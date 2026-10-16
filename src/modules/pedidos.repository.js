export function createPedidosRepository(db) {
  return {
    get:id=>db.prepare('SELECT * FROM pedido WHERE id=?').get(id),
    list:cliente=>db.prepare('SELECT * FROM pedido WHERE cliente_id=? ORDER BY creado_en DESC,id DESC').all(cliente),
    count:cliente=>db.prepare("SELECT COUNT(*) n FROM pedido WHERE cliente_id=? AND estado='abierto'").get(cliente).n,
    insert(v) {return Number(db.prepare(`INSERT INTO pedido(cliente_id,material,espesor_mm,alto_min_cm,ancho_min_cm,color,acabado,tolerancia_pct,sucursal_preferida_id,estado,creado_en,vence_en) VALUES (@cliente_id,@material,@espesor_mm,@alto_min_cm,@ancho_min_cm,@color,@acabado,@tolerancia_pct,@sucursal_preferida_id,'abierto',@creado_en,@vence_en)`).run(v).lastInsertRowid);},
    cancel(id){db.prepare("UPDATE pedido SET estado='cancelado' WHERE id=?").run(id);},
    renew(id,vence){db.prepare("UPDATE pedido SET ciclo=ciclo+CASE WHEN estado='abierto' THEN 0 ELSE 1 END,estado='abierto',vence_en=? WHERE id=?").run(vence,id);}
  };
}
