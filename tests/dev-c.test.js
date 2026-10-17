import {it,expect,afterEach} from 'vitest';
import request from 'supertest';
import {openDatabase,createBaseSchema,migrateDevB} from '../src/database.js';
import {seedDemo} from '../src/seed.js';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/config.js';
const clean=[];afterEach(()=>{while(clean.length)clean.pop()();});
const T0=new Date('2026-10-16T13:00:00Z'); // 10:00 en Buenos Aires
function setup(){
  const db=openDatabase();createBaseSchema(db);migrateDevB(db);seedDemo(db,T0);
  const time={now:T0};
  const runtime=createApp({db,config:readConfig({JWT_SECRET:'test-integration-secret-01234567890123456789',ALLOW_DEMO:'false'}),clock:()=>time.now});
  clean.push(()=>{runtime.dispose();db.close();});
  const events=[];for(const e of ['reserva.vencida','reserva.cancelada','retiro.concretado'])runtime.context.bus.on(e,p=>events.push([e,p]));
  return {...runtime,db,time,events};
}
async function login(app,id){const agent=request.agent(app);await agent.post('/api/auth/login').send({email:`usuario${id}@example.invalid`,password:'demo-local'});return agent;}
/** Pedido del cliente que coincide con el retazo 1 (MDF 18, 40×66, sucursal 1) y aviso ya enviado. */
async function offer(f,cliente=1,pedido={material:'MDF',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,sucursal_preferida_id:1}){
  f.b.pedidos.create(cliente,pedido);await f.tick();
  return f.db.prepare("SELECT * FROM aviso WHERE pedido_id=(SELECT MAX(id) FROM pedido WHERE cliente_id=?) ORDER BY id DESC").get(cliente);
}
const count=(f,sql,...a)=>f.db.prepare(sql).get(...a).n;

