
// frontend/admin.js

const API_URL = "https://barbearia-ygxt.onrender.com/api";

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const loginMessage = document.getElementById("loginMessage");

const appointmentsCount = document.getElementById("appointmentsCount");
const blocksCount = document.getElementById("blocksCount");

const appointmentsDayLabel = document.getElementById("appointmentsDayLabel");
const appointmentsDateLabel = document.getElementById("appointmentsDateLabel");
const prevAppointmentsDay = document.getElementById("prevAppointmentsDay");
let selectedAppointmentsDate = getInitialAppointmentsDate();

function getAuth() {
  const user = sessionStorage.getItem("admin_user");
  const password = sessionStorage.getItem("admin_password");
  const user = localStorage.getItem("admin_user");
  const password = localStorage.getItem("admin_password");

  if (!user || !password) return null;

  return "Basic " + btoa(`${user}:${password}`);
}

function clearAuth() {
  sessionStorage.removeItem("admin_user");
  sessionStorage.removeItem("admin_password");
  localStorage.removeItem("admin_user");
  localStorage.removeItem("admin_password");
}

function showDashboard() {
  loginSection.style.display = "none";
  dashboardSection.style.display = "block";
  logoutBtn.style.display = "inline-flex";
}

function showLogin() {
  loginSection.style.display = "block";
  dashboardSection.style.display = "none";
  logoutBtn.style.display = "none";
}

function setLoginMessage(text, type = "") {
  loginMessage.textContent = text;
  loginMessage.className = type;
}

function setListMessage(container, text) {
  container.innerHTML = "";

  const paragraph = document.createElement("p");
  paragraph.className = "empty-text";
  paragraph.textContent = text;

  container.appendChild(paragraph);
  container.innerHTML = `
    <p class="empty-text">
      ${text}
    </p>
  `;
}

function getTodayBrazilDate() {
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
  return formatDateString(date);
}

function getInitialAppointmentsDate() {
  const today = getTodayBrazilDate();

  if (isBusinessDay(today)) {
    return today;
  }

  return addBusinessDays(today, 1);
}

function updateAppointmentsDayHeader() {
  const date = parseDateString(selectedAppointmentsDate);
  const today = getTodayBrazilDate();

  appointmentsDayLabel.textContent = selectedAppointmentsDate === today ? "Hoje" : weekday;
  appointmentsDateLabel.textContent = `${day}/${month}`;
}

function handleUnauthorized(response) {
  if (response.status !== 401 && response.status !== 403) {
    return false;
  }

  clearAuth();
  showLogin();
  setLoginMessage("Sessão expirada. Entre novamente.", "error");
  return true;
}

