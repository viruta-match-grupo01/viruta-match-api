import {describe,it,expect,afterEach} from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import {openDatabase,createBaseSchema,migrateDevB} from '../src/database.js';
import {seedDemo} from '../src/seed.js';
import {createApp} from '../src/app.js';
import {readConfig} from '../src/config.js';
import {seedPreciosEjemplo} from '../src/modules/dev-a/seed.js';
import {calcularImporte,redondearImporte} from '../src/modules/dev-a/precios/importes.js';

const NOW='2026-10-16T13:00:00.000Z'; // 10:00 en Buenos Aires: dentro del horario de avisos
const clean=[];afterEach(()=>{while(clean.length)clean.pop()();});

/** Usuarios ficticios: 4 operario y 5 encargado (sucursal 1) vienen del seed; 6 y 7 son de la sucursal 2. */
function setup() {
  const db=openDatabase();createBaseSchema(db);migrateDevB(db);seedDemo(db,new Date(NOW));seedPreciosEjemplo(db);
  const hash=bcrypt.hashSync('demo-local',4);
  for(const [id,rol] of [[6,'operario'],[7,'encargado']]) db.prepare('INSERT INTO usuario(id,nombre,email,password_hash,rol,sucursal_id) VALUES(?,?,?,?,?,2)').run(id,`${rol} sucursal 2`,`usuario${id}@example.invalid`,hash,rol);
  // Aísla los retazos del seed para que no participen de estos casos.
  db.prepare("UPDATE retazo SET estado='retirado'").run();
  const runtime=createApp({db,config:readConfig({JWT_SECRET:'test-dev-a-secret-0123456789012345678901234567',ALLOW_DEMO:'false'}),clock:()=>new Date(NOW)});
  clean.push(()=>{runtime.dispose();db.close();});
  return {...runtime,db};
}
async function login(app,id) {const agent=request.agent(app);const r=await agent.post('/api/auth/login').send({email:`usuario${id}@example.invalid`,password:'demo-local'});expect(r.status).toBe(200);return agent;}
const mdf=(extra={})=>({material:'MDF',espesor_mm:18,alto_cm:40,ancho_cm:66,foto_url:'/retazo-demo.svg',forma_retiro:'Retiro presencial en sucursal',...extra});
const melamina=(extra={})=>({material:'melamina',espesor_mm:18,alto_cm:50,ancho_cm:80,color:'blanco',acabado:'mate',foto_url:'/retazo-demo.svg',forma_retiro:'Retiro presencial en sucursal',...extra});
const avisos=(db,retazoId)=>db.prepare('SELECT * FROM aviso WHERE retazo_id=?').all(retazoId);

