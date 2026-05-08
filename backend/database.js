// backend/database.js

const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, "barbearia.db");
const db = new sqlite3.Database(databasePath, (err) => {
  if (err) {
    console.error("Erro ao abrir o banco de dados:", err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");

  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, time)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_appointments_date_time
    ON appointments(date, time)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_blocked_times_date_time
    ON blocked_times(date, time)
  `);
});

module.exports = db;
