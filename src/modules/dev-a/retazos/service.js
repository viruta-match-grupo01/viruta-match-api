import {fail} from '../../../errors.js';
import {parseOrFail,CONTROL_HORAS,MEDIDA_MIN_OFRECIBLE_CM} from '../shared.js';
import {createPreciosService} from '../precios/service.js';
import {createRetazosRepository} from './repository.js';
import {retazoSchema,estimacionSchema} from './validation.js';
import {z} from 'zod';

const HORA=3600000;

/** Forma pública de un retazo. Los campos control_* internos se resumen en `motivo` y `control_limite_en`. */
export function retazoView(row) {
  if(!row) return null;
  const {control_resultado:resultado,control_motivo:motivo,control_realizado_en:controladoEn,...retazo}=row;
  const limite=new Date(new Date(row.cargado_en).getTime()+CONTROL_HORAS*HORA).toISOString();
  return {
    ...retazo,
    control_limite_en:limite,
    ultimo_control:resultado?{resultado,motivo,realizado_en:controladoEn}:null,
    motivo_estado:row.estado==='descartado'?(resultado==='rechazado'?motivo:`Alguna medida es menor a ${MEDIDA_MIN_OFRECIBLE_CM} cm`):null
  };
}

export function createRetazosService({db,clock}) {
  const repo=createRetazosRepository(db);
  const precios=createPreciosService({db});
  return {
    /** Operario: sus propias cargas. */
    list:user=>repo.listByLoader(user.id).map(retazoView),
    get(id,user) {
      const r=repo.get(id);
      if(!r||r.cargado_por!==user.id) fail(404,'RETAZO_NO_ENCONTRADO','Retazo no encontrado');
      return retazoView(r);
    },
    correct(id,user,input) {
      const data=parseOrFail(z.object({alto_cm:z.number().int().min(1).max(120),ancho_cm:z.number().int().min(1).max(120)}).strict(),input);
      db.transaction(()=>{
        const r=repo.get(id);
        if(!r||r.cargado_por!==user.id||r.sucursal_id!==user.sucursal_id)fail(404,'RETAZO_NO_ENCONTRADO','Retazo no encontrado');
        if(r.estado!=='corregir_medidas')fail(409,'CORRECCION_NO_SOLICITADA','El encargado debe solicitar primero la corrección');
        const descartado=data.alto_cm<20||data.ancho_cm<20;
        const price=precios.calcular({...r,...data});
        if(!descartado&&!price)precios.requireEntry(r.material,r.espesor_mm,r.color);
        db.prepare("UPDATE retazo SET alto_cm=?,ancho_cm=?,precio=?,estado=? WHERE id=? AND estado='corregir_medidas'")
          .run(data.alto_cm,data.ancho_cm,price?.precio??0,descartado?'descartado':'pendiente_control',id);
      }).immediate();
      return retazoView(repo.get(id));
    },
    /** Precio como dato de lectura para el operario; no modifica nada. */
    estimarPrecio(query) {
      const q=parseOrFail(estimacionSchema,query);
      const result=precios.calcular(q);
      if(!result) precios.requireEntry(q.material,q.espesor_mm,q.color);
      return result;
    },
    /**
     * RF-01 a RF-07 y RF-21. Nace pendiente_control (RF-06) o descartado si alguna medida
     * es menor a 20 cm (RF-04). Sucursal y operario salen de la sesión, nunca del cuerpo.
     */
    create(user,input) {
      if(!user.sucursal_id) fail(403,'SIN_SUCURSAL','Tu usuario no tiene una sucursal asignada');
      const data=parseOrFail(retazoSchema,input);
      const color=data.material==='melamina'?data.color:null,acabado=data.material==='melamina'?data.acabado:null;
      const id=db.transaction(()=>{
        const descartado=data.alto_cm<MEDIDA_MIN_OFRECIBLE_CM||data.ancho_cm<MEDIDA_MIN_OFRECIBLE_CM;
        const calculo=precios.calcular({material:data.material,espesor_mm:data.espesor_mm,color,alto_cm:data.alto_cm,ancho_cm:data.ancho_cm});
        // Un retazo que se ofrecerá no puede quedar sin precio; uno descartado no se vende y queda en 0.
        if(!calculo&&!descartado) precios.requireEntry(data.material,data.espesor_mm,color);
        return repo.insert({...data,color,acabado,sucursal_id:user.sucursal_id,precio:calculo?.precio??0,estado:descartado?'descartado':'pendiente_control',cargado_por:user.id,cargado_en:clock().toISOString()});
      }).immediate();
      return retazoView(repo.get(id));
    }
  };
}
