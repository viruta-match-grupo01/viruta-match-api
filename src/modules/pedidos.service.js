import {pedidoSchema} from './pedidos.validation.js';
import {createPedidosRepository} from './pedidos.repository.js';
import {fail} from '../errors.js';
export function createPedidosService({db,calendar,clock,matching,bus}) {
  const repo=createPedidosRepository(db);
  function owned(id,cliente) {const p=repo.get(id);if(!p||p.cliente_id!==cliente) fail(404,'PEDIDO_NO_ENCONTRADO','Pedido no encontrado');return p;}
  function activeReservation(id){return db.prepare("SELECT id FROM reserva WHERE pedido_id=? AND estado='activa'").get(id);}
  return {
    list(cliente){matching.expireOrders();return repo.list(cliente);},
    create(cliente,input) {
      const parsed=pedidoSchema.safeParse(input);
      if(!parsed.success) fail(400,'DATOS_INVALIDOS',parsed.error.issues.map(x=>x.message).join('; '));
      const id=db.transaction(()=>{
        matching.expireOrders();
        if(repo.count(cliente)>=3) fail(409,'LIMITE_PEDIDOS','Ya tenés 3 pedidos abiertos');
        if(!db.prepare('SELECT id FROM sucursal WHERE id=?').get(parsed.data.sucursal_preferida_id)) fail(400,'SUCURSAL_INVALIDA','Sucursal inexistente');
        const now=clock();
        const p=parsed.data;
        const pedidoId=repo.insert({...p,color:p.color??null,acabado:p.acabado??null,tolerancia_pct:p.tolerancia_pct??null,cliente_id:cliente,creado_en:now.toISOString(),vence_en:calendar.plusDays(now,30).toISOString()});
        bus?.emit('pedido.creado',{pedidoId,clienteId:cliente});
        return pedidoId;
      }).immediate();
      matching.scan();return repo.get(id);
    },
    renew(id,cliente) {
      db.transaction(()=>{
        matching.expireOrders();const p=owned(id,cliente);
        if(p.estado==='cumplido') fail(409,'PEDIDO_CUMPLIDO','Un pedido cumplido no puede renovarse');
        if(p.estado!=='abierto'&&repo.count(cliente)>=3) fail(409,'LIMITE_PEDIDOS','Ya tenés 3 pedidos abiertos');
        // La renovación modifica el vencimiento, no la antigüedad del pedido.
        repo.renew(id,calendar.plusDays(clock(),30).toISOString());
      }).immediate();matching.scan();return repo.get(id);
    },
    cancel(id,cliente) {
      db.transaction(()=>{
        const p=owned(id,cliente);
        if(p.estado==='cumplido') fail(409,'PEDIDO_CUMPLIDO','El pedido ya fue cumplido');
        if(activeReservation(id)) fail(409,'RESERVA_ACTIVA','Cancelá primero la reserva mediante el módulo de Reservas');
        repo.cancel(id);
        db.prepare("UPDATE aviso SET estado='cancelado',claim_token=NULL,claim_until=NULL WHERE pedido_id=? AND estado IN ('en_cola','enviado','fallido')").run(id);
      }).immediate();matching.scan();return repo.get(id);
    }
  };
}
