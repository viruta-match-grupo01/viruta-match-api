import {Router} from 'express';
import {requireRole} from '../../../shared/http.js';
import {createPreciosService} from './service.js';

/** Tabla de precios por m². Solo el dueño la consulta y modifica (RF-21, RF-24). */
export function createPreciosRouter(context) {
  const router=Router(),service=createPreciosService(context),owner=requireRole('duenio');
  router.get('/',owner,(_req,res)=>res.json(service.list()));
  router.put('/',owner,(req,res)=>res.json(service.upsert(req.body)));
  return router;
}
