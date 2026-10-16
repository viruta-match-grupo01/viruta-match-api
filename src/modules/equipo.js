import {Router} from 'express';
/** A/C agregan sus routers aquí. Ya montado bajo /api. Cada router usa requireRole/propiedad. */
export function createEquipoRouter(context){
 const router=Router();
 // Guido (A): router.use('/retazos', createRetazosRouter(context));
 // Guido (A): router.use('/calidad', createCalidadRouter(context));
 // A: registro público dentro de su router, sin elevar el rol elegido por el cliente.
 // C: router.use('/reservas', createReservasRouter(context));
 // C: router.use('/pagos', createPagosRouter(context));
 // C: router.use('/feedback', createFeedbackRouter(context));
 void context;
 return router;
}
/** C registra aquí su proceso de vencimiento; el servidor llama primero a C y después a B. */
export function createEquipoTasks(context){
 void context;
 return {async tick(){},dispose(){}};
}
