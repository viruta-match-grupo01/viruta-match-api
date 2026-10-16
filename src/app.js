import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import {EventEmitter} from 'node:events';
import {createDevB} from './index.js';
import {createAuth} from './auth.js';
import {createCalendar} from './calendar.js';
import {createCaptureChannel,createSmtpChannel,createUnavailableWhatsAppChannel} from './channels.js';
import {createEquipoRouter,createEquipoTasks} from './modules/equipo.js';

export function createApp({db,config,bus=new EventEmitter(),clock:customClock,channels:customChannels,equipoRouterFactory=createEquipoRouter,equipoTasksFactory=createEquipoTasks}) {
  let offset=0;const clock=customClock??(()=>new Date(Date.now()+offset));
  const calendar=createCalendar({days:config.businessDays,holidays:config.holidays});
  const capture=createCaptureChannel();
  const channels=customChannels??{correo:config.notificationMode==='smtp'?createSmtpChannel(config.smtp):capture,whatsapp:createUnavailableWhatsAppChannel()};
  const b=createDevB({db,clock,calendar,bus,channels,publicAppUrl:config.publicAppUrl});
  const context={db,bus,clock,calendar,devB:b};
  const equipoTasks=equipoTasksFactory(context);
  async function tick(){await equipoTasks.tick();return b.tick();}
  function dispose(){equipoTasks.dispose?.();b.dispose();}
  const app=express();app.disable('x-powered-by');app.use(express.json({limit:'32kb'}));app.use(cookieParser());
  app.use((req,res,next)=>{
    const origin=req.headers.origin;
    if(origin&&!config.uiOrigins.includes(origin))return res.status(403).json({error:'ORIGEN_NO_PERMITIDO',message:'Origen no autorizado'});
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!req.is('application/json'))return res.status(415).json({error:'JSON_REQUERIDO',message:'Usar application/json'});
    next();
  });
  app.use(cors({origin:(origin,callback)=>callback(null,!origin||config.uiOrigins.includes(origin)),credentials:true}));
  app.get('/health',(_req,res)=>res.json({ok:true,service:'viruta-match-api',mode:config.production?'production':'development'}));
  const auth=createAuth({db,config});app.use('/api',auth.authenticate);app.use('/api/auth',auth.router);
  if(config.allowDemo) {
    app.use('/api/demo',(req,res,next)=>{if(!req.user)return res.status(401).json({error:'SESION_REQUERIDA',message:'Iniciá sesión'});next();});
    app.get('/api/demo/estado',(_req,res)=>res.json({ahora:clock().toISOString(),retazos:db.prepare('SELECT * FROM retazo ORDER BY id').all(),capturados:capture.messages.length}));
    app.get('/api/demo/correos',(_req,res)=>res.json(capture.messages));
    app.post('/api/demo/tick',async(_req,res)=>res.json(await b.tick()));
    app.post('/api/demo/avanzar',async(req,res)=>{const m=Number(req.body.minutos);if(!Number.isFinite(m)||m<0||m>44640)return res.status(400).json({message:'Minutos entre 0 y 44640'});offset+=m*60000;await b.tick();res.json({ahora:clock().toISOString()});});
    app.post('/api/demo/retazos/:id/aprobar',async(req,res)=>{const id=Number(req.params.id);db.prepare("UPDATE retazo SET estado='disponible' WHERE id=? AND estado='pendiente_control'").run(id);bus.emit('retazo.disponible',{retazoId:id});await b.tick();res.json({ok:true});});
  }
  app.use('/api',equipoRouterFactory(context));
  app.use('/api',b.router);
  app.use('/api',(req,res)=>{if(!req.user)return res.status(401).json({error:'SESION_REQUERIDA',message:'Iniciá sesión'});return res.status(501).json({error:'MODULO_PENDIENTE',message:'Esta función todavía no está disponible.'});});
  app.use((error,_req,res,_next)=>{
    const badJson=error.type==='entity.parse.failed';const status=badJson?400:error.status??500;
    res.status(status).json({error:badJson?'JSON_INVALIDO':error.code??'ERROR_INTERNO',message:badJson?'JSON inválido':error.status?error.message:'Error interno'});
  });
  return {app,context,b,channels,tick,dispose};
}