describe('Dev A · carga de retazos (RF-01 a RF-07, RF-21)',()=>{
  it('CP-01: acepta MDF, aglomerado y melamina; rechaza terciado fenólico',async()=>{
    const f=setup();const op=await login(f.app,4);
    for(const body of [mdf(),mdf({material:'aglomerado'}),melamina()]) {const r=await op.post('/api/retazos').send(body);expect(r.status,JSON.stringify(r.body)).toBe(201);}
    const bad=await op.post('/api/retazos').send(mdf({material:'terciado fenólico'}));
    expect(bad.status).toBe(400);expect(bad.body.error).toBe('DATOS_INVALIDOS');
  });
  it('CP-02: solo los espesores del catálogo; 5,5 es válido',async()=>{
    const f=setup();const op=await login(f.app,4);
    expect((await op.post('/api/retazos').send(mdf({espesor_mm:18}))).status).toBe(201);
    expect((await op.post('/api/retazos').send(mdf({espesor_mm:10}))).status).toBe(400);
    expect((await op.post('/api/retazos').send(mdf({espesor_mm:5.5,material:'melamina',color:'blanco',acabado:'mate'}))).status).toBe(409); // válido, pero sin precio cargado: no se inventa
    f.db.prepare("INSERT INTO precio_m2(material,espesor_mm,color,precio_m2) VALUES('melamina',5.5,'blanco',1000)").run();
    expect((await op.post('/api/retazos').send(mdf({espesor_mm:5.5,material:'melamina',color:'blanco',acabado:'mate'}))).status).toBe(201);
  });
  it('CP-03: la melamina exige color del catálogo y acabado; fuera de melamina ambos son null',async()=>{
    const f=setup();const op=await login(f.app,4);
    const ok=await op.post('/api/retazos').send(melamina({color:'roble'}));expect(ok.status).toBe(201);expect(ok.body.color).toBe('roble');expect(ok.body.acabado).toBe('mate');
    expect((await op.post('/api/retazos').send(melamina({color:'rojo'}))).status).toBe(400);
    const sinAcabado=melamina();delete sinAcabado.acabado;expect((await op.post('/api/retazos').send(sinAcabado)).status).toBe(400);
    expect((await op.post('/api/retazos').send(mdf({color:'blanco',acabado:'mate'}))).status).toBe(400);
    const plain=await op.post('/api/retazos').send(mdf());expect(plain.body.color).toBeNull();expect(plain.body.acabado).toBeNull();
  });
  it('CP-04: una medida menor a 20 cm queda descartada y no genera avisos; 20×40 queda pendiente',async()=>{
    const f=setup();const op=await login(f.app,4);
    f.b.pedidos.create(1,{material:'MDF',espesor_mm:18,alto_min_cm:15,ancho_min_cm:40,sucursal_preferida_id:1});
    const events=[];f.context.bus.on('retazo.disponible',e=>events.push(e));
    const small=await op.post('/api/retazos').send(mdf({alto_cm:15,ancho_cm:40}));
    expect(small.status).toBe(201);expect(small.body.estado).toBe('descartado');expect(small.body.motivo_estado).toContain('20 cm');
    expect(avisos(f.db,small.body.id)).toHaveLength(0);expect(events).toHaveLength(0);
    const ok=await op.post('/api/retazos').send(mdf({alto_cm:20,ancho_cm:40}));expect(ok.body.estado).toBe('pendiente_control');
    // un descartado nunca vuelve a pendiente: el encargado no puede aprobarlo
    const enc=await login(f.app,5);const again=await enc.post(`/api/calidad/${small.body.id}/aprobar`).send({humedad_ok:true,bordes_ok:true,medidas_ok:true});
    expect(again.status).toBe(409);expect(again.body.error).toBe('RETAZO_NO_PENDIENTE');
  });
  it('CP-04: un descartado por tamaño se registra aunque no haya precio cargado (queda en 0)',async()=>{
    const f=setup();const op=await login(f.app,4);
    const r=await op.post('/api/retazos').send(melamina({color:'negro',alto_cm:10}));
    expect(r.status).toBe(201);expect(r.body.estado).toBe('descartado');expect(r.body.precio).toBe(0);
  });
  it('CP-05: 120 cm es válido y 125 cm se rechaza',async()=>{
    const f=setup();const op=await login(f.app,4);
    expect((await op.post('/api/retazos').send(mdf({alto_cm:120,ancho_cm:120}))).status).toBe(201);
    const r=await op.post('/api/retazos').send(mdf({alto_cm:125}));expect(r.status).toBe(400);
    expect(f.db.prepare('SELECT COUNT(*) n FROM retazo WHERE alto_cm=125').get().n).toBe(0);
  });
  it('CP-06 y CP-07: nace pendiente de control con fecha de carga automática; sucursal y operario salen de la sesión',async()=>{
    const f=setup();const op=await login(f.app,4);
    const r=await op.post('/api/retazos').send(mdf());
    expect(r.body.estado).toBe('pendiente_control');expect(r.body.cargado_en).toBe(NOW);expect(r.body.cargado_por).toBe(4);expect(r.body.sucursal_id).toBe(1);
    const other=await login(f.app,6);const r2=await other.post('/api/retazos').send(mdf());expect(r2.body.sucursal_id).toBe(2);
    for(const extra of [{sucursal_id:2},{cargado_por:9},{estado:'disponible'},{precio:1},{cargado_en:'2020-01-01T00:00:00.000Z'}]) expect((await op.post('/api/retazos').send(mdf(extra))).status).toBe(400);
  });
  it('CP-21: exige foto, calcula el precio por m² y el operario no puede fijarlo',async()=>{
    const f=setup();const op=await login(f.app,4);
    const noPhoto=mdf();delete noPhoto.foto_url;const e=await op.post('/api/retazos').send(noPhoto);expect(e.status).toBe(400);expect(e.body.message).toContain('foto');
    expect((await op.post('/api/retazos').send(mdf({foto_url:'https://externo.invalid/x.jpg'}))).status).toBe(400);
    const blanca=await op.post('/api/retazos').send(melamina());expect(blanca.body.precio).toBe(8000);   // 0,40 m² × $20.000
    const roble=await op.post('/api/retazos').send(melamina({color:'roble'}));expect(roble.body.precio).toBe(10000); // 0,40 m² × $25.000
    const m=await op.post('/api/retazos').send(mdf({alto_cm:40,ancho_cm:60}));expect(m.body.precio).toBe(2880);     // MDF usa su propio precio, sin color
    expect((await op.post('/api/retazos').send(melamina({precio:1}))).status).toBe(400);
    const sinPrecio=await op.post('/api/retazos').send(melamina({color:'negro'}));expect(sinPrecio.status).toBe(409);expect(sinPrecio.body.error).toBe('PRECIO_NO_CONFIGURADO');
  });
  it('CP-21: el dueño cambia un precio por m² y solo los retazos nuevos lo toman',async()=>{
    const f=setup();const op=await login(f.app,4),owner=await login(f.app,3);
    const before=await op.post('/api/retazos').send(melamina());
    const put=await owner.put('/api/precios').send({material:'melamina',espesor_mm:18,color:'blanco',precio_m2:30000});expect(put.status).toBe(200);expect(put.body.precio_m2).toBe(30000);
    const after=await op.post('/api/retazos').send(melamina());
    expect(after.body.precio).toBe(12000);expect(before.body.precio).toBe(8000);
    expect((await op.get(`/api/retazos/${before.body.id}`)).body.precio).toBe(8000);
    expect(f.db.prepare("SELECT COUNT(*) n FROM precio_m2 WHERE material='melamina' AND color='blanco' AND espesor_mm=18").get().n).toBe(1);
  });
  it('el dueño puede crear precios nuevos y valida el catálogo',async()=>{
    const f=setup();const owner=await login(f.app,3);
    expect((await owner.put('/api/precios').send({material:'aglomerado',espesor_mm:15,precio_m2:7000.456})).body.precio_m2).toBe(7000.46);
    expect((await owner.put('/api/precios').send({material:'melamina',espesor_mm:18,precio_m2:1})).status).toBe(400);
    expect((await owner.put('/api/precios').send({material:'MDF',espesor_mm:18,color:'blanco',precio_m2:1})).status).toBe(400);
    expect((await owner.put('/api/precios').send({material:'MDF',espesor_mm:10,precio_m2:1})).status).toBe(400);
    expect((await owner.put('/api/precios').send({material:'MDF',espesor_mm:18,precio_m2:-5})).status).toBe(400);
    const list=await owner.get('/api/precios');expect(list.status).toBe(200);expect(list.body.length).toBe(5);
  });
  it('vista previa del precio: solo lectura para el operario',async()=>{
    const f=setup();const op=await login(f.app,4);const before=f.db.prepare('SELECT COUNT(*) n FROM retazo').get().n;
    const r=await op.get('/api/retazos/precio?material=melamina&espesor_mm=18&color=roble&alto_cm=50&ancho_cm=80');
    expect(r.status).toBe(200);expect(r.body).toEqual({area_m2:0.4,precio_m2:25000,precio:10000});
    expect((await op.get('/api/retazos/precio?material=melamina&espesor_mm=18&color=negro&alto_cm=50&ancho_cm=80')).status).toBe(409);
    expect((await op.get('/api/retazos/precio?material=OSB&espesor_mm=18&alto_cm=50&ancho_cm=80')).status).toBe(400);
    expect(f.db.prepare('SELECT COUNT(*) n FROM retazo').get().n).toBe(before);
  });
  it('importes: dos decimales y sin error binario',()=>{
    expect(calcularImporte(50,80,20000)).toBe(8000);expect(calcularImporte(33,33,1234.56)).toBe(redondearImporte(33*33*1234.56/10000));expect(redondearImporte(1.005)).toBe(1.01);
  });
});

