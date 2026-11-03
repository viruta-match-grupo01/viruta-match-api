import {describe,it,expect,afterEach} from 'vitest';
import request from 'supertest';
import {tmpdir} from 'node:os';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {openDatabase,createBaseSchema,migrateDevB} from '../src/database.js';
import {seedDemo} from '../src/seed.js';
import {seedPreciosEjemplo} from '../src/modules/dev-a/seed.js';
import {readConfig} from '../src/config.js';
import {createApp} from '../src/app.js';
import {createMercadoPago} from '../src/modules/mercadopago.js';

const cleanup=[];afterEach(()=>{while(cleanup.length)cleanup.pop()();});
function setup(){
 const db=openDatabase();createBaseSchema(db);migrateDevB(db);seedDemo(db);seedPreciosEjemplo(db);
 const uploads=mkdtempSync(join(tmpdir(),'viruta-fotos-'));
 const config=readConfig({JWT_SECRET:'integracion-final-1234567890123456789012345678',ALLOW_CLIENT_REGISTRATION:'true',UPLOAD_DIR:uploads});
 const runtime=createApp({db,config});cleanup.push(()=>{runtime.dispose();db.close();rmSync(uploads,{recursive:true,force:true});});return {...runtime,db,config};
}
async function login(app,id){const a=request.agent(app);expect((await a.post('/api/auth/login').send({email:`usuario${id}@example.invalid`,password:'demo-local'})).status).toBe(200);return a;}
const validPng=Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000','hex'),Buffer.alloc(64)]);

describe('Entrega final — registro, permisos, fotografías y precios',()=>{
 it('registra solamente clientes, no permite escalar a dueño y persiste preferencias',async()=>{
   const f=setup(),a=request.agent(f.app);
   const signup={nombre:'Cliente integrado',email:'nueva@example.invalid',password:'pass-test-muy-segura'};
   expect((await a.post('/api/auth/registro').send({...signup,rol:'duenio'})).status).toBe(201);
   expect((await a.get('/api/auth/me')).body.rol).toBe('cliente');
   expect((await a.get('/api/usuarios')).status).toBe(403);
   expect((await a.patch('/api/auth/preferencias').send({medio_aviso:'whatsapp',telefono:'123'})).status).toBe(400);
   expect((await a.patch('/api/auth/preferencias').send({medio_aviso:'correo',telefono:''})).status).toBe(200);
   expect((await a.get('/api/auth/preferencias')).body.medio_aviso).toBe('correo');
   expect((await request(f.app).post('/api/auth/registro').send(signup)).status).toBe(409);
 });
 it('permite al dueño crear, editar y desactivar un operario sin permitir auto-bloqueo',async()=>{
   const f=setup(),owner=await login(f.app,3),cliente=await login(f.app,1);
   expect((await cliente.post('/api/usuarios').send({})).status).toBe(403);
   const created=await owner.post('/api/usuarios').send({nombre:'Operario de prueba',email:'nueva-operaria@example.invalid',password:'clave-segura-2026',rol:'operario',sucursal_id:1});
   expect(created.status).toBe(201);
   const updated=await owner.patch(`/api/usuarios/${created.body.id}`).send({estado:'inactivo'});
   expect(updated.body.estado).toBe('inactivo');
   expect((await request(f.app).post('/api/auth/login').send({email:'nueva-operaria@example.invalid',password:'clave-segura-2026'})).status).toBe(401);
   expect((await owner.patch('/api/usuarios/3').send({estado:'inactivo'})).status).toBe(409);
 });
 it('sube una foto real como binario, solo operario, y la enlaza al retazo',async()=>{
   const f=setup(),operario=await login(f.app,4),cliente=await login(f.app,1);
   expect((await cliente.post('/api/fotos').set('Content-Type','image/png').send(validPng)).status).toBe(403);
   expect((await operario.post('/api/fotos').set('Content-Type','image/png').send(Buffer.from('no es imagen'))).status).toBe(400);
   const photo=await operario.post('/api/fotos').set('Content-Type','image/png').send(validPng);
   expect(photo.status).toBe(201);
   expect(photo.body.foto_url).toMatch(/^\/api\/fotos\/.+\.png$/);
   expect((await operario.get(photo.body.foto_url)).status).toBe(200);
   const body={material:'MDF',espesor_mm:18,alto_cm:40,ancho_cm:60,foto_url:photo.body.foto_url,forma_retiro:'Retiro presencial'};
   expect((await operario.post('/api/retazos').send(body)).status).toBe(201);
 });
 it('el precio CP-21 de melamina blanca 0,50 × 0,80 m es $4.640',async()=>{
   const f=setup(),operario=await login(f.app,4);
   const result=await operario.get('/api/retazos/precio?material=melamina&espesor_mm=18&alto_cm=50&ancho_cm=80&color=blanco');
   expect(result.status).toBe(200);expect(result.body.precio).toBe(4640);
 });
});

describe('MercadoPago — pruebas simuladas sin credenciales ni llamadas reales',()=>{
 it('solo confirma pago verificado, con importe, moneda y reserva coincidentes',async()=>{
   const f=setup();
   f.db.prepare("INSERT INTO reserva(cliente_id,retazo_id,estado,confirmada_en,vence_en) VALUES(1,3,'activa',?,?)").run(new Date().toISOString(),new Date(Date.now()+3600_000).toISOString());
   const id=f.db.prepare('SELECT last_insert_rowid() id').get().id;
   const user={id:1,rol:'cliente'};let status='pending',amount=4640;
   const fetcher=async(url,_opts)=>({ok:true,json:async()=>url.includes('checkout/preferences')?
     {sandbox_init_point:'https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=abc'}:
     {id:123,status,currency_id:'ARS',external_reference:`VIRUTA-TEST-RESERVA-${id}`,transaction_amount:amount}});
   const mp=createMercadoPago({db:f.db,clock:()=>new Date(),config:{mercadoPago:{accessToken:'TEST-simulado',sandbox:true,publicAppUrl:'http://localhost:5173'}},fetcher});
   expect((await mp.createPreference(user,id)).estado).toBe('pendiente');
   expect((await mp.verify(user,id,'123')).estado).toBe('pendiente');
   expect(f.db.prepare("SELECT COUNT(*) n FROM pago WHERE estado='aprobado'").get().n).toBe(0);
   status='approved';amount=999;
   await expect(mp.verify(user,id,'123')).rejects.toMatchObject({code:'MP_PAGO_NO_COINCIDE'});
   amount=4640;expect((await mp.verify(user,id,'123')).estado).toBe('aprobado');
   expect(f.db.prepare("SELECT COUNT(*) n FROM pago WHERE estado='aprobado'").get().n).toBe(1);
 });
});
