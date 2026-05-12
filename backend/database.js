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

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
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

async function migrateAppointmentsTableIfNeeded() {
  const table = await get(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'appointments'"
  );

  const tableSql = String(table?.sql || "").toLowerCase();

  const hasOldUniqueConstraint =
    tableSql.includes("unique(date, time)") ||
    tableSql.includes("unique (date, time)");

  if (!hasOldUniqueConstraint) {
    return;
  }

  console.log("Migrando appointments para remover UNIQUE(date, time)...");

  await run("PRAGMA foreign_keys = OFF");
  await run("BEGIN TRANSACTION");

  try {
    await run(`
      CREATE TABLE appointments_new (
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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      INSERT INTO appointments_new
      (
        id,
        name,
        phone,
        service,
        date,
        time,
        status,
        ip,
        device_id,
        user_agent,
        created_at,
        updated_at
      )
      SELECT
        id,
        name,
        phone,
        service,
        date,
        time,
        COALESCE(status, 'scheduled'),
        ip,
        device_id,
        user_agent,
        created_at,
        COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
      FROM appointments
    `);

    await run("DROP TABLE appointments");
    await run("ALTER TABLE appointments_new RENAME TO appointments");
    await run("COMMIT");

    console.log("Migração de appointments concluída.");
  } catch (error) {
    await run("ROLLBACK");
    console.error("Erro na migração de appointments:", error.message);
    process.exit(1);
  } finally {
    await run("PRAGMA foreign_keys = ON");
  }
}

async function seedDefaultServices() {
  const total = await get("SELECT COUNT(*) AS total FROM services");

  if (total && total.total > 0) {
    return;
  }

  const defaultServices = [
    ["Corte Masculino", 35],
    ["Barba", 25],
    ["Barba + Corte", 50]
  ];

  for (const [name, price] of defaultServices) {
    await run(
      `
      INSERT INTO services (name, price, active)
      VALUES (?, ?, 1)
      `,
      [name, price]
    );
  }

  console.log("Serviços padrão cadastrados.");
}



async function seedDefaultBusinessHours() {
  const total = await get("SELECT COUNT(*) AS total FROM business_hours");

  if (total && total.total > 0) {
    return;
  }

  const defaultHours = [
    [0, "Domingo", 0, "08:00", "20:00"],
    [1, "Segunda-feira", 1, "08:00", "20:00"],
    [2, "Terça-feira", 1, "08:00", "20:00"],
    [3, "Quarta-feira", 1, "08:00", "20:00"],
    [4, "Quinta-feira", 1, "08:00", "20:00"],
    [5, "Sexta-feira", 1, "08:00", "20:00"],
    [6, "Sábado", 0, "08:00", "20:00"]
  ];

  for (const [weekday, label, isOpen, openTime, closeTime] of defaultHours) {
    await run(
      `
      INSERT INTO business_hours (weekday, label, is_open, open_time, close_time)
      VALUES (?, ?, ?, ?, ?)
      `,
      [weekday, label, isOpen, openTime, closeTime]
    );
  }

  console.log("Horários de funcionamento padrão cadastrados.");
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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    await run(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        price REAL NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);


    await run(`
      CREATE TABLE IF NOT EXISTS business_hours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weekday INTEGER NOT NULL UNIQUE,
        label TEXT NOT NULL,
        is_open INTEGER NOT NULL DEFAULT 0,
        open_time TEXT NOT NULL DEFAULT '08:00',
        close_time TEXT NOT NULL DEFAULT '20:00',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    await addColumnIfNotExists(
      "services",
      "price",
      "REAL NOT NULL DEFAULT 0"
    );

    await addColumnIfNotExists(
      "services",
      "active",
      "INTEGER NOT NULL DEFAULT 1"
    );

    await addColumnIfNotExists(
      "services",
      "updated_at",
      "DATETIME DEFAULT CURRENT_TIMESTAMP"
    );


    await addColumnIfNotExists(
      "business_hours",
      "is_open",
      "INTEGER NOT NULL DEFAULT 0"
    );

    await addColumnIfNotExists(
      "business_hours",
      "open_time",
      "TEXT NOT NULL DEFAULT '08:00'"
    );

    await addColumnIfNotExists(
      "business_hours",
      "close_time",
      "TEXT NOT NULL DEFAULT '20:00'"
    );

    await addColumnIfNotExists(
      "business_hours",
      "updated_at",
      "DATETIME DEFAULT CURRENT_TIMESTAMP"
    );

    await migrateAppointmentsTableIfNeeded();
    await seedDefaultServices();
    await seedDefaultBusinessHours();

    await run(`
      CREATE INDEX IF NOT EXISTS idx_appointments_date_time
      ON appointments(date, time)
    `);

    await run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_scheduled_slot
      ON appointments(date, time)
      WHERE status = 'scheduled'
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

    await run(`
      CREATE INDEX IF NOT EXISTS idx_services_active
      ON services(active)
    `);


    await run(`
      CREATE INDEX IF NOT EXISTS idx_business_hours_weekday
      ON business_hours(weekday)
    `);

    console.log("Banco de dados inicializado com sucesso.");
  } catch (error) {
    console.error("Erro ao inicializar banco de dados:", error.message);
    process.exit(1);
  }
}

db.ready = initializeDatabase();

module.exports = db;
