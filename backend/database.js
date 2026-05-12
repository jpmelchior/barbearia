// backend/database.js

const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath =
  process.env.DATABASE_PATH || path.join(__dirname, "barbearia.db");

const db = new sqlite3.Database(databasePath, (err) => {
  if (err) {
    console.error("Erro ao abrir o banco de dados:", err.message);
    process.exit(1);
  }
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  const columns = await all(`PRAGMA table_info(${tableName})`);

  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    await run(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
    );

    console.log(`Coluna ${columnName} adicionada em ${tableName}.`);
  }
}

async function initializeDatabase() {
  try {
    await run("PRAGMA journal_mode = WAL");
    await run("PRAGMA busy_timeout = 5000");
    await run("PRAGMA foreign_keys = ON");

    await run(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        service TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        ip TEXT,
        device_id TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, time)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS blocked_times (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time TEXT,
        reason TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    /*
      Migração para bancos antigos:
      Se appointments já existia antes, adicionamos as colunas novas.
    */
    await addColumnIfNotExists(
      "appointments",
      "status",
      "TEXT NOT NULL DEFAULT 'scheduled'"
    );

    await addColumnIfNotExists("appointments", "ip", "TEXT");

    await addColumnIfNotExists("appointments", "device_id", "TEXT");

    await addColumnIfNotExists("appointments", "user_agent", "TEXT");

    await addColumnIfNotExists(
      "appointments",
      "updated_at",
      "DATETIME DEFAULT CURRENT_TIMESTAMP"
    );

    /*
      Índices só são criados depois das colunas existirem.
    */
    await run(`
      CREATE INDEX IF NOT EXISTS idx_appointments_date_time
      ON appointments(date, time)
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_appointments_phone_date
      ON appointments(phone, date)
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_appointments_ip_date
      ON appointments(ip, date)
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_appointments_device_date
      ON appointments(device_id, date)
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_appointments_status
      ON appointments(status)
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_blocked_times_date_time
      ON blocked_times(date, time)
    `);

    console.log("Banco de dados inicializado com sucesso.");
  } catch (error) {
    console.error("Erro ao inicializar banco de dados:", error.message);
    process.exit(1);
  }
}

initializeDatabase();

module.exports = db;