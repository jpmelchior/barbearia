
// backend/server.js

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const TIME_ZONE = "America/Sao_Paulo";

const OPENING_HOUR = Number(process.env.OPENING_HOUR || 8);
const CLOSING_HOUR = Number(process.env.CLOSING_HOUR || 20);
app.use(cors());
app.use(express.json());

const OPENING_HOUR = 8;
const CLOSING_HOUR = 20;

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

const ALLOWED_SERVICES = new Set([
  "Corte Masculino",
  "Barba",
  "Corte + Barba",
  "Degradê"
]);

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = allowedOrigins.length
  ? {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origem não permitida pelo CORS."));
      }
    }
  : {};

app.disable("x-powered-by");
app.use(cors(corsOptions));
app.use(express.json({ limit: "20kb" }));

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function safeCompare(value, expected) {
  const valueBuffer = Buffer.from(String(value || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
    return res.status(401).json({ error: "Acesso negado." });
  }

  try {
    const base64 = auth.slice(6);
    const credentials = Buffer.from(base64, "base64").toString("utf8");
    const separator = credentials.indexOf(":");
  const base64 = auth.split(" ")[1];
  const [user, password] = Buffer.from(base64, "base64").toString().split(":");

    if (separator === -1) {
      return res.status(401).json({ error: "Login inválido." });
    }

    const user = credentials.slice(0, separator);
    const password = credentials.slice(separator + 1);

    if (!safeCompare(user, ADMIN_USER) || !safeCompare(password, ADMIN_PASSWORD)) {
      return res.status(401).json({ error: "Login inválido." });
    }

    next();
  } catch (error) {
    res.status(401).json({ error: "Login inválido." });
  if (user !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Login inválido." });
  }
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
  next();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidDateString(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ""))) {
    return false;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
function getBrazilNow() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    })
  );
}

function isValidTimeString(timeString) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(timeString || ""));
}

function formatUTCDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateString(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function getDatePartsInBrazil(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function getTodayBrazilDate() {
  const parts = getDatePartsInBrazil();
  return `${parts.year}-${parts.month}-${parts.day}`;
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

function getBrazilHour() {
  return Number(getDatePartsInBrazil().hour);
}

function getBrazilNow() {
  const parts = getDatePartsInBrazil();

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  return Number(
    new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    })
  );
}

function isWeekday(dateString) {
  if (!isValidDateString(dateString)) {
    return false;
  }

  const date = parseDateString(dateString);
  const day = date.getUTCDay();

  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC"
  })
    .format(date)
    .replace(".", "");
}

function generateTimes(dateString) {
  }

  return times;
}

function validateBusinessDate(date) {
  if (!date) {
    return "Informe uma data.";
  }

  if (!isValidDateString(date)) {
    return "Informe uma data válida.";
  }

  if (date < getTodayBrazilDate()) {
    return "Não é possível usar datas anteriores.";
  }

  if (!isWeekday(date)) {
    return "Agendamentos apenas de segunda a sexta.";
  }

  return null;
}

function validateAppointmentPayload(body) {
  const appointment = {
    name: normalizeText(body.name, 80),
    phone: normalizeText(body.phone, 20),
    service: normalizeText(body.service, 40),
    date: normalizeText(body.date, 10),
    time: normalizeText(body.time, 5)
  };

  if (
    !appointment.name ||
    !appointment.phone ||
    !appointment.service ||
    !appointment.date ||
    !appointment.time
  ) {
    return { error: "Preencha todos os campos." };
  }

  if (appointment.name.length < 2) {
    return { error: "Informe um nome válido." };
  }

  const phoneDigits = onlyDigits(appointment.phone);

  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    return { error: "Informe um WhatsApp válido com DDD." };
  }

  if (!ALLOWED_SERVICES.has(appointment.service)) {
    return { error: "Serviço inválido." };
  }

  const dateError = validateBusinessDate(appointment.date);

  if (dateError) {
    return { error: dateError };
  }

  if (!isValidTimeString(appointment.time)) {
    return { error: "Informe um horário válido." };
  }

  const availableTimes = generateTimes(appointment.date);

  if (!availableTimes.includes(appointment.time)) {
    return { error: "Esse horário já passou ou não está disponível." };
  }

  return { appointment };
}

