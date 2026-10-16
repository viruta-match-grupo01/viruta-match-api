import Database from 'better-sqlite3';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

/** Solo abre la conexión. El esquema base pertenece al Líder Técnico. */
export function openDatabase(filename=':memory:') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), {recursive:true});
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  return db;
}

/** Esquema compartido inicial, según sección 3.3. Román mantiene sus migraciones. */
export function createBaseSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sucursal (id INTEGER PRIMARY KEY,nombre TEXT NOT NULL,direccion TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS usuario (id INTEGER PRIMARY KEY,nombre TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,telefono TEXT,rol TEXT NOT NULL,sucursal_id INTEGER REFERENCES sucursal(id),estado TEXT NOT NULL DEFAULT 'activo');
    CREATE TABLE IF NOT EXISTS perfil_cliente (usuario_id INTEGER PRIMARY KEY REFERENCES usuario(id),tipo TEXT NOT NULL,medio_aviso TEXT NOT NULL CHECK(medio_aviso IN ('correo','whatsapp','ambos')));
    CREATE TABLE IF NOT EXISTS retazo (id INTEGER PRIMARY KEY,material TEXT NOT NULL,espesor_mm REAL NOT NULL,alto_cm INTEGER NOT NULL,ancho_cm INTEGER NOT NULL,color TEXT,acabado TEXT,foto_url TEXT NOT NULL,sucursal_id INTEGER NOT NULL REFERENCES sucursal(id),forma_retiro TEXT NOT NULL,precio REAL NOT NULL,estado TEXT NOT NULL,cargado_por INTEGER REFERENCES usuario(id),cargado_en TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reserva (id INTEGER PRIMARY KEY,aviso_id INTEGER REFERENCES aviso(id),pedido_id INTEGER REFERENCES pedido(id),cliente_id INTEGER NOT NULL REFERENCES usuario(id),retazo_id INTEGER NOT NULL REFERENCES retazo(id),estado TEXT NOT NULL,confirmada_en TEXT NOT NULL,vence_en TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reserva_cliente_activa ON reserva(cliente_id) WHERE estado='activa';
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reserva_retazo_activa ON reserva(retazo_id) WHERE estado='activa';
    CREATE TABLE IF NOT EXISTS calificacion (id INTEGER PRIMARY KEY,reserva_id INTEGER NOT NULL REFERENCES reserva(id),puntaje_material INTEGER,puntaje_trato INTEGER,comentario TEXT,creada_en TEXT);
    CREATE TABLE IF NOT EXISTS precio_m2 (id INTEGER PRIMARY KEY,material TEXT NOT NULL,espesor_mm REAL NOT NULL,color TEXT,precio_m2 REAL NOT NULL CHECK(precio_m2>=0));
    CREATE TABLE IF NOT EXISTS control_calidad (id INTEGER PRIMARY KEY,retazo_id INTEGER NOT NULL REFERENCES retazo(id),encargado_id INTEGER NOT NULL REFERENCES usuario(id),resultado TEXT NOT NULL CHECK(resultado IN ('aprobado','rechazado','corregir_medidas')),motivo TEXT,realizado_en TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pago (id INTEGER PRIMARY KEY,reserva_id INTEGER NOT NULL REFERENCES reserva(id),medio TEXT NOT NULL CHECK(medio IN ('efectivo','transferencia','mercadopago')),monto REAL NOT NULL CHECK(monto>=0),estado TEXT NOT NULL CHECK(estado IN ('pendiente','aprobado','rechazado')),comprobante TEXT,mp_link TEXT,mp_pago_id TEXT,registrado_por INTEGER REFERENCES usuario(id),registrado_en TEXT);
    CREATE TABLE IF NOT EXISTS movimiento_puntos (id INTEGER PRIMARY KEY,cliente_id INTEGER NOT NULL REFERENCES usuario(id),reserva_id INTEGER NOT NULL REFERENCES reserva(id),puntos INTEGER NOT NULL,creado_en TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS incentivo (id INTEGER PRIMARY KEY,usuario_id INTEGER NOT NULL REFERENCES usuario(id),retazo_id INTEGER NOT NULL REFERENCES retazo(id),rol TEXT NOT NULL CHECK(rol IN ('operario','encargado')),porcentaje REAL NOT NULL,monto REAL NOT NULL, generado_en TEXT NOT NULL);
  `);
}

// Alias para los tests heredados de B y el ejecutable de captura local.
export const createDemoSchema=createBaseSchema;

function addExtensionColumns(db) {
  // Compatibilidad aditiva con tablas base creadas por el Sprint 0.
  const extensions={pedido:{ciclo:'INTEGER NOT NULL DEFAULT 0'},aviso:{creado_en:"TEXT NOT NULL DEFAULT ''",claim_token:'TEXT',claim_until:'TEXT',intentos:'INTEGER NOT NULL DEFAULT 0',error_codigo:'TEXT',pedido_ciclo:'INTEGER NOT NULL DEFAULT 0'},aviso_envio:{provider_id:'TEXT'}};
  for(const [table,columns] of Object.entries(extensions)) {
    const existing=new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name));
    if(!existing.size) continue;
    for(const [column,type] of Object.entries(columns)) if(!existing.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  if(db.prepare('PRAGMA table_info(aviso)').all().length) db.prepare("UPDATE aviso SET creado_en=programado_para WHERE creado_en=''").run();
}

/** Migración aditiva de B. Validar nombres con Sprint 0 antes de integrarla. */
export function migrateDevB(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pedido (
      id INTEGER PRIMARY KEY,cliente_id INTEGER NOT NULL REFERENCES usuario(id),
      material TEXT NOT NULL CHECK(material IN ('MDF','aglomerado','melamina')),
      espesor_mm REAL NOT NULL CHECK(espesor_mm IN (3,5.5,9,12,15,18,25)),
      alto_min_cm INTEGER NOT NULL CHECK(alto_min_cm BETWEEN 1 AND 120),
      ancho_min_cm INTEGER NOT NULL CHECK(ancho_min_cm BETWEEN 1 AND 120),
      color TEXT,acabado TEXT,tolerancia_pct REAL CHECK(tolerancia_pct IS NULL OR tolerancia_pct>=0),
      sucursal_preferida_id INTEGER NOT NULL REFERENCES sucursal(id),
      estado TEXT NOT NULL CHECK(estado IN ('abierto','cumplido','cancelado','vencido')),
      creado_en TEXT NOT NULL,vence_en TEXT NOT NULL,ciclo INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS aviso (
      id INTEGER PRIMARY KEY,retazo_id INTEGER NOT NULL REFERENCES retazo(id),
      pedido_id INTEGER NOT NULL REFERENCES pedido(id),tipo TEXT NOT NULL CHECK(tipo IN ('coincidencia','liberado')),
      canal TEXT NOT NULL CHECK(canal IN ('correo','whatsapp','ambos')),
      estado TEXT NOT NULL CHECK(estado IN ('en_cola','enviado','fallido','confirmado','vencido','cancelado')),
      programado_para TEXT NOT NULL,enviado_en TEXT,vence_confirmacion_en TEXT,
      creado_en TEXT NOT NULL,claim_token TEXT,claim_until TEXT,intentos INTEGER NOT NULL DEFAULT 0,error_codigo TEXT,pedido_ciclo INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_aviso_turno ON aviso(retazo_id) WHERE estado IN ('en_cola','enviado','fallido');
    CREATE INDEX IF NOT EXISTS ix_pedido_matching ON pedido(estado,sucursal_preferida_id,material,espesor_mm,creado_en,id);
    CREATE INDEX IF NOT EXISTS ix_retazo_matching ON retazo(estado,sucursal_id,material,espesor_mm,cargado_en,id);
    CREATE INDEX IF NOT EXISTS ix_aviso_queue ON aviso(estado,programado_para);
    CREATE INDEX IF NOT EXISTS ix_aviso_historial ON aviso(retazo_id,pedido_id,id);
    CREATE TABLE IF NOT EXISTS aviso_envio (
      id INTEGER PRIMARY KEY,aviso_id INTEGER NOT NULL REFERENCES aviso(id),
      canal TEXT NOT NULL,estado TEXT NOT NULL CHECK(estado IN ('enviando','enviado','fallido','incierto')),
      iniciado_en TEXT NOT NULL,terminado_en TEXT,error_codigo TEXT,provider_id TEXT,
      UNIQUE(aviso_id,canal)
    );
    CREATE TABLE IF NOT EXISTS worker_b_lock (id INTEGER PRIMARY KEY CHECK(id=1),token TEXT NOT NULL,hasta TEXT NOT NULL);
    CREATE VIEW IF NOT EXISTS reporte_b_sucursal AS
      SELECT s.id,s.nombre,
        (SELECT COUNT(*) FROM retazo r WHERE r.sucursal_id=s.id) cargados,
        (SELECT COUNT(DISTINCT a.retazo_id || ':' || a.pedido_id) FROM aviso a JOIN retazo r ON r.id=a.retazo_id WHERE r.sucursal_id=s.id) coincidencias,
        (SELECT COUNT(*) FROM reserva v JOIN retazo r ON r.id=v.retazo_id WHERE r.sucursal_id=s.id) reservas,
        (SELECT COUNT(*) FROM retazo r WHERE r.sucursal_id=s.id AND r.estado='retirado') retiros,
        (SELECT COUNT(*) FROM retazo r WHERE r.sucursal_id=s.id AND r.estado='descartado') descartes,
        (SELECT AVG(c.puntaje_material) FROM calificacion c JOIN reserva v ON v.id=c.reserva_id JOIN retazo r ON r.id=v.retazo_id WHERE r.sucursal_id=s.id) calificacion_material,
        (SELECT AVG(c.puntaje_trato) FROM calificacion c JOIN reserva v ON v.id=c.reserva_id JOIN retazo r ON r.id=v.retazo_id WHERE r.sucursal_id=s.id) calificacion_trato
      FROM sucursal s;
  `);
  addExtensionColumns(db);
}
