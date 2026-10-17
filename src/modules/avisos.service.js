import {randomUUID} from 'node:crypto';
import {createAvisosRepository} from './avisos.repository.js';
import {fail} from '../errors.js';

function publicNotice(a) {
  return {id:a.id,pedido_id:a.pedido_id,retazo_id:a.retazo_id,tipo:a.tipo,estado:a.estado,canal:a.canal,
    programado_para:a.programado_para,enviado_en:a.enviado_en,vence_confirmacion_en:a.vence_confirmacion_en,
    material:a.material,espesor_mm:a.espesor_mm,alto_cm:a.alto_cm,ancho_cm:a.ancho_cm,color:a.color,acabado:a.acabado,
    foto_url:a.foto_url,sucursal_nombre:a.sucursal_nombre,sucursal_direccion:a.sucursal_direccion,
    precio:a.precio,forma_retiro:a.forma_retiro,plazo_confirmacion:'2 horas de atención (08:00–20:00)',plazo_retiro:'1 día hábil: 12 horas de atención desde la confirmación',
    puede_confirmar:a.estado==='enviado'&&a.retazo_estado==='disponible'&&a.pedido_estado==='abierto'};
}
export function createAvisosService({db,clock,calendar,matching,channels,publicAppUrl='http://localhost:5173'}) {
  const repo=createAvisosRepository(db);let running=false;
  function valid(a,now) {return a&&a.retazo_estado==='disponible'&&a.pedido_estado==='abierto'&&a.pedido_vence_en>now&&a.usuario_estado==='activo';}
  function list(cliente) {matching.expireOrders();matching.expireNotices();matching.scan();return repo.list(cliente).map(publicNotice);}
  function get(id,cliente){matching.expireOrders();matching.expireNotices();const a=repo.get(id);if(!a||a.cliente_id!==cliente) fail(404,'AVISO_NO_ENCONTRADO','Aviso no encontrado');return publicNotice(a);}
  function message(a) {
    const url=new URL(`/avisos/${a.id}`,publicAppUrl).toString();
    return {avisoId:a.id,email:a.email,telefono:a.telefono,subject:'Viruta Match: encontramos un retazo para tu pedido',
      text:`Hola ${a.cliente_nombre}.\n${a.material}, ${a.espesor_mm} mm; ${a.alto_cm} × ${a.ancho_cm} cm.${a.material==='melamina'?` Color: ${a.color}. Acabado: ${a.acabado}.`:''}\nFoto: ${a.foto_url}\nSucursal: ${a.sucursal_nombre}, ${a.sucursal_direccion}\nPrecio: ARS ${a.precio.toFixed(2)}. Forma de retiro: ${a.forma_retiro}.\nTenés 2 horas dentro de 08:00–20:00 para confirmar desde este aviso: ${url}\nDesde la confirmación tenés 1 día hábil (12 horas de atención) para pagar y retirar en la sucursal. No se cobra al reservar.`};
  }
  async function deliver(id,channel) {
    const existing=repo.deliveries(id).find(e=>e.canal===channel);
    if(existing?.estado==='enviado') return 'enviado';
    if(['incierto','enviando'].includes(existing?.estado)) return 'incierto';
    db.prepare(`INSERT INTO aviso_envio(aviso_id,canal,estado,iniciado_en) VALUES(?,?,'enviando',?) ON CONFLICT(aviso_id,canal) DO UPDATE SET estado='enviando',iniciado_en=excluded.iniciado_en,terminado_en=NULL,error_codigo=NULL`).run(id,channel,clock().toISOString());
    try {
      const a=repo.get(id);
      if(!valid(a,clock().toISOString())||a.estado!=='en_cola') {const e=new Error('Aviso dejó de ser elegible');e.deliveryUncertain=false;throw e;}
      const adapter=channels[channel];
      if(!adapter) {const e=new Error('Canal sin configurar');e.code='CANAL_NO_CONFIGURADO';e.deliveryUncertain=false;throw e;}
      const result=await adapter.send(message(a));
      db.prepare("UPDATE aviso_envio SET estado='enviado',terminado_en=?,provider_id=? WHERE aviso_id=? AND canal=?").run(clock().toISOString(),result?.providerId??null,id,channel);
      return 'enviado';
    } catch(e) {
      const state=e.deliveryUncertain===false?'fallido':'incierto';
      db.prepare('UPDATE aviso_envio SET estado=?,terminado_en=?,error_codigo=? WHERE aviso_id=? AND canal=?').run(state,clock().toISOString(),String(e.code??'ERROR_CANAL').slice(0,80),id,channel);
      return state;
    }
  }
  async function sendOne(id,token) {
    let a=repo.get(id);const now=clock();
    if(!valid(a,now.toISOString())) {db.prepare("UPDATE aviso SET estado='cancelado' WHERE id=? AND estado='en_cola'").run(id);return;}
    if(!calendar.isOpen(now)||repo.countDay(a.cliente_id,calendar.localDate(now))>=3) {
      const next=calendar.isOpen(now)?calendar.nextDayOpen(now):calendar.nextOpen(now);
      db.prepare('UPDATE aviso SET programado_para=? WHERE id=?').run(next.toISOString(),id);return;
    }
    db.prepare('UPDATE aviso SET claim_token=?,claim_until=?,canal=? WHERE id=?').run(token,new Date(now.getTime()+600000).toISOString(),a.medio_aviso,id);
    let ok=false,uncertain=false;
    if(a.medio_aviso!=='correo') {
      const w=await deliver(id,'whatsapp');ok=w==='enviado';uncertain=w==='incierto';
      // Correo de respaldo solo ante falla cierta. Si ambos, ambos canales se intentan.
      if(a.medio_aviso==='ambos'||w==='fallido') {const c=await deliver(id,'correo');ok=ok||c==='enviado';uncertain=uncertain||c==='incierto';}
    } else {const c=await deliver(id,'correo');ok=c==='enviado';uncertain=c==='incierto';}
    a=repo.get(id);
    if(a.estado!=='en_cola') return;
    const sent=clock();
    // Un canal aceptado alcanza para abrir el turno; intentos inciertos se conservan para revisión.
    if(ok) db.prepare("UPDATE aviso SET estado='enviado',enviado_en=?,vence_confirmacion_en=?,claim_token=NULL,claim_until=NULL,error_codigo=NULL WHERE id=? AND estado='en_cola'").run(sent.toISOString(),calendar.addHours(sent,2).toISOString(),id);
    else {
      const attempts=a.intentos+1;
      db.prepare('UPDATE aviso SET estado=?,intentos=?,error_codigo=?,programado_para=?,claim_token=NULL,claim_until=NULL WHERE id=? AND estado=\'en_cola\'').run(uncertain||attempts>=3?'fallido':'en_cola',attempts,uncertain?'ENVIO_INCIERTO':'ERROR_CANAL',calendar.nextOpen(new Date(sent.getTime()+5*60000)).toISOString(),id);
    }
  }
  async function processQueue() {
    if(running) return {busy:true};
    running=true;const token=randomUUID();let acquired=false;
    try {
      acquired=db.transaction(()=>{
        const now=clock().toISOString();const held=db.prepare('SELECT * FROM worker_b_lock WHERE id=1').get();
        if(held&&held.hasta>now) return false;
        db.prepare("UPDATE aviso_envio SET estado='incierto',error_codigo='REINICIO_DURANTE_ENVIO' WHERE estado='enviando'").run();
        db.prepare("UPDATE aviso SET estado='fallido',error_codigo='ENVIO_INCIERTO',claim_token=NULL,claim_until=NULL WHERE estado='en_cola' AND id IN (SELECT aviso_id FROM aviso_envio WHERE estado='incierto')").run();
        db.prepare('INSERT INTO worker_b_lock(id,token,hasta) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,hasta=excluded.hasta').run(token,new Date(clock().getTime()+600000).toISOString());return true;
      }).immediate();
      if(!acquired) return {busy:true};
      matching.expireOrders();matching.expireNotices();matching.scan();
      const due=repo.due(clock().toISOString());
      for(const a of due) {
        db.prepare('UPDATE worker_b_lock SET hasta=? WHERE id=1 AND token=?').run(new Date(clock().getTime()+600000).toISOString(),token);
        await sendOne(a.id,token);
      }
      return {processed:due.length};
    } finally {if(acquired) db.prepare('DELETE FROM worker_b_lock WHERE id=1 AND token=?').run(token);running=false;}
  }
  function reconcile(id,channel,delivered) {
    if(!['correo','whatsapp'].includes(channel)||typeof delivered!=='boolean') fail(400,'DATOS_INVALIDOS','Indicar canal y resultado verificado');
    db.transaction(()=>{
      const a=repo.get(id);if(!a||a.estado!=='fallido') fail(409,'AVISO_NO_RECONCILIABLE','Solo avisos fallidos requieren reconciliación');
      const e=repo.deliveries(id).find(e=>e.canal===channel);if(!e) fail(404,'ENVIO_NO_ENCONTRADO','Envío no encontrado');
      db.prepare('UPDATE aviso_envio SET estado=?,terminado_en=?,error_codigo=NULL WHERE id=?').run(delivered?'enviado':'fallido',clock().toISOString(),e.id);
      if(repo.deliveries(id).some(e=>['incierto','enviando'].includes(e.estado))) return;
      if(!valid(a,clock().toISOString())) {db.prepare("UPDATE aviso SET estado='cancelado' WHERE id=?").run(id);return;}
      if(repo.deliveries(id).some(e=>e.estado==='enviado')) {
        // Nunca regalar un nuevo plazo a un envío viejo: cuenta desde su inicio registrado.
        const start=repo.deliveries(id).find(e=>e.estado==='enviado').iniciado_en;
        db.prepare("UPDATE aviso SET estado='enviado',enviado_en=?,vence_confirmacion_en=? WHERE id=?").run(start,calendar.addHours(start,2).toISOString(),id);
      } else db.prepare("UPDATE aviso SET estado='en_cola',intentos=0,error_codigo=NULL,programado_para=? WHERE id=?").run(calendar.nextOpen(clock()).toISOString(),id);
    }).immediate();matching.expireNotices();matching.scan();
  }
  return {list,get,processQueue,reconcile};
}