function validateBlockPayload(body) {
  const block = {
    date: normalizeText(body.date, 10),
    time: normalizeText(body.time, 5),
    reason: normalizeText(body.reason, 120)
  };

  const dateError = validateBusinessDate(block.date);

  if (dateError) {
    return { error: dateError };
  }

  if (block.time && !isValidTimeString(block.time)) {
    return { error: "Informe um horário válido." };
  }

  if (block.time && !generateTimes(block.date).includes(block.time)) {
    return { error: "Horário fora do funcionamento." };
  }

  if (!block.reason) {
    return { error: "Informe o motivo do bloqueio." };
  }

  return {
    block: {
      ...block,
      time: block.time || null
    }
  };
}

app.get("/", (req, res) => {
    message: "API da barbearia funcionando",
    todayBrazil: getTodayBrazilDate(),
    hourBrazil: getBrazilHour(),
    openingHours: {
      open: `${String(OPENING_HOUR).padStart(2, "0")}:00`,
      close: `${String(CLOSING_HOUR).padStart(2, "0")}:00`
    }
  });
});

  res.json({
    date: getTodayBrazilDate(),
    hour: getBrazilHour(),
    now: getBrazilNow()
    now: getBrazilNow(),
  });
});

  let index = 0;

  while (days.length < 30) {
    const date = parseDateString(today);
    date.setUTCDate(date.getUTCDate() + index);
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() + index);

    const dateString = formatUTCDate(date);
    const dateString = date.toISOString().split("T")[0];

    if (isWeekday(dateString)) {
      days.push({
        date: dateString,
        weekday: formatWeekday(date),
        day: String(date.getUTCDate()).padStart(2, "0"),
        month: String(date.getUTCMonth() + 1).padStart(2, "0")
        weekday: date.toLocaleDateString("pt-BR", { weekday: "short" }),
        day: String(date.getDate()).padStart(2, "0"),
        month: String(date.getMonth() + 1).padStart(2, "0"),
      });
    }

  res.json(days);
});

