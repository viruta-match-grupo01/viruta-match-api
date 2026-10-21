import cron from 'node-cron';
import {readConfig} from './config.js';
import {openDatabase} from './database.js';
import {createApp} from './app.js';
const config=readConfig();const db=openDatabase(config.databasePath);
if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuario'").get())throw new Error('Base sin inicializar. Ejecutá npm run db:migrate y, en desarrollo, npm run db:seed');
const runtime=createApp({db,config});
let currentTick=Promise.resolve();
function tick(){currentTick=runtime.tick().catch(error=>console.error('Worker B:',error.code??error.name));return currentTick;}
await tick();const job=cron.schedule('* * * * *',tick,{noOverlap:true});
const server=runtime.app.listen(config.port,config.host,()=>console.log(`API: http://${config.host}:${config.port} | SQLite: ${config.databasePath} | avisos: ${config.notificationMode}`));
let closing=false;
async function shutdown(){if(closing)return;closing=true;job.stop();server.close(async()=>{await currentTick;runtime.dispose();runtime.channels.correo.close?.();db.close();});}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
