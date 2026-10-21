# Viruta Match API — prototipo integrado A/B/C

Estado y pendientes: docs/INTEGRACION_20261017.md. Conserva la base B, integra ZIP A y rama cambios-chadma de C. Node 24 (.nvmrc), versiones fijadas en package-lock.json.

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

API: http://127.0.0.1:3001/health. Para ensayo usar config/prototipo.env.example en lugar de .env.example; solamente en desarrollo. Cada PC crea su SQLite; nunca subirlo ni compartirlo como base de trabajo.

Usuarios ficticios: usuario1@example.invalid y usuario2 (clientes), usuario3 (dueño), usuario4 (operario sucursal 1), usuario5 (encargado sucursal 1), todos con contraseña demo-local. Los correos completos terminan en @example.invalid.

Flujo implementado: carga/precios/calidad/corrección → pedido/matching/aviso → reserva → pago manual/retiro → incentivos/reportes. Fotos ficticias, MercadoPago/feedback/cuentas públicas pendientes; detalle en el informe. Captura local de correos, sin envío real. ALLOW_DEMO=false por defecto; las herramientas requieren opt-in local y dueño. Producción rechaza demo/capture.

```bash
npm run check
```

Ejecutar db:migrate antes de iniciar o actualizar esta versión. No iniciar dos API sobre el mismo SQLite. No subir .env, node_modules, bases, fotos reales o credenciales. PR hacia desarrollo; validar en testing antes de producción.
