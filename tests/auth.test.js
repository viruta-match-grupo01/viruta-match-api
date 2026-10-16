import {describe,it,expect,afterEach} from 'vitest';
import request from 'supertest';
import {openDatabase,createDemoSchema,migrateDevB} from '../src/database.js';
import {seedDemo} from '../src/seed.js';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/config.js';
const cleanup=[];afterEach(()=>{while(cleanup.length)cleanup.pop()();});
function setup() {const db=openDatabase();createDemoSchema(db);migrateDevB(db);seedDemo(db);const config=readConfig({JWT_SECRET:'test-secret-only-not-for-production-0123456789',ALLOW_DEMO:'true'});const r=createApp({db,config});cleanup.push(()=>{r.b.dispose();db.close();});return {...r,db};}
describe('Base compartida: autenticación y frontera API/UI',()=>{
  it('login válido usa cookie httpOnly; me identifica al usuario',async()=>{
    const {app}=setup();const agent=request.agent(app);const login=await agent.post('/api/auth/login').send({email:'usuario1@example.invalid',password:'demo-local'});
    expect(login.status).toBe(200);expect(login.headers['set-cookie'][0]).toContain('HttpOnly');expect(login.body.password_hash).toBeUndefined();expect((await agent.get('/api/auth/me')).body.id).toBe(1);
  });
  it('x-demo-user ya no autentica en el servidor del equipo',async()=>{const {app}=setup();expect((await request(app).get('/api/pedidos').set('x-demo-user','1')).status).toBe(401);});
  it('credenciales inválidas y JWT modificado no acceden',async()=>{const {app}=setup();expect((await request(app).post('/api/auth/login').send({email:'usuario1@example.invalid',password:'error'})).status).toBe(401);expect((await request(app).get('/api/pedidos').set('Cookie','viruta_session=alterado')).status).toBe(401);});
  it('logout elimina la sesión del navegador',async()=>{const {app}=setup();const agent=request.agent(app);await agent.post('/api/auth/login').send({email:'usuario1@example.invalid',password:'demo-local'});await agent.post('/api/auth/logout').send({});expect((await agent.get('/api/auth/me')).status).toBe(401);});
  it('la UI permitida obtiene CORS con credenciales; un origen ajeno es rechazado',async()=>{const {app}=setup();const ok=await request(app).options('/api/auth/login').set('Origin','http://localhost:5173').set('Access-Control-Request-Method','POST');expect(ok.headers['access-control-allow-credentials']).toBe('true');expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');expect((await request(app).post('/api/auth/login').set('Origin','https://sitio-ajeno.invalid').send({})).status).toBe(403);});
  it('autenticación base funciona con los módulos B y separa dueño/cliente',async()=>{const {app}=setup();const client=request.agent(app);await client.post('/api/auth/login').send({email:'usuario1@example.invalid',password:'demo-local'});expect((await client.get('/api/pedidos')).status).toBe(200);expect((await client.get('/api/reportes')).status).toBe(403);const owner=request.agent(app);await owner.post('/api/auth/login').send({email:'usuario3@example.invalid',password:'demo-local'});expect((await owner.get('/api/reportes')).status).toBe(200);});
  it('producción requiere secreto y no admite captura/demo',()=>{expect(()=>readConfig({NODE_ENV:'production'})).toThrow('JWT_SECRET');expect(()=>readConfig({NODE_ENV:'production',JWT_SECRET:'x'.repeat(40),UI_ORIGIN:'https://app.invalid',PUBLIC_APP_URL:'https://app.invalid',NOTIFICATION_MODE:'capture'})).toThrow('demo');});
  it('tablas del equipo existen y las contraseñas tienen hash bcrypt',()=>{const {db}=setup();for(const name of ['precio_m2','control_calidad','pago','movimiento_puntos','incentivo'])expect(db.prepare("SELECT name FROM sqlite_master WHERE name=?").get(name)).toBeTruthy();expect(db.prepare('SELECT password_hash FROM usuario WHERE id=1').get().password_hash).toMatch(/^\$2/);});
});
