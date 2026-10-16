# Entornos y dos repositorios

Se conserva el objetivo de la Propuesta Técnica: un Cloud Server DonWeb con Sandbox y Producción aislados, Nginx, Node/PM2, archivos SQLite distintos, Web Hosting y Correo profesional. Tres ramas no obligan a contratar tres servidores.

| Rama de ambos repos | Uso | API | Base | UI |
|---|---|---|---|---|
| desarrollo | Cada computadora e integración por PR | puerto 3001 local | desarrollo.db local | Vite 5173 local |
| testing | Sandbox para integración/UAT | instancia Sandbox | testing.db | Build de testing en Nginx |
| main | Producción autorizada | instancia Producción | produccion.db | Build de main en Nginx |

Dos repos GitHub no significan dos APIs ni dos bases de datos: hay una aplicación API por entorno y una UI por entorno. SQLite no está alojada ni duplicada en la UI. No servir dos procesos de API en el mismo entorno sobre el mismo archivo.

## API

Román configura una carpeta por entorno, .env aislado, npm ci, migraciones revisadas, Node/PM2 con una sola instancia por entorno, persistencia de data y uploads, secretos y backups. `npm start` ejecuta src/server.js. La configuración de producción exige JWT_SECRET fuerte, UI_ORIGIN y PUBLIC_APP_URL. ALLOW_DEMO=false y NOTIFICATION_MODE=smtp, con SMTP real configurado.

Sandbox puede usar captura para pruebas ficticias y habilitar SMTP al hacer una prueba autorizada. El servidor real no se configuró desde esta entrega.

## UI

Build por repo: npm ci y npm run build. Servir dist como archivos estáticos. La configuración de Vite se define en build: no se guarda SMTP ni JWT_SECRET en variables VITE_*.

Ejemplo de bloque Nginx para **cada** subdominio, adaptado por Román:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

El proxy_pass sin URI conserva /api/. En producción cambiar al puerto de esa instancia (por ejemplo 3002 según la propuesta). Configurar root al dist correcto, HTTPS y dominio real fuera de este ejemplo. No publicar Vite como servidor productivo. La URL de health para la API es /health; agregar su proxy solo si se quiere exponer al monitoreo.

## Publicación y base

CI de cada repo verifica; no despliega todavía. Una promoción de API/UI a testing exige versiones compatibles. Main/tag y despliegue productivo requieren la revisión definida por el equipo y una restauración de backup probada. El CI no crea cuentas de correo ni modifica BAC; el costo del servicio está documentado en CORREO_Y_COSTOS.md.
