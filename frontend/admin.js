const API_URL = "https://barbearia-ygxt.onrender.com/api";

const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const adminUser = document.getElementById("adminUser");
const adminPassword = document.getElementById("adminPassword");

const appointmentsList = document.getElementById("appointmentsList");
const completedList = document.getElementById("completedList");

const scheduledSection = document.getElementById("scheduledSection");
const completedSection = document.getElementById("completedSection");

const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");

const blockForm = document.getElementById("blockForm");
const blockDate = document.getElementById("blockDate");
const blockTime = document.getElementById("blockTime");
const blockReason = document.getElementById("blockReason");
const blocksList = document.getElementById("blocksList");

const tabs = document.querySelectorAll(".tab");

let authHeader = localStorage.getItem("adminAuth") || "";
let savedUser = localStorage.getItem("adminUser") || "";
let savedPassword = localStorage.getItem("adminPassword") || "";

let appointments = [];
let blocks = [];

adminUser.value = savedUser;
adminPassword.value = savedPassword;

function setLoginMessage(text, type = "") {
  loginMessage.textContent = text;
  loginMessage.className = `message ${type}`;
}

function showPanel() {
  loginBox.classList.add("hidden");
  adminPanel.classList.remove("hidden");
}

function showLogin() {
  adminPanel.classList.add("hidden");
  loginBox.classList.remove("hidden");

  adminUser.value = localStorage.getItem("adminUser") || adminUser.value;
  adminPassword.value = localStorage.getItem("adminPassword") || adminPassword.value;
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseAppointmentDateTime(item) {
  return new Date(`${item.date}T${item.time || "00:00"}:00`);
}

function isCompletedAppointment(item) {
  const appointmentDateTime = parseAppointmentDateTime(item);
  const completedLimit = new Date(appointmentDateTime.getTime() + 3 * 60 * 60 * 1000);

  return new Date() >= completedLimit;
}

function formatDayHeader(dateString) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  const weekDays = [
    "DOM",
    "SEG",
    "TER",
    "QUA",
    "QUI",
    "SEX",
    "SÁB"
  ];

  const weekDay = weekDays[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${weekDay} ${day}/${month}`;
}

function formatTime(time) {
  if (!time) return "Dia inteiro";
  return time.slice(0, 5);
}

function sortAppointments(list) {
  return [...list].sort((a, b) => {
    const dateA = parseAppointmentDateTime(a);
    const dateB = parseAppointmentDateTime(b);

    return dateA - dateB;
  });
}

function groupByDate(list) {
  return list.reduce((groups, item) => {
    if (!groups[item.date]) {
      groups[item.date] = [];
    }

    groups[item.date].push(item);
    return groups;
  }, {});
}

async function adminFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: authHeader
    }
  });
}

async function login(user, password) {
  const token = btoa(`${user}:${password}`);
  authHeader = `Basic ${token}`;

  const response = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: {
      Authorization: authHeader
    }
  });

  if (!response.ok) {
    authHeader = "";
    localStorage.removeItem("adminAuth");
    throw new Error("Usuário ou senha incorretos.");
  }

  localStorage.setItem("adminAuth", authHeader);
  localStorage.setItem("adminUser", user);
  localStorage.setItem("adminPassword", password);
}

async function loadAll() {
  await Promise.all([
    loadAppointments(),
    loadBlocks()
  ]);
}

async function loadAppointments() {
  appointmentsList.innerHTML = `<p class="empty">Carregando horários...</p>`;
  completedList.innerHTML = `<p class="empty">Carregando histórico...</p>`;

  try {
    const response = await adminFetch(`${API_URL}/admin/appointments`);

    if (response.status === 401) {
      localStorage.removeItem("adminAuth");
      authHeader = "";
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      appointmentsList.innerHTML = `<p class="empty error">${data.error || "Erro ao carregar horários."}</p>`;
      completedList.innerHTML = `<p class="empty error">${data.error || "Erro ao carregar histórico."}</p>`;
      return;
    }

    appointments = Array.isArray(data) ? data : [];
    renderAppointments();
  } catch (error) {
    appointmentsList.innerHTML = `<p class="empty error">Erro ao conectar ao servidor.</p>`;
    completedList.innerHTML = `<p class="empty error">Erro ao conectar ao servidor.</p>`;
  }
}

function renderAppointments() {
  const activeAppointments = sortAppointments(
    appointments.filter((item) => !isCompletedAppointment(item))
  );

  const completedAppointments = sortAppointments(
    appointments.filter((item) => isCompletedAppointment(item))
  ).reverse();

  renderGroupedAppointments(appointmentsList, activeAppointments, "Nenhum horário futuro marcado.");
  renderGroupedAppointments(completedList, completedAppointments, "Nenhum atendimento finalizado ainda.");
}

function renderGroupedAppointments(container, list, emptyMessage) {
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = `<p class="empty">${emptyMessage}</p>`;
    return;
  }

  const grouped = groupByDate(list);

  Object.keys(grouped)
    .sort()
    .forEach((date) => {
      const daySection = document.createElement("section");
      daySection.className = "day-group";

      const dayHeader = document.createElement("div");
      dayHeader.className = "day-header";

      dayHeader.innerHTML = `
        <strong>${formatDayHeader(date)}</strong>
        <span>${grouped[date].length} horário(s)</span>
      `;

      daySection.appendChild(dayHeader);

      grouped[date].forEach((item) => {
        const card = document.createElement("article");
        card.className = "appointment-card";

        card.innerHTML = `
          <div class="time-box">
            <small>Horário</small>
            <strong>${escapeHTML(formatTime(item.time))}</strong>
          </div>

          <div class="service-box">
            <small>Serviço</small>
            <strong>${escapeHTML(item.service)}</strong>
          </div>

          <div>
            <small>Cliente</small>
            <strong>${escapeHTML(item.name)}</strong>
          </div>

          <div>
            <small>Número</small>
            <strong>${escapeHTML(item.phone)}</strong>
          </div>

          <button class="cancel-btn" data-id="${item.id}">Cancelar</button>
        `;

        daySection.appendChild(card);
      });

      container.appendChild(daySection);
    });

  document.querySelectorAll(".cancel-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;

      if (!confirm("Deseja cancelar este agendamento?")) return;

      await cancelAppointment(id);
    });
  });
}

async function cancelAppointment(id) {
  try {
    const response = await adminFetch(`${API_URL}/admin/appointments/${id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      alert("Erro ao cancelar agendamento.");
      return;
    }

    await loadAppointments();
  } catch (error) {
    alert("Erro ao conectar ao servidor.");
  }
}

