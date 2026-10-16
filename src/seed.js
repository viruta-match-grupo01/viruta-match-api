import bcrypt from 'bcrypt';
import {pathToFileURL} from 'node:url';
import {openDatabase,createDemoSchema,migrateDevB} from './database.js';
export function seedDemo(db,now=new Date()) {
  if(db.prepare('SELECT COUNT(*) n FROM usuario').get().n) return;
  db.transaction(()=>{
    const branches=['Palermo Hollywood','Palermo Soho','Villa Urquiza','Floresta','Núñez'];
    branches.forEach((nombre,i)=>db.prepare('INSERT INTO sucursal VALUES(?,?,?)').run(i+1,nombre,`${nombre}, CABA (dirección ficticia)`));
    const users=[[1,'Ignacio (cliente)','cliente',null],[2,'Ana (cliente)','cliente',null],[3,'Dueño de prueba','duenio',null],[4,'Operario de prueba','operario',1],[5,'Encargado de prueba','encargado',1]];
    const hash=bcrypt.hashSync('demo-local',10);
    for(const [id,nombre,rol,sucursal] of users) db.prepare('INSERT INTO usuario(id,nombre,email,password_hash,rol,sucursal_id) VALUES(?,?,?,?,?,?)').run(id,nombre,`usuario${id}@example.invalid`,hash,rol,sucursal);
    for(const id of [1,2]) db.prepare('INSERT INTO perfil_cliente VALUES(?,?,?)').run(id,'estudiante','correo');
    const retazos=[['MDF',18,40,66,null,null,1,3200,'disponible'],['MDF',18,60,40,null,null,1,2900,'disponible'],['melamina',18,50,80,'blanco','mate',2,8000,'disponible'],['MDF',18,40,60,null,null,1,2800,'pendiente_control'],['MDF',18,15,40,null,null,1,0,'descartado']];
    retazos.forEach((r,i)=>db.prepare(`INSERT INTO retazo(id,material,espesor_mm,alto_cm,ancho_cm,color,acabado,sucursal_id,precio,estado,foto_url,forma_retiro,cargado_por,cargado_en) VALUES(?,?,?,?,?,?,?,?,?,?,?,'Retiro presencial en sucursal',4,?)`).run(i+1,...r,`/retazo-demo.svg`,new Date(now.getTime()-86400000+i*1000).toISOString()));
  }).immediate();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const db=openDatabase(process.env.DATABASE_PATH??'./data/demo.db');createDemoSchema(db);migrateDevB(db);seedDemo(db);db.close();console.log('Datos de ejemplo preparados.');
}
