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

function getBrazilNow() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    })
  );
}

function getTodayBrazilDate() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

function getBrazilHour() {
  return Number(
    new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    })
  );
}

function isWeekday(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  return day >= 1 && day <= 5;
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

app.get("/", (req, res) => {
  res.json({
    message: "API da barbearia funcionando",
    todayBrazil: getTodayBrazilDate(),
    hourBrazil: getBrazilHour(),
  });
});

app.get("/api/today", (req, res) => {
  res.json({
    date: getTodayBrazilDate(),
    hour: getBrazilHour(),
    now: getBrazilNow(),
  });
});

app.get("/api/days", (req, res) => {
  const today = getTodayBrazilDate();
  const days = [];

  let index = 0;

  while (days.length < 30) {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() + index);

    const dateString = date.toISOString().split("T")[0];

    if (isWeekday(dateString)) {
      days.push({
        date: dateString,
        weekday: date.toLocaleDateString("pt-BR", { weekday: "short" }),
        day: String(date.getDate()).padStart(2, "0"),
        month: String(date.getMonth() + 1).padStart(2, "0"),
      });
    }

    index++;
  }

  res.json(days);
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
      times: [],
      message: "Não é possível agendar em datas anteriores.",
    });
  }

  if (!isWeekday(date)) {
    return res.json({
      date,
      times: [],
      message: "Agendamentos apenas de segunda a sexta.",
    });
  }

  const allTimes = generateTimes(date);

  db.all("SELECT time FROM appointments WHERE date = ?", [date], (err, appointments) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao buscar agendamentos." });
    }

    db.all("SELECT time, reason FROM blocked_times WHERE date = ?", [date], (err, blocks) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao buscar bloqueios." });
      }

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
          available: true,
          reason: null,
        };
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

  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ error: "Preencha todos os campos." });
  }

  const today = getTodayBrazilDate();

  if (date < today) {
    return res.status(400).json({
      error: "Não é possível agendar em datas anteriores.",
    });
  }

  if (!isWeekday(date)) {
    return res.status(400).json({
      error: "Agendamentos apenas de segunda a sexta.",
    });
  }

  const availableTimes = generateTimes(date);

  if (!availableTimes.includes(time)) {
    return res.status(400).json({
      error: "Esse horário já passou ou não está disponível.",
    });
  }

  db.all("SELECT time, reason FROM blocked_times WHERE date = ?", [date], (err, blocks) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao verificar bloqueios." });
    }

    const blockedAllDay = blocks.find((item) => !item.time);
    const blockedTime = blocks.find((item) => item.time === time);

    if (blockedAllDay) {
      return res.status(400).json({
        error: blockedAllDay.reason || "Este dia está indisponível.",
      });
    }

    if (blockedTime) {
      return res.status(400).json({
        error: blockedTime.reason || "Este horário está indisponível.",
      });
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
            id: this.lastID,
            name,
            phone,
            service,
            date,
            time,
          },
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
  db.run("DELETE FROM appointments WHERE id = ?", [req.params.id], function (err) {
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

  if (!reason) {
    return res.status(400).json({ error: "Informe o motivo do bloqueio." });
  }

  db.run(
    "INSERT INTO blocked_times (date, time, reason) VALUES (?, ?, ?)",
    [date, time || null, reason],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Erro ao criar bloqueio." });
      }

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

app.delete("/api/admin/blocks/:id", adminAuth, (req, res) => {
  db.run("DELETE FROM blocked_times WHERE id = ?", [req.params.id], function (err) {
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