async function loadBlocks() {
  blocksList.innerHTML = `<p class="empty">Carregando bloqueios...</p>`;

  try {
    const response = await adminFetch(`${API_URL}/admin/blocks`);

    if (response.status === 401) {
      localStorage.removeItem("adminAuth");
      authHeader = "";
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      blocksList.innerHTML = `<p class="empty error">${data.error || "Erro ao carregar bloqueios."}</p>`;
      return;
    }

    blocks = Array.isArray(data) ? data : [];
    renderBlocks();
  } catch (error) {
    blocksList.innerHTML = `<p class="empty error">Erro ao conectar ao servidor.</p>`;
  }
}

function renderBlocks() {
  blocksList.innerHTML = "";

  if (!blocks.length) {
    blocksList.innerHTML = `<p class="empty">Nenhum bloqueio ativo.</p>`;
    return;
  }

  blocks
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || "00:00"}:00`);
      const dateB = new Date(`${b.date}T${b.time || "00:00"}:00`);
      return dateA - dateB;
    })
    .forEach((block) => {
      const card = document.createElement("article");
      card.className = "block-card";

      card.innerHTML = `
        <div>
          <small>Dia</small>
          <strong>${formatDayHeader(block.date)}</strong>
        </div>

        <div>
          <small>Horário</small>
          <strong>${formatTime(block.time)}</strong>
        </div>

        <div>
          <small>Motivo</small>
          <strong>${escapeHTML(block.reason)}</strong>
        </div>

        <button class="remove-block-btn" data-id="${block.id}">Remover</button>
      `;

      blocksList.appendChild(card);
    });

  document.querySelectorAll(".remove-block-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;

      if (!confirm("Deseja remover este bloqueio?")) return;

      await removeBlock(id);
    });
  });
}

async function createBlock(event) {
  event.preventDefault();

  const date = blockDate.value;
  const time = blockTime.value || null;
  const reason = blockReason.value.trim();

  if (!date || !reason) {
    alert("Preencha a data e o motivo.");
    return;
  }

  try {
    const response = await adminFetch(`${API_URL}/admin/blocks`, {
      method: "POST",
      body: JSON.stringify({
        date,
        time,
        reason
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Erro ao criar bloqueio.");
      return;
    }

    blockForm.reset();
    await loadBlocks();
    alert("Bloqueio criado com sucesso.");
  } catch (error) {
    alert("Erro ao conectar ao servidor.");
  }
}

async function removeBlock(id) {
  try {
    const response = await adminFetch(`${API_URL}/admin/blocks/${id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      alert("Erro ao remover bloqueio.");
      return;
    }

    await loadBlocks();
  } catch (error) {
    alert("Erro ao conectar ao servidor.");
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");

    const selectedTab = tab.dataset.tab;

    if (selectedTab === "scheduled") {
      scheduledSection.classList.remove("hidden");
      completedSection.classList.add("hidden");
    }

    if (selectedTab === "completed") {
      completedSection.classList.remove("hidden");
      scheduledSection.classList.add("hidden");
    }
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  setLoginMessage("Entrando...");

  try {
    await login(adminUser.value.trim(), adminPassword.value.trim());
    setLoginMessage("");
    showPanel();
    await loadAll();
  } catch (error) {
    setLoginMessage(error.message, "error");
  }
});

refreshBtn.addEventListener("click", loadAll);

logoutBtn.addEventListener("click", () => {
  authHeader = "";
  showLogin();
});

blockForm.addEventListener("submit", createBlock);

if (authHeader) {
  showPanel();
  loadAll();
}
