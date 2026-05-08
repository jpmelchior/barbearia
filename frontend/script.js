
// frontend/script.js

const API_URL = "https://barbearia-ygxt.onrender.com/api";

const form = document.getElementById("appointmentForm");
const daysContainer = document.getElementById("daysContainer");
const timesContainer = document.getElementById("timesContainer");
const message = document.getElementById("message");
const submitButton = form.querySelector(".submit-btn");

const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const serviceInput = document.getElementById("service");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");

let currentPage = 0;
const DAYS_PER_PAGE = 15;

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: "America/Sao_Paulo"
});

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
  return date.toISOString().split("T")[0];
}

function formatWeekday(date) {
  return weekdayFormatter.format(date).replace(".", "");
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = type;
}

function setEmptyTimes(text) {
  timesContainer.innerHTML = "";

  const emptyText = document.createElement("p");
  emptyText.className = "empty-text";
  emptyText.textContent = text;

  timesContainer.appendChild(emptyText);
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    timeZone: "America/Sao_Paulo"
  });
}

function createPaginationControls() {
function resetSelectedTime() {
  dateInput.value = "";
  timeInput.value = "";
  setEmptyTimes("Escolha um dia primeiro.");
}

function createDayButton(date) {
  const dateString = formatISODate(date);
  const weekday = formatWeekday(date);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "day-btn";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", `Selecionar ${weekday}, ${day}/${month}`);

  const weekdayText = document.createElement("span");
  weekdayText.textContent = weekday;

  const dateText = document.createElement("strong");
  dateText.textContent = `${day}/${month}`;

  button.appendChild(weekdayText);
  button.appendChild(dateText);

  button.addEventListener("click", () => {
    document.querySelectorAll(".day-btn").forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });

    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");

    dateInput.value = dateString;
    timeInput.value = "";

    loadTimes(dateString);
  });

  return button;
  timesContainer.innerHTML = `
    <p class="empty-text">Escolha um dia primeiro.</p>
  `;
}

function generateDays() {
  }

  const today = new Date();
  const startBusinessDay = currentPage * DAYS_PER_PAGE;
  const startIndex = currentPage * DAYS_PER_PAGE;

  let added = 0;
  let skipped = 0;
  let index = 0;
  let index = startIndex;

  while (added < DAYS_PER_PAGE) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const dayOfWeek = date.getDay();
    const isBusinessDay = dayOfWeek !== 0 && dayOfWeek !== 6;

    if (isBusinessDay) {
      if (skipped < startBusinessDay) {
        skipped++;
      } else {
        daysContainer.appendChild(createDayButton(date));
        added++;
      }
    }
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dateString = formatISODate(date);

    index++;
  }
      const weekday = formatWeekday(date).replace(".", "");
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");

  createPaginationControls();
}
      const button = document.createElement("button");
      button.type = "button";
      button.className = "day-btn";

function createTimeButton(time, available, reason) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "time-btn";
  button.setAttribute("aria-pressed", "false");
      button.innerHTML = `
        <span>${weekday}</span>
        <strong>${day}/${month}</strong>
      `;

  const timeText = document.createElement("strong");
  timeText.textContent = time || "--:--";
      button.addEventListener("click", () => {
        document.querySelectorAll(".day-btn").forEach((btn) => {
          btn.classList.remove("active");
        });

        button.classList.add("active");

  const statusText = document.createElement("span");
  statusText.textContent = available ? "Disponível" : reason;
        dateInput.value = dateString;
        timeInput.value = "";

  button.appendChild(timeText);
  button.appendChild(statusText);
        loadTimes(dateString);
      });

  if (!available) {
    button.disabled = true;
    button.classList.add("disabled");
    return button;
  }
      daysContainer.appendChild(button);

  button.addEventListener("click", () => {
    document.querySelectorAll(".time-btn").forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });
      added++;
    }

    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    timeInput.value = time;
  });
    index++;
  }

  return button;
  createPaginationControls();
}

