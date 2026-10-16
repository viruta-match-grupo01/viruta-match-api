import {createReportesRepository} from './reportes.repository.js';
export function createReportesService(db) {
  const repo=createReportesRepository(db);
  return {get(){
    const sucursales=repo.byBranch().map(r=>({...r,porcentaje_retiro:r.cargados?Number((100*r.retiros/r.cargados).toFixed(2)):0}));
    const totales=sucursales.reduce((a,r)=>{for(const k of ['cargados','coincidencias','reservas','retiros','descartes']) a[k]+=r[k];return a;},{cargados:0,coincidencias:0,reservas:0,retiros:0,descartes:0});
    return {sucursales,totales,meta_retiro_pct:60,porcentaje_retiro:totales.cargados?100*totales.retiros/totales.cargados:0,cola:repo.queue(),avisos_fallidos:repo.failures()};
  }};
}
