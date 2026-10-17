import {Router} from 'express';
import {requireRole,positiveId} from '../../../shared/http.js';
import {createCalidadService} from './service.js';

/** Control de calidad: función del encargado y solo sobre retazos de su sucursal (RF-19, RF-24). */
export function createCalidadRouter(context) {
  const router=Router(),service=createCalidadService(context),encargado=requireRole('encargado');
  router.get('/',encargado,(req,res)=>res.json(service.pending(req.user)));
  router.get('/:id',encargado,(req,res)=>res.json(service.get(positiveId(req.params.id),req.user)));
  router.post('/:id/aprobar',encargado,(req,res)=>res.json(service.approve(positiveId(req.params.id),req.user,req.body)));
  router.post('/:id/rechazar',encargado,(req,res)=>res.json(service.reject(positiveId(req.params.id),req.user,req.body)));
  router.post('/:id/corregir-medidas',encargado,(req,res)=>res.json(service.requestCorrection(positiveId(req.params.id),req.user,req.body)));
  return router;
}
