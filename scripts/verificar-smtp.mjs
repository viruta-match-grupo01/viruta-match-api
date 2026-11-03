/**
 * Verificador seguro del SMTP ya implementado en Viruta Match.
 * Ejecutar dentro del repositorio API con Node 24 y dependencias instaladas.
 * Por defecto SOLO comprueba conexión/autenticación: nunca envía un mensaje.
 * Para enviar: --send --to correo-de-prueba@example.com
 */
import nodemailer from 'nodemailer';

const args=process.argv.slice(2);
const send=args.includes('--send');
const toIndex=args.indexOf('--to');
const to=toIndex>=0?args[toIndex+1]:undefined;
const required=['SMTP_HOST','SMTP_FROM','SMTP_USER','SMTP_PASSWORD'];
const missing=required.filter(k=>!process.env[k]);
if(missing.length){console.error('Falta configuración:',missing.join(', '));process.exit(2);}
if(send&&(!to||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))){console.error('Para enviar un test especificá: --send --to direccion@ejemplo.com');process.exit(2);}
if(send&&to.endsWith('.invalid')){console.error('El destinatario de prueba debe ser una casilla real autorizada.');process.exit(2);}
const port=Number(process.env.SMTP_PORT||587);
const secure=process.env.SMTP_SECURE==='true';
if(!Number.isInteger(port)||port<1||port>65535){console.error('SMTP_PORT inválido');process.exit(2);}
const transporter=nodemailer.createTransport({
  host:process.env.SMTP_HOST, port, secure,
  requireTLS:!secure,
  auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},
  connectionTimeout:12000,greetingTimeout:12000,socketTimeout:20000,
  tls:{rejectUnauthorized:true}
});
try {
  await transporter.verify();
  console.log('OK: servidor SMTP accesible y autenticación aceptada. No prueba recepción en casilla.');
  if(send){
    const result=await transporter.sendMail({
      from:process.env.SMTP_FROM,to,
      subject:'Viruta Match — verificación técnica de correo (03/11)',
      text:'Este correo de prueba verifica el transporte SMTP. No corresponde a un aviso real de matching.'
    });
    if(!result.accepted?.includes(to))throw new Error('El destinatario no figura entre los aceptados por SMTP');
    console.log(`Aceptado por SMTP. id=${result.messageId||'(no informado)'}. Confirmar llegada a bandeja manualmente.`);
  }
}catch(error){
  console.error('FALLO SMTP:',error.code||error.name||'Error', '- verificar host, TLS, credenciales y logs del servidor.');
  process.exitCode=1;
}finally{transporter.close();}
