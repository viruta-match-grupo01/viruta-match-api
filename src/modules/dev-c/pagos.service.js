import {z} from 'zod';
import {fail} from '../../errors.js';
import {requireBranch} from '../../shared/http.js';
import {roundMoney} from './money.js';
import {publicReserva} from './reservas.service.js';

const pagoSchema=z.object({
  reserva_id:z.number().int().positive(),
  medio:z.enum(['efectivo','transferencia']),
  comprobante:z.string().trim().min(1).max(200),
  monto:z.number().finite().nonnegative().optional()
}).strict();

/** Pago manual (efectivo/transferencia) y cierre del retiro, a cargo del encargado de la sucursal. MercadoPago queda fuera. */
export function createPagosService({db,bus,clock,reservas}) {
  const approved=db.prepare("SELECT id FROM pago WHERE reserva_id=? AND estado='aprobado'");

  function branchReservation(user,id) {
    const v=reservas.byId.get(id);
    if(!v) fail(404,'RESERVA_NO_ENCONTRADA','Reserva no encontrada');
    requireBranch(user,v.sucursal_id);
    return v;
  }
  function requireActive(v) {
    if(v.estado==='vencida') fail(409,'RESERVA_VENCIDA','La reserva venció; el retazo volvió a estar disponible');
    if(v.estado!=='activa') fail(409,'RESERVA_NO_ACTIVA',`La reserva está ${v.estado}`);
  }
  function detail(v) {
    const c=db.prepare('SELECT nombre FROM usuario WHERE id=?').get(v.cliente_id);
    return {...publicReserva(v),cliente_id:v.cliente_id,cliente_nombre:c?.nombre??null,monto_a_pagar:roundMoney(v.precio)};
  }

  function listBranch(user) {
    reservas.expireDue();
    return db.prepare("SELECT v.id FROM reserva v JOIN retazo r ON r.id=v.retazo_id WHERE v.estado='activa' AND r.sucursal_id=? ORDER BY v.vence_en,v.id").all(user.sucursal_id)
      .map(row=>detail(reservas.byId.get(row.id)));
  }
  function get(user,id) {reservas.expireDue();return detail(branchReservation(user,id));}

  function registerPayment(user,input) {
    const parsed=pagoSchema.safeParse(input);
    if(!parsed.success) fail(400,'DATOS_INVALIDOS',parsed.error.issues.map(x=>`${x.path.join('.')||'cuerpo'}: ${x.message}`).join('; '));
    const p=parsed.data;
    reservas.expireDue();
    return db.transaction(()=>{
      const v=branchReservation(user,p.reserva_id);requireActive(v);
      if(approved.get(v.id)) fail(409,'PAGO_YA_REGISTRADO','La reserva ya tiene un pago aprobado');
      const expected=roundMoney(v.precio);
      if(p.monto!==undefined&&roundMoney(p.monto)!==expected) fail(400,'MONTO_INCORRECTO',`El importe debe ser ARS ${expected.toFixed(2)}`);
      const id=Number(db.prepare("INSERT INTO pago(reserva_id,medio,monto,estado,comprobante,registrado_por,registrado_en) VALUES(?,?,?,'aprobado',?,?,?)")
        .run(v.id,p.medio,expected,p.comprobante,user.id,clock().toISOString()).lastInsertRowid);
      return db.prepare('SELECT id,reserva_id,medio,monto,estado,comprobante,registrado_en FROM pago WHERE id=?').get(id);
    }).immediate();
  }

  /** Idempotente: repetir sobre una reserva concretada devuelve su estado sin volver a emitir el evento. */
  function completePickup(user,id) {
    reservas.expireDue();
    return db.transaction(()=>{
      const v=branchReservation(user,id);
      if(v.estado==='concretada') return {...detail(v),ya_concretado:true};
      requireActive(v);
      if(!approved.get(v.id)) fail(409,'PAGO_REQUERIDO','Registrá un pago aprobado antes del retiro');
      const done=db.prepare("UPDATE reserva SET estado='concretada' WHERE id=? AND estado='activa'").run(v.id);
      if(done.changes!==1) fail(409,'RESERVA_NO_ACTIVA','La reserva cambió de estado');
      db.prepare("UPDATE retazo SET estado='retirado' WHERE id=? AND estado='reservado'").run(v.retazo_id);
      if(v.pedido_id) db.prepare("UPDATE pedido SET estado='cumplido' WHERE id=? AND estado='abierto'").run(v.pedido_id);
      bus.emit('retiro.concretado',{reservaId:v.id,retazoId:v.retazo_id,clienteId:v.cliente_id});
      return {...detail(reservas.byId.get(v.id)),ya_concretado:false};
    }).immediate();
  }

  return {listBranch,get,registerPayment,completePickup};
}
