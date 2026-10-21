import {z} from 'zod';
import {MATERIALS,THICKNESSES,COLORS,FINISHES} from '../../../shared/catalogos.js';
import {MEDIDA_MAX_CM} from '../shared.js';

/**
 * Fotos admitidas por ahora. La subida real (endpoint, tipos, tamaño, permisos y
 * conservación) necesita un contrato con Román porque el parser global de la API solo
 * acepta JSON de 32 kb. Hasta entonces solo se acepta la imagen ficticia de la UI.
 */
export const FOTOS_PERMITIDAS=['/retazo-demo.svg'];

const medida=label=>z.number({error:`${label} debe ser un número`}).int(`${label} debe ser un número entero de cm`).min(1,`${label} debe ser mayor que 0`).max(MEDIDA_MAX_CM,`${label} no puede superar ${MEDIDA_MAX_CM} cm`);
const espesor=z.number({error:'Espesor inválido'}).refine(n=>THICKNESSES.includes(n),'Espesor no admitido');

function reglasMelamina(v,ctx) {
  if(v.material==='melamina'&&(!v.color||!v.acabado)) ctx.addIssue({code:'custom',path:['color'],message:'La melamina requiere color y acabado'});
  if(v.material!=='melamina'&&(v.color||v.acabado)) ctx.addIssue({code:'custom',path:['color'],message:'Color y acabado solo aplican a la melamina'});
}

export const retazoSchema=z.object({
  material:z.enum(MATERIALS,{error:'Material no admitido'}),
  espesor_mm:espesor,
  alto_cm:medida('El alto'),ancho_cm:medida('El ancho'),
  color:z.enum(COLORS,{error:'Color fuera del catálogo'}).nullable().optional(),
  acabado:z.enum(FINISHES,{error:'Acabado no admitido'}).nullable().optional(),
  foto_url:z.string({error:'La foto es obligatoria'}).refine(v=>FOTOS_PERMITIDAS.includes(v),'Foto no admitida'),
  forma_retiro:z.string({error:'La forma de retiro es obligatoria'}).trim().min(3,'Indicá la forma de retiro').max(120,'La forma de retiro es demasiado larga')
}).strict().superRefine(reglasMelamina);

/** Vista previa del precio: mismos campos de medida/material que la carga, llegan por query string. */
export const estimacionSchema=z.object({
  material:z.enum(MATERIALS,{error:'Material no admitido'}),
  espesor_mm:z.coerce.number({error:'Espesor inválido'}).refine(n=>THICKNESSES.includes(n),'Espesor no admitido'),
  alto_cm:z.coerce.number({error:'El alto debe ser un número'}).int().min(1).max(MEDIDA_MAX_CM),
  ancho_cm:z.coerce.number({error:'El ancho debe ser un número'}).int().min(1).max(MEDIDA_MAX_CM),
  color:z.enum(COLORS,{error:'Color fuera del catálogo'}).nullable().optional()
}).strict().superRefine((v,ctx)=>{
  if(v.material==='melamina'&&!v.color) ctx.addIssue({code:'custom',path:['color'],message:'La melamina requiere color'});
});
