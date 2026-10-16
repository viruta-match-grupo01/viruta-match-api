import {createMatchingRepository} from './matching.repository.js';

/** RF-10/11: dimensión mínima con rotación y tolerancia sobre área. */
export function matches(r,p) {
  if(r.estado!=='disponible'||r.material!==p.material||r.espesor_mm!==p.espesor_mm||r.sucursal_id!==p.sucursal_preferida_id) return false;
  if(r.alto_cm<20||r.ancho_cm<20||r.alto_cm>120||r.ancho_cm>120) return false;
  if(r.material==='melamina'&&(r.color!==p.color||r.acabado!==p.acabado)) return false;
  const dimensions=(r.alto_cm>=p.alto_min_cm&&r.ancho_cm>=p.ancho_min_cm)||(r.alto_cm>=p.ancho_min_cm&&r.ancho_cm>=p.alto_min_cm);
  const area=r.alto_cm*r.ancho_cm;
  const max=p.alto_min_cm*p.ancho_min_cm*(1+(p.tolerancia_pct??30)/100);
  return dimensions&&area<=max+1e-8;
}
export function createMatchingService({db,clock,calendar}) {
  const repo=createMatchingRepository(db);
  function expireOrders() {
    return db.transaction(()=>{
      const now=clock().toISOString();
      const n=db.prepare("UPDATE pedido SET estado='vencido' WHERE estado='abierto' AND vence_en<=?").run(now).changes;
      db.prepare(`UPDATE aviso SET estado='cancelado',claim_token=NULL,claim_until=NULL WHERE estado IN ('en_cola','enviado','fallido') AND pedido_id IN (SELECT id FROM pedido WHERE estado!='abierto' OR vence_en<=?)`).run(now);
      return n;
    }).immediate();
  }
  function scan({retazoId,tipo='coincidencia'}={}) {
    return db.transaction(()=>{
      expireOrders();const now=clock();const created=[];
      for(const r of repo.available()) {
        if(retazoId&&r.id!==retazoId) continue;
        if(repo.active(r.id)) continue;
        const p=repo.candidates(r,now.toISOString()).find(p=>matches(r,p));
        const released=db.prepare("SELECT id FROM reserva WHERE retazo_id=? AND estado IN ('vencida','cancelada') LIMIT 1").get(r.id);
        if(p) created.push(repo.enqueue(r,p,released?'liberado':tipo,now.toISOString(),calendar.nextOpen(now).toISOString()));
      }
      return created;
    }).immediate();
  }
  function expireNotices() {
    return db.transaction(()=>{
      const due=db.prepare("SELECT id,retazo_id FROM aviso WHERE estado='enviado' AND vence_confirmacion_en<=? ORDER BY id").all(clock().toISOString());
      for(const a of due) {db.prepare("UPDATE aviso SET estado='vencido' WHERE id=? AND estado='enviado'").run(a.id);scan({retazoId:a.retazo_id});}
      return due.length;
    }).immediate();
  }
  return {scan,expireOrders,expireNotices};
}
