const JOIN=`SELECT a.*,p.cliente_id,p.estado pedido_estado,p.vence_en pedido_vence_en,
  u.nombre cliente_nombre,u.email,u.telefono,u.estado usuario_estado,pc.medio_aviso,
  r.material,r.espesor_mm,r.alto_cm,r.ancho_cm,r.color,r.acabado,r.foto_url,r.sucursal_id,
  r.forma_retiro,r.precio,r.estado retazo_estado,s.nombre sucursal_nombre,s.direccion sucursal_direccion
  FROM aviso a JOIN pedido p ON p.id=a.pedido_id JOIN usuario u ON u.id=p.cliente_id
  JOIN perfil_cliente pc ON pc.usuario_id=u.id JOIN retazo r ON r.id=a.retazo_id
  JOIN sucursal s ON s.id=r.sucursal_id`;
export function createAvisosRepository(db) {
  return {
    get:id=>db.prepare(`${JOIN} WHERE a.id=?`).get(id),
    list:cliente=>db.prepare(`${JOIN} WHERE p.cliente_id=? ORDER BY a.id DESC`).all(cliente),
    due:now=>db.prepare("SELECT id FROM aviso WHERE estado='en_cola' AND programado_para<=? ORDER BY programado_para,id LIMIT 50").all(now),
    deliveries:id=>db.prepare('SELECT * FROM aviso_envio WHERE aviso_id=? ORDER BY id').all(id),
    countDay(cliente,date){return db.prepare(`SELECT COUNT(DISTINCT a.id) n FROM aviso a JOIN pedido p ON p.id=a.pedido_id JOIN aviso_envio e ON e.aviso_id=a.id
      WHERE p.cliente_id=? AND e.estado IN ('enviando','enviado','incierto') AND date(e.iniciado_en,'-3 hours')=?`).get(cliente,date).n;}
  };
}
