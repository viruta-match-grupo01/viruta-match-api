/** SQL parametrizado de retazos. La última decisión de calidad se une para mostrar el motivo al operario. */
const SELECT=`SELECT r.*,s.nombre sucursal_nombre,s.direccion sucursal_direccion,u.nombre cargado_por_nombre,
  c.resultado control_resultado,c.motivo control_motivo,c.realizado_en control_realizado_en
  FROM retazo r JOIN sucursal s ON s.id=r.sucursal_id LEFT JOIN usuario u ON u.id=r.cargado_por
  LEFT JOIN control_calidad c ON c.id=(SELECT MAX(id) FROM control_calidad WHERE retazo_id=r.id)`;

export function createRetazosRepository(db) {
  return {
    insert(v) {
      return Number(db.prepare(`INSERT INTO retazo(material,espesor_mm,alto_cm,ancho_cm,color,acabado,foto_url,sucursal_id,forma_retiro,precio,estado,cargado_por,cargado_en)
        VALUES(@material,@espesor_mm,@alto_cm,@ancho_cm,@color,@acabado,@foto_url,@sucursal_id,@forma_retiro,@precio,@estado,@cargado_por,@cargado_en)`).run(v).lastInsertRowid);
    },
    get:id=>db.prepare(`${SELECT} WHERE r.id=?`).get(id),
    /** Solo las cargas del propio operario. */
    listByLoader:usuario=>db.prepare(`${SELECT} WHERE r.cargado_por=? ORDER BY r.cargado_en DESC,r.id DESC`).all(usuario),
    /** Pendientes de control de una sucursal, los más antiguos primero. */
    pendingByBranch:sucursal=>db.prepare(`${SELECT} WHERE r.sucursal_id=? AND r.estado='pendiente_control' ORDER BY r.cargado_en,r.id`).all(sucursal),
    /** Cambio condicional: devuelve true solo si el retazo seguía pendiente (evita doble decisión). */
    transitionFromPending:(id,estado)=>db.prepare("UPDATE retazo SET estado=? WHERE id=? AND estado='pendiente_control'").run(estado,id).changes===1,
    insertControl:v=>Number(db.prepare('INSERT INTO control_calidad(retazo_id,encargado_id,resultado,motivo,realizado_en) VALUES(@retazo_id,@encargado_id,@resultado,@motivo,@realizado_en)').run(v).lastInsertRowid)
  };
}