it('confirmar crea la reserva a 12 h de atención, confirma el aviso, reserva el retazo y no cobra',async()=>{
  const f=setup();const aviso=await offer(f);expect(aviso.estado).toBe('enviado');
  const agent=await login(f.app,1);
  const r=await agent.post('/api/reservas').send({aviso_id:aviso.id});
  expect(r.status).toBe(201);expect(r.body).toMatchObject({estado:'activa',retazo_id:aviso.retazo_id,pago_estado:'pendiente',vence_en:'2026-10-17T13:00:00.000Z'});
  expect(f.db.prepare('SELECT estado FROM aviso WHERE id=?').get(aviso.id).estado).toBe('confirmado');
  expect(f.db.prepare('SELECT estado FROM retazo WHERE id=?').get(aviso.retazo_id).estado).toBe('reservado');
  expect(count(f,'SELECT COUNT(*) n FROM pago')).toBe(0);
  expect((await agent.post('/api/reservas').send({aviso_id:aviso.id})).status).toBe(409);
  expect((await agent.get('/api/reservas')).body).toHaveLength(1);
});
it('rechaza ajeno, inválido, rol incorrecto y aviso vencido sin dejar reserva',async()=>{
  const f=setup();const aviso=await offer(f);
  expect((await (await login(f.app,2)).post('/api/reservas').send({aviso_id:aviso.id})).status).toBe(404);
  const agent=await login(f.app,1);
  expect((await agent.post('/api/reservas').send({aviso_id:'1'})).status).toBe(400);
  expect((await agent.post('/api/reservas').send({aviso_id:aviso.id,cliente_id:2})).status).toBe(400);
  expect((await (await login(f.app,5)).post('/api/reservas').send({aviso_id:aviso.id})).status).toBe(403);
  f.time.now=new Date(T0.getTime()+3*3600000);
  const late=await agent.post('/api/reservas').send({aviso_id:aviso.id});
  expect(late.status).toBe(409);expect(late.body.error).toBe('AVISO_VENCIDO');
  expect(count(f,'SELECT COUNT(*) n FROM reserva')).toBe(0);
});
it('un cliente no tiene dos reservas activas y un retazo reservado no se reserva de nuevo',async()=>{
  const f=setup();const last=await offer(f,1);
  const other=f.db.prepare("SELECT * FROM aviso WHERE pedido_id=? AND id<>?").get(last.pedido_id,last.id);
  const agent1=await login(f.app,1);
  expect((await agent1.post('/api/reservas').send({aviso_id:last.id})).status).toBe(201);
  const second=await agent1.post('/api/reservas').send({aviso_id:other.id});
  expect(second.status).toBe(409);expect(second.body.error).toBe('RESERVA_ACTIVA_EXISTENTE');
  // Aviso inconsistente de Ana sobre el retazo ya reservado: se rechaza sin tocar nada.
  f.b.pedidos.create(2,{material:'MDF',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,sucursal_preferida_id:1});
  const pedidoAna=f.db.prepare('SELECT id FROM pedido WHERE cliente_id=2').get().id;
  const id=Number(f.db.prepare("INSERT INTO aviso(retazo_id,pedido_id,tipo,canal,estado,programado_para,enviado_en,vence_confirmacion_en,creado_en) VALUES(?,?,'coincidencia','correo','enviado',?,?,?,?)")
    .run(last.retazo_id,pedidoAna,T0.toISOString(),T0.toISOString(),new Date(T0.getTime()+7200000).toISOString(),T0.toISOString()).lastInsertRowid);
  const r=await (await login(f.app,2)).post('/api/reservas').send({aviso_id:id});
  expect(r.status).toBe(409);expect(r.body.error).toBe('RETAZO_NO_DISPONIBLE');
  expect(count(f,"SELECT COUNT(*) n FROM reserva WHERE estado='activa'")).toBe(1);
});
it('vence sin esperar al cron: libera retazo, emite el evento y permite reasignar',async()=>{
  const f=setup();const aviso=await offer(f);const agent=await login(f.app,1);
  const {body}=await agent.post('/api/reservas').send({aviso_id:aviso.id});
  f.time.now=new Date(body.vence_en);
  const read=await agent.get(`/api/reservas/${body.id}`);
  expect(read.body.estado).toBe('vencida');
  expect(f.db.prepare('SELECT estado FROM retazo WHERE id=?').get(aviso.retazo_id).estado).not.toBe('reservado');
  expect(f.events.filter(([e])=>e==='reserva.vencida')).toEqual([['reserva.vencida',{retazoId:aviso.retazo_id,reservaId:body.id}]]);
  await agent.get('/api/reservas');expect(f.events).toHaveLength(1); // idempotente
});
it('el tick de C vence reservas antes de B',async()=>{
  const f=setup();const aviso=await offer(f);const agent=await login(f.app,1);
  const {body}=await agent.post('/api/reservas').send({aviso_id:aviso.id});
  f.time.now=new Date(new Date(body.vence_en).getTime()+1000);await f.tick();
  expect(f.db.prepare('SELECT estado FROM reserva WHERE id=?').get(body.id).estado).toBe('vencida');
});
it('cancelar libera el retazo y emite reserva.cancelada; no se cancela una ajena ni con pago',async()=>{
  const f=setup();const aviso=await offer(f);const agent=await login(f.app,1);
  const {body}=await agent.post('/api/reservas').send({aviso_id:aviso.id});
  expect((await (await login(f.app,2)).delete(`/api/reservas/${body.id}`).send({})).status).toBe(404);
  const manager=await login(f.app,5);
  expect((await manager.post('/api/pagos').send({reserva_id:body.id,medio:'efectivo',comprobante:'R-1'})).status).toBe(201);
  expect((await agent.delete(`/api/reservas/${body.id}`).send({})).body.error).toBe('PAGO_REGISTRADO');
  f.db.prepare('DELETE FROM pago').run();
  const del=await agent.delete(`/api/reservas/${body.id}`).send({});
  expect(del.body.estado).toBe('cancelada');expect(f.events.some(([e])=>e==='reserva.cancelada')).toBe(true);
});
it('el retiro exige pago aprobado, es del encargado de la sucursal y emite una sola vez',async()=>{
  const f=setup();const aviso=await offer(f);const client=await login(f.app,1);
  const {body}=await client.post('/api/reservas').send({aviso_id:aviso.id});
  const manager=await login(f.app,5);const price=f.db.prepare('SELECT precio FROM retazo WHERE id=?').get(aviso.retazo_id).precio;
  expect((await client.post('/api/pagos').send({reserva_id:body.id,medio:'efectivo',comprobante:'x'})).status).toBe(403);
  expect((await manager.get('/api/retiros')).body.map(r=>r.id)).toEqual([body.id]);
  const early=await manager.post(`/api/retiros/${body.id}/concretar`).send({});
  expect(early.status).toBe(409);expect(early.body.error).toBe('PAGO_REQUERIDO');
  expect((await manager.post('/api/pagos').send({reserva_id:body.id,medio:'transferencia',comprobante:'  '})).status).toBe(400);
  expect((await manager.post('/api/pagos').send({reserva_id:body.id,medio:'mercadopago',comprobante:'x'})).status).toBe(400);
  expect((await manager.post('/api/pagos').send({reserva_id:body.id,medio:'efectivo',comprobante:'x',monto:1})).body.error).toBe('MONTO_INCORRECTO');
  const pay=await manager.post('/api/pagos').send({reserva_id:body.id,medio:'efectivo',comprobante:'R-77',monto:price});
  expect(pay.body).toBeTruthy();expect(pay.status,JSON.stringify(pay.body)).toBe(201);expect(pay.body).toMatchObject({estado:'aprobado',monto:price,medio:'efectivo'});
  expect((await manager.post('/api/pagos').send({reserva_id:body.id,medio:'efectivo',comprobante:'R-78'})).body.error).toBe('PAGO_YA_REGISTRADO');
  const done=await manager.post(`/api/retiros/${body.id}/concretar`).send({});
  expect(done.status).toBe(200);expect(done.body).toMatchObject({estado:'concretada',ya_concretado:false});
  expect((await manager.post(`/api/retiros/${body.id}/concretar`).send({})).body.ya_concretado).toBe(true);
  expect(f.events.filter(([e])=>e==='retiro.concretado')).toEqual([['retiro.concretado',{reservaId:body.id,retazoId:aviso.retazo_id,clienteId:1}]]);
  expect(f.db.prepare('SELECT estado FROM retazo WHERE id=?').get(aviso.retazo_id).estado).toBe('retirado');
  expect(f.db.prepare('SELECT estado FROM pedido WHERE id=?').get(aviso.pedido_id).estado).toBe('cumplido');
});
it('otra sucursal no puede cobrar ni retirar; una reserva vencida no admite pago',async()=>{
  const f=setup();const aviso=await offer(f);const client=await login(f.app,1);
  const {body}=await client.post('/api/reservas').send({aviso_id:aviso.id});
  f.db.prepare('UPDATE usuario SET sucursal_id=2 WHERE id=5').run();
  const other=await login(f.app,5);
  expect((await other.post('/api/pagos').send({reserva_id:body.id,medio:'efectivo',comprobante:'x'})).status).toBe(403);
  expect((await other.get(`/api/retiros/${body.id}`)).status).toBe(403);
  f.db.prepare('UPDATE usuario SET sucursal_id=1 WHERE id=5').run();
  f.time.now=new Date(body.vence_en);const manager=await login(f.app,5);
  const late=await manager.post('/api/pagos').send({reserva_id:body.id,medio:'efectivo',comprobante:'x'});
  expect(late.status).toBe(409);expect(late.body.error).toBe('RESERVA_VENCIDA');expect(count(f,'SELECT COUNT(*) n FROM pago')).toBe(0);
});
