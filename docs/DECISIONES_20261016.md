> Documento histórico de la base B. Estado actual: INTEGRACION_20261017.md. Las referencias a A/C pendientes no describen el prototipo integrado.

# Decisiones de la entrega del 16/10/2026

Esta es una entrega autónoma de la base común y B, para comenzar sin recuperar el ZIP anterior. Reutiliza lógica B existente, revisada y probada de nuevo; agrega catálogos, componentes, integración de scheduler y tests actuales. No se atribuye aprobación a Román ni al dueño.

Fuente funcional: Requerimientos/Criterios v3.3 y acuerdo 1.1. El relevamiento conserva frases antiguas incompatibles; se mantiene el turno secuencial, 2 h de atención para confirmar y 12 h de atención para retirar. Las reglas pendientes siguen identificadas.

Estado observado en GitHub, rama desarrollo: API tree b85e68b42d07ffd76800d10c3fccf5541e1c7c0a (solo package.json/lock); UI tree 776bf195a089269f00202a6c1355dd90c284fe87 (starter Vite sin negocio). Se reemplazan configuraciones/pantalla de ejemplo mediante cambios normales; no se borra historial ni se fuerza main/testing.

Conservamos las líneas React 19.2, Vite 8, plugin-react 6 y oxlint 1 del starter. Incorporamos Router/Query y Vitest del contrato. API conserva Express 5.3 y pasa CommonJS a ES Modules conforme al acuerdo, con servidor implementado. package.json y package-lock.json fijan las versiones exactas comprobadas; estos archivos prevalecen sobre la tabla de versiones de referencia v2 del acuerdo. No instalar otra variante por compañero.

Node de referencia 24.19.0 en .nvmrc/CI. No hace falta instalar dependencias globales. `npm ci` en cada repositorio. React Testing Library, sharp y Prettier no se incorporan a ciegas: las pruebas UI de esta entrega verifican cliente HTTP/componentes con React DOM y navegador real para el flujo B. A define fotos con infraestructura; C define SDK/HTTP de MercadoPago cuando lo implemente.

No cambian los nombres de tablas/eventos ni las rutas B del acuerdo. Catálogos canónicos en API: src/shared/catalogos.js y GET /api/catalogos. El scheduler permite createEquipoTasks(context) para C antes de procesar B, sin duplicar cron. Helpers de permisos/sucursal en src/shared/http.js. Base visual con Arial, verdes, layout y componentes del acuerdo; sin biblioteca visual nueva.

Predeterminado local: 7 días 08–20, borde 20 exclusivo; cierres/feriados pendientes. Renovación mantiene prioridad, nuevo ciclo para pedido cerrado, y no se asignan ofertas nuevas a clientes con reserva activa: políticas técnicas conservadas del acuerdo, sujetas a revisión, no validación atribuida al dueño. Tolerancia propia no negativa sin tope; pedido mínimo 1 cm, retazo ofrecido mínimo 20 cm. Precios del seed son ficticios. Puntos, repricing, escala feedback y condiciones de WhatsApp siguen pendientes.

SMTP implementado/configurable pero no probado contra credenciales reales del equipo. WhatsApp no integrado. A/C no implementados y reservas devuelve 501 hasta que C lo haga. Esta entrega no debe presentarse como sistema completo de producción.

## Versiones efectivas fijadas

### API

- better-sqlite3: 12.11.1
- express: 5.3.0
- nodemailer: 7.0.13
- zod: 4.6.7
- node-cron: 4.6.0
- bcrypt: 6.0.0
- jsonwebtoken: 9.0.3
- cookie-parser: 1.4.7
- cors: 2.8.6
- express-rate-limit: 8.7.1
- vitest: 3.2.7
- supertest: 7.3.1
- eslint: 9.39.5
- @eslint/js: 9.39.5
- globals: 16.5.0

### UI

- react: 19.2.8
- react-dom: 19.2.8
- react-router-dom: 7.18.4
- @tanstack/react-query: 5.104.2
- @types/react: 19.2.18
- @types/react-dom: 19.2.7
- @vitejs/plugin-react: 6.1.1
- oxlint: 1.81.0
- vite: 8.3.0
- vitest: 3.2.7

