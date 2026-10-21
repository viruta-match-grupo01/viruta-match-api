// Casos de la matriz "Criterios de aceptación y casos de prueba v3.3" ejecutados por HTTP, igual que la UI.
import {describe,it,expect,afterEach} from 'vitest';
import request from 'supertest';
import {openDatabase,createBaseSchema,migrateDevB} from '../src/database.js';
import {seedDemo} from '../src/seed.js';
import {seedPreciosEjemplo} from '../src/modules/dev-a/seed.js';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/config.js';
import {matches} from '../src/modules/matching.service.js';
const clean=[];afterEach(()=>{while(clean.length)clean.pop()();});
function setup(){const db=openDatabase();createBaseSchema(db);migrateDevB(db);seedDemo(db);seedPreciosEjemplo(db);db.prepare("UPDATE retazo SET estado='retirado'").run();const f=createApp({db,config:readConfig({JWT_SECRET:'criterios-aceptacion-0123456789012345678'}),clock:()=>new Date('2026-10-17T13:00:00Z')});clean.push(()=>{f.dispose();db.close();});return {...f,db};}
async function login(f,id){const a=request.agent(f.app);expect((await a.post('/api/auth/login').send({email:`usuario${id}@example.invalid`,password:'demo-local'})).status).toBe(200);return a;}
const checks={humedad_ok:true,bordes_ok:true,medidas_ok:true};
const piece={material:'aglomerado',espesor_mm:18,alto_cm:40,ancho_cm:60,foto_url:'/retazo-demo.svg',forma_retiro:'Retiro presencial'};
const order={material:'aglomerado',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,sucursal_preferida_id:1};
/** Carga y aprueba un retazo, procesa la cola y devuelve los agentes de cada rol. */
async function flow(f,{approve=true}={}){
 const op=await login(f,4),enc=await login(f,5),c1=await login(f,1),c2=await login(f,2);
 expect((await c1.post('/api/pedidos').send(order)).status).toBe(201);
 expect((await c2.post('/api/pedidos').send(order)).status).toBe(201);
 const r=(await op.post('/api/retazos').send(piece)).body;
 if(approve)expect((await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks)).status).toBe(200);
 await f.tick();return {op,enc,c1,c2,r};
}
const estado=(f,id)=>f.db.prepare('SELECT estado FROM retazo WHERE id=?').get(id).estado;

describe('CP-10 y CP-11: reglas de coincidencia',()=>{
 const r={estado:'disponible',material:'aglomerado',espesor_mm:18,alto_cm:40,ancho_cm:66,color:null,acabado:null,sucursal_id:1};
 const p={material:'aglomerado',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,color:null,acabado:null,tolerancia_pct:null,sucursal_preferida_id:1};
 it('CP-10: área hasta +30 %, cada medida mayor o igual, rotación y tolerancia propia',()=>{
  expect(matches(r,p)).toBe(true);
  expect(matches({...r,alto_cm:60,ancho_cm:60},p)).toBe(false);
  expect(matches({...r,alto_cm:35,ancho_cm:70},p)).toBe(false);
  expect(matches({...r,alto_cm:60,ancho_cm:40},p)).toBe(true);
  expect(matches(r,{...p,tolerancia_pct:10})).toBe(true);
  expect(matches({...r,ancho_cm:67},{...p,tolerancia_pct:10})).toBe(false);
 });
 it('CP-11: basta un solo campo distinto para que no haya coincidencia',()=>{
  const mel={...r,material:'melamina',color:'roble',acabado:'mate'},pm={...p,material:'melamina',color:'roble',acabado:'mate'};
  expect(matches(mel,pm)).toBe(true);
  for(const change of [{material:'MDF'},{espesor_mm:15},{color:'blanco'},{acabado:'brillante'},{sucursal_id:2}])expect(matches({...mel,...change},pm)).toBe(false);
 });
 it('CP-12: solo participan retazos disponibles',()=>{for(const e of ['pendiente_control','descartado','reservado','retirado'])expect(matches({...r,estado:e},p)).toBe(false);});
});

