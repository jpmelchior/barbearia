

const appointmentsCount = document.getElementById("appointmentsCount");
const blocksCount = document.getElementById("blocksCount");
const appointmentsDayLabel = document.getElementById("appointmentsDayLabel");
const appointmentsDateLabel = document.getElementById("appointmentsDateLabel");
const prevAppointmentsDay = document.getElementById("prevAppointmentsDay");
const nextAppointmentsDay = document.getElementById("nextAppointmentsDay");

const blockForm = document.getElementById("blockForm");

let selectedAppointmentsDate = getInitialAppointmentsDate();

function getAuth() {
  const user = sessionStorage.getItem("admin_user");
  const password = sessionStorage.getItem("admin_password");
  container.appendChild(paragraph);
}

function getTodayBrazilDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateString(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isBusinessDay(dateString) {
  const day = parseDateString(dateString).getUTCDay();
  return day !== 0 && day !== 6;
}

function getInitialAppointmentsDate() {
  const today = getTodayBrazilDate();

  if (isBusinessDay(today)) {
    return today;
  }

  return addBusinessDays(today, 1);
}

function addBusinessDays(dateString, amount) {
  const date = parseDateString(dateString);
  const direction = amount >= 0 ? 1 : -1;
  let remaining = Math.abs(amount);

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);

    const day = date.getUTCDay();

    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }

  return formatDateString(date);
}

function updateAppointmentsDayHeader() {
  const date = parseDateString(selectedAppointmentsDate);
  const today = getTodayBrazilDate();
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC"
  }).format(date).replace(".", "");

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  appointmentsDayLabel.textContent = selectedAppointmentsDate === today ? "Hoje" : weekday;
  appointmentsDateLabel.textContent = `${day}/${month}`;
}

function handleUnauthorized(response) {
  if (response.status !== 401 && response.status !== 403) {
    return false;
  return paragraph;
}

function createWhatsAppLink(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const link = document.createElement("a");

  link.className = "appointment-phone";
  link.textContent = phone || "Sem WhatsApp";

  if (digits.length >= 10) {
    link.href = `https://wa.me/55${digits}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  return link;
}

async function login() {
  const user = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPassword").value.trim();
}

async function loadAppointments() {
  updateAppointmentsDayHeader();
  setListMessage(appointmentsList, "Carregando...");

  try {
    const response = await fetch(`${API_URL}/admin/appointments`, {
    const params = new URLSearchParams({ date: selectedAppointmentsDate });
    const response = await fetch(`${API_URL}/admin/appointments?${params.toString()}`, {
      headers: {
        Authorization: getAuth()
      }
    }

    const parsedData = await response.json();
    const data = Array.isArray(parsedData) ? parsedData : [];
    const rows = Array.isArray(parsedData) ? parsedData : [];
    const data = rows.filter((appointment) => appointment.date === selectedAppointmentsDate);

    appointmentsList.innerHTML = "";
    appointmentsCount.textContent = data.length;

    if (!data.length) {
      setListMessage(appointmentsList, "Nenhum agendamento encontrado.");
      setListMessage(appointmentsList, "Nenhum horário marcado neste dia.");
      return;
    }

    data.forEach((appointment) => {
      const item = document.createElement("article");
      item.className = "admin-card";
      item.className = "admin-card appointment-card";

      const top = document.createElement("div");
      top.className = "admin-card-top";
      const main = document.createElement("div");
      main.className = "appointment-main";

      const service = document.createElement("strong");
      service.textContent = appointment.service || "Serviço";
      const time = document.createElement("strong");
      time.className = "appointment-time";
      time.textContent = appointment.time || "--:--";

      const summary = document.createElement("div");
      summary.className = "appointment-summary";

      const date = document.createElement("span");
      date.textContent = appointment.date || "-";
      const client = document.createElement("span");
      client.className = "appointment-client";
      client.textContent = appointment.name || "Cliente";

      const content = document.createElement("div");
      content.className = "admin-card-content";
      content.appendChild(createInfoLine("Cliente", appointment.name));
      content.appendChild(createInfoLine("WhatsApp", appointment.phone));
      content.appendChild(createInfoLine("Horário", appointment.time));
      const service = document.createElement("span");
      service.className = "appointment-service";
      service.textContent = appointment.service || "Serviço";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "danger-btn";
      button.textContent = "Cancelar horário";
      button.className = "danger-btn compact-danger";
      button.textContent = "Cancelar";

      button.addEventListener("click", async () => {
        if (!confirm("Cancelar esse agendamento?")) return;
        }
      });

      top.appendChild(service);
      top.appendChild(date);
      summary.appendChild(client);
      summary.appendChild(service);
      summary.appendChild(createWhatsAppLink(appointment.phone));

      main.appendChild(time);
      main.appendChild(summary);

      item.appendChild(top);
      item.appendChild(content);
      item.appendChild(main);
      item.appendChild(button);

      appointmentsList.appendChild(item);
  showLogin();
});

prevAppointmentsDay.addEventListener("click", () => {
  selectedAppointmentsDate = addBusinessDays(selectedAppointmentsDate, -1);
  loadAppointments();
});

nextAppointmentsDay.addEventListener("click", () => {
  selectedAppointmentsDate = addBusinessDays(selectedAppointmentsDate, 1);
  loadAppointments();
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login();
