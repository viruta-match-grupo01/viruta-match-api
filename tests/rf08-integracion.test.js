// Copiar a API/tests/rf08-propuesta.test.js solo en una rama de integración.
import {describe,it,expect,afterEach} from 'vitest';
import request from 'supertest';
import {openDatabase,createDemoSchema,migrateDevB} from '../src/database.js';
import {seedDemo} from '../src/seed.js';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/config.js';
const clean=[];afterEach(()=>{while(clean.length)clean.pop()();});
function fixture(enabled=true){
 const db=openDatabase();createDemoSchema(db);migrateDevB(db);seedDemo(db);
 const config=readConfig({JWT_SECRET:'test-only-0123456789012345678901234567',ALLOW_CLIENT_REGISTRATION:enabled?'true':'false',ALLOW_DEMO:'true'});
 const runtime=createApp({db,config});clean.push(()=>{runtime.dispose();db.close();});return {db,app:runtime.app};
}
describe('RF-08 propuesta aislada',()=>{
 it('no ofrece registro cuando el feature flag está desactivado',async()=>{
   const {app}=fixture(false);
   const r=await request(app).post('/api/auth/registro').send({nombre:'Cliente Nuevo',email:'nuevo@example.com',password:'SecretoDePrueba123!'});
   expect(r.status).toBe(403);
 });
 it('crea cliente sin privilegios y permite iniciar sesión con cookie',async()=>{
   const {app,db}=fixture();const agent=request.agent(app);
   const r=await agent.post('/api/auth/registro').send({nombre:'Cliente Nuevo',email:'nuevo@example.com',password:'SecretoDePrueba123!'});
   expect(r.status).toBe(201);expect(r.body.rol).toBe('cliente');expect(r.headers['set-cookie'][0]).toContain('HttpOnly');
   expect((await agent.get('/api/auth/me')).body.email).toBe('nuevo@example.com');
   expect(db.prepare("SELECT password_hash FROM usuario WHERE email='nuevo@example.com'").get().password_hash).not.toContain('SecretoDePrueba123!');
   expect((await agent.get('/api/reportes')).status).toBe(403);
 });
 it('evita correo duplicado y medio WhatsApp sin teléfono',async()=>{
   const {app}=fixture();
   const base={nombre:'Cliente Nuevo',email:'nuevo@example.com',password:'SecretoDePrueba123!'};
   expect((await request(app).post('/api/auth/registro').send({...base,medio_aviso:'whatsapp'})).status).toBe(400);
   expect((await request(app).post('/api/auth/registro').send(base)).status).toBe(201);
   expect((await request(app).post('/api/auth/registro').send(base)).status).toBe(409);
 });
 it('actualiza medio y teléfono con sesión de cliente',async()=>{
   const {app,db}=fixture();const agent=request.agent(app);
   await agent.post('/api/auth/registro').send({nombre:'Cliente Nuevo',email:'nuevo@example.com',password:'SecretoDePrueba123!'});
   expect((await agent.patch('/api/auth/preferencias').send({medio_aviso:'whatsapp',telefono:''})).status).toBe(400);
   const changed=await agent.patch('/api/auth/preferencias').send({medio_aviso:'ambos',telefono:'+54 11 1234 5678'});
   expect(changed.status).toBe(200);expect(changed.body.medio_aviso).toBe('ambos');
   expect((await agent.get('/api/auth/preferencias')).body.telefono).toBe('+54 11 1234 5678');
   const row=db.prepare("SELECT p.medio_aviso FROM perfil_cliente p JOIN usuario u ON u.id=p.usuario_id WHERE u.email='nuevo@example.com'").get();
   expect(row.medio_aviso).toBe('ambos');
 });
});
