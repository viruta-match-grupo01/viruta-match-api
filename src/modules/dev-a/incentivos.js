import {Router} from 'express';
import {requireRole} from '../../shared/http.js';
import {redondearImporte} from './precios/importes.js';

/** Listener síncrono: comparte la transacción del retiro. No calcula puntos de clientes. */
export function createIncentivos({db,bus,clock}) {
  function generate({reservaId}) {
    const sale=db.prepare(`SELECT r.id,r.cargado_por,p.monto FROM reserva v JOIN retazo r ON r.id=v.retazo_id
      JOIN pago p ON p.reserva_id=v.id AND p.estado='aprobado' WHERE v.id=? AND v.estado='concretada' ORDER BY p.id LIMIT 1`).get(reservaId);
    if(!sale)return;
    const qc=db.prepare("SELECT encargado_id FROM control_calidad WHERE retazo_id=? AND resultado='aprobado' ORDER BY id DESC LIMIT 1").get(sale.id);
    for(const [user,role,percent] of [[sale.cargado_por,'operario',15],[qc?.encargado_id,'encargado',10]]) {
      if(user)db.prepare('INSERT INTO incentivo(usuario_id,retazo_id,rol,porcentaje,monto,generado_en) VALUES(?,?,?,?,?,?) ON CONFLICT(retazo_id,rol) DO NOTHING')
        .run(user,sale.id,role,percent,redondearImporte(sale.monto*percent/100),clock().toISOString());
    }
  }
  bus.on('retiro.concretado',generate);
  return {dispose(){bus.off('retiro.concretado',generate);}};
}
export function createIncentivosRouter({db}) {
  const router=Router();
  router.get('/',requireRole('operario','encargado'),(req,res)=>res.json(db.prepare('SELECT id,retazo_id,rol,porcentaje,monto,generado_en FROM incentivo WHERE usuario_id=? ORDER BY id DESC').all(req.user.id)));
  return router;
}
