import {readConfig} from './config.js';
import {openDatabase,createBaseSchema,migrateDevB} from './database.js';
import {seedDemo} from './seed.js';
import {seedPreciosEjemplo} from './modules/dev-a/seed.js';
const config=readConfig(),db=openDatabase(config.databasePath);
const command=process.argv[2];
try {
  if(command==='migrate'){createBaseSchema(db);migrateDevB(db);console.log(`Esquema compartido y módulos B preparados: ${config.databasePath}`);}
  else if(command==='seed'){if(config.production)throw new Error('No cargar datos ficticios en producción');seedDemo(db);seedPreciosEjemplo(db);console.log('Datos y precios ficticios cargados. Correo usuario1@example.invalid, contraseña demo-local');}
  else throw new Error('Usar migrate o seed');
} finally {db.close();}
