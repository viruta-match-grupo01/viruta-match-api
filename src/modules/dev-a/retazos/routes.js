import {Router} from 'express';
import {requireRole,positiveId} from '../../../shared/http.js';
import {createRetazosService} from './service.js';

/** Carga de retazos: función del operario (RF-24). Solo ve y crea lo propio. */
export function createRetazosRouter(context) {
  const router=Router(),service=createRetazosService(context),operario=requireRole('operario');
  router.get('/precio',operario,(req,res)=>res.json(service.estimarPrecio(req.query)));
  router.get('/',operario,(req,res)=>res.json(service.list(req.user)));
  router.post('/',operario,(req,res)=>res.status(201).json(service.create(req.user,req.body)));
  router.get('/:id',operario,(req,res)=>res.json(service.get(positiveId(req.params.id),req.user)));
  router.patch('/:id/medidas',operario,(req,res)=>res.json(service.correct(positiveId(req.params.id),req.user,req.body)));
  return router;
}
