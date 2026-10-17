> Contratos originales de la entrega A. La integración del 17/10 agrega corrección de medidas e incentivos: ver INTEGRACION_20261017.md. Esas dos funciones ya no están pendientes; fotos reales y cuentas públicas sí.

# Contratos Dev A — carga, control de calidad y precios por m²

Fichas de las rutas de A que agrega la rama `feature/dev-a-carga-calidad`. Todas viven bajo `/api`, usan la sesión de servidor (cookie `viruta_session`) y devuelven errores como `{"error":"CODIGO","message":"Texto"}`. Cada ruta verifica rol, sucursal y propiedad en el servidor; ocultar el menú en la UI no autoriza nada.

Alcance: RF-01 a RF-07, RF-19 a RF-21, RF-24 (parte de A). No incluye registro público/cuenta, recompensas ni corrección de medidas (ver «Pendiente»).

## Rutas

| Verbo y ruta | Rol | Qué hace | Respuesta |
|---|---|---|---|
| `GET /api/retazos` | operario | Sus propias cargas, más nuevas primero | 200 `[retazo]` |
| `POST /api/retazos` | operario | Carga un retazo (RF-01 a RF-07, RF-21) | 201 `retazo` |
| `GET /api/retazos/:id` | operario | Una carga propia; ajena o inexistente = 404 | 200 `retazo` |
| `GET /api/retazos/precio?material&espesor_mm&alto_cm&ancho_cm[&color]` | operario | Vista previa del precio; no escribe | 200 `{area_m2,precio_m2,precio}` |
| `GET /api/calidad` | encargado | Pendientes de control de SU sucursal, más antiguos primero | 200 `[retazo]` |
| `GET /api/calidad/:id` | encargado | Detalle; de otra sucursal = 404 | 200 `retazo` |
| `POST /api/calidad/:id/aprobar` | encargado | Aprueba el control (RF-19, RF-20) | 200 `retazo` |
| `POST /api/calidad/:id/rechazar` | encargado | Rechaza con motivo; pasa a `descartado` | 200 `retazo` |
| `GET /api/precios` | duenio | Tabla de precios por m² | 200 `[{id,material,espesor_mm,color,precio_m2}]` |
| `PUT /api/precios` | duenio | Crea o actualiza un precio por m² (RF-21, RF-24) | 200 fila |

Sin sesión: 401 `SESION_REQUERIDA`. Rol no permitido: 403 `SIN_PERMISO`. Id no numérico: 400 `ID_INVALIDO`.

## Requests

`POST /api/retazos` (campos inesperados se rechazan; `sucursal_id`, `cargado_por`, `estado`, `precio` y `cargado_en` los pone el servidor):

```json
{"material":"melamina","espesor_mm":18,"alto_cm":50,"ancho_cm":80,"color":"blanco","acabado":"mate","foto_url":"/retazo-demo.svg","forma_retiro":"Retiro presencial en sucursal"}
```

- `material`, `espesor_mm`, `color`, `acabado` salen de `src/shared/catalogos.js`. `color` y `acabado` son obligatorios solo en melamina y deben ser `null`/ausentes en MDF y aglomerado.
- `alto_cm` y `ancho_cm`: enteros de 1 a 120 (RF-05). Menores a 20 cm se registran como `descartado` (RF-04) y no participan del matching.
- `foto_url`: por ahora solo `/retazo-demo.svg` (ficticia). La subida real está pendiente de contrato con Román.

`POST /api/calidad/:id/aprobar`: `{"humedad_ok":true,"bordes_ok":true,"medidas_ok":true}`. Las tres deben ser `true`; si no, 400 `CONTROL_INCOMPLETO`.

`POST /api/calidad/:id/rechazar`: `{"motivo":"Humedad en un borde"}` (3 a 300 caracteres).

`PUT /api/precios`: `{"material":"melamina","espesor_mm":18,"color":"blanco","precio_m2":20000}`. El importe se redondea a 2 decimales.

## Forma del retazo

Columnas de la tabla `retazo` más: `sucursal_nombre`, `sucursal_direccion`, `cargado_por_nombre`, `control_limite_en` (carga + 24 h, RF-19), `ultimo_control` (`{resultado,motivo,realizado_en}` o `null`) y `motivo_estado` (solo si está `descartado`). En `/api/calidad` se suma `fuera_de_plazo` (boolean, calculado con el reloj del servidor).

## Errores propios

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Falla de validación (mensaje por campo) |
| `CONTROL_INCOMPLETO` | 400 | Aprobar sin confirmar humedad, bordes y medidas |
| `RETAZO_NO_ENCONTRADO` | 404 | No existe, es de otro operario o de otra sucursal (no se revela) |
| `RETAZO_NO_PENDIENTE` | 409 | El retazo ya fue decidido o nació descartado |
| `PRECIO_NO_CONFIGURADO` | 409 | No hay precio por m² cargado para esa combinación |
| `SIN_SUCURSAL` | 403 | El operario no tiene sucursal asignada |

## Transacciones y eventos

- Carga: una transacción inmediata; calcula el precio y inserta. Estado inicial `pendiente_control`, o `descartado` si alguna medida < 20 cm. **No emite eventos al cargar** (el acuerdo prohíbe `retazo.disponible` con retazo pendiente; `retazo.cargado` queda sin payload definido y no se usa).
- Aprobar: en una sola transacción cambia `pendiente_control → disponible` con `UPDATE ... WHERE estado='pendiente_control'`, inserta en `control_calidad` y emite `retazo.disponible {retazoId}` (listeners síncronos de B en la misma base; si uno falla, todo se revierte).
- Rechazar: misma transacción, estado `descartado`, `control_calidad` con motivo y emite `retazo.descartado {retazoId}`.
- Consumidor: B (matching/avisos). Un consumidor debe tolerar repetición.

## Reglas y decisiones aplicadas

- Precio = alto × ancho (m²) × precio por m² según material, espesor y color (color solo melamina); el operario no puede fijarlo. El precio queda fijado al cargar.
- Si el retazo se va a ofrecer y no hay precio por m², la carga falla con 409; no se inventa un valor. Un descartado por tamaño se registra con precio 0.
- Plazo de 24 h del encargado: se informa (`control_limite_en`, `fuera_de_plazo`); no bloquea la decisión.
- Los precios del seed (`src/modules/dev-a/seed.js`) son **ficticios**; los de melamina blanca y roble son los de ejemplo de CP-21.

## Pruebas

`tests/dev-a.test.js` (Vitest + Supertest, base temporal en memoria y reloj inyectado): CP-01 a CP-07, CP-19 y CP-20 (parte de A), CP-21, CP-24 y aislamiento por operario/sucursal. No envían correo ni cobran.

## Pendiente (no implementado ni asumido)

- Subida de fotos reales: endpoint multipart, tipos, tamaño, permisos y conservación (A + Román).
- Corrección de medidas (RF-19: el operario corrige y se repite el control) y aviso al operario ante rechazo.
- Si un cambio de precio por m² afecta a retazos ya cargados (a confirmar con el dueño); valores reales de precios.
- Registro público y cuenta (RF-08), recompensas e incentivos 15 % / 10 % (RF-26), puntos de clientes (fase 2).
- Evento `retazo.cargado`: payload y consumidores a cerrar antes de usarlo.
