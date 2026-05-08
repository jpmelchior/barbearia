const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const OPENING_HOUR = 8;
const CLOSING_HOUR = 20;

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Basic ")) {
    return res.status(401).json({ error: "Acesso negado." });
  }

  const base64 = auth.split(" ")[1];
  const [user, password] = Buffer.from(base64, "base64").toString().split(":");

  if (user !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Login inválido." });
  }

  next();
}

function getTodayBrazilDate() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo"
  });
}

function getBrazilHour() {
  return Number(
    new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false
    })
  );
}

function isWeekday(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function generateTimes(dateString) {
  const times = [];
  const today = getTodayBrazilDate();
  const currentHour = getBrazilHour();

  let startHour = OPENING_HOUR;

  if (dateString === today) {
    startHour = Math.max(OPENING_HOUR, currentHour + 1);
  }

  for (let hour = startHour; hour < CLOSING_HOUR; hour++) {
    times.push(`${String(hour).padStart(2, "0")}:00`);
  }

  return times;
}

app.get("/", (req, res) => {
  res.json({ message: "API da barbearia funcionando" });
});

app.get("/api/times", (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Informe uma data." });
  }

  const today = getTodayBrazilDate();

  if (date < today) {
    return res.json({
      date,
      available: [],
      message: "Não é possível agendar em datas anteriores."
    });
  }

  if (!isWeekday(date)) {
    return res.json({
      date,
      available: [],
      message: "Agendamentos apenas de segunda a sexta."
    });
  }

  const allTimes = generateTimes(date);

  db.all("SELECT time FROM appointments WHERE date = ?", [date], (err, appointments) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao buscar horários." });
    }

    db.all("SELECT time FROM blocked_times WHERE date = ?", [date], (err, blocks) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao buscar bloqueios." });
      }

      const bookedTimes = appointments.map((row) => row.time);
      const blockedAllDay = blocks.some((row) => row.time === null || row.time === "");
      const blockedTimes = blocks.filter((row) => row.time).map((row) => row.time);

      const unavailable = [...bookedTimes, ...blockedTimes];

      const available = blockedAllDay
        ? []
        : allTimes.filter((time) => !unavailable.includes(time));

      res.json({
        date,
        available,
        booked: bookedTimes,
        blocked: blockedTimes,
        blockedAllDay
      });
    });
  });
});

app.post("/api/appointments", (req, res) => {
  const { name, phone, service, date, time } = req.body;

  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ error: "Preencha todos os campos." });
  }

  const today = getTodayBrazilDate();

  if (date < today) {
    return res.status(400).json({ error: "Não é possível agendar em datas anteriores." });
  }

  if (!isWeekday(date)) {
    return res.status(400).json({ error: "Agendamentos apenas de segunda a sexta." });
  }

  const availableTimes = generateTimes(date);

  if (!availableTimes.includes(time)) {
    return res.status(400).json({ error: "Esse horário não está mais disponível." });
  }

  db.all("SELECT time FROM blocked_times WHERE date = ?", [date], (err, blocks) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao verificar bloqueios." });
    }

    const blockedAllDay = blocks.some((row) => row.time === null || row.time === "");
    const blockedTimes = blocks.filter((row) => row.time).map((row) => row.time);

    if (blockedAllDay || blockedTimes.includes(time)) {
      return res.status(400).json({ error: "Esse horário está bloqueado pelo barbeiro." });
    }

    db.run(
      `
      INSERT INTO appointments
      (name, phone, service, date, time)
      VALUES (?, ?, ?, ?, ?)
      `,
      [name, phone, service, date, time],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "Esse horário já foi agendado." });
          }

          return res.status(500).json({ error: "Erro ao criar agendamento." });
        }

        res.status(201).json({
          message: "Agendamento realizado com sucesso!",
          appointment: {
            id: this.lastID,
            name,
            phone,
            service,
            date,
            time
          }
        });
      }
    );
  });
});

app.get("/api/admin/appointments", adminAuth, (req, res) => {
  db.all(
    "SELECT * FROM appointments ORDER BY date ASC, time ASC",
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao listar agendamentos." });
      }

      res.json(rows);
    }
  );
});

app.delete("/api/admin/appointments/:id", adminAuth, (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM appointments WHERE id = ?", [id], function (err) {
    if (err) {
      return res.status(500).json({ error: "Erro ao cancelar agendamento." });
    }

    res.json({ message: "Agendamento cancelado com sucesso." });
  });
});

app.get("/api/admin/blocks", adminAuth, (req, res) => {
  db.all(
    "SELECT * FROM blocked_times ORDER BY date ASC, time ASC",
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao listar bloqueios." });
      }

      res.json(rows);
    }
  );
});

app.post("/api/admin/blocks", adminAuth, (req, res) => {
  const { date, time, reason } = req.body;

  if (!date) {
    return res.status(400).json({ error: "Informe a data." });
  }

  db.run(
    "INSERT INTO blocked_times (date, time, reason) VALUES (?, ?, ?)",
    [date, time || null, reason || "Indisponível"],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Erro ao bloquear horário." });
      }

      res.status(201).json({
        message: "Bloqueio criado com sucesso.",
        block: {
          id: this.lastID,
          date,
          time: time || null,
          reason: reason || "Indisponível"
        }
      });
    }
  );
});

app.delete("/api/admin/blocks/:id", adminAuth, (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM blocked_times WHERE id = ?", [id], function (err) {
    if (err) {
      return res.status(500).json({ error: "Erro ao remover bloqueio." });
    }

    res.json({ message: "Bloqueio removido com sucesso." });
  });
});

app.post("/api/admin/login", adminAuth, (req, res) => {
  res.json({ message: "Login realizado com sucesso." });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
