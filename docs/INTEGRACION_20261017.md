# Integración del prototipo A + B + C — 17/10/2026

## Resultado y alcance
El recorrido principal funciona conectado, con una API, una UI, una sesión, una base SQLite y componentes comunes. Es un prototipo local verificable; no es la totalidad del producto de producción.

A: ZIP entrega_dev_a.zip (Guido), base API 376bfb6 y UI 9bacd6e.
B: código ya fusionado en desarrollo, conservado.
C: cambios-chadma API eaddba3483f61784494ed3f655d300ff627c8690 y UI 7d7c43ce4eac35767a78a4167485e947bd45b71a.
Desarrollo revisado: API 376bfb686da632ff800085a7d33c5488fe2355dc, UI 9bacd6e6e1e7171f0f29150e43772516df440a9c.

## Qué se combinó y corrigió
- API src/modules/equipo.js: routers de A y C juntos; vencimientos de C antes de la cola de B; un solo scheduler.
- UI equipo-routes y AppLayout: menú común; respeta tanto menu:false de A como rutas sin label de C. No aparecen rutas de detalle en el menú.
- db-commands: seed incluye los cuatro precios ficticios de A. Sin ellos la carga fallaba por precio no configurado.
- Calidad: solicitar corrección, operario corrige alto/ancho y se repite el control. No se permite editar un retazo disponible/reservado/retirado mediante este flujo. Recalcula precio por área; si alguna medida corregida baja de 20, descarta.
- Incentivos: al retiro concretado se generan 15 % para quien cargó y 10 % para quien aprobó, sobre el importe aprobado. Índice único retazo/rol; repetir el retiro no duplica incentivos. Si falla un listener, retiro e incentivos revierten juntos.
- Herramientas locales: dueño puede preparar próximo día hábil a las 10 y procesar avisos, y ver correos capturados. El reloj es compartido con A/B/C y vuelve a la hora real al reiniciar; ensayar con una base de prueba nueva. Se eliminó el endpoint de demo que aprobaba sin control.
- Se mantienen dependencias y lockfiles de la base. No se incorporaron SDK ni bibliotecas visuales alternativas.

## Contratos añadidos y consumidores
- POST /api/calidad/:id/corregir-medidas {motivo}: encargado de origen; estado corregir_medidas. Error de estado 409.
- PATCH /api/retazos/:id/medidas {alto_cm,ancho_cm}: operario que cargó, misma sucursal, solo corrección solicitada. Devuelve pendiente_control o descartado. API A y UI A; B/C solo consumen disponibles como antes.
- GET /api/incentivos: operario/encargado, exclusivamente propios.
- retiro.concretado {reservaId,retazoId,clienteId}: consumidor A síncrono y transaccional; productor C sin cambios.
- GET /api/entorno: usuario autenticado; {demo,ahora,avisos}. Solo información de modo/reloj; consumidor UI común.
- /api/demo/*: ALLOW_DEMO=true y rol duenio. GET estado/correos; POST horario/tick/avanzar. No exponer estas herramientas en producción.
- Índice uq_incentivo_venta_rol: migración aditiva en createBaseSchema. Ejecutar db:migrate antes de iniciar esta versión, también sobre bases locales existentes. No borra datos. Si una base ajena ya contiene incentivos duplicados, no se eliminan automáticamente: requiere revisión antes de crear el índice.

## Validación realizada
- npm ci en ambos repositorios; API npm run check: 99 pruebas pasan. UI npm run check: 36 pruebas pasan, lint y build correctos.
- Cinco pruebas adicionales de integración real: flujo A/B/C/incentivos, corrección y nuevo control, descarte/permisos, rollback del retiro, restricción de herramientas de demo.
- Navegador Chromium, HTTP real y SQLite: login dueño, preparar reloj, pedido aglomerado 18 mm 40x60, carga 40x60, pedir corrección, corregir a 45x60, aprobar, capturar aviso, reservar, verificar sin cobro anticipado, transferencia ficticia por $2.430, retiro, pedido cumplido, incentivos $364,50 y $243, reportes y aislamiento entre clientes. Sin errores JS.
- Vista cliente sin desbordamiento horizontal a 360 y 768 px. Chromium validado; Safari y carga de 10 usuarios simultáneos pendientes.
- db:migrate y db:seed ejecutados dos veces sobre archivo SQLite: 5 usuarios, 4 precios, integrity_check=ok y sin errores de claves foráneas.
- Matching 500 retazos: prueba heredada de B pasa en este entorno; no acredita volumen de producción ni rendimiento de todos los módulos.
- No se enviaron correos reales ni se hicieron cobros reales. Comprobantes introducidos de prueba, sin integración bancaria.

## Pendiente del producto completo
- Fotos reales: actualmente imagen ficticia; falta endpoint, límites y almacenamiento.
- Registro público y edición de cuenta: se usan usuarios ficticios precargados.
- Feedback: falta acordar escala y completar su API/UI. Los promedios del reporte existen, pero no se mostrará feedback generado ficticiamente como implementado. No se bloquean reservas por feedback.
- MercadoPago/QR/webhook, credenciales SMTP reales y WhatsApp; no están probados con proveedores. El pago manual sí funciona.
- Puntos de clientes: fase 2, reglas no definidas. Incentivos de personal registrados no equivalen a liquidación salarial.
- Atención a una reserva ya pagada que vence, devoluciones y conciliación: falta procedimiento de negocio. No presentar este escenario como listo para producción.
- Calendario/feriados definitivos, precios reales, despliegue DonWeb/HTTPS/backups, pruebas con Safari y UAT del equipo.

## Presentación académica
Mostrar el flujo funcionando y evidencias de avance frente a la planificación. Actualizar MS Project y su tablero con una única fecha de corte, trabajo realmente terminado y horas/costos reales. Este paquete no modifica Project ni calcula SPI/CPI: faltan los datos de corte verificables. No afirmar 100 % ni usar 40 % por aparecer en la transcripción. No confundir las métricas comerciales de la aplicación con SPI/CPI del proyecto.

Publicación: publicar-integracion.sh probado con remotos Git locales, incluido reintento. Conserva ancestros B/C y no modifica main/testing/desarrollo. Los dos PR se crean y fusionan por el usuario; no se publicó nada en GitHub desde esta sesión.
