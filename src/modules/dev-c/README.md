# Dev C

Agregar reservas, pagos/retiro, MercadoPago y feedback aquí. Montar routers en `src/modules/equipo.js`.

`POST /api/reservas` recibe `{aviso_id}`. En transacción inmediata verificar identidad, propiedad, aviso enviado y vigente, pedido abierto/vigente, retazo disponible, y una reserva activa por cliente/retazo. Crear reserva con `calendar.addHours(clock(),12)`, marcar aviso confirmado y retazo reservado. Los índices únicos parciales son la última defensa concurrente. Responder 409 ante conflicto; jamás cobrar al reservar.

Registrar el vencimiento de reservas desde `createEquipoTasks(context).tick`; el servidor ejecuta esas tareas ANTES de B. Al vencer/cancelar una reserva: cambiar estado y liberar retazo; emitir `reserva.vencida`/`reserva.cancelada` con `{retazoId,reservaId}`. La lectura/confirmación debe validar vencimientos sin esperar el cron. No crear un segundo cron o calendario.

Pago aprobado es requisito del retiro. Al concretar: reserva concretada, retazo retirado y pedido cumplido; emitir `retiro.concretado` con `{reservaId,retazoId,clienteId}` una vez de forma idempotente. A genera incentivos, C feedback; B consulta SQL para reportes.

MercadoPago real está pendiente de contrato/credenciales. Su webhook requiere montaje específico antes del guard de Origin/JSON del navegador en `app.js`, autenticación del proveedor, comprobación de monto/moneda/referencia e idempotencia. No eliminar el guard global ni aceptar body.estado como confirmación. Mantener secretos solo en servidor.
