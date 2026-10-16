# Guía para Ignacio y sus compañeros

## Qué recibir

Dos carpetas independientes: `viruta-match-api` y `viruta-match-ui`. No hay un package.json padre, workspaces ni node_modules compartido. Cada una se sube a su repositorio de la organización GitHub. El ZIP conjunto sirve únicamente para entregar las dos carpetas y esta guía.

## Paso 1 — Preparar la API (una vez por compañero)

Abrir PowerShell en `viruta-match-api`:

```powershell
Copy-Item .env.example .env
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Dejar esa terminal abierta. Comprobar http://localhost:3001/health. Debe indicar `ok: true`.

`data/desarrollo.db` se crea **en el repo API** con db:migrate y recibe ejemplos con db:seed. Cada computadora tiene su propia base. DB Browser for SQLite puede abrir ese archivo; evitar modificarlo manualmente mientras se prueba un flujo.

## Paso 2 — Preparar la UI (otra terminal)

Abrir PowerShell en `viruta-match-ui`:

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Abrir http://localhost:5173, iniciar sesión. Contraseña de todos los ejemplos: `demo-local`.

| Usuario | Correo |
|---|---|
| Ignacio, cliente | usuario1@example.invalid |
| Ana, cliente | usuario2@example.invalid |
| Dueño | usuario3@example.invalid |
| Operario | usuario4@example.invalid |
| Encargado | usuario5@example.invalid |

API y UI pueden estar en carpetas distintas: no requieren ser vecinas. Para Linux/macOS, cambiar Copy-Item por cp.

## Paso 3 — Primera entrega de Ignacio (B)

Los módulos B ya están implementados: pedidos, matching, avisos, reportes. Probar creación de pedido, prioridad al más antiguo, rotación/área, plazos de avisos, límite tres por día y reportes del dueño. El pago sigue siendo al retirar; no hay cobro al reservar. Confirmar reserva requiere el módulo C.

La base de autenticación permite que A/C desarrollen con un usuario real en req.user y sin confiar en headers enviados por el navegador. Román revisa el soporte común del Sprint 0, sus migraciones y el entorno antes del Sandbox.

## Paso 4 — Trabajo del dev A

API: `src/modules/dev-a/`. UI: `src/modules/dev-a/`.

Implementar carga y corrección de retazos, control de calidad, registro completo/roles/perfiles y recompensas, siguiendo RF-01 a RF-08, RF-19 a RF-21, RF-24 y RF-26. Reutilizar usuario/perfil_cliente/retazo/precio_m2/control_calidad/incentivo/movimiento_puntos. El precio se calcula por m², sin edición del operario; precios de ejemplo hasta validación del dueño. Incentivos: operario 15 %, encargado aprobador 10 %. Puntos del cliente siguen sujetos a reglas de fase 2.

Al aprobar calidad, cambiar retazo a disponible y emitir `retazo.disponible` con retazoId. Al rechazar, estado descartado y evento retazo.descartado. B ya reacciona. Nunca ofrecer retazos pendientes de control.

## Paso 5 — Trabajo del dev C

API: `src/modules/dev-c/`. UI: `src/modules/dev-c/`.

Implementar reservas, pago/retiro, integración MercadoPago y feedback, siguiendo RF-17/18/22/23/27. El primer endpoint es POST `/api/reservas` con `{aviso_id}`: así funciona el botón de la UI B. El aviso confirma en dos horas de atención y la reserva permite retirar dentro de 12 horas de atención (un día hábil), con pago en la sucursal.

No marcar retirado sin pago aprobado. Efectivo/transferencia se registran con comprobante; MercadoPago genera link/QR por precio exacto y confirma contra el proveedor. No asumir que un webhook acredita el pago sin consultar/verificar el proveedor. Las credenciales son del servidor, nunca de la UI.

Cuando venza/cancele una reserva, liberar retazo en una transacción y emitir el evento definido en CONTRATOS_EQUIPO. El feedback se registra en calificacion; B lo consulta en reportes. No bloquear futuras reservas por falta de calificación sin que el dueño confirme esa consecuencia (pendiente en la fuente).

## Paso 6 — Conectar módulos sin tocar los demás

API: montar routers en `src/modules/equipo.js`. Todos reciben `context` con la misma conexión db, bus, clock, calendar y servicios B. El servidor, login, middleware y scheduler comunes están listos; no copiar un nuevo server.js para cada desarrollador.

UI: agregar elementos en `src/modules/equipo-routes.jsx`. Cada entrada contiene `{path,label,roles,element}`. Reutilizar SessionApp, request y el Router comunes. No crear conexiones a SQLite ni guardar secretos de proveedores en VITE_*.

Cada dev modifica únicamente sus módulos y las entradas comunes indispensables. Cambios del esquema/autenticación/calendario se coordinan con Román. A revisa B, B revisa C, C revisa A, conforme a la propuesta; Román hace revisión final.

## Paso 7 — Ramas y pruebas

```text
feature/dev-<a|b|c>-<modulo> → PR a desarrollo → PR a testing → PR a main
```

En **cada repo modificado**, `npm run check` antes de abrir el PR. API y UI tienen pipelines propios. Si una función cambia el contrato HTTP, abrir y vincular ambos PR; probar juntos antes de promover a main. No significa que ambos repos deban tener siempre el mismo commit, sino versiones compatibles.

Testing prueba integración y UAT con datos ficticios. Main contiene solo una versión que el equipo decidió publicar. Esta entrega no despliega a DonWeb ni configura protecciones de GitHub por sí sola.

## Problemas frecuentes

| Problema | Acción |
|---|---|
| UI abre pero no inicia sesión | Verificar que la terminal API siga abierta y /health responda; comprobar VITE_API_PROXY_TARGET. |
| API dice base sin inicializar | Ejecutar db:migrate y, en local, db:seed dentro del repo API. |
| No hay usuarios de ejemplo | db:seed solo crea ejemplos si usuario está vacía; no borra datos existentes. |
| API cambia puerto | Cambiar PORT y el VITE_API_PROXY_TARGET de la UI; reiniciar ambos. |
| Se vencieron sesiones al reiniciar | Copiar .env.example a .env para mantener JWT_SECRET local; sin .env desarrollo genera uno nuevo por arranque. |
| Aviso no sale | Revisar horario Buenos Aires, cupo diario, retazo disponible y pedido vigente. Usar herramientas locales de reloj/cola. |
| Botón reservar devuelve módulo pendiente | Dev C aún no montó POST /api/reservas. Es una dependencia documentada, no un éxito simulado. |
| Error de compilación better-sqlite3 | Usar Node.js 24 LTS y npm ci; si no hay binario compatible, instalar herramientas de compilación de Node de la plataforma. |
