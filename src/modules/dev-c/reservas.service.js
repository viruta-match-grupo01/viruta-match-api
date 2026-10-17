import {z} from 'zod';
import {fail} from '../../errors.js';

const createSchema=z.object({aviso_id:z.number().int().positive()}).strict();
const SELECT=`SELECT v.id,v.aviso_id,v.pedido_id,v.cliente_id,v.retazo_id,v.estado,v.confirmada_en,v.vence_en,
  r.material,r.espesor_mm,r.alto_cm,r.ancho_cm,r.color,r.acabado,r.foto_url,r.precio,r.forma_retiro,r.sucursal_id,
  s.nombre sucursal_nombre,s.direccion sucursal_direccion,
  (SELECT p.estado FROM pago p WHERE p.reserva_id=v.id ORDER BY (p.estado='aprobado') DESC,p.id DESC LIMIT 1) pago_estado
  FROM reserva v JOIN retazo r ON r.id=v.retazo_id JOIN sucursal s ON s.id=r.sucursal_id`;

export function publicReserva(v) {
  return {id:v.id,aviso_id:v.aviso_id,pedido_id:v.pedido_id,retazo_id:v.retazo_id,estado:v.estado,confirmada_en:v.confirmada_en,vence_en:v.vence_en,
    material:v.material,espesor_mm:v.espesor_mm,alto_cm:v.alto_cm,ancho_cm:v.ancho_cm,color:v.color,acabado:v.acabado,foto_url:v.foto_url,
    precio:v.precio,forma_retiro:v.forma_retiro,sucursal_id:v.sucursal_id,sucursal_nombre:v.sucursal_nombre,sucursal_direccion:v.sucursal_direccion,
    pago_estado:v.pago_estado??'pendiente',plazo_retiro:'12 horas de atención (08:00–20:00) desde la confirmación; el pago se realiza al retirar'};
}

export function createReservasService({db,bus,clock,calendar}) {
  const byId=db.prepare(`${SELECT} WHERE v.id=?`);

  /** Vence reservas activas cuyo plazo pasó. Idempotente; el cron y cada operación de C lo llaman antes de leer. */
  function expireDue() {
    const run=()=>{
      const due=db.prepare("SELECT id,retazo_id FROM reserva WHERE estado='activa' AND vence_en<=?").all(clock().toISOString());
      for(const r of due) {
        db.prepare("UPDATE reserva SET estado='vencida' WHERE id=? AND estado='activa'").run(r.id);
        db.prepare("UPDATE retazo SET estado='disponible' WHERE id=? AND estado='reservado'").run(r.retazo_id);
        bus.emit('reserva.vencida',{retazoId:r.retazo_id,reservaId:r.id});
      }
      return due.length;
    };
    return db.inTransaction?run():db.transaction(run).immediate();
  }

  function create(user,input) {
    const parsed=createSchema.safeParse(input);
    if(!parsed.success) fail(400,'DATOS_INVALIDOS','aviso_id debe ser un entero positivo');
    expireDue();
    try {
      const id=db.transaction(()=>{
        const now=clock().toISOString();
        const a=db.prepare(`SELECT a.id,a.estado,a.retazo_id,a.pedido_id,a.vence_confirmacion_en,p.cliente_id,p.estado pedido_estado,p.vence_en pedido_vence_en,r.estado retazo_estado
          FROM aviso a JOIN pedido p ON p.id=a.pedido_id JOIN retazo r ON r.id=a.retazo_id WHERE a.id=?`).get(parsed.data.aviso_id);
        if(!a||a.cliente_id!==user.id) fail(404,'AVISO_NO_ENCONTRADO','Aviso no encontrado');
        if(a.estado==='confirmado') fail(409,'AVISO_YA_CONFIRMADO','Este aviso ya fue confirmado');
        if(a.estado!=='enviado') fail(409,'AVISO_NO_VIGENTE','El aviso ya no está vigente');
        if(!a.vence_confirmacion_en||a.vence_confirmacion_en<=now) fail(409,'AVISO_VENCIDO','Venció el plazo para confirmar el aviso');
        if(a.pedido_estado!=='abierto'||a.pedido_vence_en<=now) fail(409,'PEDIDO_NO_VIGENTE','El pedido ya no está abierto');
        if(a.retazo_estado!=='disponible') fail(409,'RETAZO_NO_DISPONIBLE','El retazo ya no está disponible');
        if(db.prepare("SELECT id FROM reserva WHERE cliente_id=? AND estado='activa'").get(user.id)) fail(409,'RESERVA_ACTIVA_EXISTENTE','Ya tenés una reserva activa');
        const reservaId=Number(db.prepare("INSERT INTO reserva(aviso_id,pedido_id,cliente_id,retazo_id,estado,confirmada_en,vence_en) VALUES(?,?,?,?,'activa',?,?)")
          .run(a.id,a.pedido_id,user.id,a.retazo_id,now,calendar.addHours(clock(),12).toISOString()).lastInsertRowid);
        const notice=db.prepare("UPDATE aviso SET estado='confirmado',claim_token=NULL,claim_until=NULL WHERE id=? AND estado='enviado'").run(a.id);
        const piece=db.prepare("UPDATE retazo SET estado='reservado' WHERE id=? AND estado='disponible'").run(a.retazo_id);
        if(notice.changes!==1||piece.changes!==1) fail(409,'RESERVA_CONFLICTO','El retazo o el aviso cambiaron; intentá de nuevo');
        return reservaId;
      }).immediate();
      return publicReserva(byId.get(id));
    } catch(error) {
      if(String(error.code).startsWith('SQLITE_CONSTRAINT')) fail(409,'RESERVA_CONFLICTO','El retazo ya fue reservado o ya tenés una reserva activa');
      throw error;
    }
  }

  function list(user) {expireDue();return db.prepare(`${SELECT} WHERE v.cliente_id=? ORDER BY v.id DESC`).all(user.id).map(publicReserva);}
  function get(id,user) {expireDue();const v=byId.get(id);if(!v||v.cliente_id!==user.id) fail(404,'RESERVA_NO_ENCONTRADA','Reserva no encontrada');return publicReserva(v);}

  function cancel(id,user) {
    expireDue();
    db.transaction(()=>{
      const v=byId.get(id);
      if(!v||v.cliente_id!==user.id) fail(404,'RESERVA_NO_ENCONTRADA','Reserva no encontrada');
      if(v.estado!=='activa') fail(409,'RESERVA_NO_ACTIVA',`La reserva está ${v.estado}`);
      if(db.prepare("SELECT id FROM pago WHERE reserva_id=? AND estado='aprobado'").get(id)) fail(409,'PAGO_REGISTRADO','La reserva tiene un pago registrado; consultá en la sucursal');
      db.prepare("UPDATE reserva SET estado='cancelada' WHERE id=? AND estado='activa'").run(id);
      db.prepare("UPDATE retazo SET estado='disponible' WHERE id=? AND estado='reservado'").run(v.retazo_id);
      bus.emit('reserva.cancelada',{retazoId:v.retazo_id,reservaId:id});
    }).immediate();
    return publicReserva(byId.get(id));
  }

  return {expireDue,create,list,get,cancel,byId};
}
