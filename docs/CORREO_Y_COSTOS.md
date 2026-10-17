# Correo profesional y costo informado por el equipo

Dato aportado por Ignacio el 14/10/2026: servicio de **10 cuentas de email profesionales**, $2.700 por mes inicialmente y aumento a $13.500 por mes.

| Concepto | Importe ARS mensual |
|---|---:|
| Paquete de 10 cuentas, etapa inicial | $2.700 |
| Mismo paquete, después del aumento | $13.500 |
| Diferencia mensual | $10.800 |

Es el costo del paquete, no $2.700 o $13.500 por cada cuenta. No se conoce fecha del aumento/duración del precio inicial, ni se informó el tratamiento del IVA; no se inventa un presupuesto anual ni se modifica un BAC aprobado. En SC-03, registrar esos dos tramos y completar fechas/cotización junto con Cloud Server y Web Hosting.

## Implementación

La API usa una casilla como remitente de avisos (nombre a elegir por el equipo, por ejemplo avisos@su-dominio). Las otras nueve pueden asignarse por el equipo; no es necesario crear diez remitentes en el código ni enviar diez veces un aviso. No se contrataron cuentas ni se configuró un dominio con esta entrega.

Configurar en el `.env` del servidor: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD y SMTP_FROM, con los datos exactos del panel del proveedor. Activar NOTIFICATION_MODE=smtp cuando quieran probar envíos autorizados a cuentas de prueba. No asumir el host ni inventar credenciales del servicio.

La UI no contiene SMTP ni contraseñas. El proveedor y costo no cambian las reglas RF-14/15/16: medio elegido, respaldo por correo, máximo tres avisos lógicos diarios y franja 08–20. Los avisos capturados de desarrollo no generan envíos externos.

El servidor y casilla reales todavía requieren configuración y prueba por Román. Un éxito SMTP significa aceptación del proveedor, no garantía de lectura/entrega en la bandeja del cliente.
