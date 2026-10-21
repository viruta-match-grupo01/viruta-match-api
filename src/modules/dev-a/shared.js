import {fail} from '../../errors.js';

/** Valida con Zod y traduce la falla al formato común {error,message}. */
export function parseOrFail(schema,input) {
  const result=schema.safeParse(input??{});
  if(!result.success) {
    const message=result.error.issues.map(i=>i.path.length?`${i.path.join('.')}: ${i.message}`:i.message).join('; ');
    fail(400,'DATOS_INVALIDOS',message);
  }
  return result.data;
}

/** Plazo de control de calidad: 24 horas corridas desde la carga (RF-19). */
export const CONTROL_HORAS=24;
/** Mínimo para ofrecer un retazo (RF-04) y máximo de cualquier medida (RF-05). */
export const MEDIDA_MIN_OFRECIBLE_CM=20;
export const MEDIDA_MAX_CM=120;
