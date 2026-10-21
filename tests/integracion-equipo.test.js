import {it,expect,afterEach} from 'vitest';
import {Router} from 'express';
import request from 'supertest';
import {openDatabase,createBaseSchema,migrateDevB} from '../src/database.js';
import {seedDemo} from '../src/seed.js';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/config.js';
import {requireRole,positiveId,requireBranch} from '../src/shared/http.js';
const clean=[];afterEach(()=>{while(clean.length)clean.pop()();});
function setup(options={}){const db=openDatabase();createBaseSchema(db);migrateDevB(db);seedDemo(db,new Date('2026-10-16T13:00:00Z'));const runtime=createApp({db,config:readConfig({JWT_SECRET:'test-integration-secret-01234567890123456789',ALLOW_DEMO:'false'}),clock:()=>new Date('2026-10-16T13:00:00Z'),...options});clean.push(()=>{runtime.dispose();db.close();});return {...runtime,db};}
async function login(app,id=1){const agent=request.agent(app);await agent.post('/api/auth/login').send({email:`usuario${id}@example.invalid`,password:'demo-local'});return agent;}
it('A puede publicar routers con la misma sesión y permisos sin otro login',async()=>{
 const f=setup({equipoRouterFactory:context=>{const router=Router();router.get('/prueba-a',requireRole('operario'),(req,res)=>{requireBranch(req.user,1);res.json({id:req.user.id,sharedDb:!!context.db});});return router;}});
 expect((await request(f.app).get('/api/prueba-a')).status).toBe(401);
 expect((await (await login(f.app,1)).get('/api/prueba-a')).status).toBe(403);
 expect((await (await login(f.app,4)).get('/api/prueba-a')).body).toEqual({id:4,sharedDb:true});
});
it('catálogos de A y pedidos de B tienen una única fuente',async()=>{const f=setup();const agent=await login(f.app);const r=await agent.get('/api/catalogos');expect(r.status).toBe(200);expect(r.body.espesores_mm).toContain(5.5);expect(r.body.materiales).not.toContain('OSB');});
it('evento disponible de A genera un aviso en la misma transacción, y rollback no lo conserva',()=>{
 const f=setup();f.db.prepare("UPDATE retazo SET estado='pendiente_control' WHERE estado='disponible'").run();f.b.pedidos.create(1,{material:'MDF',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,sucursal_preferida_id:1});
 const approve=()=>{f.db.prepare("UPDATE retazo SET estado='disponible' WHERE id=4").run();f.context.bus.emit('retazo.disponible',{retazoId:4});};
 expect(()=>f.db.transaction(()=>{approve();throw new Error('rollback');}).immediate()).toThrow('rollback');expect(f.db.prepare('SELECT COUNT(*) n FROM aviso').get().n).toBe(0);
 f.db.transaction(approve).immediate();expect(f.db.prepare('SELECT retazo_id FROM aviso').get().retazo_id).toBe(4);
});
it('C puede enchufar vencimientos antes del procesamiento de B',async()=>{let ran=false;const f=setup({equipoTasksFactory:context=>({async tick(){expect(context.calendar.addHours).toBeTypeOf('function');ran=true;}})});await f.tick();expect(ran).toBe(true);});
it('no se declara un cobro de MercadoPago sin su contrato',async()=>{const f=setup();const agent=await login(f.app,5);const r=await agent.post('/api/pagos/mercadopago').send({reserva_id:1});expect(r.status).toBe(501);expect(r.body.error).toBe('MODULO_PENDIENTE');expect(f.db.prepare('SELECT COUNT(*) n FROM pago').get().n).toBe(0);});
it('sin configuración explícita no expone controles de prueba',()=>{expect(readConfig({}).allowDemo).toBe(false);});
it('identificadores y pertenencia de sucursal se validan en la base común',()=>{expect(()=>positiveId('1.5')).toThrow();expect(()=>positiveId('abc')).toThrow();expect(()=>requireBranch({sucursal_id:1},2)).toThrow();});
