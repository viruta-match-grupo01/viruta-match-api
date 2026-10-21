import {z} from 'zod';
import {fail} from '../../../errors.js';
import {parseOrFail} from '../shared.js';
import {createRetazosRepository} from '../retazos/repository.js';
import {retazoView} from '../retazos/service.js';

const aprobarSchema=z.object({
  humedad_ok:z.boolean({error:'Indicá si verificaste la humedad'}),
  bordes_ok:z.boolean({error:'Indicá si verificaste los bordes'}),
  medidas_ok:z.boolean({error:'Indicá si las medidas coinciden con la carga'})
}).strict();
const rechazarSchema=z.object({
  motivo:z.string({error:'El motivo es obligatorio'}).trim().min(3,'Indicá el motivo del rechazo').max(300,'El motivo es demasiado largo')
}).strict();

export function createCalidadService({db,bus,clock}) {
  const repo=createRetazosRepository(db);
  const withDeadline=row=>{const v=retazoView(row);return {...v,fuera_de_plazo:clock().getTime()>new Date(v.control_limite_en).getTime()};};
  /** Un retazo de otra sucursal se trata como inexistente: no se revela su existencia. */
  function ownBranch(id,user) {
    const r=repo.get(id);
    if(!r||!user.sucursal_id||r.sucursal_id!==user.sucursal_id) fail(404,'RETAZO_NO_ENCONTRADO','Retazo no encontrado');
    return r;
  }
  /**
   * Cambia estado, registra el control y emite el evento dentro de la misma transacción: los
   * listeners de B son síncronos y escriben en la misma db, así que un rollback no deja avisos.
   */
  function decide(id,user,resultado,motivo) {
    db.transaction(()=>{
      const r=ownBranch(id,user);
      if(r.estado!=='pendiente_control') fail(409,'RETAZO_NO_PENDIENTE','El retazo ya no está pendiente de control');
      if(resultado==='corregir_medidas') {
        repo.transitionFromPending(id,'corregir_medidas');
        repo.insertControl({retazo_id:id,encargado_id:user.id,resultado,motivo,realizado_en:clock().toISOString()});
        return;
      }
      const aprobado=resultado==='aprobado';
      if(!repo.transitionFromPending(id,aprobado?'disponible':'descartado')) fail(409,'RETAZO_NO_PENDIENTE','El retazo ya no está pendiente de control');
      repo.insertControl({retazo_id:id,encargado_id:user.id,resultado,motivo,realizado_en:clock().toISOString()});
      bus.emit(aprobado?'retazo.disponible':'retazo.descartado',{retazoId:id});
    }).immediate();
    return withDeadline(repo.get(id));
  }
  return {
    pending:user=>user.sucursal_id?repo.pendingByBranch(user.sucursal_id).map(withDeadline):[],
    get:(id,user)=>withDeadline(ownBranch(id,user)),
    /** RF-19: humedad, bordes y medidas verificados. Sin las tres confirmaciones no se aprueba. */
    approve(id,user,input) {
      const checks=parseOrFail(aprobarSchema,input);
      if(!checks.humedad_ok||!checks.bordes_ok||!checks.medidas_ok) fail(400,'CONTROL_INCOMPLETO','Para aprobar tenés que confirmar humedad, bordes y medidas. Si algo falla, rechazá indicando el motivo.');
      return decide(id,user,'aprobado',null);
    },
    reject(id,user,input) {
      const {motivo}=parseOrFail(rechazarSchema,input);
      return decide(id,user,'rechazado',motivo);
    },
    requestCorrection(id,user,input) {
      const {motivo}=parseOrFail(rechazarSchema,input);
      return decide(id,user,'corregir_medidas',motivo);
    }
  };
}
