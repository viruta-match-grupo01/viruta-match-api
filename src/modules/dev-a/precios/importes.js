/**
 * Importes en ARS con dos decimales (la base v2 guarda REAL). Propuesta del acuerdo:
 * una función compartida; vive aquí hasta que Román la mueva a la base común.
 */
export function redondearImporte(value) {
  return Math.round((value+Number.EPSILON)*100)/100;
}

/** área en m² = alto_cm × ancho_cm / 10000 */
export function areaM2(altoCm,anchoCm) {
  return altoCm*anchoCm/10000;
}

/** precio = área × precio por m². Se multiplica antes de dividir para no arrastrar error binario. */
export function calcularImporte(altoCm,anchoCm,precioM2) {
  return redondearImporte(altoCm*anchoCm*precioM2/10000);
}
