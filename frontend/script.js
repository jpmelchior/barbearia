// frontend/script.js

const API_URL = window.API_URL || "https://barbearia-ygxt.onrender.com/api";

const DEVICE_ID_KEY = "barbearia_device_id";

const form = document.getElementById("appointmentForm");
const daysContainer = document.getElementById("daysContainer");
const timesContainer = document.getElementById("timesContainer");
const message = document.getElementById("message");
const submitButton = form.querySelector(".submit-btn");

const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const serviceInput = document.getElementById("service");
const serviceOptions = document.getElementById("serviceOptions");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");

let currentPage = 0;
const DAYS_PER_PAGE = 15;

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: "America/Sao_Paulo"
});

function generateDeviceId() {
  const cryptoApi = window.crypto || window.msCrypto;

  if (cryptoApi && cryptoApi.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi && cryptoApi.getRandomValues) {
    const array = new Uint8Array(16);
    cryptoApi.getRandomValues(array);

    return Array.from(array)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatWeekday(date) {
  return weekdayFormatter.format(date).replace(".", "");
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = type;
}

async function loadServices() {
  serviceInput.value = "";

  if (!serviceOptions) {
    setMessage("Erro interno: área de serviços não encontrada.", "error");
    return;
  }

  serviceOptions.innerHTML = '<p class="service-loading">Carregando serviços...</p>';

  try {
    const response = await fetch(`${API_URL}/services`);

    if (!response.ok) {
      throw new Error("Erro ao buscar serviços.");
    }

    const services = await response.json();

    serviceOptions.innerHTML = "";

    if (!Array.isArray(services) || !services.length) {
      serviceOptions.innerHTML = '<p class="service-loading">Nenhum serviço disponível</p>';
      return;
    }

    services.forEach((service) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "service-option";
      button.dataset.service = service.name;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");
      button.setAttribute("aria-pressed", "false");
      button.setAttribute(
        "aria-label",
        `Selecionar ${service.name}, ${service.price_label || "R$ 0,00"}`
      );

      button.innerHTML = `
        <span class="service-option-name">${service.name}</span>
        <strong class="service-option-price">${service.price_label || "R$ 0,00"}</strong>
      `;

      button.addEventListener("click", () => {
        document.querySelectorAll(".service-option").forEach((item) => {
          item.classList.remove("active");
          item.setAttribute("aria-selected", "false");
          item.setAttribute("aria-pressed", "false");
        });

        button.classList.add("active");
        button.setAttribute("aria-selected", "true");
        button.setAttribute("aria-pressed", "true");

        serviceInput.value = service.name;
        setMessage("");
      });

      serviceOptions.appendChild(button);
    });
  } catch (error) {
    console.error("Erro ao carregar serviços:", error);

    serviceInput.value = "";
    serviceOptions.innerHTML = '<p class="service-loading error">Erro ao carregar serviços</p>';
    setMessage("Erro ao carregar serviços. Recarregue a página.", "error");
  }
}

function setEmptyTimes(text) {
  timesContainer.innerHTML = "";

  const emptyText = document.createElement("p");

  emptyText.className = "empty-text";
  emptyText.textContent = text;

  timesContainer.appendChild(emptyText);
}

function createPaginationControls() {
  const oldControls = document.querySelector(".pagination-controls");

  if (oldControls) {
    oldControls.remove();
  }

  const controls = document.createElement("div");

  controls.className = "pagination-controls reveal show";

  const prevButton = document.createElement("button");

  prevButton.type = "button";
  prevButton.className = "pagination-btn";
  prevButton.textContent = "← Dias anteriores";

  const nextButton = document.createElement("button");

  nextButton.type = "button";
  nextButton.className = "pagination-btn";
  nextButton.textContent = "Próximos dias →";

  if (currentPage === 0) {
    prevButton.disabled = true;
    prevButton.classList.add("disabled");
  }

  prevButton.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage--;
      generateDays();
      resetSelectedTime();
      daysContainer.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  nextButton.addEventListener("click", () => {
    currentPage++;
    generateDays();
    resetSelectedTime();
    daysContainer.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  controls.appendChild(prevButton);
  controls.appendChild(nextButton);

  daysContainer.after(controls);
}

function resetSelectedTime() {
  dateInput.value = "";
  timeInput.value = "";
  setEmptyTimes("Escolha um dia primeiro.");
}

function createDayButton(dayInfo) {
  const dateString = dayInfo.date;
  const weekday = dayInfo.weekday;
  const day = dayInfo.day;
  const month = dayInfo.month;

  const button = document.createElement("button");

  button.type = "button";
  button.className = "day-btn";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", `Selecionar ${weekday}, ${day}/${month}`);

  const weekdayText = document.createElement("span");
  weekdayText.textContent = weekday;

  const dateText = document.createElement("strong");
  dateText.textContent = `${day}/${month}`;

  const hoursText = document.createElement("small");
  hoursText.textContent = `${dayInfo.open_time || "08:00"} às ${dayInfo.close_time || "20:00"}`;

  button.appendChild(weekdayText);
  button.appendChild(dateText);
  button.appendChild(hoursText);

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
}

async function generateDays() {
  daysContainer.innerHTML = "";

  const oldControls = document.querySelector(".pagination-controls");

  if (oldControls) {
    oldControls.remove();
  }

  const loadingText = document.createElement("p");
  loadingText.className = "empty-text";
  loadingText.textContent = "Carregando dias disponíveis...";
  daysContainer.appendChild(loadingText);

  try {
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(DAYS_PER_PAGE)
    });

    const response = await fetch(`${API_URL}/days?${params.toString()}`);

    if (!response.ok) {
      throw new Error("Erro ao buscar dias disponíveis.");
    }

    const days = await response.json();

    daysContainer.innerHTML = "";

    if (!Array.isArray(days) || !days.length) {
      const emptyText = document.createElement("p");
      emptyText.className = "empty-text";
      emptyText.textContent = "Nenhum dia disponível no momento.";
      daysContainer.appendChild(emptyText);
      return;
    }

    days.forEach((dayInfo, index) => {
      const dayButton = createDayButton(dayInfo);
      dayButton.style.animationDelay = `${index * 35}ms`;
      daysContainer.appendChild(dayButton);
    });

    createPaginationControls();
  } catch (error) {
    console.error("Erro ao carregar dias disponíveis:", error);

    daysContainer.innerHTML = "";

    const errorText = document.createElement("p");
    errorText.className = "empty-text";
    errorText.textContent = "Erro ao carregar dias disponíveis. Tente novamente.";
    daysContainer.appendChild(errorText);
  }
}

function createTimeButton(time, available, reason) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "time-btn";
  button.setAttribute("aria-pressed", "false");

  const timeText = document.createElement("strong");
  timeText.textContent = time || "--:--";

  const statusText = document.createElement("span");
  statusText.textContent = available ? "Disponível" : reason;

  button.appendChild(timeText);
  button.appendChild(statusText);

  if (!available) {
    button.disabled = true;
    button.classList.add("disabled");
    return button;
  }

  button.addEventListener("click", () => {
    document.querySelectorAll(".time-btn").forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });

    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");

    timeInput.value = time;
  });

  return button;
}

