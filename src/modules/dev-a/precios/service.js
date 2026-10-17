import {z} from 'zod';
import {MATERIALS,THICKNESSES,COLORS} from '../../../shared/catalogos.js';
import {fail} from '../../../errors.js';
import {parseOrFail} from '../shared.js';
import {createPreciosRepository} from './repository.js';
import {redondearImporte,areaM2,calcularImporte} from './importes.js';

export const precioSchema=z.object({
  material:z.enum(MATERIALS,{error:'Material no admitido'}),
  espesor_mm:z.number({error:'Espesor inválido'}).refine(n=>THICKNESSES.includes(n),'Espesor no admitido'),
  color:z.enum(COLORS,{error:'Color fuera del catálogo'}).nullable().optional(),
  precio_m2:z.number({error:'El precio por m² debe ser un número'}).finite().nonnegative('El precio por m² no puede ser negativo')
}).strict().superRefine((v,ctx)=>{
  if(v.material==='melamina'&&!v.color) ctx.addIssue({code:'custom',path:['color'],message:'La melamina requiere color'});
  if(v.material!=='melamina'&&v.color) ctx.addIssue({code:'custom',path:['color'],message:'El color solo aplica a la melamina'});
});

export function createPreciosService({db}) {
  const repo=createPreciosRepository(db);
  return {
    list:()=>repo.list(),
    /** Busca el precio por m² vigente; null si el dueño todavía no lo cargó. */
    buscar:(material,espesor,color)=>repo.find(material,espesor,material==='melamina'?color:null),
    /** Cálculo único de RF-21. El precio queda fijado al cargar: un cambio posterior no reprecia (pendiente de confirmar). */
    calcular({material,espesor_mm,color,alto_cm,ancho_cm}) {
      const row=repo.find(material,espesor_mm,material==='melamina'?color:null);
      if(!row) return null;
      return {area_m2:areaM2(alto_cm,ancho_cm),precio_m2:row.precio_m2,precio:calcularImporte(alto_cm,ancho_cm,row.precio_m2)};
    },
    /** Solo el dueño (verificado en la ruta). Crea o actualiza el valor para esa combinación. */
    upsert(input) {
      const data=parseOrFail(precioSchema,input);
      const color=data.material==='melamina'?data.color:null;
      const precio=redondearImporte(data.precio_m2);
      return db.transaction(()=>{
        const current=repo.find(data.material,data.espesor_mm,color);
        if(current) {repo.update(current.id,precio);return repo.find(data.material,data.espesor_mm,color);}
        repo.insert({material:data.material,espesor_mm:data.espesor_mm,color,precio_m2:precio});
        return repo.find(data.material,data.espesor_mm,color);
      }).immediate();
    },
    requireEntry(material,espesor,color) {
      const row=repo.find(material,espesor,material==='melamina'?color:null);
      if(!row) fail(409,'PRECIO_NO_CONFIGURADO','Todavía no hay un precio por m² cargado para este material, espesor y color. Avisá al dueño.');
      return row;
    }
  };
}
