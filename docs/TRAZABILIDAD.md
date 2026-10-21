# Trazabilidad de la parte B

| Requisito / caso | Implementación | Prueba / alcance |
|---|---|---|
| RF-09 / CP-09 | pedidos.validation, repository, service; pantalla Pedidos | Tres abiertos, concurrentes, vencimiento exacto, renovación, cancelación y propiedad. |
| RF-10 / CP-10 | matches() | Ejemplos 40×66, 60×60, 35×70, rotación, tolerancia propia 10 %, cero y superior al 100 %. |
| RF-11 / CP-11 | matching.repository + matches | Material, espesor, medidas, color/acabado y sucursal. |
| RF-12 / CP-12 | Estado disponible y mínimo de retazo | Rechaza pendientes, descartados y medidas fuera del rango ofertable. |
| RF-13 / CP-13 | publicNotice, plantilla texto, pantalla Avisos | Foto, precio, medidas, sucursal, retiro y ambos plazos. |
| RF-14 / CP-14 | NotificationChannel, SMTP, fallback | Captura de ambos y fallo simulado WhatsApp. Conexión real al chatbot pendiente en la fuente. |
| RF-15 / CP-15 | countDay y cola SQLite | Tres avisos lógicos (no canales), cuarto al próximo día, disponibilidad revalidada. |
| RF-16 / CP-16 | Calendario Buenos Aires | Franja 08–20, envío fuera de horario en siguiente apertura. |
| RF-22 / CP-22 (parte B) | matching + expireNotices | Solo pedido más antiguo; vencimiento en 2 horas de atención; siguiente pedido. Reserva única y confirmación las implementa C. |
| RF-18 / CP-18 (integración B) | Listener reserva.vencida/cancelada + historial de avisos | B rematchea retazo liberado; C realiza vencimiento y liberación de la reserva. |
| RF-20 / CP-20 (integración B) | Filtro disponible | B nunca ofrece pendiente; control de calidad es A. |
| RF-25 / CP-25 | vista SQL + reportes.service + pantalla dueño | Totales por sucursal, sin multiplicación por joins. |
| RNF-01 / CP-28 | Índices y matching | Benchmark local de 500 retazos; no certifica DonWeb ni el volumen anual. |
| RNF-02 / CP-29 | CSS responsive, Router, formularios | Flujo comprobado en Chromium: crear pedido, despachar aviso, leer ofertas y reportes; viewport móvil 390 px sin desbordamiento. Safari real pendiente. |
| RNF-03 / CP-30 (parte B) | req.user y filtros por propietario / rol | Pedidos y avisos ajenos devuelven 404; reportes requieren dueño. Login real y hashing corresponden a A/Sprint 0. |
| RNF-04 / CP-31 (parte B) | Transacciones inmediatas e índices | Diez peticiones concurrentes a pedidos, workers concurrentes, ausencia de duplicados. Reservas concurrentes requieren C. |

No se modificaron los estados “No ejecutado” de los casos del Drive. Las pruebas propias son evidencia de desarrollo; revisión cruzada, UAT y aceptación final siguen pendientes.

## Antecedente de implementación revisado en la entrega del 16 de octubre

La API y UI ahora son repos separados. La autenticación base usa bcrypt y JWT/cookie; ocho pruebas adicionales verifican sesión y CORS. UI agrega tres pruebas de contrato HTTP. Los routers de A/C se montan en equipo.js y sus pantallas en equipo-routes.jsx.
