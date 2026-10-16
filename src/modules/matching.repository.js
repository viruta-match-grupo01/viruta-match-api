export function createMatchingRepository(db) {
  return {
    available:()=>db.prepare("SELECT * FROM retazo WHERE estado='disponible' ORDER BY cargado_en,id").all(),
    active:retazo=>db.prepare("SELECT id FROM aviso WHERE retazo_id=? AND estado IN ('en_cola','enviado','fallido')").get(retazo),
    candidates(r,now){return db.prepare(`SELECT p.*,pc.medio_aviso FROM pedido p
      JOIN usuario u ON u.id=p.cliente_id JOIN perfil_cliente pc ON pc.usuario_id=u.id
      WHERE p.estado='abierto' AND p.vence_en>? AND u.estado='activo'
      AND p.material=? AND p.espesor_mm=? AND p.sucursal_preferida_id=?
      AND NOT EXISTS (SELECT 1 FROM reserva v WHERE v.cliente_id=p.cliente_id AND v.estado='activa')
      AND NOT EXISTS (SELECT 1 FROM aviso a WHERE a.retazo_id=? AND a.pedido_id=p.id AND a.pedido_ciclo=p.ciclo)
      ORDER BY p.creado_en,p.id`).all(now,r.material,r.espesor_mm,r.sucursal_id,r.id);},
    enqueue(r,p,tipo,now,programado){return Number(db.prepare(`INSERT INTO aviso(retazo_id,pedido_id,tipo,canal,estado,programado_para,creado_en,pedido_ciclo) VALUES(?,?,?,?,'en_cola',?,?,?)`).run(r.id,p.id,tipo,p.medio_aviso,programado,now,p.ciclo).lastInsertRowid);}
  };
}
