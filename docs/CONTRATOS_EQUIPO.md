# Contratos API / UI / módulos

## Reparto y autoridad

Requerimientos v3.3, criterios v3.3 y Propuesta Técnica v1.1 siguen definiendo las reglas. La instrucción del equipo del 14/10 reemplaza únicamente el monorepo y las ramas main/develop de la sección 1.2 por **dos repositorios con main/testing/desarrollo**. Las asignaciones de A/B/C siguen la sección 4.2.

API contiene todo el dominio y la única conexión SQLite por proceso. UI usa HTTP/JSON con cookie. Román mantiene plataforma compartida; se entrega una base inicial para que los tres puedan comenzar.

Esta entrega del 16/10 aplica además docs/DECISIONES_20261016.md. El ZIP anterior no es un requisito.

## Endpoints implementados

| Verbo | Ruta | Rol / dato |
|---|---|---|
| GET | /health | Estado sin datos personales. |
| POST | /api/auth/login | email, password; crea cookie httpOnly. |
| GET | /api/auth/me | Usuario de la cookie; no expone password_hash. |
| POST | /api/auth/logout | Quita cookie. |
| GET | /api/sucursales | Autenticado. |
| GET | /api/catalogos | Catálogos canónicos; autenticado. |
| GET | /api/pedidos | Cliente; solo propios. |
| POST | /api/pedidos | Cliente; 201 / 400 datos inválidos / 409 máximo tres. |
| POST | /api/pedidos/:id/renovar | Cliente propietario; 404 si ajeno. |
| DELETE | /api/pedidos/:id | Cliente propietario; 409 si tiene reserva activa. |
| GET | /api/avisos | Cliente; solo propios, incluso en cola. |
| GET | /api/avisos/:id | Cliente destinatario. |
| GET | /api/reportes | Dueño. |
| POST | /api/avisos/:id/reconciliar | Dueño; canal y resultado verificado. |

Pedido:

```json
{"material":"MDF","espesor_mm":18,"alto_min_cm":40,"ancho_min_cm":60,"color":null,"acabado":null,"tolerancia_pct":null,"sucursal_preferida_id":1}
```

No aceptar cliente_id del cuerpo: proviene de req.user. Los campos no previstos se rechazan. Los errores de negocio usan `{error,message}`.

## Punto de extensión API

`createEquipoRouter(context)` recibe `{db,bus,clock,calendar,devB}`. Ejemplo de A:

```js
import {createRetazosRouter} from './dev-a/retazos/routes.js';
router.use('/retazos',createRetazosRouter(context));
```

El router ya está bajo `/api` y después del middleware de sesión. Cada router debe comprobar rol/propiedad. req.user es `{id,nombre,email,rol,sucursal_id}`. Los roles canónicos son cliente/operario/encargado/duenio.

## Eventos

| Evento | Emisor | Payload | Reacción B |
|---|---|---|---|
| pedido.creado | B | {pedidoId,clienteId} | Barrer disponibles y encolar. |
| retazo.disponible | A | {retazoId} | Buscar pedido más antiguo compatible. |
| retazo.descartado | A | {retazoId} | Cancelar ofertas activas de ese retazo. |
| reserva.vencida | C | {retazoId,reservaId} | Aviso liberado al siguiente pedido. |
| reserva.cancelada | C | {retazoId,reservaId} | Aviso liberado al siguiente pedido. |
| retiro.concretado | C | {reservaId,retazoId,clienteId} | Alimenta A/recompensas y C/feedback; B reporta mediante SQL. |

Cambiar los estados en SQLite antes del evento, dentro de la transacción cuando los listeners escriban en la misma db. Los listeners no llaman proveedores externos: escriben la cola. El tick de B barre la base y recupera disponibles/plazos aunque un evento en memoria se pierda.

## Confirmación, pago y retiro: contrato C

POST `/api/reservas` recibe `{aviso_id}`. En una transacción inmediata, C debe:

1. Resolver aviso/pedido/retazo y comprobar propiedad con req.user.
2. Verificar aviso enviado y vencimiento futuro, pedido abierto/no vencido y retazo disponible.
3. Rechazar con 409 si cliente o retazo ya tiene una reserva activa; índices únicos parciales apoyan esa regla.
4. Crear reserva activa con `calendar.addHours(clock(),12)`, marcar aviso confirmado y retazo reservado.
5. No cobrar al reservar. Al concretar pago y retiro, exigir pago aprobado, marcar retazo retirado, reserva concretada y pedido cumplido.

