import {z} from 'zod';
import {MATERIALS,THICKNESSES,COLORS,FINISHES} from '../shared/catalogos.js';
export {COLORS} from '../shared/catalogos.js';
export const pedidoSchema=z.object({
  material:z.enum(MATERIALS),
  espesor_mm:z.number().refine(n=>THICKNESSES.includes(n),'Espesor no admitido'),
  alto_min_cm:z.number().int().min(1).max(120),ancho_min_cm:z.number().int().min(1).max(120),
  color:z.enum(COLORS).nullable().optional(),acabado:z.enum(FINISHES).nullable().optional(),
  tolerancia_pct:z.number().finite().nonnegative().nullable().optional(),
  sucursal_preferida_id:z.number().int().positive()
}).strict().superRefine((v,ctx)=>{
  if(v.material==='melamina'&&(!v.color||!v.acabado)) ctx.addIssue({code:'custom',message:'Melamina requiere color y acabado'});
  if(v.material!=='melamina'&&(v.color||v.acabado)) ctx.addIssue({code:'custom',message:'Color y acabado solo aplican a melamina'});
});