describe('Dev A · control de calidad (RF-19, RF-20, RF-12)',()=>{
  async function cargado(f,body=mdf()) {const op=await login(f.app,4);return (await op.post('/api/retazos').send(body)).body;}
  const checks={humedad_ok:true,bordes_ok:true,medidas_ok:true};
  it('CP-20: sin control no hay avisos; al aprobar queda disponible, se emite retazo.disponible y B crea un único aviso',async()=>{
    const f=setup();f.b.pedidos.create(1,{material:'MDF',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,sucursal_preferida_id:1});
    const events=[];f.context.bus.on('retazo.disponible',e=>events.push(e));
    const r=await cargado(f);expect(avisos(f.db,r.id)).toHaveLength(0);expect(events).toHaveLength(0);
    const enc=await login(f.app,5);
    const pend=await enc.get('/api/calidad');expect(pend.body.map(x=>x.id)).toEqual([r.id]);
    const ok=await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks);
    expect(ok.status,JSON.stringify(ok.body)).toBe(200);expect(ok.body.estado).toBe('disponible');expect(ok.body.ultimo_control.resultado).toBe('aprobado');
    expect(events).toEqual([{retazoId:r.id}]);
    const a=avisos(f.db,r.id);expect(a).toHaveLength(1);expect(a[0].estado).toBe('en_cola');
    expect(f.db.prepare('SELECT encargado_id,resultado FROM control_calidad WHERE retazo_id=?').all(r.id)).toEqual([{encargado_id:5,resultado:'aprobado'}]);
    expect((await enc.get('/api/calidad')).body).toEqual([]);
  });
  it('aprobar exige confirmar humedad, bordes y medidas',async()=>{
    const f=setup();const r=await cargado(f);const enc=await login(f.app,5);
    for(const body of [{humedad_ok:true,bordes_ok:true,medidas_ok:false},{humedad_ok:false,bordes_ok:true,medidas_ok:true}]) {const x=await enc.post(`/api/calidad/${r.id}/aprobar`).send(body);expect(x.status).toBe(400);expect(x.body.error).toBe('CONTROL_INCOMPLETO');}
    expect((await enc.post(`/api/calidad/${r.id}/aprobar`).send({})).status).toBe(400);
    expect(f.db.prepare('SELECT estado FROM retazo WHERE id=?').get(r.id).estado).toBe('pendiente_control');
    expect(f.db.prepare('SELECT COUNT(*) n FROM control_calidad').get().n).toBe(0);
  });
  it('CP-19: rechazar con motivo descarta el retazo, no genera avisos y emite retazo.descartado',async()=>{
    const f=setup();f.b.pedidos.create(1,{material:'MDF',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,sucursal_preferida_id:1});
    const r=await cargado(f);const enc=await login(f.app,5);const events=[];f.context.bus.on('retazo.descartado',e=>events.push(e));
    expect((await enc.post(`/api/calidad/${r.id}/rechazar`).send({})).status).toBe(400);
    expect((await enc.post(`/api/calidad/${r.id}/rechazar`).send({motivo:' '})).status).toBe(400);
    const x=await enc.post(`/api/calidad/${r.id}/rechazar`).send({motivo:'Humedad en un borde'});
    expect(x.status).toBe(200);expect(x.body.estado).toBe('descartado');expect(x.body.motivo_estado).toBe('Humedad en un borde');expect(events).toEqual([{retazoId:r.id}]);
    expect(avisos(f.db,r.id)).toHaveLength(0);
    const op=await login(f.app,4);const own=await op.get(`/api/retazos/${r.id}`);expect(own.body.estado).toBe('descartado');expect(own.body.motivo_estado).toBe('Humedad en un borde');
    expect((await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks)).status).toBe(409);
  });
  it('una segunda decisión sobre el mismo retazo se rechaza sin duplicar el control',async()=>{
    const f=setup();const r=await cargado(f);const enc=await login(f.app,5);
    expect((await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks)).status).toBe(200);
    const again=await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks);expect(again.status).toBe(409);expect(again.body.error).toBe('RETAZO_NO_PENDIENTE');
    expect((await enc.post(`/api/calidad/${r.id}/rechazar`).send({motivo:'Tarde'})).status).toBe(409);
    expect(f.db.prepare('SELECT COUNT(*) n FROM control_calidad WHERE retazo_id=?').get(r.id).n).toBe(1);
  });
  it('si un listener falla, la aprobación se revierte completa',async()=>{
    const f=setup();const r=await cargado(f);const enc=await login(f.app,5);
    const boom=()=>{throw new Error('falla de prueba');};f.context.bus.on('retazo.disponible',boom);
    const x=await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks);f.context.bus.off('retazo.disponible',boom);
    expect(x.status).toBe(500);expect(f.db.prepare('SELECT estado FROM retazo WHERE id=?').get(r.id).estado).toBe('pendiente_control');
    expect(f.db.prepare('SELECT COUNT(*) n FROM control_calidad').get().n).toBe(0);
    expect((await enc.post(`/api/calidad/${r.id}/aprobar`).send(checks)).status).toBe(200);
  });
  it('indica el plazo de 24 h desde la carga y si ya pasó',async()=>{
    const f=setup();const r=await cargado(f);const enc=await login(f.app,5);
    const d=(await enc.get(`/api/calidad/${r.id}`)).body;expect(d.control_limite_en).toBe('2026-10-17T13:00:00.000Z');expect(d.fuera_de_plazo).toBe(false);
    f.db.prepare('UPDATE retazo SET cargado_en=? WHERE id=?').run('2026-10-15T12:00:00.000Z',r.id);
    expect((await enc.get(`/api/calidad/${r.id}`)).body.fuera_de_plazo).toBe(true);
  });
});

