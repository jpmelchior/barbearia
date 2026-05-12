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

const historyDateFilter = document.getElementById("historyDateFilter");
const resetHistoryFilters = document.getElementById("resetHistoryFilters");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const historyTotal = document.getElementById("historyTotal");
const historyResult = document.getElementById("historyResult");
const dateFilterButtons = document.querySelectorAll(".date-filter-btn");

const tabs = document.querySelectorAll(".tab");

const perDayPageSize = 5;
const dayPages = {};

let authHeader = sessionStorage.getItem("adminAuth") || "";
let savedUser = sessionStorage.getItem("adminUser") || "";

let appointments = [];
let blocks = [];

let historyDate = "";
let historyDateMode = "all";

/*
  Limpeza de dados antigos inseguros.
  Versões anteriores salvavam senha no localStorage.
  Agora a senha não deve ficar armazenada no navegador.
*/
localStorage.removeItem("adminAuth");
localStorage.removeItem("adminPassword");

adminUser.value = savedUser;
adminPassword.value = "";

adminPassword.setAttribute("autocomplete", "current-password");
adminUser.setAttribute("autocomplete", "username");

function clearAdminSession() {
  authHeader = "";
  sessionStorage.removeItem("adminAuth");
  sessionStorage.removeItem("adminUser");
  localStorage.removeItem("adminAuth");
  localStorage.removeItem("adminPassword");
}

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

  adminUser.value = sessionStorage.getItem("adminUser") || adminUser.value || "";
  adminPassword.value = "";
  adminPassword.focus();
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

  const completedLimit = new Date(
    appointmentDateTime.getTime() + 3 * 60 * 60 * 1000
  );

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

function formatFullDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
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

function getTodayISO() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getYesterdayISO() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, "0");
  const day = String(yesterday.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isWithinLastDays(dateString, days) {
  const itemDate = new Date(`${dateString}T00:00:00`);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const limit = new Date(today);
  limit.setDate(today.getDate() - (days - 1));

  return itemDate >= limit && itemDate <= today;
}

function isCurrentMonth(dateString) {
  const itemDate = new Date(`${dateString}T00:00:00`);
  const today = new Date();

  return (
    itemDate.getFullYear() === today.getFullYear() &&
    itemDate.getMonth() === today.getMonth()
  );
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
  const cleanUser = String(user || "").trim();
  const cleanPassword = String(password || "").trim();

  if (!cleanUser || !cleanPassword) {
    throw new Error("Informe usuário e senha.");
  }

  const token = btoa(`${cleanUser}:${cleanPassword}`);
  authHeader = `Basic ${token}`;

  const response = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: {
      Authorization: authHeader
    }
  });

  if (!response.ok) {
    clearAdminSession();
    throw new Error("Usuário ou senha incorretos.");
  }

  /*
    Segurança:
    - Não salvamos senha.
    - Não salvamos credencial em localStorage.
    - sessionStorage dura apenas durante a sessão do navegador.
  */
  sessionStorage.setItem("adminAuth", authHeader);
  sessionStorage.setItem("adminUser", cleanUser);

  adminPassword.value = "";
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
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      appointmentsList.innerHTML = `<p class="empty error">${escapeHTML(data.error || "Erro ao carregar horários.")}</p>`;
      completedList.innerHTML = `<p class="empty error">${escapeHTML(data.error || "Erro ao carregar histórico.")}</p>`;
      return;
    }

    appointments = Array.isArray(data) ? data : [];
    renderAppointments();
  } catch (error) {
    appointmentsList.innerHTML = `<p class="empty error">Erro ao conectar ao servidor.</p>`;
    completedList.innerHTML = `<p class="empty error">Erro ao conectar ao servidor.</p>`;
  }
}

function getActiveAppointments() {
  return sortAppointments(
    appointments.filter((item) => !isCompletedAppointment(item))
  );
}

function getCompletedAppointments() {
  return sortAppointments(
    appointments.filter((item) => isCompletedAppointment(item))
  ).reverse();
}

function getFilteredCompletedAppointments() {
  const completedAppointments = getCompletedAppointments();

  return completedAppointments.filter((item) => {
    const date = item.date || "";

    if (historyDate) {
      return date === historyDate;
    }

    if (historyDateMode === "today") {
      return date === getTodayISO();
    }

    if (historyDateMode === "yesterday") {
      return date === getYesterdayISO();
    }

    if (historyDateMode === "last7") {
      return isWithinLastDays(date, 7);
    }

    if (historyDateMode === "month") {
      return isCurrentMonth(date);
    }

    return true;
  });
}

