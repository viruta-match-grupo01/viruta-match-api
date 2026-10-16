# Validación v2 — API y UI independientes (14/10/2026)

- API: npm run check correcto; **56 pruebas aprobadas**, lint correcto.
- UI: npm run check correcto; **3 pruebas aprobadas**, lint y build correctos.
- Flujo en navegador Chromium, con dos procesos separados: login cliente por cookie, crear pedido, procesar avisos, leer coincidencias, cerrar sesión, login dueño y reportes. Sin errores JavaScript.
- Vista móvil 390 px: sin desbordamiento horizontal de la página.
- Benchmark API sobre 500 retazos: 58,2 ms en la última ejecución local; no certifica DonWeb ni 120.000 retazos por año.
- db:migrate y db:seed se ejecutaron: SQLite creada en viruta-match-api/data/desarrollo.db; no se creó ninguna base en la UI.

## Límites

No se creó aún la organización/repositorios GitHub (Ignacio confirmó que no existen), no se desplegó DonWeb ni se enviaron correos/WhatsApp reales. La estructura y los comandos para hacerlo están documentados. El costo del paquete de correo es el informado por Ignacio; la fecha del aumento falta confirmar.

B está implementado. La autenticación/esquema comunes son una base de Sprint 0 para revisión del Líder Técnico. A/C todavía agregan registro completo/carga/calidad/recompensas y reservas/pagos/feedback. El botón de reserva devuelve dependencia pendiente hasta montar el endpoint C, sin simular éxito.

No se marcaron los casos del Drive como aprobados. Falta revisión cruzada, UAT por Franco, pruebas reales Safari/dispositivos y pruebas conjuntas con los módulos A/C.

## Repetir

En API: npm ci y npm run check. En UI: npm ci y npm run check. Para flujo manual, seguir GUIA_EQUIPO.md.
