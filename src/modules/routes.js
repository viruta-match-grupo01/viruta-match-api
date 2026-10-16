import {Router} from 'express';
import {fail} from '../errors.js';
import {catalogos} from '../shared/catalogos.js';
function requireRole(role){return (req,_res,next)=>{if(!req.user) fail(401,'SESION_REQUERIDA','Iniciá sesión');if(req.user.rol!==role) fail(403,'SIN_PERMISO','No tenés permiso para esta función');next();};}
function id(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0) fail(400,'ID_INVALIDO','Identificador inválido');return n;}
export function createRoutes({pedidos,avisos,reportes,db}) {
  const router=Router();const client=requireRole('cliente'),owner=requireRole('duenio');
  router.get('/catalogos',(req,res)=>{if(!req.user)fail(401,'SESION_REQUERIDA','Iniciá sesión');res.json(catalogos);});
  router.get('/sucursales',(req,res)=>{if(!req.user) fail(401,'SESION_REQUERIDA','Iniciá sesión');res.json(db.prepare('SELECT id,nombre,direccion FROM sucursal ORDER BY id').all());});
  router.get('/pedidos',client,(req,res)=>res.json(pedidos.list(req.user.id)));
  router.post('/pedidos',client,(req,res)=>res.status(201).json(pedidos.create(req.user.id,req.body)));
  router.post('/pedidos/:id/renovar',client,(req,res)=>res.json(pedidos.renew(id(req.params.id),req.user.id)));
  router.delete('/pedidos/:id',client,(req,res)=>res.json(pedidos.cancel(id(req.params.id),req.user.id)));
  router.get('/avisos',client,(req,res)=>res.json(avisos.list(req.user.id)));
  router.get('/avisos/:id',client,(req,res)=>res.json(avisos.get(id(req.params.id),req.user.id)));
  router.get('/reportes',owner,(_req,res)=>res.json(reportes.get()));
  router.post('/avisos/:id/reconciliar',owner,(req,res)=>{avisos.reconcile(id(req.params.id),req.body.canal,req.body.entregado);res.json({ok:true});});
  return router;
}
