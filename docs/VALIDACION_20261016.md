> Documento histórico de la base B. Estado actual: INTEGRACION_20261017.md. Las referencias a A/C pendientes no describen el prototipo integrado.

# Validación de la entrega del 16/10/2026

Ejecutada en Linux, Node 24.19.0 y npm 11.9.0. No se afirma validación en las PC Windows del equipo ni en servidores DonWeb.

- API: npm ci y npm run check; ESLint sin errores, 63 pruebas aprobadas. Incluyen permisos/sesión/aislamiento, tope de pedidos con 10 solicitudes concurrentes, tolerancia/rotación/material/sucursal, turnos, cupos/horarios, reinicio persistente, envío incierto y reconciliación, reportes, conexión de A por factory/eventos/rollback y contrato de tareas C.
- UI: npm run check; oxlint sin errores, 16 pruebas aprobadas y build Vite 8.3.0 correcto. Se reinstalaron dependencias limpias durante validación; luego se fijaron exactamente React/React DOM 19.2.8, plugin-react 6.1.1, oxlint 1.81.0 y Vite 8.3.0 del starter, y se volvió a ejecutar el check. API/Router/Query/Vitest siguen versiones documentadas en lockfiles.
- Navegador Chromium local contra UI/API reales y DB temporal: login; alta persistida; dos avisos compatibles; intento de reservar devuelve 501 sin crear reserva; cancelación mediante diálogo persistida; logout; ingreso de dueño con redirección a reportes; ingreso de otro cliente sin caché ajena. Sin errores JavaScript. Sin desbordamiento de página a 360 y 768 px; pantalla de escritorio revisada a 1280 px.
- Matching: escenario de 500 retazos compatible con referencia RNF, aproximadamente 90 ms en la corrida de referencia de esta entrega; no es un benchmark del volumen anual ni garantía de servidor real.
- CLI real: db:migrate, db:seed y db:migrate repetido sobre DB local de verificación; correctos. SQLite se generó con ruta esperada.
- bash -n publicar-base.sh: correcto. El script NO se ejecutó contra GitHub; no se crearon ramas/PR remotos ni se modificaron permisos.

Se corrigieron dos fallos detectados en el navegador: DELETE sin encabezado JSON al cancelar, y pantalla restringida al cambiar de cliente a dueño sin redirección. Hay pruebas de regresión para ambos; enlaces /avisos/:id se conservan tras login del cliente.

No verificado aquí: correo real del equipo, WhatsApp/chatbot, pagos/MercadoPago, módulos A/C reales, Safari real, despliegue HTTPS, restauración de backups y carga sostenida de 10.000 retazos/mes. Los adaptadores de captura y fixtures son pruebas, no servicios externos reales. Reservas requiere C y no se simula éxito.
