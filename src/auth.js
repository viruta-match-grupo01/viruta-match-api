import {Router} from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {rateLimit} from 'express-rate-limit';
const COOKIE='viruta_session';
export function createAuth({db,config}) {
  const cookie={httpOnly:true,secure:config.production,sameSite:'lax',path:'/api',maxAge:8*3600000};
  const router=Router();
  const limiter=rateLimit({windowMs:15*60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'DEMASIADOS_INTENTOS',message:'Esperá unos minutos antes de intentar otra vez'}});
  const view=u=>({id:u.id,nombre:u.nombre,email:u.email,rol:u.rol,sucursal_id:u.sucursal_id});
  function authenticate(req,_res,next) {
    req.user=null;
    try {
      const token=req.cookies?.[COOKIE];
      if(token) {
        const decoded=jwt.verify(token,config.jwtSecret,{algorithms:['HS256'],issuer:'viruta-match-api',audience:'viruta-match-ui'});
        const u=db.prepare("SELECT * FROM usuario WHERE id=? AND estado='activo'").get(Number(decoded.sub));
        if(u) req.user=view(u);
      }
    } catch { /* Una cookie vencida o alterada no inicia sesión. */ }
    next();
  }
  router.post('/login',limiter,async(req,res)=>{
    const {email,password}=req.body??{};
    if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>200) return res.status(400).json({error:'DATOS_INVALIDOS',message:'Indicá correo y contraseña'});
    const u=db.prepare("SELECT * FROM usuario WHERE lower(email)=? AND estado='activo'").get(email.trim().toLowerCase());
    if(!u||!await bcrypt.compare(password,u.password_hash)) return res.status(401).json({error:'CREDENCIALES_INVALIDAS',message:'Correo o contraseña incorrectos'});
    const token=jwt.sign({},config.jwtSecret,{subject:String(u.id),algorithm:'HS256',expiresIn:'8h',issuer:'viruta-match-api',audience:'viruta-match-ui'});
    res.cookie(COOKIE,token,cookie);res.json(view(u));
  });
  // RF-08: registro de nuevos clientes para el entorno académico. No da roles internos.
  const emailValid=v=>typeof v==='string'&&v.trim().length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const phoneValid=v=>typeof v==='string'&&/^[+\d() -]{8,24}$/.test(v.trim())&&v.replace(/\D/g,'').length>=8;
  const media=['correo','whatsapp','ambos'];
  router.post('/registro',limiter,async(req,res)=>{
    if(!config.allowClientRegistration) return res.status(403).json({error:'REGISTRO_NO_DISPONIBLE',message:'El registro público solo está habilitado en el entorno de pruebas autorizado'});
    const {nombre,email,password,telefono='',medio_aviso='correo'}=req.body??{};
    if(typeof nombre!=='string'||nombre.trim().length<2||nombre.trim().length>80||!emailValid(email)||typeof password!=='string'||password.length<10||password.length>100||!media.includes(medio_aviso))
      return res.status(400).json({error:'DATOS_INVALIDOS',message:'Nombre, correo y contraseña (mínimo 10 caracteres) válidos son obligatorios'});
    if((medio_aviso!=='correo'&&!phoneValid(telefono))||(telefono!==''&&!phoneValid(telefono)))
      return res.status(400).json({error:'TELEFONO_INVALIDO',message:'El medio WhatsApp requiere teléfono válido'});
    const mail=email.trim().toLowerCase();
    if(db.prepare('SELECT id FROM usuario WHERE lower(email)=?').get(mail))
      return res.status(409).json({error:'CORREO_EN_USO',message:'La cuenta ya existe'});
    const hash=await bcrypt.hash(password,12);
    let userId;
    try{
      userId=db.transaction(()=>{
        const insert=db.prepare("INSERT INTO usuario(nombre,email,password_hash,telefono,rol,estado) VALUES(?,?,?,?, 'cliente','activo')").run(nombre.trim(),mail,hash,telefono.trim()||null);
        const id=Number(insert.lastInsertRowid);
        db.prepare("INSERT INTO perfil_cliente(usuario_id,tipo,medio_aviso) VALUES(?,'estudiante',?)").run(id,medio_aviso);
        return id;
      })();
    }catch(error){
      if(String(error.code||'').startsWith('SQLITE_CONSTRAINT'))return res.status(409).json({error:'CORREO_EN_USO',message:'La cuenta ya existe'});
      throw error;
    }
    const user=db.prepare('SELECT * FROM usuario WHERE id=?').get(userId);
    const token=jwt.sign({},config.jwtSecret,{subject:String(user.id),algorithm:'HS256',expiresIn:'8h',issuer:'viruta-match-api',audience:'viruta-match-ui'});
    res.cookie(COOKIE,token,cookie);return res.status(201).json(view(user));
  });
  router.get('/preferencias',(req,res)=>{
    if(req.user?.rol!=='cliente')return res.status(403).json({error:'ROL_NO_PERMITIDO',message:'Disponible solo para clientes'});
    const row=db.prepare('SELECT p.medio_aviso,u.telefono FROM perfil_cliente p JOIN usuario u ON u.id=p.usuario_id WHERE p.usuario_id=?').get(req.user.id);
    return row?res.json(row):res.status(404).json({error:'PERFIL_NO_ENCONTRADO'});
  });
  router.patch('/preferencias',(req,res)=>{
    if(req.user?.rol!=='cliente')return res.status(403).json({error:'ROL_NO_PERMITIDO',message:'Disponible solo para clientes'});
    const {medio_aviso,telefono=''}=req.body??{};
    if(!media.includes(medio_aviso)||typeof telefono!=='string'||(telefono&& !phoneValid(telefono))||(medio_aviso!=='correo'&&!phoneValid(telefono)))
      return res.status(400).json({error:'DATOS_INVALIDOS',message:'Medio de aviso o teléfono inválidos'});
    db.transaction(()=>{
      db.prepare('UPDATE perfil_cliente SET medio_aviso=? WHERE usuario_id=?').run(medio_aviso,req.user.id);
      db.prepare('UPDATE usuario SET telefono=? WHERE id=?').run(telefono.trim()||null,req.user.id);
    })();
    return res.json({medio_aviso,telefono:telefono.trim()||null});
  });
  router.get('/me',(req,res)=>req.user?res.json(req.user):res.status(401).json({error:'SESION_REQUERIDA',message:'Iniciá sesión'}));
  router.post('/logout',(_req,res)=>{res.clearCookie(COOKIE,{httpOnly:true,secure:cookie.secure,sameSite:cookie.sameSite,path:cookie.path});res.json({ok:true});});
  return {router,authenticate};
}
