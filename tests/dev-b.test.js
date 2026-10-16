import {describe,it,expect,afterEach} from 'vitest';
import express from 'express';
import request from 'supertest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {openDatabase,createDemoSchema,migrateDevB} from '../src/database.js';
import {seedDemo} from '../src/seed.js';
import {createDevB} from '../src/index.js';
import {createCalendar} from '../src/calendar.js';
import {createCaptureChannel,createUnavailableWhatsAppChannel} from '../src/channels.js';
import {matches} from '../src/modules/matching.service.js';

const cleanup=[];afterEach(()=>{while(cleanup.length) cleanup.pop()();});
const iso='2026-10-14T13:00:00.000Z'; // 10:00 Buenos Aires
function fixture({filename=':memory:',channels,seed=true}={}) {
  const db=openDatabase(filename);createDemoSchema(db);migrateDevB(db);if(seed) seedDemo(db,new Date(iso));
  let now=new Date(iso);const correo=createCaptureChannel(),whatsapp=createCaptureChannel();
  const b=createDevB({db,clock:()=>new Date(now),channels:channels??{correo,whatsapp}});
  cleanup.push(()=>{b.dispose();if(db.open)db.close();});
  return {db,b,correo,whatsapp,setTime:d=>{now=new Date(d);},now:()=>now};
}
const input={material:'MDF',espesor_mm:18,alto_min_cm:40,ancho_min_cm:60,sucursal_preferida_id:1};
function order(f,client=1,overrides={}){return f.b.pedidos.create(client,{...input,...overrides});}
function scrap(f,id,{state='disponible',branch=1,height=40,width=60}={}) {
  f.db.prepare(`INSERT INTO retazo(id,material,espesor_mm,alto_cm,ancho_cm,sucursal_id,foto_url,forma_retiro,precio,estado,cargado_en) VALUES(?,'MDF',18,?,?,?,'/demo.svg','presencial',2000,?,?)`).run(id,height,width,branch,state,iso);
}
function app(f) {
  const a=express();a.use(express.json());a.use((req,_res,next)=>{const id=Number(req.headers['x-test-user']);req.user=f.db.prepare('SELECT id,rol FROM usuario WHERE id=?').get(id||0);next();});a.use('/api',f.b.router);
  a.use((e,_req,res,_next)=>res.status(e.status??500).json({code:e.code,message:e.message}));return a;
}

