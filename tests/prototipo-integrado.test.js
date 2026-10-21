import {it,expect,afterEach} from 'vitest';
import request from 'supertest';
import {openDatabase,createBaseSchema,migrateDevB} from '../src/database.js';
import {seedDemo} from '../src/seed.js';
import {seedPreciosEjemplo} from '../src/modules/dev-a/seed.js';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/config.js';
const clean=[];afterEach(()=>{while(clean.length)clean.pop()();});
function setup(demo=false){const db=openDatabase();createBaseSchema(db);migrateDevB(db);seedDemo(db);seedPreciosEjemplo(db);db.prepare("UPDATE retazo SET estado='retirado'").run();const f=createApp({db,config:readConfig({JWT_SECRET:'prueba-integrada-012345678901234567890',ALLOW_DEMO:String(demo)}),clock:()=>new Date('2026-10-17T13:00:00Z')});clean.push(()=>{f.dispose();db.close();});return {...f,db};}
async function login(f,id){const a=request.agent(f.app);expect((await a.post('/api/auth/login').send({email:`usuario${id}@example.invalid`,password:'demo-local'})).status).toBe(200);return a;}
const checks={humedad_ok:true,bordes_ok:true,medidas_ok:true};
const piece={material:'aglomerado',espesor_mm:18,alto_cm:40,ancho_cm:60,foto_url:'/retazo-demo.svg',forma_retiro:'Retiro presencial'};
async function load(f){const op=await login(f,4);const r=await op.post('/api/retazos').send(piece);expect(r.status).toBe(201);return {op,r:r.body,enc:await login(f,5)};}
it('integra A → B → C → incentivos de A y reportes de B, sin doble venta',async()=>{
 const f=setup();const {r,enc}=await load(f);const client=await login(f,1);
 const p=await client.post('/api/pedidos').send({material:'aglomerado',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,sucursal_preferida_id:1,tolerancia_pct:0});expect(p.status).toBe(201);
 expect(f.db.prepare('SELECT COUNT(*) n FROM aviso').get().n).toBe(0);
 expect((await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks)).status).toBe(200);await f.tick();
 const avisos=await client.get('/api/avisos');expect(avisos.body).toHaveLength(1);
 const v=await client.post('/api/reservas').send({aviso_id:avisos.body[0].id});expect(v.status).toBe(201);
 expect((await enc.post(`/api/retiros/${v.body.id}/concretar`).send({})).status).toBe(409);
 expect((await enc.post('/api/pagos').send({reserva_id:v.body.id,medio:'transferencia',comprobante:'FICTICIO-001',monto:2160})).status).toBe(201);
 expect((await enc.post(`/api/retiros/${v.body.id}/concretar`).send({})).status).toBe(200);
 await enc.post(`/api/retiros/${v.body.id}/concretar`).send({});
 expect(f.db.prepare('SELECT rol,monto FROM incentivo ORDER BY id').all()).toEqual([{rol:'operario',monto:324},{rol:'encargado',monto:216}]);
 expect((await client.get('/api/pedidos')).body[0].estado).toBe('cumplido');
 const owner=await login(f,3);const report=await owner.get('/api/reportes');expect(report.body.sucursales.find(s=>s.id===1).reservas).toBe(1);
 expect((await client.get('/api/incentivos')).status).toBe(403);
});
it('las medidas incorrectas vuelven al operario y requieren un nuevo control',async()=>{
 const f=setup();const {r,op,enc}=await load(f);
 expect((await op.patch(`/api/retazos/${r.id}/medidas`).send({alto_cm:45,ancho_cm:60})).status).toBe(409);
 expect((await enc.post(`/api/calidad/${r.id}/corregir-medidas`).send({motivo:'El alto real es 45 cm'})).body.estado).toBe('corregir_medidas');
 expect((await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks)).status).toBe(409);
 const fixed=await op.patch(`/api/retazos/${r.id}/medidas`).send({alto_cm:45,ancho_cm:60});expect(fixed.status).toBe(200);expect(fixed.body).toMatchObject({estado:'pendiente_control',alto_cm:45,precio:2430});
 expect((await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks)).body.estado).toBe('disponible');
 expect(f.db.prepare('SELECT resultado FROM control_calidad WHERE retazo_id=? ORDER BY id').all(r.id).map(x=>x.resultado)).toEqual(['corregir_medidas','aprobado']);
});
it('una corrección menor a 20 se descarta; clientes no pueden editar ni decidir',async()=>{
 const f=setup();const {r,op,enc}=await load(f);const c=await login(f,1);
 expect((await c.post(`/api/calidad/${r.id}/corregir-medidas`).send({motivo:'Error'})).status).toBe(403);
 await enc.post(`/api/calidad/${r.id}/corregir-medidas`).send({motivo:'Revisar dimensiones'});
 expect((await c.patch(`/api/retazos/${r.id}/medidas`).send({alto_cm:45,ancho_cm:60})).status).toBe(403);
 expect((await op.patch(`/api/retazos/${r.id}/medidas`).send({alto_cm:15,ancho_cm:60})).body.estado).toBe('descartado');
 expect((await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks)).status).toBe(409);
});
it('un listener fallido revierte retiro e incentivos de la misma venta',async()=>{
 const f=setup();const {r,enc}=await load(f);const c=await login(f,1);await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks);
 f.b.pedidos.create(1,{material:'aglomerado',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,sucursal_preferida_id:1});await f.tick();const a=(await c.get('/api/avisos')).body[0];const v=(await c.post('/api/reservas').send({aviso_id:a.id})).body;
 await enc.post('/api/pagos').send({reserva_id:v.id,medio:'efectivo',comprobante:'TEST'});
 const fail=()=>{throw new Error('rollback');};f.context.bus.on('retiro.concretado',fail);
 expect((await enc.post(`/api/retiros/${v.id}/concretar`).send({})).status).toBe(500);
 expect(f.db.prepare('SELECT COUNT(*) n FROM incentivo').get().n).toBe(0);expect(f.db.prepare('SELECT estado FROM reserva WHERE id=?').get(v.id).estado).toBe('activa');
 f.context.bus.off('retiro.concretado',fail);expect((await enc.post(`/api/retiros/${v.id}/concretar`).send({})).status).toBe(200);
});
it('solo el dueño accede al reloj y mensajes de demostración; no existe bypass de calidad',async()=>{
 const f=setup(true);expect((await request(f.app).get('/api/demo/correos')).status).toBe(401);const c=await login(f,1);expect((await c.get('/api/demo/correos')).status).toBe(403);expect((await c.post('/api/demo/tick').send({})).status).toBe(403);
 const owner=await login(f,3);expect((await owner.get('/api/demo/correos')).status).toBe(200);expect((await owner.post('/api/demo/retazos/1/aprobar').send({})).status).toBe(501);expect((await owner.post('/api/demo/tick').send({})).status).toBe(200);
});
