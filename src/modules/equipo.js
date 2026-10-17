import {Router} from 'express';
import {createRetazosRouter} from './dev-a/retazos/routes.js';
import {createCalidadRouter} from './dev-a/calidad/routes.js';
import {createPreciosRouter} from './dev-a/precios/routes.js';
import {createDevC} from './dev-c/index.js';
import {createIncentivos,createIncentivosRouter} from './dev-a/incentivos.js';
/** A/C agregan sus routers aquí. Ya montado bajo /api. Cada router usa requireRole/propiedad. */
export function createEquipoRouter(context){
 const router=Router();
 router.use('/retazos',createRetazosRouter(context));
 router.use('/precios',createPreciosRouter(context));
 router.use('/incentivos',createIncentivosRouter(context));
 router.use('/calidad',createCalidadRouter(context));
 // A: registro público dentro de su router, sin elevar el rol elegido por el cliente.
 const c=createDevC(context);
 router.use('/reservas',c.reservasRouter);
 router.use('/pagos',c.pagosRouter);
 router.use('/retiros',c.retirosRouter);
 // C: router.use('/feedback', createFeedbackRouter(context));
 return router;
}
/** C registra aquí su proceso de vencimiento; el servidor llama primero a C y después a B. */
export function createEquipoTasks(context){
 const c=createDevC(context).tasks;
 const incentives=createIncentivos(context);
 return {tick:()=>c.tick(),dispose(){c.dispose();incentives.dispose();}};
}
