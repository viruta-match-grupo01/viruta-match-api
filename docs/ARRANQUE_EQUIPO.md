> Documento histórico de la base B. Estado actual: INTEGRACION_20261017.md. Las referencias a A/C pendientes no describen el prototipo integrado.

# Arranque de los tres desarrolladores

Ignacio no necesita terminar A/C ni esperar infraestructura para publicar esta base en desarrollo. Compartir ambos repositorios y esta misma entrega, no tres estructuras iniciales independientes.

1. Ignacio publica API y UI en ramas feature/base-compartida-dev-b-20261016 y abre PR hacia desarrollo; revisar y fusionar ambos PR sin force push.
2. Dar a Guido y Dev C acceso Write en AMBOS repositorios y que acepten invitaciones. No es suficiente estar en la organización.
3. Guido clona/actualiza ambos repositorios, cambia a desarrollo y crea feature/dev-a-carga-calidad. A/C tienen sus README en src/modules/dev-a y dev-c, tanto API como UI.
4. Cada uno ejecuta npm ci en API/UI, copia .env.example a .env, migra/seed solo en API local y abre dos terminales npm run dev. Cada PC genera SQLite propio; el código del schema/migraciones sí es común.
5. IA de Guido: leer README, docs/DECISIONES_20261016.md y docs/ACUERDO_DESARROLLO.md, luego código actual. Implementar A dentro de sus carpetas, reutilizar sesión/db/calendario/catálogos/layout/componentes. No pedir ZIP viejo ni generar otro proyecto.
6. A empieza carga/control, C reserva/pago/retiro, B ya sirve pedidos/matching/avisos/reportes. A emite retazo.disponible y B genera cola; C confirma desde aviso_id. Hacer PR de la primera operación y probar ese cruce antes de terminar todo aislado.
7. Antes de cada PR: npm run check en ambos repositorios afectados. Enlazar PR API/UI, documentar endpoints/cambios y capturas. Hacer integración/UAT en testing; main queda para producción.

## Guido — comandos dentro de cada clon

```bash
git switch desarrollo
git pull --ff-only origin desarrollo
git switch -c feature/dev-a-carga-calidad
```

Si ya creó esa rama, usar git switch feature/dev-a-carga-calidad, sin recrearla. Al terminar: git add, git commit, git push -u origin feature/dev-a-carga-calidad y PR hacia desarrollo. Una rama en API y otra en UI con el mismo nombre son independientes.

## Puntos de integración reales

API src/modules/equipo.js recibe {db,bus,clock,calendar,devB}; routers bajo /api y tareas C en createEquipoTasks. UI src/modules/equipo-routes.jsx recibe el array de pantallas; ya hay una sola sesión, QueryClient y navegación. No hay endpoints operativos A/C todavía. Ver sus README para payloads y criterios.

Si el equipo cambió datos/contratos después del estado observado, integrar cambios manualmente y volver a probar. No resolverlo borrando trabajo o reemplazando el historial.
