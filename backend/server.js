// backend/server.js

require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const db = require("./database");

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const TIME_ZONE = "America/Sao_Paulo";

const OPENING_HOUR = Number(process.env.OPENING_HOUR || 8);
const CLOSING_HOUR = Number(process.env.CLOSING_HOUR || 20);

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const MAX_APPOINTMENTS_PER_IP_PER_DAY = Number(
  process.env.MAX_APPOINTMENTS_PER_IP_PER_DAY || 3
);

if (!ADMIN_USER || !ADMIN_PASSWORD) {
  console.error("ERRO: ADMIN_USER e ADMIN_PASSWORD são obrigatórios.");
  console.error("Configure essas variáveis no Render ou no arquivo backend/.env local.");
  process.exit(1);
}

if (ADMIN_USER === "admin" || ADMIN_PASSWORD === "123456") {
  console.error("ERRO: não use ADMIN_USER=admin nem ADMIN_PASSWORD=123456.");
  console.error("Defina credenciais fortes nas variáveis de ambiente.");
  process.exit(1);
}

if (!Number.isInteger(OPENING_HOUR) || !Number.isInteger(CLOSING_HOUR)) {
  console.error("ERRO: OPENING_HOUR e CLOSING_HOUR devem ser números inteiros.");
  process.exit(1);
}

if (OPENING_HOUR < 0 || OPENING_HOUR > 23 || CLOSING_HOUR < 1 || CLOSING_HOUR > 24) {
  console.error("ERRO: horário de funcionamento inválido.");
  process.exit(1);
}

if (OPENING_HOUR >= CLOSING_HOUR) {
  console.error("ERRO: OPENING_HOUR precisa ser menor que CLOSING_HOUR.");
  process.exit(1);
}

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

if (NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.error("ERRO: FRONTEND_ORIGIN é obrigatório em produção.");
  console.error("Exemplo: FRONTEND_ORIGIN=https://barbearia-sigma-henna.vercel.app");
  process.exit(1);
}

const corsOptions = allowedOrigins.length
  ? {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error("Origem não permitida pelo CORS."));
      },
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false
    }
  : {};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas requisições. Tente novamente em alguns minutos."
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas de login. Tente novamente em alguns minutos."
  }
});

const appointmentLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Limite de tentativas de agendamento atingido. Tente novamente amanhã."
  }
});

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "20kb" }));
app.use(generalLimiter);

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

  if (!auth || !auth.startsWith("Basic ")) {
    return res.status(401).json({ error: "Acesso negado." });
  }

  try {
    const base64 = auth.slice(6);
    const credentials = Buffer.from(base64, "base64").toString("utf8");
    const separator = credentials.indexOf(":");

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
    return res.status(401).json({ error: "Login inválido." });
  }
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeDeviceId(value) {
  const clean = normalizeText(value, 120);

  if (!clean) {
    return "";
  }

  if (!/^[a-zA-Z0-9._:-]{10,120}$/.test(clean)) {
    return "";
  }

  return clean;
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim().slice(0, 80);
  }

  return String(req.ip || req.socket?.remoteAddress || "")
    .replace("::ffff:", "")
    .slice(0, 80);
}

function getUserAgent(req) {
  return normalizeText(req.headers["user-agent"], 255);
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
}

function getBrazilHour() {
  return Number(getDatePartsInBrazil().hour);
}

