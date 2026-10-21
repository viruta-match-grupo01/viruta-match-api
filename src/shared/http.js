import {fail} from '../errors.js';
export function requireUser(req,_res,next){if(!req.user)fail(401,'SESION_REQUERIDA','Iniciá sesión');next();}
export function requireRole(...roles){return (req,res,next)=>{requireUser(req,res,()=>{});if(!roles.includes(req.user.rol))fail(403,'SIN_PERMISO','No tenés permiso para esta función');next();};}
export function positiveId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)fail(400,'ID_INVALIDO','Identificador inválido');return n;}
export function requireBranch(user,branchId){if(user.sucursal_id!==branchId)fail(403,'SUCURSAL_NO_PERMITIDA','La operación corresponde a otra sucursal');}
