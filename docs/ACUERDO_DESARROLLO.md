> Estado actual del código: INTEGRACION_20261017.md. Acuerdo funcional conservado como fuente; las referencias históricas a entregas v2/base B no requieren recuperar esos ZIP ni reemplazar los módulos integrados.

> Aplicación del 16/10/2026: esta entrega contiene el código base autónomo. No hace falta recuperar el ZIP v2 citado históricamente en este acuerdo. Leer primero DECISIONES_20261016.md para versiones y puntos de integración efectivos.

# Viruta Match

Acuerdo de desarrollo e integración para el equipo y sus IA

## 1 Objetivo y autoridad

Este acuerdo permite que tres desarrolladores y sus asistentes de IA implementen partes compatibles de Viruta Match. Versión 1.1 · 14/10/2026 · Guía operativa para iniciar el desarrollo local con una UI común. Pendiente de revisión del equipo; no se atribuye aprobación a Román ni a otros integrantes.
La base funcional son los Requerimientos v3.3 y los Criterios de aceptación v3.3. La Propuesta Técnica v1.1 define la arquitectura y el reparto. La decisión posterior del equipo sustituye el monorepo por dos repositorios, con ramas main, testing y desarrollo. Los puntos que las fuentes dejan abiertos permanecen abiertos.
Repositorios: https://github.com/viruta-match-grupo01/viruta-match-api y https://github.com/viruta-match-grupo01/viruta-match-ui.
Verificación previa del 14/10 para la versión 1.0, a comprobar contra el checkout actual: package.json en main y desarrollo de API usa CommonJS, Express ^5.3.0 y nodemon ^3.1.14; su script test todavía es un marcador que falla. UI declara ES Modules, React/React DOM ^19.2.8, Vite ^8.3.0, plugin-react ^6.1.1 y oxlint ^1.81.0. Los rangos declarados no demuestran qué versiones están instaladas.
La entrega Viruta_Match_API_UI_v2.zip tiene una base modular diferente: ES Modules en ambos repositorios, sesión, SQLite y módulos B. Por eso los contratos de las páginas siguientes se proponen sobre v2; no se afirma que estén publicados en GitHub. No copiar módulos sobre el starter actual sin integrar primero esa base.
Decisión propuesta para la reunión: adoptar v2 como base común mediante PR en desarrollo, conservar el trabajo útil del starter, revisar las diferencias y congelar ambos lockfiles. Si el equipo conserva Vite 8/oxlint u otra base, debe adaptar y verificar v2 en un PR compartido y registrar el ajuste en este acuerdo antes de integrar módulos incompatibles. No mantener configuraciones alternativas por desarrollador.
Para comenzar: compartir esta versión entre los tres y guardar el mismo Markdown en docs/ACUERDO_DESARROLLO.md de API y UI. Román mantiene la versión y registra cada cambio de contrato. Las reglas funcionales confirmadas no cambian por una sugerencia de la IA. Esta revisión agrega diseño de UI, mapa de pantallas y forma de empezar en paralelo. Conserva los contratos técnicos de la versión anterior y no modifica código ni repositorios.

## 2 Stack y versiones comunes

Propuesta: JavaScript con ES Modules (import/export), React + Vite, Express y SQLite. Node.js 24.x como línea común; Román debe fijar el mismo parche en .nvmrc y CI al integrar la base. npm es el único gestor. No introducir TypeScript, otro framework, ORM, otra base de datos o gestor de paquetes en un módulo aislado.
Las versiones siguientes se extrajeron de los package-lock.json de v2. Son la referencia reproducible de esa entrega, no versiones comprobadas en los repositorios actuales ni una recomendación de usar la última versión disponible.
| API | Versión resuelta en v2 | Función |
|---|---|---|
| express | 5.3.0 | HTTP y routers |
| better-sqlite3 | 12.11.1 | SQLite y transacciones |
| zod | 4.6.7 | Validación de entrada |
| bcrypt | 6.0.0 | Hash de contraseñas |
| jsonwebtoken | 9.0.3 | Sesión JWT |
| cookie-parser | 1.4.7 | Cookie de sesión |
| cors | 2.8.6 | Orígenes permitidos |
| express-rate-limit | 8.7.1 | Límite de autenticación |
| nodemailer | 7.0.13 | Correo SMTP |
| node-cron | 4.6.0 | Procesamiento periódico |
| UI | Versión resuelta en v2 | Función |
|---|---|---|
| react / react-dom | 19.3.1 / 19.3.1 | Componentes y renderizado |
| react-router-dom | 7.18.4 | Navegación |
| @tanstack/react-query | 5.104.2 | Datos de servidor y caché |
| vite | 7.3.7 | Desarrollo y compilación |
| Herramienta | Versión resuelta en v2 | Alcance |
|---|---|---|
| vitest | 3.2.7 | API y UI |
| supertest | 7.3.1 | API HTTP |
| eslint / @eslint/js | 9.39.5 / 9.39.5 | API y UI |
| globals | 16.5.0 | Configuración ESLint |
Instalar con npm ci, incluyendo en CI. Versionar package.json y package-lock.json en cada repositorio; no editar el lockfile manualmente ni ejecutar npm update o npm audit fix --force por iniciativa de una IA. Una dependencia nueva requiere motivo, revisión del líder y verificación del módulo afectado.
Pendientes de incorporación de la Propuesta Técnica: React Testing Library para pruebas de componentes, sharp para fotos y Prettier/hooks de formato. No están instalados en v2; Román fija versiones y configuración en un PR común. El SDK de MercadoPago tampoco está acordado: C y Román eligen SDK o HTTP directo y documentan su versión/contrato. No dejar que cada IA agregue una alternativa.