app.get("/api/times", async (req, res) => {
  const date = normalizeText(req.query.date, 10);
app.get("/api/times", (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Informe uma data." });
  }

  if (!isValidDateString(date)) {
    return res.status(400).json({ error: "Informe uma data válida." });
  }
  const today = getTodayBrazilDate();

  if (date < getTodayBrazilDate()) {
  if (date < today) {
    return res.json({
      date,
      times: [],
      message: "Não é possível agendar em datas anteriores."
      message: "Não é possível agendar em datas anteriores.",
    });
  }

    return res.json({
      date,
      times: [],
      message: "Agendamentos apenas de segunda a sexta."
      message: "Agendamentos apenas de segunda a sexta.",
    });
  }

  try {
    const allTimes = generateTimes(date);
    const appointments = await dbAll(
      "SELECT time FROM appointments WHERE date = ?",
      [date]
    );
    const blocks = await dbAll(
      "SELECT time, reason FROM blocked_times WHERE date = ?",
      [date]
    );

    const bookedTimes = appointments.map((item) => item.time);
    const blockedAllDay = blocks.find((item) => !item.time);
    const blockedTimes = blocks.filter((item) => item.time);
  const allTimes = generateTimes(date);

    const times = allTimes.map((time) => {
      const blocked = blockedTimes.find((item) => item.time === time);
      const booked = bookedTimes.includes(time);
  db.all("SELECT time FROM appointments WHERE date = ?", [date], (err, appointments) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao buscar agendamentos." });
    }

      if (blockedAllDay) {
        return {
          time,
          available: false,
          reason: blockedAllDay.reason || "Dia indisponível"
        };
    db.all("SELECT time, reason FROM blocked_times WHERE date = ?", [date], (err, blocks) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao buscar bloqueios." });
      }

      if (booked) {
      const bookedTimes = appointments.map((item) => item.time);
      const blockedAllDay = blocks.find((item) => !item.time);
      const blockedTimes = blocks.filter((item) => item.time);

      const times = allTimes.map((time) => {
        const blocked = blockedTimes.find((item) => item.time === time);
        const booked = bookedTimes.includes(time);

        if (blockedAllDay) {
          return {
            time,
            available: false,
            reason: blockedAllDay.reason || "Dia indisponível",
          };
        }

        if (booked) {
          return {
            time,
            available: false,
            reason: "Horário indisponível",
          };
        }

        if (blocked) {
          return {
            time,
            available: false,
            reason: blocked.reason || "Horário bloqueado",
          };
        }

        return {
          time,
          available: false,
          reason: "Horário indisponível"
          available: true,
          reason: null,
        };
      }
      });

      res.json({
        date,
        times,
      });
    });
  });
});

app.post("/api/appointments", (req, res) => {
  const { name, phone, service, date, time } = req.body;

      if (blocked) {
        return {
          time,
          available: false,
          reason: blocked.reason || "Horário bloqueado"
        };
      }
  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ error: "Preencha todos os campos." });
  }

  const today = getTodayBrazilDate();

      return {
        time,
        available: true,
        reason: null
      };
  if (date < today) {
    return res.status(400).json({
      error: "Não é possível agendar em datas anteriores.",
    });
  }

    res.json({
      date,
      times
  if (!isWeekday(date)) {
    return res.status(400).json({
      error: "Agendamentos apenas de segunda a sexta.",
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar horários." });
  }
});

app.post("/api/appointments", async (req, res) => {
  const { appointment, error } = validateAppointmentPayload(req.body);
  const availableTimes = generateTimes(date);

  if (error) {
    return res.status(400).json({ error });
  if (!availableTimes.includes(time)) {
    return res.status(400).json({
      error: "Esse horário já passou ou não está disponível.",
    });
  }

  try {
    const blocks = await dbAll(
      "SELECT time, reason FROM blocked_times WHERE date = ?",
      [appointment.date]
    );
  db.all("SELECT time, reason FROM blocked_times WHERE date = ?", [date], (err, blocks) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao verificar bloqueios." });
    }

    const blockedAllDay = blocks.find((item) => !item.time);
    const blockedTime = blocks.find((item) => item.time === appointment.time);
    const blockedTime = blocks.find((item) => item.time === time);

    if (blockedAllDay) {
      return res.status(400).json({
        error: blockedAllDay.reason || "Este dia está indisponível."
        error: blockedAllDay.reason || "Este dia está indisponível.",
      });
    }

    if (blockedTime) {
      return res.status(400).json({
        error: blockedTime.reason || "Este horário está indisponível."
        error: blockedTime.reason || "Este horário está indisponível.",
      });
    }

    const result = await dbRun(
    db.run(
      `
      INSERT INTO appointments
      (name, phone, service, date, time)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        appointment.name,
        appointment.phone,
        appointment.service,
        appointment.date,
        appointment.time
      ]
    );
      [name, phone, service, date, time],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(409).json({
              error: "Horário indisponível.",
            });
          }

          return res.status(500).json({
            error: "Erro ao criar agendamento.",
          });
        }

    res.status(201).json({
      message: "Agendamento realizado com sucesso!",
      appointment: {
        id: result.lastID,
        ...appointment
        res.status(201).json({
          message: "Agendamento realizado com sucesso!",
          appointment: {
            id: this.lastID,
            name,
            phone,
            service,
            date,
            time,
          },
        });
      }
    });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(409).json({
        error: "Horário indisponível."
      });
    }

    res.status(500).json({
      error: "Erro ao criar agendamento."
    });
  }
    );
  });
});

app.get("/api/admin/appointments", adminAuth, async (req, res) => {
  const date = normalizeText(req.query.date, 10);
app.get("/api/admin/appointments", adminAuth, (req, res) => {
  const { date } = req.query;

  if (date && !isValidDateString(date)) {
    return res.status(400).json({ error: "Informe uma data válida." });
  }
  if (date) {
    db.all(
      "SELECT * FROM appointments WHERE date = ? ORDER BY time ASC",
      [date],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: "Erro ao listar agendamentos." });
        }

  try {
    const sql = date
      ? "SELECT * FROM appointments WHERE date = ? ORDER BY time ASC"
      : "SELECT * FROM appointments ORDER BY date ASC, time ASC";
    const params = date ? [date] : [];
    const rows = await dbAll(
      sql,
      params
        return res.json(rows);
      }
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar agendamentos." });
    return;
  }
});

app.delete("/api/admin/appointments/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  db.all(
    "SELECT * FROM appointments ORDER BY date ASC, time ASC",
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao listar agendamentos." });
      }

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Agendamento inválido." });
  }

  try {
    const result = await dbRun("DELETE FROM appointments WHERE id = ?", [id]);
      res.json(rows);
    }
  );
});

    if (!result.changes) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
app.delete("/api/admin/appointments/:id", adminAuth, (req, res) => {
  db.run("DELETE FROM appointments WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: "Erro ao cancelar agendamento." });
    }

    res.json({ message: "Agendamento cancelado com sucesso." });
  } catch (error) {
    res.status(500).json({ error: "Erro ao cancelar agendamento." });
  }
  });
});

app.get("/api/admin/blocks", adminAuth, async (req, res) => {
  try {
    const rows = await dbAll(
      "SELECT * FROM blocked_times ORDER BY date ASC, time ASC"
    );
app.get("/api/admin/blocks", adminAuth, (req, res) => {
  db.all(
    "SELECT * FROM blocked_times ORDER BY date ASC, time ASC",
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao listar bloqueios." });
      }

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar bloqueios." });
  }
      res.json(rows);
    }
  );
});

app.post("/api/admin/blocks", adminAuth, async (req, res) => {
  const { block, error } = validateBlockPayload(req.body);
app.post("/api/admin/blocks", adminAuth, (req, res) => {
  const { date, time, reason } = req.body;

  if (error) {
    return res.status(400).json({ error });
  if (!date) {
    return res.status(400).json({ error: "Informe a data." });
  }

  try {
    const existingBlock = await dbGet(
      `
      SELECT id FROM blocked_times
      WHERE date = ?
      AND (
        (time IS NULL AND ? IS NULL)
        OR time = ?
      )
      LIMIT 1
      `,
      [block.date, block.time, block.time]
    );
  if (!reason) {
    return res.status(400).json({ error: "Informe o motivo do bloqueio." });
  }

    if (existingBlock) {
      return res.status(409).json({ error: "Esse bloqueio já existe." });
    }

    const result = await dbRun(
      "INSERT INTO blocked_times (date, time, reason) VALUES (?, ?, ?)",
      [block.date, block.time, block.reason]
    );

    res.status(201).json({
      message: "Bloqueio criado com sucesso.",
      block: {
        id: result.lastID,
        ...block
  db.run(
    "INSERT INTO blocked_times (date, time, reason) VALUES (?, ?, ?)",
    [date, time || null, reason],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Erro ao criar bloqueio." });
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar bloqueio." });
  }
});

app.delete("/api/admin/blocks/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Bloqueio inválido." });
  }

  try {
    const result = await dbRun("DELETE FROM blocked_times WHERE id = ?", [id]);
      res.status(201).json({
        message: "Bloqueio criado com sucesso.",
        block: {
          id: this.lastID,
          date,
          time: time || null,
          reason,
        },
      });
    }
  );
});

    if (!result.changes) {
      return res.status(404).json({ error: "Bloqueio não encontrado." });
app.delete("/api/admin/blocks/:id", adminAuth, (req, res) => {
  db.run("DELETE FROM blocked_times WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: "Erro ao remover bloqueio." });
    }

    res.json({ message: "Bloqueio removido com sucesso." });
  } catch (error) {
    res.status(500).json({ error: "Erro ao remover bloqueio." });
  }
  });
});

app.post("/api/admin/login", adminAuth, (req, res) => {
  res.json({ message: "Login realizado com sucesso." });
});

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

app.use((err, req, res, next) => {
  if (err && err.message === "Origem não permitida pelo CORS.") {
    return res.status(403).json({ error: err.message });
  }

  res.status(500).json({ error: "Erro interno do servidor." });
});

const server = app.listen(PORT, () => {
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

function shutdown() {
  server.close(() => {
    db.close(() => {
      process.exit(0);
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