Si C vence una reserva, cambia reserva a vencida y retazo a disponible, y emite reserva.vencida. B no vence reservas por su cuenta. Un aviso confirmado nunca se trata como un aviso sin confirmar.

## Calendario y cola

Fechas siempre ISO UTC con milisegundos. Calendario Buenos Aires: addHours(2) para aviso y addHours(12) para reserva. Ejemplos: aviso a 19:30 vence 09:30 siguiente; reserva a 15:00 vence 15:00 siguiente; reserva fuera de horario a 22:00 vence 20:00 siguiente.

Horario de nuevos envíos: 08:00 inclusive, 20:00 exclusive. Default de todos los días porque la fuente no define cierres semanales/feriados; BUSINESS_DAYS y BUSINESS_HOLIDAYS permiten confirmarlos/configurarlos. Pedidos vencen a 30 días calendario desde creación/renovación, aunque hayan tenido avisos.

Turno = un aviso lógico por retazo. Se ordenan retazos por cargado_en/id y pedidos por creado_en/id. Solo disponible; exactitud de material/espesor/color/acabado/sucursal; dimensiones con rotación; área dentro de tolerancia propia o 30 %. Un cliente con reserva activa no recibe nuevas asignaciones. Al vencer el turno, no se vuelve al mismo pedido dentro del ciclo de ofertas; renovar un pedido cerrado abre un nuevo ciclo, conservando su antigüedad. Son decisiones de implementación a ratificar con el equipo si quiere otra política.

aviso_envio registra el canal, estado, fecha y provider_id. Cuenta como un cupo el aviso, no cada canal. Hasta tres avisos de coincidencia/liberado por cliente y día Buenos Aires. Cola permanece en SQLite; solo se inicia el plazo de dos horas después del envío.

## Avisos externos

NotificationChannel.send(message) es async y devuelve providerId al aceptar el proveedor. Para fallos ciertos se marca deliveryUncertain=false; fallos ambiguos quedan inciertos y requieren reconciliación por el dueño, sin reenvío automático. SMTP implementado; WhatsApp real pendiente de contrato con el chatbot. Ambos canales comparten el mismo aviso; una falla cierta WhatsApp habilita correo de respaldo. No existe garantía exactamente-una-vez de SMTP: se guarda el resultado por canal y se revisan los envíos interrumpidos.

## Esquema compartido

database.js crea las entidades de la sección 3.3 y extensiones técnicas B. No ejecutar una base distinta por módulo. Extensiones: pedido.ciclo, aviso.pedido_ciclo, creado_en/claim/error/intentos, canal ambos, aviso_envio, worker_b_lock y vista reporte_b_sucursal. Si Román aporta un esquema previo, revisar sus CHECK y migraciones sobre una copia; la migración agrega campos B pero no reconstruye tablas ajenas.

Las rutas del registro/perfiles, controles, reservas, pagos, puntos y feedback se implementan por sus responsables; tener sus tablas creadas no significa que esos módulos estén implementados.

## UI y configuración

VITE_API_URL=/api y proxy Vite hacia API 3001 en local. Producción recomendada: UI y `/api` bajo el mismo dominio, Nginx sirve estáticos y hace proxy. Con un dominio API distinto: VITE_API_URL absoluto, UI_ORIGIN exacto y credenciales; si además es un sitio distinto, Román debe revisar política de cookies y CSRF antes de habilitarlo. No cambiar cookies a SameSite=None sin revisar esa protección.

equipo-routes.jsx permite agregar `{path,label,roles,element}`. Registro/login comparte SessionApp. El CSS responsive y TanStack Query existentes pueden reutilizarse. UI nunca guarda SMTP_PASSWORD/JWT_SECRET/MercadoPago; cualquier VITE_* llega al navegador.

## Reportes

Coincidencias = pares retazo/pedido registrados en avisos, sin duplicar canales. Reservas = registros históricos; retiros/descartes = estados del retazo. Promedios de calificaciones existentes por sucursal. Porcentaje retiros/cargados acumulado; no se interpreta como reducción medida del descarte sin base del negocio.

La regla de bloquear reservas por feedback pendiente y las reglas de puntos del cliente siguen pendientes en la fuente; B no las inventa.