## 3 Responsabilidades y estructura

| Responsable | Desarrollo propio | Integración que debe entregar |
|---|---|---|
| Dev A, nombre por confirmar | Carga, calidad, registro/roles completos y recompensas | Retazo aprobado disponible; identidad compatible con sesión; incentivos sin duplicación |
| Dev B, Ignacio Hernández | Pedidos, matching, avisos y reportes | Cola persistente, turnos y reportes coherentes con retiros |
| Dev C, nombre por confirmar | Reservas, pago/retiro, MercadoPago y feedback | Reserva atómica, pago aprobado y cierre de retiro |
| Román Borla | Plataforma compartida | Autenticación base, migraciones, calendario, bus, scheduler, CI y entornos |
Franco Liuzzo realiza aceptación funcional; Martín Bergero coordina alcance y cambios. A revisa B, B revisa C y C revisa A; Román revisa la integración final. La asignación de QA sigue pendiente.
API es un monolito modular: router → servicio → repositorio → SQLite. Router valida entrada y permisos; servicio aplica negocio; repositorio ejecuta SQL parametrizado. No acceder a SQLite desde UI ni repetir lógica de negocio decisiva en pantallas.
Patrones comunes: Repository para datos, servicios para reglas, Adapter para proveedores de avisos/pagos, inyección de dependencias para db/reloj/calendario y eventos internos para colaboración. No imponer una segunda arquitectura en un módulo.
En la base v2: módulos B están en src/modules/*.repository.js, *.service.js y routes.js. A agrega src/modules/dev-a/; C agrega src/modules/dev-c/. Montan routers desde src/modules/equipo.js mediante createEquipoRouter({db,bus,clock,calendar,devB}). Los routers quedan bajo /api y deben verificar rol/propiedad en cada operación.
UI agrega módulos en src/modules/dev-a/ y dev-c/. Registra pantallas en src/modules/equipo-routes.jsx con {path,label,roles,element}; utiliza SessionApp, cliente HTTP y TanStack Query existentes. No crear otra aplicación, otro login, otro proveedor de sesión o una base de datos por desarrollador.
JavaScript usa camelCase, componentes PascalCase y datos HTTP/SQL conservan los nombres snake_case del contrato. Mantener estilo del archivo existente. No reformatear archivos ajenos junto con un cambio funcional.
Las tablas creadas para A/C en v2 son una base de integración; no significan que sus servicios estén implementados. Cada responsable valida las tablas que utiliza antes de integrar su módulo; puede avanzar con pruebas y datos ficticios mientras se resuelve una dependencia compartida.

## 4 Datos y reglas compartidas

SQLite: una base por entorno, una conexión compartida por proceso; foreign_keys=ON, WAL y busy_timeout=5000 ms en v2. Transacciones cortas; SQL con parámetros. Nunca realizar llamadas de red dentro de una transacción. No ejecutar dos instancias de API sobre el mismo archivo.
IDs enteros positivos. JSON transmite números como números, sin separadores locales: 5.5, no "5,5". Fechas persistidas y transportadas como ISO UTC con milisegundos, por ejemplo 2026-10-14T18:00:00.000Z. La UI las presenta en America/Argentina/Buenos_Aires.
Medidas en cm; espesor en mm; área en m² = alto_cm × ancho_cm / 10000. Moneda ARS. La base v2 almacena importes REAL: no mezclar centavos enteros con esos campos. Propuesta: redondear el importe final a dos decimales con una función compartida y comparar pagos con ese mismo valor. Migrar a centavos exige un cambio coordinado; no hacerlo por módulo.
| Campo | Valores canónicos |
|---|---|
| material | MDF, aglomerado, melamina |
| espesor_mm | 3, 5.5, 9, 12, 15, 18, 25 |
| acabado | mate, brillante; null fuera de melamina |
| rol | cliente, operario, encargado, duenio |
| medio_aviso / canal lógico | correo, whatsapp, ambos |
| retazo.estado | pendiente_control, disponible, reservado, retirado, descartado |
| pedido.estado | abierto, cumplido, cancelado, vencido |
| reserva.estado | activa, concretada, vencida, cancelada |
| pago.estado | pendiente, aprobado, rechazado |
| aviso.estado | en_cola, enviado, fallido, confirmado, vencido, cancelado |
Colores de melamina: blanco, negro, gris grafito, gris claro, roble, wengué, nogal, cedro, haya, arce, beige, chocolate. Coincidencia exacta de color y acabado. Fuera de melamina ambos son null. El perfil estudiante/hobbista/profesional/empresa es informativo; no es un rol.
RF-01 a RF-07, RF-19 a RF-21: retazos ofrecidos tienen cada dimensión entre 20 y 120 cm y control aprobado. Por debajo de 20 se registra descartado; no entra al matching. El encargado controla humedad, bordes y medidas en 24 h desde la carga; puede aprobar, rechazar con motivo o pedir corrección de medidas. El operario no modifica precio.
RF-09 a RF-12: máximo tres pedidos abiertos; vencen a 30 días calendario desde creación/renovación aunque hayan recibido aviso. Matching solo con disponibles, material/espesor/sucursal exactos, cada medida suficiente con rotación de 90° y área ≤ área pedida × (1 + tolerancia_pct/100). Si tolerancia es null se usa 30; si es 0 se respeta 0; sin tope adicional para tolerancia propia no negativa. El mínimo de 20 cm es del retazo ofrecido, no del pedido; v2 admite pedidos de 1 a 120 cm, decisión técnica a ratificar.
RF-21, RF-26: precio calculado por área y tabla del dueño; valores y efecto sobre retazos ya cargados pendientes. Incentivos: 15% para quien cargó y 10% para quien aprobó, sobre precio de venta, una vez por venta. Puntos del cliente quedan para fase 2; no inventar equivalencias, topes ni vencimientos.

## 5 Tiempo, avisos y estados

Una única función calendar.addHours(inicio,horas), con reloj inyectable, sirve a B y C. Se suman horas de atención 08:00–20:00 en Buenos Aires: aviso 2 h; retiro 12 h. Ejemplos sin días de cierre: aviso 19:30 vence 09:30 siguiente; reserva 15:00 vence 15:00 siguiente; reserva iniciada fuera de horario a las 22:00 vence a las 20:00 siguiente.
Propuesta de límite: envíos desde 08:00 inclusive hasta 20:00 exclusive. v2 usa todos los días por defecto; no hay confirmación de cierres semanales/feriados. Román y Franco deben definir BUSINESS_DAYS/BUSINESS_HOLIDAYS comunes antes de usar datos reales. No implementar un calendario distinto en C.
RF-13 a RF-18 y RF-22: se ofrece a un solo pedido compatible por turno, el más antiguo. v2 desempata por id y recorre retazos por cargado_en/id. El plazo de 2 h inicia al envío efectivo, no al crear la cola. Sin confirmación, pasa al siguiente; el pedido sigue abierto. El retazo reservado deja de ofrecerse.
Máximo tres avisos lógicos por cliente por día calendario de Buenos Aires; incluyen coincidencias y liberados. Correo + WhatsApp para un mismo aviso cuentan uno. El exceso queda persistido para la próxima franja desde las 08:00, tras volver a verificar pedido/retazo. WhatsApp con falla técnica cierta permite correo de respaldo.
Políticas v2 por ratificar: no reasignar a cliente con reserva activa; no repetir el mismo par retazo/pedido durante el ciclo de oferta; renovación de pedido cerrado abre ciclo y conserva antigüedad. Mantener consistencia de pedido.ciclo y aviso.pedido_ciclo. Estas políticas no deben presentarse como una validación del dueño.
NotificationChannel.send(message) es async y devuelve providerId al aceptar el proveedor. Una falla de resultado incierto queda registrada por canal para reconciliación; no reenviar a ciegas ni declarar éxito. SMTP está preparado en v2; WhatsApp real sigue pendiente del contrato con el chatbot de La Viruta.
Un scheduler coordinado por Román procesa cada minuto. B maneja cola y vencimiento de avisos; C maneja vencimiento de reservas; no duplicar jobs. En v2 B incluye bloqueo y prevención de ejecuciones simultáneas. La base guarda estado, vencimiento y resultados por canal; se recupera trabajo al reiniciar. Los eventos en memoria ayudan a integrar, pero no garantizan entrega durable.
C valida vencimientos también en la operación, sin depender de que el cron haya corrido. Al reservar: transacción inmediata, comprobar aviso enviado/vigente y cliente correcto, pedido abierto/vigente y retazo disponible; imponer una reserva activa por cliente y por retazo con índices únicos. Crear reserva, marcar aviso confirmado y retazo reservado como una sola operación. Conflicto: 409.
No se cobra al reservar. En origen, dentro del plazo, encargado registra efectivo/transferencia con comprobante o C verifica MercadoPago. Solo pago aprobado permite retiro: reserva concretada, retazo retirado, pedido cumplido. Vencimiento de reserva: C marca vencida, libera disponible y notifica a B. El feedback es obligatorio después del retiro; el bloqueo de futuras reservas está pendiente y no debe inventarse.

## 6 Contratos HTTP y eventos

HTTP/JSON bajo /api; GET /health queda fuera del prefijo. Usar el cliente HTTP de UI con credentials: include. No introducir un envoltorio {data:...} en rutas existentes. Errores de negocio de v2: {"error":"CODIGO_ESTABLE","message":"Texto legible"}. Nuevas rutas siguen ese formato y documentan su código. No devolver stack, SQL ni secretos.
| Operación | Contrato de base v2 / propuesto |
|---|---|
| POST /api/auth/login | email, password; crea cookie |
| GET /api/auth/me; POST /api/auth/logout | Sesión compartida / cierre |
| GET /api/sucursales | Catálogo autenticado |
| GET /api/pedidos; POST /api/pedidos | Solo pedidos propios; alta 201 |
| POST /api/pedidos/:id/renovar; DELETE /api/pedidos/:id | Propietario; cancelación incompatible con reserva activa devuelve 409 |
| GET /api/avisos; GET /api/avisos/:id | Solo destinatario |
| GET /api/reportes | Dueño |
| POST /api/reservas | Contrato C a implementar: {aviso_id} |
| POST /api/pagos/mercadopago | Contrato C a cerrar: generar link/QR para reserva propia de la operación del encargado |
| POST /api/webhooks/mercadopago | C: contrato externo verificado, idempotente y sin sesión de usuario |
Alta de pedido, ejemplo válido:
```json
{"material":"MDF","espesor_mm":18,"alto_min_cm":40,"ancho_min_cm":60,"color":null,"acabado":null,"tolerancia_pct":null,"sucursal_preferida_id":1}
```
cliente_id se obtiene de req.user; no se acepta del cuerpo. Campos inesperados se rechazan. Referencia HTTP: 400 entrada inválida, 401 sin sesión, 403 rol no permitido, 404 inexistente o recurso ajeno donde se oculta su existencia, 409 conflicto de estado. Mantener semántica de rutas existentes.
| Evento | Emisor | Payload mínimo | Consumidor |
|---|---|---|---|
| pedido.creado | B | {pedidoId,clienteId} | B matching |
| retazo.disponible | A | {retazoId} | B matching |
| retazo.descartado | A | {retazoId} | B cancela ofertas |
| reserva.vencida / reserva.cancelada | C | {retazoId,reservaId} | B libera próximo turno |
| retiro.concretado | C | {reservaId,retazoId,clienteId} | A incentivos; C feedback |
retazo.cargado está previsto por la propuesta, pero su payload/consumidores deben cerrarse antes de usarlo. No emitir retazo.disponible al cargar pendiente de control.
En v2 los listeners son síncronos y solo escriben en la misma db: actualizar estado y emitir después dentro de la transacción cuando deban compartir atomicidad. No usar listeners async ni acceder a proveedores desde ellos. Si se cambia el bus, Román debe definir después del commit + outbox/recuperación. Un consumidor debe tolerar repetición: incentivos, feedback y confirmación de pago necesitan claves únicas/idempotencia.
Antes del primer PR de A/C, anexar fichas para sus rutas todavía no cerradas: verbo/ruta, rol/sucursal/propiedad, request, response real, estados, errores, transacción, evento y prueba. No generar pantallas contra endpoints supuestos. Fotos: la propuesta usa disco /uploads y ruta en DB; A y Román deben cerrar endpoint, tipos, tamaño, permisos y conservación.

## 7 Configuración, seguridad y ejecución

| Parámetro | Base local v2 / regla común |
|---|---|
| NODE_ENV | development local; production en entornos publicados |
| HOST / PORT | 127.0.0.1 / 3001 local |
| DATABASE_PATH | data/desarrollo.db, relativa a API |
| UI_ORIGIN | Origen exacto de UI, localhost:5173 o 127.0.0.1:5173 |
| PUBLIC_APP_URL | URL usada en enlaces de avisos |
| VITE_API_URL | /api |
| VITE_API_PROXY_TARGET | http://127.0.0.1:3001 local |
| JWT_SECRET | Secreto propio de cada entorno; nunca Git |
| ALLOW_DEMO / NOTIFICATION_MODE | true / capture solo local; false y canal real al publicar |
| BUSINESS_DAYS / BUSINESS_HOLIDAYS | Calendario único aprobado; default v2 0,1,2,3,4,5,6 / vacío |
| SMTP_HOST, PORT, SECURE, USER, PASSWORD, FROM | Configurados por infraestructura; nunca en UI |
API y UI tienen cada una .env.example sin credenciales y su .env local ignorado. Todo VITE_* es público. Credenciales MercadoPago/WhatsApp se definen solo en servidor; sus nombres exactos deben acordarse con C/B y Román. No inventar credenciales ni valores de producción.
Sesión v2: bcrypt para contraseñas, JWT HS256 de 8 h, cookie viruta_session httpOnly, SameSite=Lax y Secure en producción; usuario activo resuelto en DB. req.user contiene id,nombre,email,rol,sucursal_id. A debe extender esta base, no reemplazarla por JWT en localStorage ni x-demo-user. Verificar rol, sucursal y propiedad en API; ocultar una pantalla no autoriza ni protege el recurso.
Mantener middleware de origen, CORS con credenciales y validación JSON existente. El webhook externo de MercadoPago requiere montaje específico por C/Román para no quedar bloqueado por sesión/origin de navegador: autenticar firma y consultar proveedor; nunca confiar en body.estado o solo en retorno del navegador. Comprobar monto, moneda, reserva e id de pago, y no procesar dos veces.
Después de integrar v2 y congelar locks, desde la carpeta API:
```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```
Seed solo para base local/datos ficticios. Nunca ejecutar seed/reset sobre producción. SQLite aparece al migrar en data/desarrollo.db; cada compañero genera su propia base. No subir .db, .db-wal, .db-shm, node_modules, .env o fotos reales al repositorio.
En otra terminal, desde UI:
```bash
npm ci
cp .env.example .env
npm run dev
```
Abrir el puerto que indique Vite; mantenerlo consistente con UI_ORIGIN. No abrir index.html como archivo. Estos scripts pertenecen a v2; todavía no existen todos en el starter publicado.
Objetivo infraestructura: desarrollo local, testing/Sandbox y producción aislados en DonWeb, con bases/credenciales independientes. UI estática y /api bajo el mismo dominio con Nginx/HTTPS simplifica cookies. Cambiar a sitios distintos requiere revisar cookies y protección CSRF de forma conjunta. Backup coherente SQLite mediante API de backup, diario, retención propuesta de 14 días y copia externa; no copiar solo .db con escrituras WAL activas. Hacer también backup de fotos y probar restauración.

## 8 Integración y criterios de entrega

Cada módulo se desarrolla desde desarrollo actualizado en feature/<modulo>-<descripcion>. PR hacia desarrollo; pruebas/revisión antes de integrar. Después se promueve a testing para integración/UAT y a main para producción. Sin commits directos en main/testing ni ramas personales que sustituyan desarrollo.
Los cambios de API y UI relacionados usan PR enlazados y una misma versión de contrato. Román coordina publicación compatible y migraciones; no desplegar una UI que necesite una API aún inexistente. Etiquetar una entrega coherente en ambos repositorios. Si un cambio rompe compatibilidad, actualizar contrato, consumidores y pruebas en la misma entrega.
Cambios compartidos — sesión, esquema, calendario, estados, eventos, dependencias y configuración — se coordinan antes de integrarse. Un cambio funcional del negocio se deriva a Franco/PM. Mantener un registro con fecha, decisión, responsable, impacto y versión del acuerdo. No resolver contradicciones con una regla inventada por la IA.
Pruebas de entrega: npm run check en API y UI de v2; la UI incluye build. CI debe ejecutar npm ci y estos controles en PR. El starter actual todavía no tiene esa verificación común. Supertest comprueba permisos, propiedad y códigos; servicios usan db temporal y reloj inyectado. Componentes se prueban con Testing Library una vez incorporada. No enviar correo real ni cobrar en pruebas automatizadas.
| Caso de integración mínimo | Resultado esperado |
|---|---|
| A aprueba retazo y existe pedido compatible | B crea un único turno |
| Retazo pendiente/rechazado | No se ofrece |
| Rotación y tolerancia null/0/propia | Misma regla en API y presentación UI |
| Aviso 19:30; límite de tres; ambos canales | Vence 09:30; exceso queda en cola; ambos cuentan uno |
| Dos clientes reservan mismo retazo | Una reserva; el otro recibe conflicto |
| Cliente intenta dos reservas activas | Segunda rechazada |
| Reinicio con cola/plazos pendientes | Retoma sin duplicar operaciones |
| Pago pendiente / webhook repetido | No permite retiro / un solo registro efectivo |
| C registra retiro válido | Pedido cumplido; incentivo único; feedback disponible |
| Usuario ajeno o sucursal no autorizada | Acceso denegado sin fuga de datos |
Usar además CP-01 a CP-31 de Criterios v3.3; no sustituirlos por esta lista. RNF de referencia: matching ≤3 s con 500 retazos y 10 usuarios simultáneos, responsive Chrome/Safari. El volumen validado es aproximadamente 10.000 retazos/mes entre cinco sucursales: Román debe ampliar el escenario de rendimiento/fotos; no afirmar validación a escala real con 500 registros.
Reportes comunes: cargados por sucursal; coincidencias por pares retazo/pedido registrados sin duplicar canales; reservas históricas; retiros/descartes según estado; promedio de calificaciones existentes. Meta de retiros/cargados acumulada: 60%. La definición de coincidencias de v2 debe ratificarse; no interpretarla como todos los pares posibles ni como reducción de desperdicio medida.
Un PR está listo cuando incluye alcance/RF, contratos afectados, migración si aplica, capturas UI útiles, pruebas y resultado real, variables nuevas sin secretos y pasos de ejecución. Diferenciar implementado, probado, simulado y pendiente.

## 9 Diseño común de la interfaz

Los tres módulos se incorporan a una misma aplicación. La referencia visual inicial es src/styles.css de la entrega v2, con las extensiones de legibilidad y accesibilidad definidas aquí. Es un diseño propuesto para implementar de forma uniforme; no es una identidad gráfica aprobada por La Viruta ni prueba de que todas estas pantallas existan hoy.
Una sola cabecera muestra Viruta Match, nombre/rol y cierre de sesión; un menú presenta las funciones del rol. El contenido usa título, breve descripción, acción principal, filtros si corresponden y paneles/listados. Reutilizar el layout existente: ningún módulo agrega otra cabecera, login o navegación global.

| Elemento | Valor común |
|---|---|
| Fuente | Arial, sans-serif; sin descarga externa ni nueva dependencia |
| Fondo y panel | #F4F5F0 y #FFFFFF |
| Texto principal | #253729 |
| Texto secundario | #52614C para texto normal; ajustar el CSS v2 donde use tonos más claros |
| Acción principal | #2E573C con texto blanco; hover #23452E |
| Acción secundaria | #EEF2E9 con texto #2E573C y borde #D9E2D0 |
| Bordes de panel | #DFE4DA |
| Foco visible | Outline de 3 px #2E573C, offset 2 px; sustituye el foco más claro de v2 |
| Error | Fondo #FBEEE9 y texto #963E32 |
| Éxito | Fondo #E9F3E2 y texto #2E653A |
| Advertencia | Fondo #F2EAD9 y texto #66542C |
| Tipografía | Cuerpo 16 px; etiquetas/botones 14 px; ayuda 13 px; h1 34/29 px escritorio/móvil; h2 20 px |
| Espaciado | Escala 4, 8, 12, 16, 24, 32 px; gap formularios 16 px; panel 24/20 px escritorio/móvil |
| Forma | Panel radius 14 px; controles 7 px; badge redondeado; sin gradientes ni animaciones decorativas |
La fuente Arial evita que cada equipo termine con una tipografía diferente por no tener Inter instalada. Aplicar los ajustes de CSS una sola vez en un PR común; la UI B existente también debe recibirlos. No afirmar cumplimiento de accesibilidad hasta verificar contraste, teclado y lector de pantalla en la implementación.

Escritorio mayor que 850 px: menú lateral de 220 px, contenido con ancho máximo 1200 px, formularios en dos columnas y tarjetas adaptativas. Entre 601 y 850 px: lateral de 170 px y menos columnas de métricas. Hasta 600 px: una columna, menú horizontal desplazable con nombres visibles, controles a todo el ancho y acciones táctiles de al menos 44 px de alto. Probar a 360, 768 y 1280 px; sin desbordamiento de la página. Una tabla extensa puede desplazarse dentro de su contenedor.

## 10 Componentes y comportamiento común

Crear o extraer los componentes compartidos en src/components/ui/ y el layout en src/components/layout/, aprovechando el CSS actual. Un PR transversal integra estos componentes; mientras tanto, los módulos pueden usar las mismas clases/markup de la base. No sumar Bootstrap, Tailwind, Material UI ni una librería de iconos por decisión individual.

| Componente propuesto | Contrato mínimo de uso |
|---|---|
| PageHeader | title, description, actions; un h1 por pantalla |
| Panel | children; mismo borde, padding y radio |
| Button | variant primary/secondary/danger, disabled, busy; type explícito |
| FormField | label, htmlFor, hint, error, children; error debajo del campo |
| StatusBadge | state; etiqueta traducida y texto, además de color |
| RetazoCard | retazo, actions; foto, material/espesor, medidas, precio, sucursal y estado |
| FeedbackMessage | kind success/error/warning, children; role status/alert |
| EmptyState | title, description, action; aparece solo al terminar la carga |
| LoadingState | Texto Cargando…; nunca mostrar datos vacíos como si ya hubieran llegado |
| ConfirmDialog | title, description, confirmLabel, busy, onConfirm, onCancel; teclado y retorno de foco |
| DataTable | columns, rows, loading, emptyMessage; encabezados semánticos |
Estos nombres/props son contratos de UI propuestos, todavía no componentes entregados. El integrador designado entre los tres los publica y todos importan la misma implementación. No crear tres Button distintos. No renombrar funciones de negocio al extraer componentes visuales.
Estados de toda pantalla: cargando, datos, vacío, error con reintento y acción en curso. Al enviar un formulario, impedir doble submit y mostrar Guardando…/Confirmando…; conservar los datos ante error. Al terminar, invalidar las queryKeys del recurso y mostrar confirmación. La caché de datos propios incluye user.id; al salir o cambiar sesión, limpiar datos del usuario anterior.
Formularios con etiquetas permanentes, unidades visibles, errores junto al campo y resumen si falla API. Material, espesor, color, acabado, sucursal y canal usan los catálogos únicos. Mostrar color/acabado solo para melamina. Precio calculado como dato de lectura para el operario. No usar placeholders como única etiqueta.
Confirmar acciones irreversibles o destructivas con contexto: cancelar pedido, descartar retazo y registrar retiro. No pedir confirmación extra para cada guardado. Si la acción no está permitida, explicar por qué: aviso en cola/vencido, pago pendiente o reserva ocupada; no dejar un botón gris sin explicación.
Moneda: Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}); fechas en Buenos Aires. Los vencimientos usan la fecha del servidor; un contador visual no decide si la reserva es válida. Mostrar dos plazos distintos: confirmar aviso y pagar/retirar. No usar “2 horas para retirar”.
Usar texto claro: Confirmar reserva, Registrar pago, Registrar retiro, Aprobar control y Solicitar corrección. Nunca Reservar y pagar como una sola acción. Estados traducidos: pendiente_control → Pendiente de control; en_cola → En cola; duenio → Dueño. El API mantiene los enums técnicos originales.
Imagen con alt descriptivo y fallback Material sin foto; una foto fallida no oculta medidas/precio. Navegación por teclado, foco visible, labels, aria-describedby para ayuda/error, estados con texto y no solo color. El diálogo permite Escape, contiene foco y lo devuelve al botón que lo abrió.

## 11 Mapa de pantallas por rol

Las rutas B existentes se conservan. Las rutas nuevas de A/C siguientes son propuestas para registrar en equipo-routes.jsx; son rutas del navegador, no endpoints API. Se documenta cualquier ajuste antes de conectarlo desde otro módulo.

| Pantalla y ruta propuesta | Responsable y rol | Contenido y acción principal |
|---|---|---|
| /login | Base Román; A extiende | Email, contraseña e Iniciar sesión |
| /registro y /cuenta | A; público/cliente | Nombre, email, contraseña, perfil, medio de aviso y teléfono condicional; crear/editar cuenta |
| /retazos y /retazos/nuevo | A; operario | Cargas propias autorizadas y formulario con foto, medidas, material, sucursal, retiro y precio calculado |
| /calidad y /calidad/:id | A; encargado | Pendientes de su sucursal, foto y medidas; humedad/bordes/concordancia; aprobar, rechazar con motivo o corregir |
| /pedidos | B; cliente | Formulario y pedidos propios; 0–3 abiertos, vencimiento, renovar/cancelar |
| /avisos y /avisos/:id | B; cliente | Oferta con foto, medidas, precio, origen, plazo de confirmación y Confirmar reserva |
| /reservas | C; cliente | Reserva activa, comprobante, origen y vencimiento de retiro; no botón de pago anticipado |
| /retiros y /retiros/:id | C; encargado | Buscar comprobante en su sucursal, retazo/reserva, plazo, pago y retiro |
| /feedback/:reservaId | C; cliente | Calificación de material y trato, comentario; solo retiro propio; escala pendiente de confirmar |
| /recompensas | A; usuario autorizado | Incentivos propios; puntos cliente cuando estén definidas sus reglas |
| /precios | A; dueño | Tabla por material/espesor/color; valores pendientes no inventados |
| /reportes | B; dueño | Filtro sucursal, cinco indicadores, tabla y feedback disponible |
No exponer registro para elegir operario/encargado/dueño: registro público crea cliente. El menú del cliente incluye Pedidos, Avisos, Mi reserva, Cuenta y funciones de recompensas/feedback cuando estén disponibles. Operario: Retazos/Cargar y sus incentivos; encargado: Calidad, Pago y retiro e incentivos; dueño: Precios y Reportes. Los permisos de otros accesos administrativos se cierran con A/Román; no se deducen de que el rol sea dueño.
Detalle de pago/retiro: mostrar reserva, estado y precio exacto; efectivo/transferencia requieren comprobante, MercadoPago genera link/QR y luego Verificar pago. Solo tras pago aprobado se habilita Registrar retiro. Un aviso de éxito se muestra después de la respuesta confirmada de API. No sumar cobros anticipados, envío a domicilio ni aplicación móvil.
Escala de feedback, tamaños/tipos de foto y alta de personal interno necesitan contrato propio; se pueden desarrollar layout/validaciones conocidas sin inventar esas reglas. Los puntos de clientes no se muestran como calculados si la regla todavía no existe.

## 12 Referencias visuales de escritorio y móvil

Los esquemas adjuntos muestran la misma cabecera, menú, paneles, campos y botones en A/B/C. Son referencias de diseño con datos ficticios; no capturas de módulos implementados ni validación comercial de precios. El Markdown conserva las especificaciones textuales para que las IA no dependan de interpretar una imagen.
Referencia: carga y control de calidad usan la misma cabecera, menú lateral y panel de formulario; la aprobación se separa de la carga.

## 13 Referencias visuales del flujo cliente y retiro

La oferta muestra Confirmar reserva y Pago al retirar; la reserva muestra el plazo de doce horas de atención; la pantalla del encargado separa Registrar pago de Registrar retiro. Es la misma UI con funciones distintas según rol. El QR ilustrativo no es un código de cobro funcional.
Referencia: aviso y reserva en una columna móvil; pago/retiro del encargado mantiene los mismos campos y botones, con retiro bloqueado hasta pago aprobado.

## 14 Alineación con relevamiento y arranque paralelo

Se revisó el texto actual de Relevamiento_Inicial_Consolidado_Viruta (1), actualizado al 14/10. Coincide en cinco sucursales, carga manual, calidad antes de matching, una reserva activa, sucursal preferida, feedback, tres avisos/día y web responsive. Ese texto no especifica un sistema de diseño visual; los tokens/componentes/pantallas de esta versión son una propuesta adicional.

| Diferencia encontrada | Tratamiento en código y pantallas |
|---|---|
| Sección 4 dice primero en confirmar | Aplicar RF-22 v3.3: aviso secuencial al pedido más antiguo; no ofrecer simultáneamente a todos |
| Secciones 4–5 dicen retiro en 2 h o al cierre | Aplicar RF-17 v3.3: 12 h de atención desde confirmación; no cortar al cierre |
| Empresa vende OSB, entre otros productos | Catálogo del sistema RF-01: MDF, aglomerado, melamina; no agregar OSB por estar en descripción comercial |
| Métricas incluyen kg y tiempo hasta match | Conservar como necesidades identificadas; no afirmar que reportes B ya las calculan. Pesaje es acumulado semanal por sucursal, no por retazo |
Estas diferencias requieren que PM/analista actualicen el relevamiento. No se modificó ese archivo. Para programar, las decisiones específicas confirmadas de v3.3 y sus casos prevalecen sobre esas frases antiguas. El acuerdo no añade un módulo de báscula o kilos a A/B/C sin asignación.
Los tres pueden empezar desarrollo local de sus partes definidas. Antes de conectar módulos, publicar en el grupo: rol A/B/C, rama y commit base de API/UI, contrato consumido y tarea en curso. Usar una copia común de la base v2 para reproducir los ejemplos, o el checkout compartido adaptado; no sobrescribir el trabajo actual de GitHub. Integrar esa base con PR cuando corresponda.
Primero A entrega carga/control; B pedidos/matching/avisos; C reserva y pago/retiro manual. Cada uno implementa dentro de su carpeta, usa esta UI común y agrega pruebas. No esperar credenciales WhatsApp/MP para desarrollar el núcleo con adaptadores de prueba explícitos. No implementar una regla pendiente como real. Cuando falte una API ajena, usar un fixture local con el contrato conocido, marcado como ficticio y sin activar acciones reales.
Hacer una integración pequeña al terminar la primera operación de cada módulo, antes de completar todos los módulos aislados. Publicar PR enlazados y una captura a 360/1280 px, detectar diferencias y acordar el ajuste en este archivo. Las decisiones visuales locales no requieren reabrir todo el proyecto; los cambios de sesión, datos o contratos sí se coordinan.
Plan de ajuste posterior: reunir PR/commits de los tres, revisar diferencias de contratos/UI, ejecutar el flujo carga → calidad → pedido → aviso → reserva → pago → retiro, corregir conflictos y actualizar el documento a la versión siguiente. No garantizar que tres desarrollos independientes sean compatibles sin esta prueba.

Relevamiento revisado: https://docs.google.com/document/d/1mo_e-AxKglv6soVPXxmoPDXkroOYd8Ze_AJR80KI4uw/edit

## 15 Coordinación e instrucciones para IA

Coordinar el arranque en el grupo de los tres desarrolladores con una base común y tareas identificadas; la revisión de Román se mantiene para la plataforma e integración, sin atribuirle una aprobación previa. Los pendientes de negocio solo bloquean las operaciones que dependen de ellos, no el trabajo local definido.
| Decisión necesaria | Responsable / salida |
|---|---|
| Adoptar v2 o adaptar al starter actual | A+B+C+Román; PR y commits de referencia API/UI |
| Node, locks, lint y dependencias pendientes | Román; .nvmrc, CI y configuración compartida |
| Nombres de A/C y responsable QA | Equipo; asignación publicada |
| Calendario semanal/feriados y borde de las 20 h | Román+Franco; parámetros y ejemplos aprobados |
| Precio, repricing y puntos | Franco+dueño; regla escrita, sin valores inventados |
| WhatsApp/chatbot, fotos, endpoints A/C | B/A/C+Román; contratos concretos |
| MercadoPago y entornos | C+Román; credenciales de prueba, webhook e idempotencia |
| Feedback, turnos/ciclos y reportes | Equipo+Franco; ratificar políticas pendientes |
Al coordinar, registrar la versión utilizada, fecha, nombres, commits de API/UI y decisiones pendientes con responsable; diferenciar propuesta, adoptado por los desarrolladores y validado por Román/dueño. Después, los tres usan la misma copia; cuando cambie, reemplazan el contexto en sus IA. No desarrollar decisiones pendientes como si estuvieran validadas.
Texto para pegar en ChatGPT o Claude junto con este documento:
```text
Trabajamos en Viruta Match. Mi rol es DEV [A/B/C]. Usá el acuerdo adjunto como contrato común y los Requerimientos/Criterios v3.3 como fuente funcional. Primero leé README, docs/ACUERDO_DESARROLLO.md, package.json, package-lock.json, esquema/migraciones, autenticación, calendario y puntos de integración del checkout actual. Indicá qué versión/commit estás usando y cualquier diferencia con el acuerdo.
Seguí el diseño común de las secciones 9–13: mismos tokens, layout, componentes, estados de carga/error y mapa de pantallas. No diseñes otra estética ni agregues una librería visual por tu cuenta. Si faltan componentes, reutilizá las clases comunes y proponé una extracción compartida, sin duplicarlos.
Implementá mi módulo y sus pruebas/UI dentro de los dos repositorios existentes. Conservá las interfaces de otros módulos. No crees otro login, calendario, conexión SQLite, gestor de paquetes, arquitectura o formato de respuesta. Usá npm ci y las dependencias aprobadas; no actualices versiones por iniciativa propia.
No inventes reglas de precio, puntos, WhatsApp, feedback o estados pendientes. Si una diferencia bloquea una integración, describí el conflicto y proponé el cambio de contrato para el equipo; continuá con lo que sí esté definido. Para una dependencia o contrato nuevo documentá impacto y consumidores antes de incorporarlo a la base común.
Usá sesión de servidor para identidad y permisos. Guardá cola/plazos en SQLite. No simules un cobro o aviso real como éxito. No expongas secretos en código, navegador ni pruebas.
Entregá archivos modificados, pasos de ejecución, contratos/eventos usados, migraciones y pruebas efectivamente ejecutadas. Aclará todo pendiente o simulado. Completá mi parte sin implementar ni reemplazar la de otro compañero salvo una integración acordada.
```
Uso práctico: enviar el Word para revisar el acuerdo y el Markdown a cada IA; indicar el rol y aportar el código actual o acceso al repositorio. El documento no permite a una IA leer GitHub/Drive si no tiene esa conexión. Antes de aceptar código generado, verificar su integración en testing.
Fuentes consultadas: Propuesta Técnica v1.1 (14/10), sección 1 y 3–4; Requerimientos v3.3 con ajustes del 14/10; package.json de main/desarrollo de ambos repositorios; package-lock.json y contratos de la entrega v2. Criterios v3.3 se mantienen como referencia de aceptación; este acuerdo no reproduce todos sus casos. La versión 1.1 agrega el texto del Relevamiento Inicial consolidado y el CSS/pantallas existentes de v2 como referencia, con las diferencias identificadas en la sección 14.
Propuesta: https://drive.google.com/file/d/1OrebUPSi_fFHtrqaDzGmYMkCARpgfvNI/view
Requerimientos: https://docs.google.com/spreadsheets/d/1v6TGpySinttehK652J7tncf-JTN29yr850ihzBi7bc0
Criterios: https://docs.google.com/spreadsheets/d/12tUVQzNGQ-Ar0THXJ0mCN277sSdLEEVTRogZ0CCgzFc
Base v2: https://drive.google.com/file/d/1N4f9s3L9O5BcgL2v8iatDddwU7GF3vIG/view