function getBrazilNow() {
  const parts = getDatePartsInBrazil();

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function isWeekday(dateString) {
  if (!isValidDateString(dateString)) {
    return false;
  }

  const date = parseDateString(dateString);
  const day = date.getUTCDay();

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
  const today = getTodayBrazilDate();
  const currentHour = getBrazilHour();

  let startHour = OPENING_HOUR;

  if (dateString === today) {
    startHour = Math.max(OPENING_HOUR, currentHour + 1);
  }

  const times = [];

  for (let hour = startHour; hour < CLOSING_HOUR; hour++) {
    times.push(`${String(hour).padStart(2, "0")}:00`);
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
    time: normalizeText(body.time, 5),
    device_id: normalizeDeviceId(body.device_id || body.deviceId)
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

  if (appointment.name.length < 3) {
    return { error: "Informe um nome válido." };
  }

  if (!/^[A-Za-zÀ-ÿ\s'.-]{3,80}$/.test(appointment.name)) {
    return { error: "O nome deve conter apenas letras e espaços." };
  }

  const phoneDigits = onlyDigits(appointment.phone);

  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    return { error: "Informe um WhatsApp válido com DDD." };
  }

  appointment.phone = phoneDigits;

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

async function validateAntiAbuseRules(appointment, metadata) {
  const samePhone = await dbGet(
    `
    SELECT id FROM appointments
    WHERE phone = ?
    AND date = ?
    AND status = 'scheduled'
    LIMIT 1
    `,
    [appointment.phone, appointment.date]
  );

  if (samePhone) {
    return {
      error: "Este WhatsApp já possui um agendamento nesse dia."
    };
  }

  if (appointment.device_id) {
    const sameDevice = await dbGet(
      `
      SELECT id FROM appointments
      WHERE device_id = ?
      AND date = ?
      AND status = 'scheduled'
      LIMIT 1
      `,
      [appointment.device_id, appointment.date]
    );

    if (sameDevice) {
      return {
        error: "Este aparelho já possui um agendamento nesse dia."
      };
    }
  }

  if (metadata.ip) {
    const ipUsage = await dbGet(
      `
      SELECT COUNT(*) AS total FROM appointments
      WHERE ip = ?
      AND date = ?
      AND status = 'scheduled'
      `,
      [metadata.ip, appointment.date]
    );

    if (ipUsage && ipUsage.total >= MAX_APPOINTMENTS_PER_IP_PER_DAY) {
      return {
        error: "Muitos agendamentos foram feitos por essa conexão hoje. Tente novamente amanhã."
      };
    }
  }

  return null;
}

app.get("/", (req, res) => {
  res.json({
    message: "API da barbearia funcionando",
    environment: NODE_ENV,
    todayBrazil: getTodayBrazilDate(),
    hourBrazil: getBrazilHour(),
    openingHours: {
      open: `${String(OPENING_HOUR).padStart(2, "0")}:00`,
      close: `${String(CLOSING_HOUR).padStart(2, "0")}:00`
    }
  });
});

app.get("/api/today", (req, res) => {
  res.json({
    date: getTodayBrazilDate(),
    hour: getBrazilHour(),
    now: getBrazilNow()
  });
});

app.get("/api/days", (req, res) => {
  const today = getTodayBrazilDate();
  const days = [];

  let index = 0;

  while (days.length < 30) {
    const date = parseDateString(today);
    date.setUTCDate(date.getUTCDate() + index);

    const dateString = formatUTCDate(date);

    if (isWeekday(dateString)) {
      days.push({
        date: dateString,
        weekday: formatWeekday(date),
        day: String(date.getUTCDate()).padStart(2, "0"),
        month: String(date.getUTCMonth() + 1).padStart(2, "0")
      });
    }

    index++;
  }

  res.json(days);
});

app.get("/api/times", async (req, res) => {
  const date = normalizeText(req.query.date, 10);

  if (!date) {
    return res.status(400).json({ error: "Informe uma data." });
  }

  if (!isValidDateString(date)) {
    return res.status(400).json({ error: "Informe uma data válida." });
  }

  if (date < getTodayBrazilDate()) {
    return res.json({
      date,
      times: [],
      message: "Não é possível agendar em datas anteriores."
    });
  }

  if (!isWeekday(date)) {
    return res.json({
      date,
      times: [],
      message: "Agendamentos apenas de segunda a sexta."
    });
  }

  try {
    const allTimes = generateTimes(date);

    const appointments = await dbAll(
      `
      SELECT time FROM appointments
      WHERE date = ?
      AND status = 'scheduled'
      `,
      [date]
    );

    const blocks = await dbAll(
      "SELECT time, reason FROM blocked_times WHERE date = ?",
      [date]
    );

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
          reason: blockedAllDay.reason || "Dia indisponível"
        };
      }

      if (booked) {
        return {
          time,
          available: false,
          reason: "Horário indisponível"
        };
      }

      if (blocked) {
        return {
          time,
          available: false,
          reason: blocked.reason || "Horário bloqueado"
        };
      }

      return {
        time,
        available: true,
        reason: null
      };
    });

    res.json({
      date,
      times
    });
  } catch (error) {
    console.error("Erro em GET /api/times:", error);
    res.status(500).json({ error: "Erro ao buscar horários." });
  }
});