function createInfoLine(label, value) {
  const paragraph = document.createElement("p");
  const strong = document.createElement("b");

  strong.textContent = `${label}: `;
  paragraph.appendChild(strong);
  paragraph.append(document.createTextNode(value || "-"));

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

  if (!user || !password) {
    setLoginMessage("Preencha usuário e senha.", "error");
    loginMessage.textContent = "Preencha usuário e senha.";
    return;
  }

  const auth = "Basic " + btoa(`${user}:${password}`);
  const loginButton = loginForm.querySelector(".submit-btn");

  setLoginMessage("Entrando...");
  loginButton.disabled = true;

  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      }
    });

    const data = await response.json().catch(() => ({}));
    const data = await response.json();

    if (!response.ok) {
      setLoginMessage(data.error || "Erro no login.", "error");
      loginMessage.textContent = data.error || "Erro no login.";
      return;
    }

    sessionStorage.setItem("admin_user", user);
    sessionStorage.setItem("admin_password", password);
    localStorage.setItem("admin_user", user);
    localStorage.setItem("admin_password", password);

    setLoginMessage("");
    showDashboard();

    loadAppointments();
    loadBlocks();

  } catch (error) {
    setLoginMessage("Erro ao conectar.", "error");
  } finally {
    loginButton.disabled = false;
    loginMessage.textContent = "Erro ao conectar.";
  }
}

  setListMessage(appointmentsList, "Carregando...");

  try {
    const params = new URLSearchParams({ date: selectedAppointmentsDate });
    const response = await fetch(`${API_URL}/admin/appointments?${params.toString()}`, {
    const response = await fetch(`${API_URL}/admin/appointments?date=${selectedAppointmentsDate}`, {
      headers: {
        Authorization: getAuth()
      }
    });

    if (handleUnauthorized(response)) return;
    const data = await response.json();
    const appointments = Array.isArray(data)
      ? data.filter((appointment) => appointment.date === selectedAppointmentsDate)
      : [];

    if (!response.ok) {
      throw new Error("Erro ao carregar agendamentos.");
    }

    const parsedData = await response.json();
    const rows = Array.isArray(parsedData) ? parsedData : [];
    const data = rows.filter((appointment) => appointment.date === selectedAppointmentsDate);

    appointmentsList.innerHTML = "";
    appointmentsCount.textContent = data.length;

    if (!data.length) {
    appointmentsCount.textContent = appointments.length;

    if (!appointments.length) {
      setListMessage(appointmentsList, "Nenhum horário marcado neste dia.");
      return;
    }

    data.forEach((appointment) => {
      const item = document.createElement("article");
    appointments.forEach((appointment) => {
      const item = document.createElement("div");

      item.className = "admin-card appointment-card";

      const main = document.createElement("div");
      main.className = "appointment-main";

      const time = document.createElement("strong");
      time.className = "appointment-time";
      time.textContent = appointment.time || "--:--";
      item.innerHTML = `
        <div class="appointment-main">
          <strong class="appointment-time">${appointment.time}</strong>

      const summary = document.createElement("div");
      summary.className = "appointment-summary";

      const client = document.createElement("span");
      client.className = "appointment-client";
      client.textContent = appointment.name || "Cliente";
          <div class="appointment-summary">
            <span class="appointment-client">${appointment.name}</span>
            <span class="appointment-service">${appointment.service}</span>
            <a class="appointment-phone" href="https://wa.me/55${appointment.phone.replace(/\D/g, "")}" target="_blank">
              ${appointment.phone}
            </a>
          </div>
        </div>

      const service = document.createElement("span");
      service.className = "appointment-service";
      service.textContent = appointment.service || "Serviço";
        <button class="danger-btn compact-danger">
          Cancelar
        </button>
      `;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "danger-btn compact-danger";
      button.textContent = "Cancelar";
      const button = item.querySelector("button");

      button.addEventListener("click", async () => {
        if (!confirm("Cancelar esse agendamento?")) return;

        button.disabled = true;
        await fetch(`${API_URL}/admin/appointments/${appointment.id}`, {
          method: "DELETE",
          headers: {
            Authorization: getAuth()
          }
        });

        try {
          const response = await fetch(`${API_URL}/admin/appointments/${appointment.id}`, {
            method: "DELETE",
            headers: {
              Authorization: getAuth()
            }
          });

          if (handleUnauthorized(response)) return;

          loadAppointments();
        } finally {
          button.disabled = false;
        }
        loadAppointments();
      });

      summary.appendChild(client);
      summary.appendChild(service);
      summary.appendChild(createWhatsAppLink(appointment.phone));

      main.appendChild(time);
      main.appendChild(summary);

      item.appendChild(main);
      item.appendChild(button);

      appointmentsList.appendChild(item);
    });

  } catch (error) {
    setListMessage(appointmentsList, "Erro ao carregar agendamentos.");
    appointmentsList.innerHTML = `
      <p class="empty-text">
        Erro ao carregar agendamentos.
      </p>
    `;
  }
}

async function loadBlocks() {
  setListMessage(blocksList, "Carregando...");
  blocksList.innerHTML = "Carregando...";

  try {
    const response = await fetch(`${API_URL}/admin/blocks`, {
        Authorization: getAuth()
      }
    });

    if (handleUnauthorized(response)) return;

    if (!response.ok) {
      throw new Error("Erro ao carregar bloqueios.");
    }
    const data = await response.json();

    const parsedData = await response.json();
    const data = Array.isArray(parsedData) ? parsedData : [];
    blocksList.innerHTML = "";

    blocksList.innerHTML = "";
    blocksCount.textContent = data.length;

    if (!data.length) {
      setListMessage(blocksList, "Nenhum bloqueio encontrado.");
      blocksList.innerHTML = `
        <p class="empty-text">
          Nenhum bloqueio encontrado.
        </p>
      `;
      return;
    }

    data.forEach((block) => {
      const item = document.createElement("article");
      item.className = "admin-card";
      const item = document.createElement("div");

      const top = document.createElement("div");
      top.className = "admin-card-top";
      item.className = "admin-card";

      const date = document.createElement("strong");
      date.textContent = block.date || "-";
      item.innerHTML = `
        <div class="admin-card-top">
          <strong>${block.date}</strong>
          <span>${block.time || "Dia inteiro"}</span>
        </div>

      const time = document.createElement("span");
      time.textContent = block.time || "Dia inteiro";
        <div class="admin-card-content">
          <p><b>Motivo:</b> ${block.reason}</p>
        </div>

      const content = document.createElement("div");
      content.className = "admin-card-content";
      content.appendChild(createInfoLine("Motivo", block.reason));
        <button class="danger-btn">
          Remover bloqueio
        </button>
      `;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "danger-btn";
      button.textContent = "Remover bloqueio";
      const button = item.querySelector("button");

      button.addEventListener("click", async () => {
        if (!confirm("Remover bloqueio?")) return;

        button.disabled = true;
        await fetch(`${API_URL}/admin/blocks/${block.id}`, {
          method: "DELETE",
          headers: {
            Authorization: getAuth()
          }
        });

        try {
          const response = await fetch(`${API_URL}/admin/blocks/${block.id}`, {
            method: "DELETE",
            headers: {
              Authorization: getAuth()
            }
          });

          if (handleUnauthorized(response)) return;

          loadBlocks();
        } finally {
          button.disabled = false;
        }
        loadBlocks();
      });

      top.appendChild(date);
      top.appendChild(time);

      item.appendChild(top);
      item.appendChild(content);
      item.appendChild(button);

      blocksList.appendChild(item);
    });

  } catch (error) {
    setListMessage(blocksList, "Erro ao carregar bloqueios.");
    blocksList.innerHTML = `
      <p class="empty-text">
        Erro ao carregar bloqueios.
      </p>
    `;
  }
}

  const date = document.getElementById("blockDate").value;
  const time = document.getElementById("blockTime").value;
  const reason = document.getElementById("blockReason").value.trim();
  const submitButton = blockForm.querySelector(".submit-btn");

  if (!date || !reason) {
    alert("Preencha os campos.");
    return;
  }

  submitButton.disabled = true;

  try {
    const response = await fetch(`${API_URL}/admin/blocks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuth()
      },
      body: JSON.stringify({
        date,
        time,
        reason
      })
    });

    if (handleUnauthorized(response)) return;
  await fetch(`${API_URL}/admin/blocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuth()
    },
    body: JSON.stringify({
      date,
      time,
      reason
    })
  });

    if (!response.ok) {
      alert("Erro ao criar bloqueio.");
      return;
    }
  blockForm.reset();

    blockForm.reset();
    loadBlocks();
  } catch (error) {
    alert("Erro ao conectar.");
  } finally {
    submitButton.disabled = false;
  }
  loadBlocks();
});

logoutBtn.addEventListener("click", () => {
  clearAuth();
  localStorage.removeItem("admin_user");
  localStorage.removeItem("admin_password");

  showLogin();
});

  loadAppointments();
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login();
});
loginBtn.addEventListener("click", login);

if (getAuth()) {
  showDashboard();
