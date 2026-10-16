# Viruta Match API

Entrega del 16/10/2026: base compartida + Dev B (Ignacio). Repositorio independiente para `viruta-match-grupo01/viruta-match-api`.

## Ejecutar desde Git Bash

Node 24 (parche de referencia `.nvmrc`), npm. Ejecutar dentro de esta carpeta:

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

API: http://127.0.0.1:3001/health. SQLite se crea al migrar en `data/desarrollo.db`, con ruta absoluta impresa en consola. Cada desarrollador tiene su DB local. No copiar una DB compartida ni subirla a Git.

Usuarios ficticios del seed: `usuario1@example.invalid` y `usuario2@example.invalid` clientes; `usuario3@example.invalid` dueño; `usuario4@example.invalid` operario; `usuario5@example.invalid` encargado. Contraseña de todos: `demo-local`. Usuarios/cargas son ficticios y seed no se permite en producción.

## Qué está implementado

Sesión JWT en cookie httpOnly, bcrypt, conexión SQLite WAL, esquema común, reloj/calendario, bus y scheduler. Módulo B: pedidos (alta/lista/renovación/cancelación), matching con rotación y tolerancia de área, avisos por turnos, cola persistente con cupos/horarios/vencimientos/reconciliación, SMTP por adaptador y reportes de dueño.

La configuración local captura avisos en memoria en vez de enviar correo; estados/cola/resultados por canal permanecen en SQLite. Captura es un adaptador de prueba, no evidencia de entrega a una casilla. `SMTP_*` + `NOTIFICATION_MODE=smtp` habilitan el adaptador real con credenciales del equipo; no se han enviado mensajes reales en esta entrega. WhatsApp real pendiente del chatbot: su falla cierta permite correo de respaldo. `ALLOW_DEMO=false` por defecto; herramientas de simulación solo opt-in local.

No están implementados A ni C. Leer `src/modules/dev-a/README.md` y `src/modules/dev-c/README.md`. Las tablas compartidas y fixtures no sustituyen esos módulos. Confirmar reserva responde 501 hasta integrar C.

## Contratos y pruebas

`docs/ARRANQUE_EQUIPO.md` explica módulos/extensiones. `docs/CONTRATOS_EQUIPO.md` contiene rutas/eventos. `docs/ACUERDO_DESARROLLO.md` conserva el acuerdo 1.1 y `docs/DECISIONES_20261016.md` registra los ajustes de esta entrega.

```bash
npm run check
```

Para producción se requieren credenciales, calendario confirmado, revisión de schema/migraciones y entornos/HTTPS; no desplegar datos ficticios. Nunca iniciar varias API sobre el mismo SQLite.
