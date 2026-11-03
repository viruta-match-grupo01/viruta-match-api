import {Router} from 'express';
import {requireRole,positiveId} from '../../shared/http.js';
import {createReservasService} from './reservas.service.js';
import {createPagosService} from './pagos.service.js';
import {createMercadoPago} from '../mercadopago.js';

/** Módulo C: reservas y pago/retiro manual. El vencimiento corre desde tasks.tick y también en cada operación. */
export function createDevC({db,bus,clock,calendar,config}) {
  const reservas=createReservasService({db,bus,clock,calendar});
  const pagos=createPagosService({db,bus,clock,reservas});
  const mp=createMercadoPago({db,clock,config:config??{mercadoPago:{accessToken:"",sandbox:true,publicAppUrl:"http://localhost:5173"}}});
  const client=requireRole('cliente'),manager=requireRole('encargado');
  const reservasRouter=Router();
  reservasRouter.post('/',client,(req,res)=>res.status(201).json(reservas.create(req.user,req.body)));
  reservasRouter.get('/',client,(req,res)=>res.json(reservas.list(req.user)));
  reservasRouter.get('/:id',client,(req,res)=>res.json(reservas.get(positiveId(req.params.id),req.user)));
  reservasRouter.delete('/:id',client,(req,res)=>res.json(reservas.cancel(positiveId(req.params.id),req.user)));
  const pagosRouter=Router();
  pagosRouter.post('/mercadopago/:id/preferencia',client,async(req,res)=>res.status(201).json(await mp.createPreference(req.user,positiveId(req.params.id))));
  pagosRouter.post('/mercadopago/:id/verificar',client,async(req,res)=>res.json(await mp.verify(req.user,positiveId(req.params.id),req.body?.pago_id)));
  pagosRouter.post('/',manager,(req,res)=>res.status(201).json(pagos.registerPayment(req.user,req.body)));
  const retirosRouter=Router();
  retirosRouter.get('/',manager,(req,res)=>res.json(pagos.listBranch(req.user)));
  retirosRouter.get('/:id',manager,(req,res)=>res.json(pagos.get(req.user,positiveId(req.params.id))));
  retirosRouter.post('/:id/concretar',manager,(req,res)=>res.json(pagos.completePickup(req.user,positiveId(req.params.id))));
  return {reservas,pagos,reservasRouter,pagosRouter,retirosRouter,
    tasks:{async tick(){reservas.expireDue();},dispose(){}}};
}