function renderAppointments() {
  const activeAppointments = getActiveAppointments();
  const completedAppointments = getFilteredCompletedAppointments();
  const allCompleted = getCompletedAppointments();

  historyTotal.textContent = `Total atendidos: ${allCompleted.length}`;
  historyResult.textContent = `Resultado atual: ${completedAppointments.length}`;
  clearHistoryBtn.disabled = allCompleted.length === 0;

  renderGroupedAppointments(
    appointmentsList,
    activeAppointments,
    "Nenhum horário futuro marcado.",
    "scheduled"
  );

  renderGroupedAppointments(
    completedList,
    completedAppointments,
    "Nenhum cliente encontrado no histórico.",
    "completed"
  );
}

function resetCompletedPagination() {
  Object.keys(dayPages).forEach((key) => {
    if (key.startsWith("completed-")) {
      dayPages[key] = 1;
    }
  });
}

function renderGroupedAppointments(container, list, emptyMessage, groupType) {
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = `<p class="empty">${emptyMessage}</p>`;
    return;
  }

  const grouped = groupByDate(list);

  Object.keys(grouped)
    .sort()
    .forEach((date) => {
      const items = grouped[date];
      const pageKey = `${groupType}-${date}`;

      if (!dayPages[pageKey]) {
        dayPages[pageKey] = 1;
      }

      const totalItems = items.length;
      const totalPages = Math.ceil(totalItems / perDayPageSize);
      const currentPage = Math.min(dayPages[pageKey], totalPages);

      dayPages[pageKey] = currentPage;

      const start = (currentPage - 1) * perDayPageSize;
      const end = start + perDayPageSize;
      const visibleItems = items.slice(start, end);

      const firstVisible = start + 1;
      const lastVisible = Math.min(end, totalItems);

      const daySection = document.createElement("section");
      daySection.className = "day-group";

      const dayHeader = document.createElement("div");
      dayHeader.className = "day-header";

      dayHeader.innerHTML = `
        <div class="day-title-area">
          <strong>${escapeHTML(formatDayHeader(date))}</strong>
          <small>${escapeHTML(formatFullDate(date))}</small>
        </div>

        <div class="day-info-area">
          <span>${totalItems} horário(s)</span>
          <span>Página ${currentPage} de ${totalPages}</span>
          <span>Mostrando ${firstVisible}-${lastVisible}</span>
        </div>
      `;

      daySection.appendChild(dayHeader);

      visibleItems.forEach((item) => {
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

          <button class="cancel-btn" data-id="${escapeHTML(item.id)}">
            ${groupType === "completed" ? "Remover" : "Cancelar"}
          </button>
        `;

        daySection.appendChild(card);
      });

      if (totalPages > 1) {
        const pagination = document.createElement("div");
        pagination.className = "day-pagination";

        pagination.innerHTML = `
          <button 
            class="day-prev" 
            data-page-key="${escapeHTML(pageKey)}" 
            ${currentPage === 1 ? "disabled" : ""}
          >
            ← Anterior
          </button>

          <span>Página ${currentPage} de ${totalPages}</span>

          <button 
            class="day-next" 
            data-page-key="${escapeHTML(pageKey)}" 
            data-total-pages="${totalPages}" 
            ${currentPage === totalPages ? "disabled" : ""}
          >
            Próxima →
          </button>
        `;

        daySection.appendChild(pagination);
      }

      container.appendChild(daySection);
    });

  container.querySelectorAll(".cancel-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      const actionText =
        groupType === "completed"
          ? "remover este registro"
          : "cancelar este agendamento";

      if (!confirm(`Deseja ${actionText}?`)) return;

      await cancelAppointment(id);
    });
  });

  container.querySelectorAll(".day-prev").forEach((button) => {
    button.addEventListener("click", () => {
      const pageKey = button.dataset.pageKey;

      dayPages[pageKey] = Math.max(1, (dayPages[pageKey] || 1) - 1);

      renderAppointments();
    });
  });

  container.querySelectorAll(".day-next").forEach((button) => {
    button.addEventListener("click", () => {
      const pageKey = button.dataset.pageKey;
      const totalPages = Number(button.dataset.totalPages);

      dayPages[pageKey] = Math.min(
        totalPages,
        (dayPages[pageKey] || 1) + 1
      );

      renderAppointments();
    });
  });
}

async function cancelAppointment(id) {
  try {
    const response = await adminFetch(`${API_URL}/admin/appointments/${id}`, {
      method: "DELETE"
    });

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    if (!response.ok) {
      alert("Erro ao remover registro.");
      return;
    }

    await loadAppointments();
  } catch (error) {
    alert("Erro ao conectar ao servidor.");
  }
}

async function clearCompletedHistory() {
  const completedAppointments = getCompletedAppointments();

  if (!completedAppointments.length) {
    alert("Não existe histórico para limpar.");
    return;
  }

  const confirmed = confirm(
    `Deseja limpar todo o histórico de ${completedAppointments.length} cliente(s) atendido(s)? Essa ação não pode ser desfeita.`
  );

  if (!confirmed) return;

  const secondConfirm = confirm(
    "Confirma novamente? Essa ação remove os registros atendidos do sistema."
  );

  if (!secondConfirm) return;

  try {
    const ids = completedAppointments.map((item) => item.id);

    for (const id of ids) {
      const response = await adminFetch(`${API_URL}/admin/appointments/${id}`, {
        method: "DELETE"
      });

      if (response.status === 401) {
        clearAdminSession();
        showLogin();
        setLoginMessage("Faça login novamente.", "error");
        return;
      }

      if (!response.ok) {
        alert("Alguns registros não puderam ser removidos.");
        break;
      }
    }

    historyDate = "";
    historyDateMode = "all";
    historyDateFilter.value = "";

    dateFilterButtons.forEach((item) => {
      item.classList.toggle("active", item.dataset.filter === "all");
    });

    resetCompletedPagination();

    await loadAppointments();

    alert("Histórico limpo com sucesso.");
  } catch (error) {
    alert("Erro ao limpar histórico.");
  }
}

async function loadBlocks() {
  blocksList.innerHTML = `<p class="empty">Carregando bloqueios...</p>`;

  try {
    const response = await adminFetch(`${API_URL}/admin/blocks`);

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      blocksList.innerHTML = `<p class="empty error">${escapeHTML(data.error || "Erro ao carregar bloqueios.")}</p>`;
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
          <strong>${escapeHTML(formatDayHeader(block.date))}</strong>
        </div>

        <div>
          <small>Horário</small>
          <strong>${escapeHTML(formatTime(block.time))}</strong>
        </div>

        <div>
          <small>Motivo</small>
          <strong>${escapeHTML(block.reason)}</strong>
        </div>

        <button class="remove-block-btn" data-id="${escapeHTML(block.id)}">Remover</button>
      `;

      blocksList.appendChild(card);
    });

  blocksList.querySelectorAll(".remove-block-btn").forEach((button) => {
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

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

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

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

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
    await login(adminUser.value, adminPassword.value);

    setLoginMessage("");
    showPanel();

    await loadAll();
  } catch (error) {
    setLoginMessage(error.message, "error");
  }
});

refreshBtn.addEventListener("click", loadAll);

logoutBtn.addEventListener("click", () => {
  clearAdminSession();
  appointments = [];
  blocks = [];
  adminPassword.value = "";
  showLogin();
  setLoginMessage("Você saiu do painel.", "");
});

blockForm.addEventListener("submit", createBlock);

dateFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    dateFilterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    historyDateMode = button.dataset.filter;
    historyDate = "";
    historyDateFilter.value = "";

    resetCompletedPagination();
    renderAppointments();
  });
});

historyDateFilter.addEventListener("change", () => {
  historyDate = historyDateFilter.value;
  historyDateMode = "manual";

  dateFilterButtons.forEach((item) => item.classList.remove("active"));

  resetCompletedPagination();
  renderAppointments();
});

resetHistoryFilters.addEventListener("click", () => {
  historyDate = "";
  historyDateMode = "all";
  historyDateFilter.value = "";

  dateFilterButtons.forEach((item) => {
    item.classList.toggle("active", item.dataset.filter === "all");
  });

  resetCompletedPagination();
  renderAppointments();
});

clearHistoryBtn.addEventListener("click", clearCompletedHistory);

if (authHeader) {
  showPanel();
  loadAll();
} else {
  showLogin();
}