describe('CP-09 Pedidos y aislamiento',()=>{
  it('permite tres y rechaza el cuarto, incluyendo intentos concurrentes',async()=>{
    const f=fixture();const a=app(f);
    const responses=await Promise.all(Array.from({length:10},()=>request(a).post('/api/pedidos').set('x-test-user','1').send(input)));
    expect(responses.filter(r=>r.status===201)).toHaveLength(3);expect(responses.filter(r=>r.status===409)).toHaveLength(7);
    expect(f.b.pedidos.list(1)).toHaveLength(3);
  });
  it('vence exactamente a los 30 días aunque tenga aviso; no vence un minuto antes',()=>{
    const f=fixture();const p=order(f);f.setTime('2026-11-13T12:59:59.999Z');expect(f.b.pedidos.list(1)[0].estado).toBe('abierto');
    f.setTime(p.vence_en);expect(f.b.pedidos.list(1)[0].estado).toBe('vencido');expect(f.db.prepare("SELECT COUNT(*) n FROM aviso WHERE estado='en_cola'").get().n).toBe(0);
  });
  it('renueva por 30 días desde ahora sin alterar creado_en',()=>{
    const f=fixture();const p=order(f);f.setTime('2026-10-20T13:00:00Z');const renewed=f.b.pedidos.renew(p.id,1);
    expect(renewed.vence_en).toBe('2026-11-19T13:00:00.000Z');expect(renewed.creado_en).toBe(p.creado_en);
  });
  it('cancelar deja lugar libre y cancela el aviso asociado',()=>{
    const f=fixture();const p=order(f);f.b.pedidos.cancel(p.id,1);expect(f.b.pedidos.list(1)[0].estado).toBe('cancelado');
    expect(f.db.prepare('SELECT estado FROM aviso WHERE pedido_id=?').get(p.id).estado).toBe('cancelado');order(f);
  });
  it('renovar un pedido cerrado abre un nuevo ciclo de avisos',()=>{
    const f=fixture();const p=order(f);f.b.pedidos.cancel(p.id,1);f.b.pedidos.renew(p.id,1);
    expect(f.db.prepare("SELECT COUNT(*) n FROM aviso WHERE pedido_id=? AND estado='en_cola'").get(p.id).n).toBe(2);
  });
  it('un cliente no lee, cancela ni renueva pedidos ajenos',async()=>{
    const f=fixture();const p=order(f);expect(()=>f.b.pedidos.cancel(p.id,2)).toThrow('Pedido no encontrado');
    expect(()=>f.b.pedidos.renew(p.id,2)).toThrow('Pedido no encontrado');expect(f.b.pedidos.list(2)).toEqual([]);
    const aid=f.db.prepare('SELECT id FROM aviso LIMIT 1').get().id;
    expect((await request(app(f)).get(`/api/avisos/${aid}`).set('x-test-user','2')).status).toBe(404);
  });
  it('rechaza campos de dueño, colores inválidos y espesores no admitidos',()=>{
    const f=fixture();for(const x of [{cliente_id:2},{espesor_mm:10},{alto_min_cm:0},{alto_min_cm:121},{material:'terciado'},{material:'melamina',color:'rojo',acabado:'mate'},{material:'melamina',color:'blanco'},{color:'blanco'},{tolerancia_pct:-1}]) expect(()=>order(f,1,x)).toThrow();
  });
  it('reserva activa impide cancelar el pedido por debajo del dev C',()=>{
    const f=fixture();const p=order(f);f.db.prepare("INSERT INTO reserva(cliente_id,retazo_id,pedido_id,estado,confirmada_en,vence_en) VALUES(1,1,?,'activa',?,?)").run(p.id,iso,'2026-10-15T13:00:00Z');
    expect(()=>f.b.pedidos.cancel(p.id,1)).toThrow('Cancelá primero la reserva');
  });
});
describe('CP-10/11/12/20 Matching',()=>{
  const p={...input,estado:'abierto',color:null,acabado:null,tolerancia_pct:null};
  const r={material:'MDF',espesor_mm:18,alto_cm:40,ancho_cm:66,sucursal_id:1,estado:'disponible'};
  it.each([[40,66,true],[60,60,false],[35,70,false],[60,40,true],[40,78,true],[40,79,false]])('40×60 vs %s×%s => %s',(h,w,result)=>expect(matches({...r,alto_cm:h,ancho_cm:w},p)).toBe(result));
  it('tol propia 10%, 0% y superior al 100% sin tope',()=>{
    expect(matches(r,{...p,tolerancia_pct:10})).toBe(true);expect(matches({...r,ancho_cm:67},{...p,tolerancia_pct:10})).toBe(false);
    expect(matches(r,{...p,tolerancia_pct:0})).toBe(false);expect(matches({...r,alto_cm:100,ancho_cm:100},{...p,tolerancia_pct:500})).toBe(true);
  });
  it.each([{material:'aglomerado'},{espesor_mm:15},{sucursal_id:2},{estado:'pendiente_control'},{estado:'descartado'},{alto_cm:15},{ancho_cm:125}])('un cambio incompatible rechaza %j',change=>expect(matches({...r,...change},p)).toBe(false));
  it('melamina exige igualdad de color y acabado',()=>{
    const rp={...r,material:'melamina',color:'roble',acabado:'mate'};const pp={...p,material:'melamina',color:'roble',acabado:'mate'};
    expect(matches(rp,pp)).toBe(true);expect(matches({...rp,color:'blanco'},pp)).toBe(false);expect(matches({...rp,acabado:'brillante'},pp)).toBe(false);
  });
  it('calidad pendiente no genera avisos y disponible sí',()=>{
    const f=fixture();f.db.prepare("UPDATE retazo SET estado='pendiente_control' WHERE estado='disponible'").run();order(f);expect(f.db.prepare('SELECT COUNT(*) n FROM aviso').get().n).toBe(0);
    f.db.prepare("UPDATE retazo SET estado='disponible' WHERE id=4").run();f.b.matching.scan();expect(f.db.prepare('SELECT retazo_id FROM aviso').get().retazo_id).toBe(4);
  });
  it('un evento de A se recupera leyendo el estado de la base',()=>{
    const f=fixture();order(f);f.db.prepare("UPDATE retazo SET estado='disponible' WHERE id=4").run();f.b.matching.scan({retazoId:4});
    expect(f.db.prepare('SELECT retazo_id FROM aviso WHERE retazo_id=4').get().retazo_id).toBe(4);
  });
  it('recupera retazo liberado por C aun sin evento en memoria',()=>{
    const f=fixture();f.db.prepare("INSERT INTO reserva(cliente_id,retazo_id,estado,confirmada_en,vence_en) VALUES(2,1,'vencida',?,?)").run(iso,iso);order(f);
    expect(f.db.prepare('SELECT tipo FROM aviso WHERE retazo_id=1').get().tipo).toBe('liberado');
  });
  it('prioriza retazo más antiguo y pedido más antiguo; scan repetido es idempotente',()=>{
    const f=fixture();const p1=order(f);f.setTime('2026-10-14T13:01:00Z');order(f,2);for(let i=0;i<10;i++)f.b.matching.scan();
    const notices=f.db.prepare('SELECT * FROM aviso ORDER BY id').all();expect(notices).toHaveLength(2);expect(notices[0].retazo_id).toBe(1);expect(notices.every(a=>a.pedido_id===p1.id)).toBe(true);
  });
  it('el cliente con reserva activa no recibe nuevas ofertas',()=>{
    const f=fixture();f.db.prepare("INSERT INTO reserva(cliente_id,retazo_id,estado,confirmada_en,vence_en) VALUES(1,1,'activa',?,?)").run(iso,'2026-10-15T13:00:00Z');order(f);expect(f.db.prepare('SELECT COUNT(*) n FROM aviso').get().n).toBe(0);
  });
});
describe('CP-14/15/16/22 Avisos persistentes',()=>{
  it('ambos medios reciben el aviso lógico una vez por canal',async()=>{
    const f=fixture();f.db.prepare("UPDATE perfil_cliente SET medio_aviso='ambos' WHERE usuario_id=1").run();order(f);await f.b.tick();await f.b.tick();
    expect(f.correo.messages).toHaveLength(2);expect(f.whatsapp.messages).toHaveLength(2);expect(f.db.prepare("SELECT COUNT(*) n FROM aviso WHERE estado='enviado'").get().n).toBe(2);
  });
  it('WhatsApp no configurado usa correo como respaldo',async()=>{
    const correo=createCaptureChannel();const f=fixture({channels:{correo,whatsapp:createUnavailableWhatsAppChannel()}});f.db.prepare("UPDATE perfil_cliente SET medio_aviso='whatsapp' WHERE usuario_id=1").run();order(f);await f.b.tick();expect(correo.messages).toHaveLength(2);
  });
  it('máximo 3 avisos lógicos diarios, 4to queda en cola al día siguiente',async()=>{
    const f=fixture();scrap(f,10);scrap(f,11);order(f);await f.b.tick();expect(f.correo.messages).toHaveLength(3);
    const a=f.db.prepare("SELECT * FROM aviso WHERE estado='en_cola'").get();expect(a.programado_para).toBe('2026-10-15T11:00:00.000Z');
    f.setTime(a.programado_para);await f.b.tick();expect(f.correo.messages).toHaveLength(4);
  });
  it('ambos canales no consumen dos cupos',async()=>{
    const f=fixture();scrap(f,10);f.db.prepare("UPDATE perfil_cliente SET medio_aviso='ambos' WHERE usuario_id=1").run();order(f);await f.b.tick();expect(f.correo.messages).toHaveLength(3);expect(f.whatsapp.messages).toHaveLength(3);
  });
  it('fuera de horario espera a las 8 y no empieza el plazo antes del envío',async()=>{
    const f=fixture();f.setTime('2026-10-15T00:00:00Z');order(f);await f.b.tick();expect(f.correo.messages).toHaveLength(0);
    expect(f.db.prepare('SELECT vence_confirmacion_en FROM aviso LIMIT 1').get().vence_confirmacion_en).toBeNull();
    f.setTime('2026-10-15T11:00:00Z');await f.b.tick();expect(f.correo.messages).toHaveLength(2);
  });
  it('20:00 es límite exclusivo para envío; 19:59 sí',async()=>{
    const f=fixture();f.setTime('2026-10-14T23:00:00Z');order(f);await f.b.tick();expect(f.correo.messages).toHaveLength(0);
    f.setTime('2026-10-15T22:59:00Z');await f.b.tick();expect(f.correo.messages).toHaveLength(2);
  });
  it('aviso 19:30 vence 09:30 siguiente y pasa al segundo pedido',async()=>{
    const f=fixture();f.setTime('2026-10-14T22:30:00Z');const p=order(f);order(f,2);await f.b.tick();
    expect(f.db.prepare('SELECT vence_confirmacion_en FROM aviso WHERE pedido_id=? LIMIT 1').get(p.id).vence_confirmacion_en).toBe('2026-10-15T12:30:00.000Z');
    f.setTime('2026-10-15T12:30:00Z');await f.b.tick();expect(f.db.prepare("SELECT COUNT(*) n FROM aviso a JOIN pedido p ON p.id=a.pedido_id WHERE p.cliente_id=2 AND a.estado='enviado'").get().n).toBe(2);
    expect(f.b.pedidos.list(1)[0].estado).toBe('abierto');
  });
  it('un retazo tomado antes del envío cancela la cola',async()=>{
    const f=fixture();order(f);f.db.prepare("UPDATE retazo SET estado='reservado' WHERE id=1").run();await f.b.tick();expect(f.correo.messages).toHaveLength(1);expect(f.db.prepare('SELECT estado FROM aviso WHERE retazo_id=1').get().estado).toBe('cancelado');
  });
  it('la cola sobrevive a reiniciar la conexión',async()=>{
    const dir=mkdtempSync(join(tmpdir(),'viruta-'));cleanup.push(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'test.db');
    const f=fixture({filename:file});f.setTime('2026-10-15T00:00:00Z');order(f);f.b.dispose();f.db.close();
    const g=fixture({filename:file});g.setTime('2026-10-15T11:00:00Z');await g.b.tick();expect(g.correo.messages).toHaveLength(2);
  });
  it('dos workers simultáneos no duplican entregas',async()=>{
    const f=fixture();order(f);const result=await Promise.all([f.b.tick(),f.b.tick()]);expect(result.some(x=>x.busy)).toBe(true);expect(f.correo.messages).toHaveLength(2);
  });
  it('envío incierto exige reconciliación y no se reenvía automáticamente',async()=>{
    const send=async()=>{throw new Error('Conexión cortada después de enviar');};const f=fixture({channels:{correo:{send},whatsapp:{send}}});order(f);await f.b.tick();await f.b.tick();
    expect(f.db.prepare("SELECT COUNT(*) n FROM aviso WHERE error_codigo='ENVIO_INCIERTO'").get().n).toBe(2);
    const id=f.db.prepare('SELECT id FROM aviso LIMIT 1').get().id;f.b.avisos.reconcile(id,'correo',true);expect(f.db.prepare('SELECT estado FROM aviso WHERE id=?').get(id).estado).toBe('enviado');
  });
  it('la recuperación de un envío interrumpido conserva estado incierto',async()=>{
    const f=fixture();order(f);const id=f.db.prepare('SELECT id FROM aviso LIMIT 1').get().id;
    f.db.prepare("INSERT INTO aviso_envio(aviso_id,canal,estado,iniciado_en) VALUES(?,'correo','enviando',?)").run(id,iso);
    await f.b.tick();expect(f.db.prepare('SELECT estado FROM aviso WHERE id=?').get(id).estado).toBe('fallido');expect(f.correo.messages).toHaveLength(1);
  });
  it('contenido incluye datos y ambos plazos CP-13',async()=>{
    const f=fixture();order(f);await f.b.tick();const a=f.b.avisos.list(1)[0];for(const k of ['foto_url','precio','sucursal_nombre','forma_retiro','plazo_confirmacion','plazo_retiro'])expect(a[k]).toBeTruthy();
    expect(f.correo.messages[0].text).toContain('2 horas');expect(f.correo.messages[0].text).toContain('12 horas');
  });
});
describe('Calendario compartido y reportes',()=>{
  it.each([['2026-10-14T18:00:00Z','2026-10-15T18:00:00.000Z'],['2026-10-14T22:30:00Z','2026-10-15T22:30:00.000Z'],['2026-10-15T01:00:00Z','2026-10-15T23:00:00.000Z']])('CP-17 sumar 12 horas %s',(start,end)=>expect(createCalendar().addHours(start,12).toISOString()).toBe(end));
  it('el calendario permite excluir domingos y feriados explícitos',()=>{
    const c=createCalendar({days:[1,2,3,4,5,6],holidays:['2026-10-19']});expect(c.nextOpen('2026-10-18T15:00:00Z').toISOString()).toBe('2026-10-20T11:00:00.000Z');
  });
  it('CP-25 totales por sucursal sin duplicación por joins',()=>{
    const f=fixture();order(f);const r=f.b.reportes.get();expect(r.totales.cargados).toBe(5);expect(r.sucursales[0].cargados).toBe(4);expect(r.sucursales[1].cargados).toBe(1);expect(r.totales.coincidencias).toBe(2);
  });
  it('RNF-03 autorización API y rol dueño',async()=>{
    const f=fixture(),a=app(f);expect((await request(a).get('/api/pedidos')).status).toBe(401);expect((await request(a).get('/api/reportes').set('x-test-user','1')).status).toBe(403);expect((await request(a).get('/api/reportes').set('x-test-user','3')).status).toBe(200);
  });
  it('CP-28 matching de 500 retazos dentro de 3s en este entorno',()=>{
    const f=fixture();f.db.transaction(()=>{for(let i=10;i<510;i++)scrap(f,i);}).immediate();const start=performance.now();order(f);const elapsed=performance.now()-start;console.log(`Matching 500 retazos: ${elapsed.toFixed(1)} ms`);expect(elapsed).toBeLessThanOrEqual(3000);
  });
});
