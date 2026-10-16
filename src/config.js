import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export function readConfig(env=process.env) {
  const production=env.NODE_ENV==='production';
  if(production&&(!env.JWT_SECRET||env.JWT_SECRET.length<32)) throw new Error('JWT_SECRET de al menos 32 caracteres es obligatorio en producción');
  if(production&&(!env.UI_ORIGIN||!env.PUBLIC_APP_URL)) throw new Error('UI_ORIGIN y PUBLIC_APP_URL son obligatorios en producción');
  if(production&&(env.ALLOW_DEMO=== 'true'||env.NOTIFICATION_MODE==='capture')) throw new Error('Producción no permite endpoints ni canales de demo');
  return {production,port:Number(env.PORT??3001),host:env.HOST??'127.0.0.1',
    databasePath:resolve(root,env.DATABASE_PATH??'data/desarrollo.db'),
    jwtSecret:env.JWT_SECRET??randomBytes(48).toString('hex'),
    uiOrigins:(env.UI_ORIGIN??'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s=>s.trim()),
    publicAppUrl:env.PUBLIC_APP_URL??'http://localhost:5173',allowDemo:!production&&env.ALLOW_DEMO==='true',
    notificationMode:env.NOTIFICATION_MODE??(production?'smtp':'capture'),
    smtp:{host:env.SMTP_HOST,port:Number(env.SMTP_PORT??587),secure:env.SMTP_SECURE==='true',user:env.SMTP_USER,password:env.SMTP_PASSWORD,from:env.SMTP_FROM},
    businessDays:(env.BUSINESS_DAYS??'0,1,2,3,4,5,6').split(',').map(Number),holidays:(env.BUSINESS_HOLIDAYS??'').split(',').filter(Boolean)};
}
