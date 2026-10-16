export function createReportesRepository(db){
 return {
  byBranch:()=>db.prepare('SELECT * FROM reporte_b_sucursal ORDER BY id').all(),
  queue:()=>db.prepare('SELECT estado,COUNT(*) cantidad FROM aviso GROUP BY estado').all(),
  failures:()=>db.prepare("SELECT a.id,a.retazo_id,p.cliente_id,a.error_codigo,a.intentos FROM aviso a JOIN pedido p ON p.id=a.pedido_id WHERE a.estado='fallido' ORDER BY a.id").all().map(a=>({...a,envios:db.prepare('SELECT canal,estado,error_codigo,provider_id,iniciado_en,terminado_en FROM aviso_envio WHERE aviso_id=? ORDER BY id').all(a.id)}))
 };
}
