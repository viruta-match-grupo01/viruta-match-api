/** Actualiza solo la tarifa de demostración confirmada por la consigna CP-21.
    No repricia reservas, ventas ni retazos publicados: eso requiere aprobación comercial. */
import {readConfig} from '../src/config.js';
import {openDatabase} from '../src/database.js';
const config=readConfig();if(config.production)throw new Error('Comando de demostración prohibido en producción');
const db=openDatabase(config.databasePath);
try{
 const row=db.prepare("SELECT id FROM precio_m2 WHERE material='melamina' AND espesor_mm=18 AND color='blanco'").get();
 if(row)db.prepare('UPDATE precio_m2 SET precio_m2=11600 WHERE id=?').run(row.id);
 else db.prepare("INSERT INTO precio_m2(material,espesor_mm,color,precio_m2) VALUES('melamina',18,'blanco',11600)").run();
 console.log('Tarifa de demostración: melamina blanca 18 mm = ARS 11.600/m² (0,40 m² = $4.640).');
 console.log('Retazos ya cargados mantienen su precio; no se modificaron ventas ni reservas.');
}finally{db.close();}
