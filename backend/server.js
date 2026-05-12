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

if (
  OPENING_HOUR < 0 ||
  OPENING_HOUR > 23 ||
  CLOSING_HOUR < 1 ||
  CLOSING_HOUR > 24
) {
  console.error("ERRO: horário de funcionamento inválido.");
  process.exit(1);
}

if (OPENING_HOUR >= CLOSING_HOUR) {
  console.error("ERRO: OPENING_HOUR precisa ser menor que CLOSING_HOUR.");
  process.exit(1);
}


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
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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

function normalizePrice(value) {
  const number = Number(
    String(value || "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
  );

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return Math.round(number * 100) / 100;
}

function formatServicePrice(price) {
  return Number(price || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

async function getActiveServiceByName(name) {
  return dbGet(
    `
    SELECT id, name, price, active
    FROM services
    WHERE name = ?
    AND active = 1
    LIMIT 1
    `,
    [name]
  );
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

function getWeekdayFromDateString(dateString) {
  if (!isValidDateString(dateString)) {
    return null;
  }

  return parseDateString(dateString).getUTCDay();
}

function isWeekday(dateString) {
  const weekday = getWeekdayFromDateString(dateString);
  return weekday !== null && weekday >= 1 && weekday <= 5;
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC"
  })
    .format(date)
    .replace(".", "");
}

function normalizeTimeSlot(value) {
  const time = normalizeText(value, 5);

  if (!isValidTimeString(time)) {
    return null;
  }

  const [, minute] = time.split(":").map(Number);

  if (minute !== 0) {
    return null;
  }

  return time;
}

function timeToHour(timeString) {
  return Number(String(timeString || "00:00").split(":")[0]);
}

async function getBusinessHoursByWeekday(weekday) {
  return dbGet(
    `
    SELECT weekday, label, is_open, open_time, close_time
    FROM business_hours
    WHERE weekday = ?
    LIMIT 1
    `,
    [weekday]
  );
}

async function getBusinessHoursForDate(dateString) {
  const weekday = getWeekdayFromDateString(dateString);

  if (weekday === null) {
    return null;
  }

  return getBusinessHoursByWeekday(weekday);
}

async function isOpenBusinessDate(dateString) {
  const hours = await getBusinessHoursForDate(dateString);

  return Boolean(hours && Number(hours.is_open) === 1);
}

async function generateTimes(dateString) {
  const hours = await getBusinessHoursForDate(dateString);

  if (!hours || Number(hours.is_open) !== 1) {
    return [];
  }

  const today = getTodayBrazilDate();
  const currentHour = getBrazilHour();

  const openHour = timeToHour(hours.open_time);
  const closeHour = timeToHour(hours.close_time);

  let startHour = openHour;

  if (dateString === today) {
    startHour = Math.max(openHour, currentHour + 1);
  }

  const times = [];

  for (let hour = startHour; hour < closeHour; hour++) {
    times.push(`${String(hour).padStart(2, "0")}:00`);
  }

  return times;
}

async function validateBusinessDate(date) {
  if (!date) {
    return "Informe uma data.";
  }

  if (!isValidDateString(date)) {
    return "Informe uma data válida.";
  }

  if (date < getTodayBrazilDate()) {
    return "Não é possível usar datas anteriores.";
  }

  const hours = await getBusinessHoursForDate(date);

  if (!hours || Number(hours.is_open) !== 1) {
    return "A barbearia está fechada nessa data.";
  }

  return null;
}

async function getDatesBetween(startDateString, endDateString) {
  const dates = [];
  const startDate = parseDateString(startDateString);
  const endDate = parseDateString(endDateString);

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateString = formatUTCDate(currentDate);

    if (await isOpenBusinessDate(dateString)) {
      dates.push(dateString);
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return dates;
}

async function isBusinessTimeSlot(dateString, timeString) {
  const time = normalizeTimeSlot(timeString);

  if (!time) {
    return false;
  }

  const hours = await getBusinessHoursForDate(dateString);

  if (!hours || Number(hours.is_open) !== 1) {
    return false;
  }

  const hour = timeToHour(time);
  const openHour = timeToHour(hours.open_time);
  const closeHour = timeToHour(hours.close_time);

  return hour >= openHour && hour < closeHour;
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


  if (!isValidTimeString(appointment.time)) {
    return { error: "Informe um horário válido." };
  }

  return { appointment };
}

async function validateBlockPayload(body) {
  const startDate = normalizeText(body.startDate || body.date, 10);
  const endDate = normalizeText(body.endDate || body.startDate || body.date, 10);

  const block = {
    startDate,
    endDate,
    time: normalizeText(body.time, 5),
    reason: normalizeText(body.reason, 120)
  };

  const startDateError = await validateBusinessDate(block.startDate);

  if (startDateError) {
    return { error: startDateError };
  }

  if (!isValidDateString(block.endDate)) {
    return { error: "Informe uma data final válida." };
  }

  if (block.endDate < block.startDate) {
    return { error: "A data final não pode ser menor que a data inicial." };
  }

  const dates = await getDatesBetween(block.startDate, block.endDate);

  if (!dates.length) {
    return { error: "Nenhum dia aberto encontrado nesse intervalo." };
  }

  if (dates.length > 90) {
    return { error: "O intervalo não pode passar de 90 dias abertos." };
  }

  if (block.time) {
    const invalidTimeDate = [];

    for (const date of dates) {
      if (!(await isBusinessTimeSlot(date, block.time))) {
        invalidTimeDate.push(date);
      }
    }

    if (invalidTimeDate.length) {
      return {
        error: "Informe um horário cheio dentro do funcionamento dos dias selecionados."
      };
    }
  }

  if (!block.reason) {
    return { error: "Informe o motivo do bloqueio." };
  }

  return {
    block: {
      ...block,
      dates,
      time: block.time || null
    }
  };
}

async function validateBusinessHoursPayload(body) {
  const weekday = Number(body.weekday);
  const isOpen =
    body.is_open === true ||
    body.is_open === 1 ||
    body.is_open === "1" ||
    body.isOpen === true ||
    body.isOpen === 1 ||
    body.isOpen === "1"
      ? 1
      : 0;

  const openTime = normalizeTimeSlot(body.open_time || body.openTime || "08:00");
  const closeTime = normalizeTimeSlot(body.close_time || body.closeTime || "20:00");

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { error: "Dia da semana inválido." };
  }

  if (!openTime || !closeTime) {
    return { error: "Informe horários cheios e válidos, como 08:00 e 20:00." };
  }

  if (timeToHour(openTime) >= timeToHour(closeTime)) {
    return { error: "O horário de abertura precisa ser menor que o de fechamento." };
  }

  return {
    businessHour: {
      weekday,
      is_open: isOpen,
      open_time: openTime,
      close_time: closeTime
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

app.get("/api/services", async (req, res) => {
  try {
    const services = await dbAll(
      `
      SELECT id, name, price, active
      FROM services
      WHERE active = 1
      ORDER BY name ASC
      `
    );

    res.json(
      services.map((service) => ({
        ...service,
        price_label: formatServicePrice(service.price)
      }))
    );
  } catch (error) {
    console.error("Erro em GET /api/services:", error);
    res.status(500).json({ error: "Erro ao listar serviços." });
  }
});

app.get("/api/admin/services", adminAuth, async (req, res) => {
  try {
    const services = await dbAll(
      `
      SELECT id, name, price, active, created_at, updated_at
      FROM services
      ORDER BY active DESC, name ASC
      `
    );

    res.json(
      services.map((service) => ({
        ...service,
        price_label: formatServicePrice(service.price)
      }))
    );
  } catch (error) {
    console.error("Erro em GET /api/admin/services:", error);
    res.status(500).json({ error: "Erro ao listar serviços." });
  }
});

app.post("/api/admin/services", adminAuth, async (req, res) => {
  const name = normalizeText(req.body.name, 80);
  const price = normalizePrice(req.body.price);

  if (!name || name.length < 2) {
    return res.status(400).json({ error: "Informe o nome do serviço." });
  }

  if (price === null) {
    return res.status(400).json({ error: "Informe um preço válido." });
  }

  try {
    const result = await dbRun(
      `
      INSERT INTO services (name, price, active)
      VALUES (?, ?, 1)
      `,
      [name, price]
    );

    res.status(201).json({
      message: "Serviço criado com sucesso.",
      service: {
        id: result.lastID,
        name,
        price,
        active: 1,
        price_label: formatServicePrice(price)
      }
    });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(409).json({
        error: "Já existe um serviço com esse nome."
      });
    }

    console.error("Erro em POST /api/admin/services:", error);
    res.status(500).json({ error: "Erro ao criar serviço." });
  }
});

app.patch("/api/admin/services/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  const name = normalizeText(req.body.name, 80);
  const price = normalizePrice(req.body.price);
  const active =
    req.body.active === true ||
    req.body.active === 1 ||
    req.body.active === "1"
      ? 1
      : 0;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Serviço inválido." });
  }

  if (!name || name.length < 2) {
    return res.status(400).json({ error: "Informe o nome do serviço." });
  }

  if (price === null) {
    return res.status(400).json({ error: "Informe um preço válido." });
  }

  try {
    const result = await dbRun(
      `
      UPDATE services
      SET name = ?,
          price = ?,
          active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [name, price, active, id]
    );

    if (!result.changes) {
      return res.status(404).json({ error: "Serviço não encontrado." });
    }

    res.json({
      message: "Serviço atualizado com sucesso."
    });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(409).json({
        error: "Já existe um serviço com esse nome."
      });
    }

    console.error("Erro em PATCH /api/admin/services/:id:", error);
    res.status(500).json({ error: "Erro ao atualizar serviço." });
  }
});

app.delete("/api/admin/services/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Serviço inválido." });
  }

  try {
    const result = await dbRun(
      `
      UPDATE services
      SET active = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [id]
    );

    if (!result.changes) {
      return res.status(404).json({ error: "Serviço não encontrado." });
    }

    res.json({ message: "Serviço desativado com sucesso." });
  } catch (error) {
    console.error("Erro em DELETE /api/admin/services/:id:", error);
    res.status(500).json({ error: "Erro ao desativar serviço." });
  }
});



app.get("/api/business-hours", async (req, res) => {
  try {
    const rows = await dbAll(
      `
      SELECT weekday, label, is_open, open_time, close_time
      FROM business_hours
      ORDER BY weekday ASC
      `
    );

    res.json(rows);
  } catch (error) {
    console.error("Erro em GET /api/business-hours:", error);
    res.status(500).json({ error: "Erro ao listar funcionamento." });
  }
});

app.get("/api/admin/business-hours", adminAuth, async (req, res) => {
  try {
    const rows = await dbAll(
      `
      SELECT id, weekday, label, is_open, open_time, close_time, created_at, updated_at
      FROM business_hours
      ORDER BY weekday ASC
      `
    );

    res.json(rows);
  } catch (error) {
    console.error("Erro em GET /api/admin/business-hours:", error);
    res.status(500).json({ error: "Erro ao listar funcionamento." });
  }
});

app.patch("/api/admin/business-hours/:weekday", adminAuth, async (req, res) => {
  const payload = {
    ...req.body,
    weekday: req.params.weekday
  };

  const { businessHour, error } = await validateBusinessHoursPayload(payload);

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const result = await dbRun(
      `
      UPDATE business_hours
      SET is_open = ?,
          open_time = ?,
          close_time = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE weekday = ?
      `,
      [
        businessHour.is_open,
        businessHour.open_time,
        businessHour.close_time,
        businessHour.weekday
      ]
    );

    if (!result.changes) {
      return res.status(404).json({ error: "Dia de funcionamento não encontrado." });
    }

    res.json({ message: "Funcionamento atualizado com sucesso." });
  } catch (error) {
    console.error("Erro em PATCH /api/admin/business-hours/:weekday:", error);
    res.status(500).json({ error: "Erro ao atualizar funcionamento." });
  }
});

app.put("/api/admin/business-hours", adminAuth, async (req, res) => {
  const items = Array.isArray(req.body.hours) ? req.body.hours : [];

  if (!items.length) {
    return res.status(400).json({ error: "Envie os horários da semana." });
  }

  try {
    for (const item of items) {
      const { businessHour, error } = await validateBusinessHoursPayload(item);

      if (error) {
        return res.status(400).json({ error });
      }

      await dbRun(
        `
        UPDATE business_hours
        SET is_open = ?,
            open_time = ?,
            close_time = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE weekday = ?
        `,
        [
          businessHour.is_open,
          businessHour.open_time,
          businessHour.close_time,
          businessHour.weekday
        ]
      );
    }

    res.json({ message: "Funcionamento semanal atualizado com sucesso." });
  } catch (error) {
    console.error("Erro em PUT /api/admin/business-hours:", error);
    res.status(500).json({ error: "Erro ao atualizar funcionamento." });
  }
});

app.get("/api/today", (req, res) => {
  res.json({
    date: getTodayBrazilDate(),
    hour: getBrazilHour(),
    now: getBrazilNow()
  });
});

app.get("/api/days", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 60);
  const page = Math.max(Number(req.query.page || 0), 0);
  const today = getTodayBrazilDate();
  const days = [];

  let index = 0;
  let skippedOpenDays = 0;
  const skip = page * limit;

  try {
    while (days.length < limit && index < 730) {
      const date = parseDateString(today);
      date.setUTCDate(date.getUTCDate() + index);

      const dateString = formatUTCDate(date);
      const hours = await getBusinessHoursForDate(dateString);
      const isOpen = hours && Number(hours.is_open) === 1;

      if (isOpen) {
        if (skippedOpenDays < skip) {
          skippedOpenDays++;
        } else {
          days.push({
            date: dateString,
            weekday: formatWeekday(date),
            weekday_index: getWeekdayFromDateString(dateString),
            day: String(date.getUTCDate()).padStart(2, "0"),
            month: String(date.getUTCMonth() + 1).padStart(2, "0"),
            open_time: hours.open_time,
            close_time: hours.close_time
          });
        }
      }

      index++;
    }

    res.json(days);
  } catch (error) {
    console.error("Erro em GET /api/days:", error);
    res.status(500).json({ error: "Erro ao listar dias disponíveis." });
  }
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

  try {
    const hours = await getBusinessHoursForDate(date);

    if (!hours || Number(hours.is_open) !== 1) {
      return res.json({
        date,
        times: [],
        message: "A barbearia está fechada nessa data."
      });
    }

    const allTimes = await generateTimes(date);

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
      business_hours: {
        open_time: hours.open_time,
        close_time: hours.close_time
      },
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
    const selectedService = await getActiveServiceByName(appointment.service);

    if (!selectedService) {
      return res.status(400).json({
        error: "Serviço inválido ou indisponível."
      });
    }

    const dateError = await validateBusinessDate(appointment.date);

    if (dateError) {
      return res.status(400).json({ error: dateError });
    }

    const availableTimes = await generateTimes(appointment.date);

    if (!availableTimes.includes(appointment.time)) {
      return res.status(400).json({
        error: "Esse horário já passou ou não está disponível."
      });
    }

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
      `
      SELECT * FROM appointments
      WHERE status IS NULL OR status != 'hidden'
      ORDER BY date ASC, time ASC
      `
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

app.patch("/api/admin/appointments/:id/status", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
  const status = normalizeText(req.body.status, 20);

  const allowedStatuses = new Set([
    "scheduled",
    "completed",
    "cancelled",
    "no_show",
    "hidden"
  ]);

  const statusMessages = {
    scheduled: "Agendamento restaurado com sucesso.",
    completed: "Agendamento marcado como atendido.",
    cancelled: "Agendamento cancelado com sucesso.",
    no_show: "Agendamento marcado como falta.",
    hidden: "Registro removido do histórico."
  };

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Agendamento inválido." });
  }

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }

  try {
    const appointment = await dbGet(
      "SELECT id, date, time FROM appointments WHERE id = ?",
      [id]
    );

    if (!appointment) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    if (status === "scheduled") {
      const conflict = await dbGet(
        `
        SELECT id FROM appointments
        WHERE date = ?
        AND time = ?
        AND status = 'scheduled'
        AND id != ?
        LIMIT 1
        `,
        [appointment.date, appointment.time, id]
      );

      if (conflict) {
        return res.status(409).json({
          error: "Não foi possível restaurar. Esse horário já está ocupado."
        });
      }
    }

    const result = await dbRun(
      `
      UPDATE appointments
      SET status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [status, id]
    );

    if (!result.changes) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    res.json({
      message: statusMessages[status] || "Status atualizado com sucesso."
    });
  } catch (error) {
    console.error("Erro em PATCH /api/admin/appointments/:id/status:", error);
    res.status(500).json({ error: "Erro ao atualizar status do agendamento." });
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
  const { block, error } = await validateBlockPayload(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    let created = 0;
    let skipped = 0;

    for (const date of block.dates) {
      const existingBlock = await dbGet(
        block.time
          ? `
            SELECT id FROM blocked_times
            WHERE date = ?
            AND (time IS NULL OR time = ?)
            LIMIT 1
            `
          : `
            SELECT id FROM blocked_times
            WHERE date = ?
            AND time IS NULL
            LIMIT 1
            `,
        block.time ? [date, block.time] : [date]
      );

      if (existingBlock) {
        skipped++;
        continue;
      }

      await dbRun(
        "INSERT INTO blocked_times (date, time, reason) VALUES (?, ?, ?)",
        [date, block.time, block.reason]
      );

      created++;
    }

    if (!created && skipped) {
      return res.status(409).json({
        error: "Todos os bloqueios desse intervalo já existem."
      });
    }

    res.status(201).json({
      message:
        created === 1
          ? "Bloqueio criado com sucesso."
          : `${created} bloqueios criados com sucesso.${skipped ? ` ${skipped} já existiam.` : ""}`,
      block: {
        startDate: block.startDate,
        endDate: block.endDate,
        time: block.time,
        reason: block.reason,
        created,
        skipped
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

let server;

db.ready
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Ambiente: ${NODE_ENV}`);
    });
  })
  .catch((error) => {
    console.error("Erro ao preparar servidor:", error.message);
    process.exit(1);
  });

function shutdown() {
  if (!server) {
    db.close(() => {
      process.exit(0);
    });

    return;
  }

  server.close(() => {
    db.close(() => {
      process.exit(0);
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);