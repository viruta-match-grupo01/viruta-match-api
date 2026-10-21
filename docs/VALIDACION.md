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
