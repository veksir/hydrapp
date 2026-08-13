const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "hydrapp.sqlite");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weight_kg REAL NOT NULL,
  age_years INTEGER NOT NULL DEFAULT 30,
  sex TEXT NOT NULL DEFAULT 'F', -- 'M' | 'F', usado para el piso de referencia IOM
  tz_offset_minutes INTEGER NOT NULL DEFAULT 0, -- new Date().getTimezoneOffset() del usuario
  activity_level TEXT NOT NULL DEFAULT 'moderado', -- sedentario | moderado | alto -> cambia el ml/kg base
  workout_time TEXT, -- hora habitual de ejercicio, ej '18:00' (opcional)
  physio_state TEXT NOT NULL DEFAULT 'normal', -- normal | embarazo | lactancia
  wake_time TEXT NOT NULL DEFAULT '07:00',
  sleep_time TEXT NOT NULL DEFAULT '23:00',
  default_activity_minutes INTEGER NOT NULL DEFAULT 0,
  climate_temp REAL NOT NULL DEFAULT 25,
  climate_humidity REAL NOT NULL DEFAULT 60,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  volume_ml REAL NOT NULL, -- capacidad total del recipiente (volumen calibrado)
  container_type TEXT NOT NULL DEFAULT 'custom', -- custom | thermos | pitcher | dispenser
  drink_type TEXT NOT NULL DEFAULT 'agua', -- qué contiene habitualmente (agua, cafe, te, jugo...)
  current_volume REAL NOT NULL DEFAULT 0, -- volumen restante hoy (para recipientes grandes con seguimiento parcial)
  last_reset_date TEXT, -- YYYY-MM-DD del último llenado/reinicio diario (zona horaria del usuario)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_context (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  activity_minutes INTEGER NOT NULL DEFAULT 0,
  activity_is_live INTEGER NOT NULL DEFAULT 0, -- 1 si el usuario reportó su ejercicio de HOY (no un default)
  temp_override REAL,
  humidity_override REAL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS water_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  container_id INTEGER REFERENCES containers(id) ON DELETE SET NULL,
  amount_ml REAL NOT NULL, -- volumen físico real que se tomó
  drink_type TEXT NOT NULL DEFAULT 'agua',
  effective_ml REAL NOT NULL DEFAULT 0, -- amount_ml * factor de hidratación del tipo de bebida
  logged_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, logged_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  last_notified_at TEXT, -- para no mandar dos avisos de sed muy seguidos
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
`);

// --- Migración ligera --------------------------------------------------
// "CREATE TABLE IF NOT EXISTS" no le agrega columnas nuevas a una tabla que
// ya existía de una versión anterior (por ejemplo, un hydrapp.sqlite creado
// antes de que el perfil tuviera age_years/sex). Si falta alguna columna
// esperada, se agrega aquí con un valor por defecto razonable para no
// romper el INSERT/UPDATE de profiles.
const existingColumns = db.prepare("PRAGMA table_info(profiles)").all().map((c) => c.name);

const EXPECTED_PROFILE_COLUMNS = {
  age_years: "INTEGER NOT NULL DEFAULT 30",
  sex: "TEXT NOT NULL DEFAULT 'F'",
  tz_offset_minutes: "INTEGER NOT NULL DEFAULT 0",
  activity_level: "TEXT NOT NULL DEFAULT 'moderado'",
  workout_time: "TEXT",
  physio_state: "TEXT NOT NULL DEFAULT 'normal'",
  wake_time: "TEXT NOT NULL DEFAULT '07:00'",
  sleep_time: "TEXT NOT NULL DEFAULT '23:00'",
  default_activity_minutes: "INTEGER NOT NULL DEFAULT 20",
  climate_temp: "REAL NOT NULL DEFAULT 25",
  climate_humidity: "REAL NOT NULL DEFAULT 60",
};

for (const [column, definition] of Object.entries(EXPECTED_PROFILE_COLUMNS)) {
  if (!existingColumns.includes(column)) {
    db.exec(`ALTER TABLE profiles ADD COLUMN ${column} ${definition}`);
  }
}

const existingLogColumns = db.prepare("PRAGMA table_info(water_logs)").all().map((c) => c.name);
if (!existingLogColumns.includes("drink_type")) {
  db.exec("ALTER TABLE water_logs ADD COLUMN drink_type TEXT NOT NULL DEFAULT 'agua'");
}
if (!existingLogColumns.includes("effective_ml")) {
  db.exec("ALTER TABLE water_logs ADD COLUMN effective_ml REAL NOT NULL DEFAULT 0");
  // Registros viejos no tenían ml efectivo calculado: como eran 100% agua
  // implícitamente, el efectivo es igual al volumen físico.
  db.exec("UPDATE water_logs SET effective_ml = amount_ml WHERE effective_ml = 0");
}

const existingContextColumns = db.prepare("PRAGMA table_info(daily_context)").all().map((c) => c.name);
if (!existingContextColumns.includes("activity_is_live")) {
  db.exec("ALTER TABLE daily_context ADD COLUMN activity_is_live INTEGER NOT NULL DEFAULT 0");
}

// Recipientes de gran capacidad (>3000ml): seguimiento parcial del volumen
// restante con reinicio diario automático. Un termo de 4L no se registra de
// una sola vez (antes rebotaba contra el límite de "un solo registro"), sino
// con tomas parciales que descuentan del restante. Migración ligera: si la
// columna no existe (recipientes de una versión anterior), se agrega y los
// recipientes existentes arrancan llenos hoy para no cambiarles el
// comportamiento.
const existingContainerColumns = db.prepare("PRAGMA table_info(containers)").all().map((c) => c.name);
if (!existingContainerColumns.includes("container_type")) {
  db.exec("ALTER TABLE containers ADD COLUMN container_type TEXT NOT NULL DEFAULT 'custom'");
}
if (!existingContainerColumns.includes("current_volume")) {
  db.exec("ALTER TABLE containers ADD COLUMN current_volume REAL NOT NULL DEFAULT 0");
}
if (!existingContainerColumns.includes("last_reset_date")) {
  db.exec("ALTER TABLE containers ADD COLUMN last_reset_date TEXT");
  // Los recipientes ya calibrados arrancan llenos hoy; el auto-reset diario
  // los deja así a partir de mañana sin intervención.
  db.exec(
    "UPDATE containers SET current_volume = volume_ml, last_reset_date = date('now', 'localtime')"
  );
}
if (!existingContainerColumns.includes("drink_type")) {
  db.exec("ALTER TABLE containers ADD COLUMN drink_type TEXT NOT NULL DEFAULT 'agua'");
}

module.exports = db;
