# Dev A — Guido

Agregar aquí carga, calidad, registro/roles completos y recompensas; no reemplazar la sesión ni el esquema compartido.

1. Crear `retazos/routes.js`, `retazos/service.js`, `retazos/repository.js` y equivalentes de calidad.
2. Exportar factory `createRetazosRouter(context)`; importar/montar en `src/modules/equipo.js` con `router.use('/retazos', createRetazosRouter(context))`. Ya está bajo `/api`.
3. `context` contiene `db`, `bus`, `clock`, `calendar`, `devB`. Usar `requireRole`, `positiveId`, `requireBranch` desde `src/shared/http.js`; verificar propiedad/sucursal en SQL.
4. Catálogos en `src/shared/catalogos.js`. Esquema en `src/database.js`; cambios aditivos y pruebas, no borrar tablas.
5. Guardar retazo pendiente de control; aprobar calidad en transacción y luego `bus.emit('retazo.disponible',{retazoId})` dentro de esa misma transacción síncrona. Ante rechazo emitir `retazo.descartado` después de cambiar estado. Sin llamadas externas dentro de listeners/transactions.
6. B ya escucha esos eventos y vuelve a barrer la base en el tick; no implementar otro matching.
7. Registro público crea solo clientes. Contraseñas con bcrypt. Perfil informativo separado de rol y `medio_aviso` en `perfil_cliente`.
8. Foto: acordar y documentar endpoint/multipart, tipos, tamaño y persistencia antes de exponer uploads; el parser JSON global no acepta multipart automáticamente. No modificar esa protección global para todos los endpoints.

La plataforma no implementa todavía estos endpoints. Los retazos del seed son ficticios. Probar integración con `tests/integracion-equipo.test.js` como ejemplo de factory, sesión, eventos y rollback.
