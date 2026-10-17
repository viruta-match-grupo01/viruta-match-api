export function createPreciosRepository(db) {
  return {
    /** color es null para MDF y aglomerado; `IS ?` compara también NULL. */
    find:(material,espesor,color)=>db.prepare('SELECT * FROM precio_m2 WHERE material=? AND espesor_mm=? AND color IS ?').get(material,espesor,color??null),
    list:()=>db.prepare('SELECT id,material,espesor_mm,color,precio_m2 FROM precio_m2 ORDER BY material,espesor_mm,color').all(),
    insert:v=>Number(db.prepare('INSERT INTO precio_m2(material,espesor_mm,color,precio_m2) VALUES(?,?,?,?)').run(v.material,v.espesor_mm,v.color,v.precio_m2).lastInsertRowid),
    update:(id,precio)=>db.prepare('UPDATE precio_m2 SET precio_m2=? WHERE id=?').run(precio,id),
    count:()=>db.prepare('SELECT COUNT(*) n FROM precio_m2').get().n
  };
}
