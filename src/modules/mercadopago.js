import {fail} from '../errors.js';

/** Integración opcional Checkout Pro (Preferences API). Nunca considera un redirect como pago aprobado. */
export function createMercadoPago({db,clock,config,fetcher=fetch}){
 const token=config?.mercadoPago?.accessToken??'';
 const sandbox=config?.mercadoPago?.sandbox!==false;
 const base='https://api.mercadopago.com';
 function enabled(){
   if(!token)fail(503,'MP_NO_CONFIGURADO','MercadoPago no está configurado; el pago manual sigue disponible');
   if(sandbox&&!token.startsWith('TEST-'))fail(503,'MP_REQUIERE_TEST','Para esta demo usá exclusivamente credenciales TEST de MercadoPago');
 }
 async function call(path,method='GET',body){
   enabled();let response;
   try{response=await fetcher(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(method==='POST'?{'X-Idempotency-Key':`vm-preferencia-${body?.external_reference??Date.now()}`}: {})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});}
   catch{fail(502,'MP_SIN_CONEXION','No se pudo consultar MercadoPago; reintentá más tarde');}
   const data=await response.json().catch(()=>({}));
   if(!response.ok)fail(502,'MP_RESPUESTA_ERROR',`MercadoPago rechazó la solicitud (HTTP ${response.status})`);
   return data;
 }
 const owner=db.prepare('SELECT v.*,r.material,r.espesor_mm,r.precio FROM reserva v JOIN retazo r ON r.id=v.retazo_id WHERE v.id=?');
 const existing=db.prepare("SELECT * FROM pago WHERE reserva_id=? AND medio='mercadopago' ORDER BY id DESC LIMIT 1");
 const approved=db.prepare("SELECT id FROM pago WHERE reserva_id=? AND estado='aprobado'");
 function ownActive(user,id){
   const v=owner.get(id);
   if(!v||v.cliente_id!==user.id)fail(404,'RESERVA_NO_ENCONTRADA','Reserva no encontrada');
   if(v.estado!=='activa'||v.vence_en<=clock().toISOString())fail(409,'RESERVA_NO_ACTIVA','La reserva no está activa o ya venció');
   return v;
 }
 function externalReference(id){return `VIRUTA-${sandbox?'TEST':'LIVE'}-RESERVA-${id}`;}
 async function createPreference(user,id){
   const v=ownActive(user,id);if(approved.get(id))fail(409,'PAGO_YA_APROBADO','La reserva ya está pagada');
   const previous=existing.get(id);
   if(previous?.estado==='pendiente'&&previous.mp_link)return {url:previous.mp_link,estado:'pendiente',reserva_id:id,modo:'prueba'};
   const amount=Math.round(v.precio*100)/100;
   if(!(amount>0))fail(409,'PRECIO_INVALIDO','El importe del retazo debe ser positivo para MercadoPago');
   const url=config.mercadoPago.publicAppUrl.replace(/\/$/,'')+'/reservas';
   const payload={items:[{id:`retazo-${v.retazo_id}`,title:`Retazo Viruta Match #${v.retazo_id}`,currency_id:'ARS',quantity:1,unit_price:amount}],external_reference:externalReference(id),back_urls:{success:url,pending:url,failure:url},auto_return:'approved',metadata:{reserva_id:id}};
   const result=await call('/checkout/preferences','POST',payload);
   const link=sandbox?result.sandbox_init_point:result.init_point;
   if(typeof link!=='string'||!/^https:\/\/(sandbox\.|www\.)?mercadopago\.com\//.test(link))fail(502,'MP_LINK_INVALIDO','MercadoPago no devolvió un enlace de pago válido');
   db.transaction(()=>{
     if(approved.get(id))fail(409,'PAGO_YA_APROBADO','La reserva ya está pagada');
     const prev=existing.get(id);
     if(prev?.estado==='pendiente')db.prepare('UPDATE pago SET mp_link=? WHERE id=?').run(link,prev.id);
     else db.prepare("INSERT INTO pago(reserva_id,medio,monto,estado,mp_link,registrado_en) VALUES(?,'mercadopago',?,'pendiente',?,?)").run(id,amount,link,clock().toISOString());
   })();
   return {url:link,estado:'pendiente',reserva_id:id,modo:sandbox?'prueba':'real'};
 }
 async function verify(user,reservaId,paymentId){
   const v=ownActive(user,reservaId);
   if(!/^\d{1,30}$/.test(String(paymentId)))fail(400,'MP_PAGO_ID_INVALIDO','Indicá un identificador numérico de pago');
   const pay=await call(`/v1/payments/${paymentId}`);
   if(String(pay.external_reference)!==externalReference(reservaId)||pay.currency_id!=='ARS'||!Number.isFinite(Number(pay.transaction_amount))||!Number.isFinite(Number(v.precio))||Math.abs(Number(pay.transaction_amount)-Number(v.precio))>0.009)
     fail(409,'MP_PAGO_NO_COINCIDE','El pago consultado no corresponde a esta reserva e importe');
   if(pay.status!=='approved')return {reserva_id:reservaId,estado:'pendiente',estado_proveedor:String(pay.status??'desconocido')};
   db.transaction(()=>{
     if(approved.get(reservaId))return;
     if(db.prepare('SELECT id FROM pago WHERE mp_pago_id=? AND reserva_id<>?').get(String(paymentId),reservaId))fail(409,'MP_PAGO_YA_USADO','El pago ya está asociado a otra reserva');
     const previous=existing.get(reservaId);
     if(previous?.estado==='pendiente')db.prepare("UPDATE pago SET estado='aprobado',mp_pago_id=?,registrado_en=? WHERE id=? AND estado='pendiente'").run(String(paymentId),clock().toISOString(),previous.id);
     else db.prepare("INSERT INTO pago(reserva_id,medio,monto,estado,mp_pago_id,registrado_en) VALUES(?,'mercadopago',?,'aprobado',?,?)").run(reservaId,v.precio,String(paymentId),clock().toISOString());
   })();
   return {reserva_id:reservaId,estado:'aprobado',pago_id:String(paymentId),modo:sandbox?'prueba':'real'};
 }
 return {createPreference,verify};
}