describe('Recorrido por HTTP',()=>{
 it('CP-20 y CP-22: sin control no hay aviso; aprobado, avisa solo al pedido más antiguo',async()=>{
  const f=setup();const {enc,c1,c2,r}=await flow(f,{approve:false});
  expect((await c1.get('/api/avisos')).body).toHaveLength(0);
  await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks);await f.tick();
  expect((await c1.get('/api/avisos')).body.map(a=>a.retazo_id)).toEqual([r.id]);
  expect((await c2.get('/api/avisos')).body).toHaveLength(0);
 });
 it('CP-06: pendiente no se reserva; reservar, cancelar y retirar recorren los estados permitidos',async()=>{
  const f=setup();const {enc,c1,r}=await flow(f);
  expect(estado(f,r.id)).toBe('disponible');
  const aviso=(await c1.get('/api/avisos')).body[0];
  const v=(await c1.post('/api/reservas').send({aviso_id:aviso.id})).body;expect(estado(f,r.id)).toBe('reservado');
  expect((await c1.delete(`/api/reservas/${v.id}`).send({})).body.estado).toBe('cancelada');expect(estado(f,r.id)).toBe('disponible');
  const p=f.db.prepare("INSERT INTO retazo(material,espesor_mm,alto_cm,ancho_cm,sucursal_id,precio,estado,foto_url,forma_retiro,cargado_por,cargado_en) VALUES('MDF',18,40,60,1,100,'pendiente_control','/retazo-demo.svg','Retiro',4,?)").run(new Date().toISOString()).lastInsertRowid;
  await f.tick();expect(f.db.prepare('SELECT COUNT(*) n FROM aviso WHERE retazo_id=?').get(p).n).toBe(0);
  expect((await enc.get('/api/retiros')).body).toHaveLength(0);
 });
 it('CP-22: un cliente no puede tener dos reservas activas',async()=>{
  const f=setup();const {op,enc,c1,r}=await flow(f);
  const a1=(await c1.get('/api/avisos')).body[0];expect((await c1.post('/api/reservas').send({aviso_id:a1.id})).status).toBe(201);
  expect((await c1.post('/api/pedidos').send({...order,alto_min_cm:30})).status).toBe(201);
  const r2=(await op.post('/api/retazos').send({...piece,alto_cm:30})).body;await enc.post(`/api/calidad/${r2.id}/aprobar`).send(checks);await f.tick();
  expect((await c1.get('/api/avisos')).body.filter(a=>a.retazo_id===r2.id)).toHaveLength(0);
  expect(estado(f,r.id)).toBe('reservado');expect(estado(f,r2.id)).toBe('disponible');
 });
 it('CP-23 y CP-26: retiro solo con pago del importe exacto; incentivos 15 % y 10 %',async()=>{
  const f=setup();const {enc,c1,r}=await flow(f);
  const aviso=(await c1.get('/api/avisos')).body[0];const v=(await c1.post('/api/reservas').send({aviso_id:aviso.id})).body;
  const monto=(await enc.get(`/api/retiros/${v.id}`)).body.monto_a_pagar;expect(monto).toBe(2160);
  expect((await enc.post(`/api/retiros/${v.id}/concretar`).send({})).body.error).toBe('PAGO_REQUERIDO');
  expect((await enc.post('/api/pagos').send({reserva_id:v.id,medio:'efectivo',comprobante:'X',monto:2000})).body.error).toBe('MONTO_INCORRECTO');
  expect((await enc.post('/api/pagos').send({reserva_id:v.id,medio:'mercadopago',comprobante:'X'})).status).toBe(400);
  expect((await enc.post('/api/pagos').send({reserva_id:v.id,medio:'efectivo',comprobante:'RECIBO-1',monto})).status).toBe(201);
  expect((await enc.post(`/api/retiros/${v.id}/concretar`).send({})).body.estado).toBe('concretada');
  expect(estado(f,r.id)).toBe('retirado');
  const op=await login(f,4);expect((await op.get('/api/incentivos')).body.map(i=>i.monto)).toEqual([324]);
  expect((await enc.get('/api/incentivos')).body.map(i=>i.monto)).toEqual([216]);
 });
});