describe('Dev A · permisos y aislamiento (RF-24, RNF-03)',()=>{
  it('CP-24: cada rol solo accede a sus funciones',async()=>{
    const f=setup();const op=await login(f.app,4),enc=await login(f.app,5),owner=await login(f.app,3),client=await login(f.app,1);
    const r=(await op.post('/api/retazos').send(mdf())).body;
    expect((await client.post('/api/retazos').send(mdf())).status).toBe(403);
    expect((await enc.post('/api/retazos').send(mdf())).status).toBe(403);
    expect((await owner.post('/api/retazos').send(mdf())).status).toBe(403);
    expect((await op.post(`/api/calidad/${r.id}/aprobar`).send({humedad_ok:true,bordes_ok:true,medidas_ok:true})).status).toBe(403);
    expect((await op.get('/api/calidad')).status).toBe(403);
    expect((await client.get('/api/calidad')).status).toBe(403);
    expect((await op.put('/api/precios').send({material:'MDF',espesor_mm:18,precio_m2:1})).status).toBe(403);
    expect((await enc.put('/api/precios').send({material:'MDF',espesor_mm:18,precio_m2:1})).status).toBe(403);
    expect((await op.get('/api/precios')).status).toBe(403);
    expect((await client.get('/api/precios')).status).toBe(403);
    expect(f.db.prepare("SELECT precio_m2 FROM precio_m2 WHERE material='MDF' AND espesor_mm=18").get().precio_m2).toBe(12000);
  });
  it('sin sesión todo devuelve 401, incluido x-demo-user',async()=>{
    const f=setup();
    for(const [m,u] of [['get','/api/retazos'],['post','/api/retazos'],['get','/api/calidad'],['post','/api/calidad/1/aprobar'],['get','/api/precios'],['put','/api/precios']]) expect((await request(f.app)[m](u).set('x-demo-user','4').send({})).status).toBe(401);
  });
  it('un operario solo ve sus cargas; el retazo de otro es inexistente para él',async()=>{
    const f=setup();const a=await login(f.app,4),b=await login(f.app,6);
    const mine=(await a.post('/api/retazos').send(mdf())).body;
    expect((await b.get(`/api/retazos/${mine.id}`)).status).toBe(404);
    expect((await b.get('/api/retazos')).body.map(x=>x.id)).not.toContain(mine.id);
    expect((await a.get('/api/retazos')).body.map(x=>x.id)).toContain(mine.id);
    expect((await a.get('/api/retazos/abc')).status).toBe(400);expect((await a.get('/api/retazos/99999')).status).toBe(404);
  });
  it('un encargado no ve ni decide sobre retazos de otra sucursal, sin revelar que existen',async()=>{
    const f=setup();const op=await login(f.app,4),other=await login(f.app,7),own=await login(f.app,5);
    const r=(await op.post('/api/retazos').send(mdf())).body;
    expect((await other.get('/api/calidad')).body).toEqual([]);
    expect((await other.get(`/api/calidad/${r.id}`)).status).toBe(404);
    expect((await other.post(`/api/calidad/${r.id}/aprobar`).send({humedad_ok:true,bordes_ok:true,medidas_ok:true})).status).toBe(404);
    expect((await other.post(`/api/calidad/${r.id}/rechazar`).send({motivo:'No me corresponde'})).status).toBe(404);
    expect(f.db.prepare('SELECT estado FROM retazo WHERE id=?').get(r.id).estado).toBe('pendiente_control');
    expect((await own.get(`/api/calidad/${r.id}`)).status).toBe(200);
  });
  it('los errores no exponen SQL ni stack y usan el formato común',async()=>{
    const f=setup();const op=await login(f.app,4);const r=await op.post('/api/retazos').send({material:"MDF'; DROP TABLE retazo;--"});
    expect(r.status).toBe(400);expect(Object.keys(r.body).sort()).toEqual(['error','message']);expect(JSON.stringify(r.body)).not.toMatch(/stack|SELECT|INSERT/);
    expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name='retazo'").get()).toBeTruthy();
  });
});