async function loadTimes(date) {
  setEmptyTimes("Carregando horários...");
  timesContainer.setAttribute("aria-busy", "true");
  setMessage("");

  try {
    const params = new URLSearchParams({ date });
    const response = await fetch(`${API_URL}/times?${params.toString()}`);
  timesContainer.innerHTML = `
    <p class="empty-text">Carregando horários...</p>
  `;

    if (!response.ok) {
      throw new Error("Erro ao buscar horários.");
    }
  message.textContent = "";

  try {
    const response = await fetch(`${API_URL}/times?date=${date}`);
    const data = await response.json();

    timesContainer.innerHTML = "";

    const rawTimes = data.times || data.available || [];
    const times = Array.isArray(rawTimes) ? rawTimes : [];
    const times = data.times || data.available || [];

    if (!times.length) {
      setEmptyTimes("Nenhum horário disponível para este dia.");
      timesContainer.innerHTML = `
        <p class="empty-text">Nenhum horário disponível para este dia.</p>
      `;
      return;
    }

      let available = true;
      let reason = "Horário indisponível";

      if (typeof item === "object" && item !== null) {
      if (typeof item === "object") {
        time = item.time;
        available = item.available !== false;
        reason = item.reason || reason;
        available = item.available;
        reason = item.reason || "Horário indisponível";
      }

      timesContainer.appendChild(createTimeButton(time, Boolean(time) && available, reason));
    });
  } catch (error) {
    setEmptyTimes("Erro ao carregar horários. Tente novamente.");
  } finally {
    timesContainer.removeAttribute("aria-busy");
  }
}
      const button = document.createElement("button");
      button.type = "button";
      button.className = "time-btn";

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}
      if (available) {
        button.innerHTML = `
          <strong>${time}</strong>
          <span>Disponível</span>
        `;
      } else {
        button.innerHTML = `
          <strong>${time}</strong>
          <span>${reason}</span>
        `;

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
        button.disabled = true;
        button.classList.add("disabled");
      }

  if (digits.length <= 2) {
    return digits;
  }
      button.addEventListener("click", () => {
        if (!available) return;

        document.querySelectorAll(".time-btn").forEach((btn) => {
          btn.classList.remove("active");
        });

        button.classList.add("active");
        timeInput.value = time;
      });

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      timesContainer.appendChild(button);
    });
  } catch (error) {
    timesContainer.innerHTML = `
      <p class="empty-text">Erro ao carregar horários.</p>
    `;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const appointment = {
    name: nameInput.value.trim(),
    phone: phoneInput.value.trim(),
    service: serviceInput.value,
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    service: document.getElementById("service").value,
    date: dateInput.value,
    time: timeInput.value
  };

  const phoneDigits = onlyDigits(appointment.phone);

  if (
    !appointment.name ||
    !appointment.phone ||
    !appointment.date ||
    !appointment.time
  ) {
    setMessage("Preencha todos os campos e escolha dia e horário.", "error");
    return;
  }

  if (phoneDigits.length < 10) {
    setMessage("Informe um WhatsApp válido com DDD.", "error");
    phoneInput.focus();
    message.textContent = "Preencha todos os campos e escolha dia e horário.";
    return;
  }

  setMessage("Confirmando agendamento...");
  submitButton.disabled = true;
  message.textContent = "Confirmando agendamento...";

  try {
    const response = await fetch(`${API_URL}/appointments`, {
      body: JSON.stringify(appointment)
    });

    const data = await response.json().catch(() => ({}));
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Erro ao agendar. Tente novamente.", "error");
      message.textContent = data.error || "Erro ao agendar.";
      return;
    }

    setMessage("Agendamento realizado com sucesso!", "success");
    message.textContent = "Agendamento realizado com sucesso!";

    form.reset();


    document.querySelectorAll(".day-btn").forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });

    setEmptyTimes("Escolha um dia primeiro.");
    timesContainer.innerHTML = `
      <p class="empty-text">Escolha um dia primeiro.</p>
    `;
  } catch (error) {
    setMessage("Erro ao conectar ao servidor.", "error");
  } finally {
    submitButton.disabled = false;
    message.textContent = "Erro ao conectar ao servidor.";
  }
});