app.post("/api/appointments", appointmentLimiter, async (req, res) => {
  const { appointment, error } = validateAppointmentPayload(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  const metadata = {
    ip: getClientIp(req),
    user_agent: getUserAgent(req)
  };

  try {
    const blocks = await dbAll(
      "SELECT time, reason FROM blocked_times WHERE date = ?",
      [appointment.date]
    );

    const blockedAllDay = blocks.find((item) => !item.time);
    const blockedTime = blocks.find((item) => item.time === appointment.time);

    if (blockedAllDay) {
      return res.status(400).json({
        error: blockedAllDay.reason || "Este dia está indisponível."
      });
    }

    if (blockedTime) {
      return res.status(400).json({
        error: blockedTime.reason || "Este horário está indisponível."
      });
    }

    const antiAbuseError = await validateAntiAbuseRules(appointment, metadata);

    if (antiAbuseError) {
      return res.status(429).json(antiAbuseError);
    }

    const result = await dbRun(
      `
      INSERT INTO appointments
      (name, phone, service, date, time, status, ip, device_id, user_agent)
      VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
      `,
      [
        appointment.name,
        appointment.phone,
        appointment.service,
        appointment.date,
        appointment.time,
        metadata.ip,
        appointment.device_id || null,
        metadata.user_agent
      ]
    );

    res.status(201).json({
      message: "Agendamento realizado com sucesso!",
      appointment: {
        id: result.lastID,
        ...appointment,
        status: "scheduled"
      }
    });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(409).json({
        error: "Horário indisponível."
      });
    }

    console.error("Erro em POST /api/appointments:", error);

    res.status(500).json({
      error: "Erro ao criar agendamento."
    });
  }
});

app.get("/api/admin/appointments", adminAuth, async (req, res) => {
  try {
    const rows = await dbAll(
      "SELECT * FROM appointments ORDER BY date ASC, time ASC"
    );

    res.json(rows);
  } catch (error) {
    console.error("Erro em GET /api/admin/appointments:", error);
    res.status(500).json({ error: "Erro ao listar agendamentos." });
  }
});

app.delete("/api/admin/appointments/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Agendamento inválido." });
  }

  try {
    const result = await dbRun(
      `
      UPDATE appointments
      SET status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [id]
    );

    if (!result.changes) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    res.json({ message: "Agendamento cancelado com sucesso." });
  } catch (error) {
    console.error("Erro em DELETE /api/admin/appointments/:id:", error);
    res.status(500).json({ error: "Erro ao cancelar agendamento." });
  }
});

app.get("/api/admin/blocks", adminAuth, async (req, res) => {
  try {
    const rows = await dbAll(
      "SELECT * FROM blocked_times ORDER BY date ASC, time ASC"
    );

    res.json(rows);
  } catch (error) {
    console.error("Erro em GET /api/admin/blocks:", error);
    res.status(500).json({ error: "Erro ao listar bloqueios." });
  }
});

app.post("/api/admin/blocks", adminAuth, async (req, res) => {
  const { block, error } = validateBlockPayload(req.body);

  if (error) {
    return res.status(400).json({ error });
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
      }
    });
  } catch (error) {
    console.error("Erro em POST /api/admin/blocks:", error);
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

    if (!result.changes) {
      return res.status(404).json({ error: "Bloqueio não encontrado." });
    }

    res.json({ message: "Bloqueio removido com sucesso." });
  } catch (error) {
    console.error("Erro em DELETE /api/admin/blocks/:id:", error);
    res.status(500).json({ error: "Erro ao remover bloqueio." });
  }
});

app.post("/api/admin/login", loginLimiter, adminAuth, (req, res) => {
  res.json({ message: "Login realizado com sucesso." });
});

app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

app.use((err, req, res, next) => {
  if (err && err.message === "Origem não permitida pelo CORS.") {
    return res.status(403).json({ error: err.message });
  }

  console.error("Erro interno:", err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

const server = app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${NODE_ENV}`);
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