describe('Contrato HTTP con la UI',()=>{
 it('DELETE de pedidos y reservas funciona con cuerpo JSON vacío, como lo envía la UI',async()=>{
  const f=setup();const {c1,c2}=await flow(f);
  const aviso=(await c1.get('/api/avisos')).body[0];const v=(await c1.post('/api/reservas').send({aviso_id:aviso.id})).body;
  expect((await c1.delete(`/api/reservas/${v.id}`).send({})).status).toBe(200);
  const pedido=(await c2.get('/api/pedidos')).body[0];
  expect((await c1.delete(`/api/pedidos/${pedido.id}`).send({})).status).toBe(404);
  expect((await c2.delete(`/api/pedidos/${pedido.id}`).send({})).body.estado).toBe('cancelado');
 });
 it('un POST o DELETE sin cuerpo JSON se rechaza con 415 (por eso la UI envía {})',async()=>{
  const f=setup();const c=await login(f,1);
  const pedido=(await c.post('/api/pedidos').send(order)).body;
  expect((await c.delete(`/api/pedidos/${pedido.id}`)).status).toBe(415);
  expect((await c.delete(`/api/pedidos/${pedido.id}`).set('Content-Type','application/json')).status).toBe(415);
  expect((await c.post(`/api/pedidos/${pedido.id}/renovar`)).status).toBe(415);
 });
 it('todas las rutas que consume la UI existen para su rol',async()=>{
  const f=setup();
  const routes={1:['/api/pedidos','/api/avisos','/api/reservas','/api/sucursales','/api/catalogos','/api/entorno','/api/auth/me'],
   3:['/api/precios','/api/reportes','/api/catalogos'],4:['/api/retazos','/api/incentivos','/api/retazos/precio?material=MDF&espesor_mm=18&alto_cm=40&ancho_cm=60'],5:['/api/calidad','/api/retiros','/api/incentivos']};
  for(const [id,paths] of Object.entries(routes)){const a=await login(f,id);for(const path of paths)expect([path,(await a.get(path)).status]).toEqual([path,200]);}
 });
});

describe('No funcionales',()=>{
 it('CP-31 / RNF-04: 10 operaciones simultáneas de clientes sin errores ni pérdida de datos',async()=>{
  const f=setup();const c1=await login(f,1),c2=await login(f,2);
  const ops=[];for(let i=0;i<5;i++){ops.push(c1.post('/api/pedidos').send({...order,alto_min_cm:30+i}));ops.push(c2.post('/api/pedidos').send({...order,alto_min_cm:30+i}));}
  const statuses=(await Promise.all(ops)).map(r=>r.status).sort();
  expect(statuses).toEqual([...Array(6).fill(201),...Array(4).fill(409)]);
  expect(f.db.prepare("SELECT cliente_id,COUNT(*) n FROM pedido WHERE estado='abierto' GROUP BY cliente_id").all()).toEqual([{cliente_id:1,n:3},{cliente_id:2,n:3}]);
  expect(f.db.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok');
 });
 it('CP-30 / RNF-03: un cliente no accede a pedidos, avisos ni reservas de otro',async()=>{
  const f=setup();const {c1,c2}=await flow(f);
  const a=(await c1.get('/api/avisos')).body[0];const v=(await c1.post('/api/reservas').send({aviso_id:a.id})).body;
  expect((await c2.get(`/api/avisos/${a.id}`)).status).toBe(404);
  expect((await c2.get(`/api/reservas/${v.id}`)).status).toBe(404);
  expect((await c2.post('/api/reservas').send({aviso_id:a.id})).status).toBe(404);
  expect(f.db.prepare("SELECT COUNT(*) n FROM usuario WHERE password_hash NOT LIKE '$2%'").get().n).toBe(0);
 });
});
