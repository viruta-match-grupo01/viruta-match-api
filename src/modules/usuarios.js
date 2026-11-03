import {Router} from 'express';
import bcrypt from 'bcrypt';
import {z} from 'zod';
import {requireRole,positiveId} from '../shared/http.js';
import {fail} from '../errors.js';

const roles=['cliente','operario','encargado','duenio'];
const email=z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const userCreate=z.object({
 nombre:z.string().trim().min(2).max(80),email,
 password:z.string().min(10).max(100),rol:z.enum(roles),
 sucursal_id:z.number().int().positive().nullable().optional(),
 estado:z.enum(['activo','inactivo']).optional()
}).strict();
const userUpdate=userCreate.omit({password:true}).partial().extend({password:z.string().min(10).max(100).optional()}).strict();
const publicFields='id,nombre,email,rol,sucursal_id,estado';
function parse(schema,v){let r=schema.safeParse(v);if(!r.success)fail(400,'DATOS_INVALIDOS',r.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));return r.data;}
function branch(db,rol,id){
 if(['operario','encargado'].includes(rol)){
   if(!id||!db.prepare('SELECT id FROM sucursal WHERE id=?').get(id))fail(400,'SUCURSAL_INVALIDA','El rol necesita una sucursal válida');
   return id;
 }
 if(id)fail(400,'SUCURSAL_INVALIDA','Los usuarios clientes y dueños no tienen sucursal fija');
 return null;
}
function duplicate(e){if(String(e.code||'').startsWith('SQLITE_CONSTRAINT'))fail(409,'CORREO_EN_USO','El correo ya está registrado');throw e;}
export function createUsuariosRouter({db}){
 const r=Router();r.use(requireRole('duenio'));
 r.get('/',(_req,res)=>res.json(db.prepare(`SELECT ${publicFields} FROM usuario ORDER BY rol,nombre LIMIT 500`).all()));
 r.post('/',async(req,res)=>{
   const input=parse(userCreate,req.body);const sucursal=branch(db,input.rol,input.sucursal_id);
   const hash=await bcrypt.hash(input.password,12);let id;
   try{id=db.transaction(()=>{
     const saved=db.prepare('INSERT INTO usuario(nombre,email,password_hash,rol,sucursal_id,estado) VALUES(?,?,?,?,?,?)')
       .run(input.nombre,input.email,hash,input.rol,sucursal,input.estado??'activo');
     const uid=Number(saved.lastInsertRowid);
     if(input.rol==='cliente')db.prepare("INSERT INTO perfil_cliente(usuario_id,tipo,medio_aviso) VALUES(?,'estudiante','correo')").run(uid);
     return uid;
   })();}catch(e){duplicate(e);}
   res.status(201).json(db.prepare(`SELECT ${publicFields} FROM usuario WHERE id=?`).get(id));
 });
 r.patch('/:id',async(req,res)=>{
   const id=positiveId(req.params.id);const input=parse(userUpdate,req.body);
   const old=db.prepare('SELECT * FROM usuario WHERE id=?').get(id);
   if(!old)fail(404,'USUARIO_NO_ENCONTRADO','Usuario no encontrado');
   const next={...old,...input};next.sucursal_id=branch(db,next.rol,next.sucursal_id);
   if(id===req.user.id&&(next.estado!=='activo'||next.rol!=='duenio'))fail(409,'AUTO_BLOQUEO','No podés desactivar ni quitarte tu propio rol de dueño');
   if(old.rol==='duenio'&&(next.rol!=='duenio'||next.estado!=='activo')&&db.prepare("SELECT COUNT(*) n FROM usuario WHERE rol='duenio' AND estado='activo'").get().n<=1)
     fail(409,'ULTIMO_DUENIO','No se puede desactivar al último dueño');
   let hash=old.password_hash;if(input.password)hash=await bcrypt.hash(input.password,12);
   try{db.transaction(()=>{
     db.prepare('UPDATE usuario SET nombre=?,email=?,password_hash=?,rol=?,sucursal_id=?,estado=? WHERE id=?').run(next.nombre,next.email,hash,next.rol,next.sucursal_id,next.estado,id);
     if(next.rol==='cliente')db.prepare("INSERT INTO perfil_cliente(usuario_id,tipo,medio_aviso) VALUES(?,'estudiante','correo') ON CONFLICT(usuario_id) DO NOTHING").run(id);
     else db.prepare('DELETE FROM perfil_cliente WHERE usuario_id=?').run(id);
   })();}catch(e){duplicate(e);}
   res.json(db.prepare(`SELECT ${publicFields} FROM usuario WHERE id=?`).get(id));
 });
 return r;
}
