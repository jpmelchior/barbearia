const API_URL = "https://barbearia-ygxt.onrender.com/api";

const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const adminUser = document.getElementById("adminUser");
const adminPassword = document.getElementById("adminPassword");

const appointmentsList = document.getElementById("appointmentsList");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");

const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");

const blockForm = document.getElementById("blockForm");
const blockDate = document.getElementById("blockDate");
const blockTime = document.getElementById("blockTime");
const blockReason = document.getElementById("blockReason");
const blocksList = document.getElementById("blocksList");

let authHeader = localStorage.getItem("adminAuth") || "";
let appointments = [];
let blocks = [];
let currentPage = 1;
const perPage = 5;

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
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  if (!date || !date.includes("-")) return date || "-";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(time) {
  if (!time) return "Dia inteiro";
  return time.slice(0, 5);
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
}

async function loadAll() {
  await Promise.all([
    loadAppointments(),
    loadBlocks()
  ]);
}

async function loadAppointments() {
  appointmentsList.innerHTML = `<p class="empty">Carregando agendamentos...</p>`;

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
      appointmentsList.innerHTML = `<p class="empty error">${data.error || "Erro ao carregar agendamentos."}</p>`;
      return;
    }

    appointments = Array.isArray(data) ? data : [];
    currentPage = 1;
    renderAppointments();
  } catch (error) {
    appointmentsList.innerHTML = `<p class="empty error">Erro ao conectar ao servidor.</p>`;
  }
}

function renderAppointments() {
  appointmentsList.innerHTML = "";

  if (!appointments.length) {
    appointmentsList.innerHTML = `<p class="empty">Nenhum agendamento marcado.</p>`;
    pageInfo.textContent = "Página 1";
    prevPage.disabled = true;
    nextPage.disabled = true;
    return;
  }

  const totalPages = Math.ceil(appointments.length / perPage);
  const start = (currentPage - 1) * perPage;
  const pageItems = appointments.slice(start, start + perPage);

  pageItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "appointment-card";

    card.innerHTML = `
      <div>
        <small>Nome</small>
        <strong>${escapeHTML(item.name)}</strong>
      </div>

      <div>
        <small>Número</small>
        <strong>${escapeHTML(item.phone)}</strong>
      </div>

      <div>
        <small>Dia</small>
        <strong>${formatDate(item.date)}</strong>
      </div>

      <div>
        <small>Hora</small>
        <strong>${escapeHTML(formatTime(item.time))}</strong>
      </div>

      <div>
        <small>Serviço</small>
        <strong>${escapeHTML(item.service)}</strong>
      </div>

      <button class="cancel-btn" data-id="${item.id}">Cancelar</button>
    `;

    appointmentsList.appendChild(card);
  });

  document.querySelectorAll(".cancel-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;

      if (!confirm("Deseja cancelar este agendamento?")) return;

      await cancelAppointment(id);
    });
  });

  pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  prevPage.disabled = currentPage === 1;
  nextPage.disabled = currentPage === totalPages;
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

  blocks.forEach((block) => {
    const card = document.createElement("article");
    card.className = "block-card";

    card.innerHTML = `
      <div>
        <small>Dia</small>
        <strong>${formatDate(block.date)}</strong>
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
  localStorage.removeItem("adminAuth");
  authHeader = "";
  showLogin();
});

prevPage.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderAppointments();
  }
});

nextPage.addEventListener("click", () => {
  const totalPages = Math.ceil(appointments.length / perPage);

  if (currentPage < totalPages) {
    currentPage++;
    renderAppointments();
  }
});

blockForm.addEventListener("submit", createBlock);

if (authHeader) {
  showPanel();
  loadAll();
}