async function loadTimes(date) {
  setEmptyTimes("Carregando horários...");
  timesContainer.setAttribute("aria-busy", "true");
  setMessage("");

  try {
    const params = new URLSearchParams({ date });
    const response = await fetch(`${API_URL}/times?${params.toString()}`);

    if (!response.ok) {
      throw new Error("Erro ao buscar horários.");
    }

    const data = await response.json();

    timesContainer.innerHTML = "";

    const rawTimes = data.times || data.available || [];
    const times = Array.isArray(rawTimes) ? rawTimes : [];

    if (!times.length) {
      setEmptyTimes("Nenhum horário disponível para este dia.");
      return;
    }

    times.forEach((item, index) => {
      let time = item;
      let available = true;
      let reason = "Horário indisponível";

      if (typeof item === "object" && item !== null) {
        time = item.time;
        available = item.available !== false;
        reason = item.reason || reason;
      }

      const button = createTimeButton(time, Boolean(time) && available, reason);

      button.style.animationDelay = `${index * 30}ms`;

      timesContainer.appendChild(button);
    });
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
    setEmptyTimes("Erro ao carregar horários. Tente novamente.");
  } finally {
    timesContainer.removeAttribute("aria-busy");
  }
}

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
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
    date: dateInput.value,
    time: timeInput.value,
    device_id: getDeviceId()
  };

  const phoneDigits = onlyDigits(appointment.phone);

  if (
    !appointment.name ||
    !appointment.phone ||
    !appointment.service ||
    !appointment.date ||
    !appointment.time
  ) {
    setMessage("Preencha todos os campos e escolha dia e horário.", "error");
    return;
  }

  if (phoneDigits.length < 10) {
    setMessage("Informe um WhatsApp válido com DDD.", "error");
    phoneInput.focus();
    return;
  }

  setMessage("Confirmando agendamento...");
  submitButton.disabled = true;

  try {
    const response = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(appointment)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error || "Erro ao agendar. Tente novamente.", "error");
      return;
    }

    setMessage("Agendamento confirmado com sucesso! A Barbearia Prime agradece.", "success");

    form.reset();

    serviceInput.value = "";
    document.querySelectorAll(".service-option").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
      item.setAttribute("aria-pressed", "false");
    });

    dateInput.value = "";
    timeInput.value = "";

    document.querySelectorAll(".day-btn").forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });

    setEmptyTimes("Escolha um dia primeiro.");

    await loadServices();
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    setMessage("Erro ao conectar ao servidor.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

/* Animações de entrada */

function setupRevealAnimations() {
  const elements = document.querySelectorAll(
    ".section-text, .info-card, .services > .tag, .services > h2, .service-card, .booking-left, .booking-form, .service-option, .footer"
  );

  elements.forEach((element) => {
    element.classList.add("reveal");
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.14
    }
  );

  elements.forEach((element) => {
    observer.observe(element);
  });
}

async function initializePage() {
  getDeviceId();
  setupRevealAnimations();
  await loadServices();
  await generateDays();
}

initializePage();