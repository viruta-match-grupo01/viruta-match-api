/** Importes ARS REAL con dos decimales; usar siempre esta función para comparar pagos con el precio del retazo. */
export function roundMoney(value){return Math.round((Number(value)+Number.EPSILON)*100)/100;}
