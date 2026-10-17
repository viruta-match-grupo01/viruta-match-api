import {EventEmitter} from 'node:events';
import {createCalendar} from './calendar.js';
import {createMatchingService} from './modules/matching.service.js';
import {createPedidosService} from './modules/pedidos.service.js';
import {createAvisosService} from './modules/avisos.service.js';
import {createReportesService} from './modules/reportes.service.js';
import {createRoutes} from './modules/routes.js';

/** Integración: recibir conexión, autenticación, calendario, bus y canales del Sprint 0. */
export function createDevB({db,clock=()=>new Date(),calendar=createCalendar(),bus=new EventEmitter(),channels,publicAppUrl}) {
  if(!channels) throw new Error('Configurar canales explícitamente: captura o SMTP');
  const matching=createMatchingService({db,clock,calendar});
  const pedidos=createPedidosService({db,clock,calendar,matching,bus});
  const avisos=createAvisosService({db,clock,calendar,matching,channels,publicAppUrl});
  const reportes=createReportesService(db);
  const handlers={
    'retazo.disponible':e=>matching.scan({retazoId:e.retazoId}),
    'pedido.creado':()=>matching.scan(),
    'reserva.vencida':e=>matching.scan({retazoId:e.retazoId,tipo:'liberado'}),
    'reserva.cancelada':e=>matching.scan({retazoId:e.retazoId,tipo:'liberado'}),
    'retazo.descartado':e=>db.prepare("UPDATE aviso SET estado='cancelado' WHERE retazo_id=? AND estado IN ('en_cola','enviado','fallido')").run(e.retazoId)
  };
  for(const [event,fn] of Object.entries(handlers)) bus.on(event,fn);
  return {pedidos,matching,avisos,reportes,router:createRoutes({pedidos,avisos,reportes,db}),
    async tick(){return avisos.processQueue();},
    dispose(){for(const [event,fn] of Object.entries(handlers)) bus.off(event,fn);}
  };
}
