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
  router.get('/me',(req,res)=>req.user?res.json(req.user):res.status(401).json({error:'SESION_REQUERIDA',message:'Iniciá sesión'}));
  router.post('/logout',(_req,res)=>{res.clearCookie(COOKIE,{httpOnly:true,secure:cookie.secure,sameSite:cookie.sameSite,path:cookie.path});res.json({ok:true});});
  return {router,authenticate};
}
