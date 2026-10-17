import {createPreciosRepository} from './precios/repository.js';

/**
 * Precios por m² FICTICIOS para desarrollo local. El dueño todavía no confirmó los valores
 * reales (RF-21); los de melamina blanca y roble son los de ejemplo del caso CP-21.
 * Solo se cargan si la tabla está vacía y nunca en producción (lo controla db-commands.js).
 */
export const PRECIOS_EJEMPLO=[
  {material:'MDF',espesor_mm:18,color:null,precio_m2:12000},
  {material:'aglomerado',espesor_mm:18,color:null,precio_m2:9000},
  {material:'melamina',espesor_mm:18,color:'blanco',precio_m2:20000},
  {material:'melamina',espesor_mm:18,color:'roble',precio_m2:25000}
];

export function seedPreciosEjemplo(db) {
  const repo=createPreciosRepository(db);
  if(repo.count()) return false;
  db.transaction(()=>{for(const p of PRECIOS_EJEMPLO) repo.insert(p);}).immediate();
  return true;
}
