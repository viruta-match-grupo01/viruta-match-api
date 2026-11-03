import {Router,raw} from 'express';
import {randomUUID} from 'node:crypto';
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {requireRole,requireUser} from '../shared/http.js';

const MIME={"image/jpeg":'jpg',"image/png":'png',"image/webp":'webp'};
const EXT_MIME={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
const RE=/^([0-9a-f-]{36})\.(jpg|png|webp)$/;
function validSignature(bytes,mime){
 if(mime==='image/jpeg') return bytes.length>4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(mime==='image/png') return bytes.length>24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==='image/webp') return bytes.length>16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 return false;
}
/** Archivo binario autenticado, no base64 ni rutas de sistema provistas por el cliente. */
export function createFotosRouter({config}) {
 const router=Router();
 router.use(requireUser);
 router.post('/',requireRole('operario'),(req,res,next)=>{
   const origin=req.headers.origin;
   if(origin&&!config.uiOrigins.includes(origin)) return res.status(403).json({error:'ORIGEN_NO_PERMITIDO',message:'Origen no autorizado'});
   next();
 },raw({type:Object.keys(MIME),limit:'4mb'}),(req,res)=>{
   const mime=(req.headers['content-type']||'').split(';')[0].toLowerCase();
   if(!MIME[mime]||!Buffer.isBuffer(req.body)||!validSignature(req.body,mime))return res.status(400).json({error:'FOTO_INVALIDA',message:'Subí un JPG, PNG o WebP válido (máximo 4 MB)'});
   const id=randomUUID(),filename=`${id}.${MIME[mime]}`;
   mkdirSync(config.uploadDir,{recursive:true});
   writeFileSync(join(config.uploadDir,filename),req.body,{flag:'wx',mode:0o600});
   res.status(201).json({foto_url:`/api/fotos/${filename}`,tamano:req.body.length});
 });
 router.get('/:name',(req,res)=>{
   const match=RE.exec(req.params.name);
   if(!match)return res.status(404).end();
   const file=join(config.uploadDir,req.params.name);
   if(!existsSync(file))return res.status(404).end();
   res.set('Cache-Control','private, max-age=120');res.type(EXT_MIME[match[2]]);return res.sendFile(file);
 });
 return router;
}
