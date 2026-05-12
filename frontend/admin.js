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
const servicesSection = document.getElementById("servicesSection");
const businessHoursSection = document.getElementById("businessHoursSection");

const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");

const blockForm = document.getElementById("blockForm");
const blockDate = document.getElementById("blockDate");
const blockEndDate = document.getElementById("blockEndDate");
const blockTime = document.getElementById("blockTime");
const blockReason = document.getElementById("blockReason");
const blocksList = document.getElementById("blocksList");

const historyDateFilter = document.getElementById("historyDateFilter");
const resetHistoryFilters = document.getElementById("resetHistoryFilters");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const historyTotal = document.getElementById("historyTotal");
const historyResult = document.getElementById("historyResult");
const dateFilterButtons = document.querySelectorAll(".date-filter-btn");

const exportScheduledBtn = document.getElementById("exportScheduledBtn");
const exportHistoryBtn = document.getElementById("exportHistoryBtn");
const exportBlocksBtn = document.getElementById("exportBlocksBtn");

const serviceForm = document.getElementById("serviceForm");
const serviceIdInput = document.getElementById("serviceId");
const serviceNameInput = document.getElementById("serviceName");
const servicePriceInput = document.getElementById("servicePrice");
const serviceActiveInput = document.getElementById("serviceActive");
const saveServiceBtn = document.getElementById("saveServiceBtn");
const cancelServiceEditBtn = document.getElementById("cancelServiceEditBtn");
const servicesList = document.getElementById("servicesList");

const businessHoursForm = document.getElementById("businessHoursForm");
const businessHoursList = document.getElementById("businessHoursList");
const saveBusinessHoursBtn = document.getElementById("saveBusinessHoursBtn");

const tabs = document.querySelectorAll(".tab");

const perDayPageSize = 5;
const dayPages = {};

let adminToken = sessionStorage.getItem("adminToken") || "";
let authHeader = adminToken ? `Bearer ${adminToken}` : "";
let savedUser = sessionStorage.getItem("adminUser") || "";

let appointments = [];
let blocks = [];
let services = [];
let businessHours = [];

let historyDate = "";
let historyDateMode = "all";

localStorage.removeItem("adminAuth");
localStorage.removeItem("adminPassword");

adminUser.value = savedUser;
adminPassword.value = "";

adminUser.setAttribute("autocomplete", "username");
adminPassword.setAttribute("autocomplete", "current-password");

function clearAdminSession() {
  adminToken = "";
  authHeader = "";
  sessionStorage.removeItem("adminToken");
  sessionStorage.removeItem("adminAuth");
  sessionStorage.removeItem("adminUser");
  localStorage.removeItem("adminAuth");
  localStorage.removeItem("adminToken");
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

function getAppointmentStatus(item) {
  return item.status || "scheduled";
}

function getStatusLabel(status) {
  const labels = {
    scheduled: "Agendado",
    completed: "Atendido",
    cancelled: "Cancelado",
    no_show: "Faltou",
    hidden: "Oculto"
  };

  return labels[status] || "Agendado";
}

function parseAppointmentDateTime(item) {
  return new Date(`${item.date}T${item.time || "00:00"}:00`);
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

  const response = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user: cleanUser,
      password: cleanPassword
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    clearAdminSession();
    throw new Error(data.error || "Usuário ou senha incorretos.");
  }

  adminToken = data.token;
  authHeader = `Bearer ${adminToken}`;

  sessionStorage.setItem("adminToken", adminToken);
  sessionStorage.setItem("adminUser", cleanUser);

  adminPassword.value = "";
}

async function loadAll() {
  await Promise.all([
    loadAppointments(),
    loadBlocks(),
    loadServices(),
    loadBusinessHours()
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

function getScheduledAppointments() {
  return sortAppointments(
    appointments.filter((item) => getAppointmentStatus(item) === "scheduled")
  );
}

function getHistoryAppointments() {
  return sortAppointments(
    appointments.filter((item) => {
      const status = getAppointmentStatus(item);
      return status === "completed" || status === "cancelled" || status === "no_show";
    })
  ).reverse();
}

function getFilteredHistoryAppointments() {
  const historyAppointments = getHistoryAppointments();

  return historyAppointments.filter((item) => {
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
  const scheduledAppointments = getScheduledAppointments();
  const filteredHistory = getFilteredHistoryAppointments();
  const allHistory = getHistoryAppointments();

  historyTotal.textContent = `Total no histórico: ${allHistory.length}`;
  historyResult.textContent = `Resultado atual: ${filteredHistory.length}`;
  clearHistoryBtn.disabled = allHistory.length === 0;

  renderGroupedAppointments(
    appointmentsList,
    scheduledAppointments,
    "Nenhum horário marcado.",
    "scheduled"
  );

  renderGroupedAppointments(
    completedList,
    filteredHistory,
    "Nenhum registro encontrado no histórico.",
    "history"
  );
}

function resetHistoryPagination() {
  Object.keys(dayPages).forEach((key) => {
    if (key.startsWith("history-")) {
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
          <span>${totalItems} registro(s)</span>
          <span>Página ${currentPage} de ${totalPages}</span>
          <span>Mostrando ${firstVisible}-${lastVisible}</span>
        </div>
      `;

      daySection.appendChild(dayHeader);

      visibleItems.forEach((item) => {
        const status = getAppointmentStatus(item);
        const card = document.createElement("article");

        card.className = `appointment-card status-${status}`;

        const buttons =
          groupType === "scheduled"
            ? `
              <button class="status-btn done-btn" data-id="${escapeHTML(item.id)}" data-status="completed">
                Atendido
              </button>

              <button class="status-btn no-show-btn" data-id="${escapeHTML(item.id)}" data-status="no_show">
                Faltou
              </button>

              <button class="cancel-btn" data-id="${escapeHTML(item.id)}" data-status="cancelled">
                Cancelar
              </button>
            `
            : `
              <button class="status-btn restore-btn" data-id="${escapeHTML(item.id)}" data-status="scheduled">
                Restaurar
              </button>

              <button class="cancel-btn" data-id="${escapeHTML(item.id)}" data-status="hidden">
                Remover
              </button>
            `;

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

          <div>
            <small>Status</small>
            <strong>${escapeHTML(getStatusLabel(status))}</strong>
          </div>

          <div class="card-actions">
            ${buttons}
          </div>
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

  container.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      const status = button.dataset.status;

      const messages = {
        completed: "marcar este cliente como atendido",
        no_show: "marcar este cliente como falta",
        cancelled: "cancelar este agendamento",
        scheduled: "restaurar este agendamento",
        hidden: "remover este registro do histórico"
      };

      if (!confirm(`Deseja ${messages[status] || "alterar este registro"}?`)) {
        return;
      }

      await updateAppointmentStatus(id, status);
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

async function updateAppointmentStatus(id, status) {
  try {
    const response = await adminFetch(`${API_URL}/admin/appointments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    if (!response.ok) {
      alert(data.error || "Erro ao atualizar registro.");
      return;
    }

    await loadAppointments();
  } catch (error) {
    alert("Erro ao conectar ao servidor.");
  }
}

async function clearCompletedHistory() {
  const historyAppointments = getHistoryAppointments();

  if (!historyAppointments.length) {
    alert("Não existe histórico para limpar.");
    return;
  }

  const confirmed = confirm(
    `Deseja remover ${historyAppointments.length} registro(s) do histórico? Essa ação apenas oculta os registros do painel.`
  );

  if (!confirmed) return;

  const secondConfirm = confirm(
    "Confirma novamente? Os registros sairão do histórico exibido."
  );

  if (!secondConfirm) return;

  try {
    for (const item of historyAppointments) {
      const response = await adminFetch(`${API_URL}/admin/appointments/${item.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "hidden" })
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

    resetHistoryPagination();

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

  const startDate = blockDate.value;
  const endDate = blockEndDate.value || blockDate.value;
  const time = blockTime.value || null;
  const reason = blockReason.value.trim();

  if (!startDate || !reason) {
    alert("Preencha a data inicial e o motivo.");
    return;
  }

  if (endDate < startDate) {
    alert("A data final não pode ser menor que a data inicial.");
    return;
  }

  try {
    const response = await adminFetch(`${API_URL}/admin/blocks`, {
      method: "POST",
      body: JSON.stringify({
        startDate,
        endDate,
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

    alert(data.message || "Bloqueio criado com sucesso.");
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

function csvEscape(value) {
  const cleanValue = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();

  if (
    cleanValue.includes(";") ||
    cleanValue.includes(",") ||
    cleanValue.includes('"')
  ) {
    return `"${cleanValue.replaceAll('"', '""')}"`;
  }

  return cleanValue;
}

function buildCSV(headers, rows) {
  const csvHeaders = headers.map(csvEscape).join(";");

  const csvRows = rows.map((row) => {
    return headers.map((header) => csvEscape(row[header])).join(";");
  });

  return [csvHeaders, ...csvRows].join("\n");
}

function downloadCSV(filename, headers, rows) {
  if (!rows.length) {
    alert("Não há dados para exportar.");
    return;
  }

  const csvContent = buildCSV(headers, rows);
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function getExportDate() {
  return new Date().toISOString().slice(0, 10);
}

function exportScheduledAppointments() {
  const scheduled = getScheduledAppointments();

  const rows = scheduled.map((item) => ({
    "Data": item.date || "",
    "Dia": formatDayHeader(item.date),
    "Hora": formatTime(item.time),
    "Cliente": item.name || "",
    "Telefone": item.phone || "",
    "Servico": item.service || "",
    "Status": getStatusLabel(getAppointmentStatus(item)),
    "Criado em": item.created_at || "",
    "Atualizado em": item.updated_at || ""
  }));

  downloadCSV(
    `barbearia-agendamentos-${getExportDate()}.csv`,
    ["Data", "Dia", "Hora", "Cliente", "Telefone", "Servico", "Status", "Criado em", "Atualizado em"],
    rows
  );
}

function exportHistoryAppointments() {
  const history = getFilteredHistoryAppointments();

  const rows = history.map((item) => ({
    "Data": item.date || "",
    "Dia": formatDayHeader(item.date),
    "Hora": formatTime(item.time),
    "Cliente": item.name || "",
    "Telefone": item.phone || "",
    "Servico": item.service || "",
    "Status": getStatusLabel(getAppointmentStatus(item)),
    "Criado em": item.created_at || "",
    "Atualizado em": item.updated_at || ""
  }));

  downloadCSV(
    `barbearia-historico-${getExportDate()}.csv`,
    ["Data", "Dia", "Hora", "Cliente", "Telefone", "Servico", "Status", "Criado em", "Atualizado em"],
    rows
  );
}

function exportBlocks() {
  const rows = blocks.map((item) => ({
    "Data": item.date || "",
    "Dia": formatDayHeader(item.date),
    "Hora": formatTime(item.time),
    "Motivo": item.reason || "",
    "Criado em": item.created_at || ""
  }));

  downloadCSV(
    `barbearia-bloqueios-${getExportDate()}.csv`,
    ["Data", "Dia", "Hora", "Motivo", "Criado em"],
    rows
  );
}


async function loadServices() {
  servicesList.innerHTML = `<p class="empty">Carregando serviços...</p>`;

  try {
    const response = await adminFetch(`${API_URL}/admin/services`);

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      servicesList.innerHTML = `<p class="empty error">${escapeHTML(data.error || "Erro ao carregar serviços.")}</p>`;
      return;
    }

    services = Array.isArray(data) ? data : [];
    renderServices();
  } catch (error) {
    servicesList.innerHTML = `<p class="empty error">Erro ao conectar ao servidor.</p>`;
  }
}

function renderServices() {
  servicesList.innerHTML = "";

  if (!services.length) {
    servicesList.innerHTML = `<p class="empty">Nenhum serviço cadastrado.</p>`;
    return;
  }

  services.forEach((service) => {
    const card = document.createElement("article");
    card.className = `service-admin-card ${Number(service.active) ? "service-active" : "service-inactive"}`;

    card.innerHTML = `
      <div>
        <small>Serviço</small>
        <strong>${escapeHTML(service.name)}</strong>
      </div>

      <div>
        <small>Preço</small>
        <strong>${escapeHTML(service.price_label || formatMoney(service.price))}</strong>
      </div>

      <div>
        <small>Status</small>
        <strong>${Number(service.active) ? "Ativo" : "Inativo"}</strong>
      </div>

      <div class="service-card-actions">
        <button type="button" class="secondary-btn edit-service-btn" data-id="${escapeHTML(service.id)}">
          Editar
        </button>

        <button type="button" class="cancel-btn disable-service-btn" data-id="${escapeHTML(service.id)}">
          Desativar
        </button>
      </div>
    `;

    servicesList.appendChild(card);
  });

  servicesList.querySelectorAll(".edit-service-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const service = services.find((item) => String(item.id) === String(button.dataset.id));

      if (service) {
        startServiceEdit(service);
      }
    });
  });

  servicesList.querySelectorAll(".disable-service-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const service = services.find((item) => String(item.id) === String(button.dataset.id));

      if (!service) return;

      if (!confirm(`Deseja desativar o serviço "${service.name}"?`)) {
        return;
      }

      await disableService(service.id);
    });
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function startServiceEdit(service) {
  serviceIdInput.value = service.id;
  serviceNameInput.value = service.name;
  servicePriceInput.value = Number(service.price || 0).toFixed(2);
  serviceActiveInput.checked = Number(service.active) === 1;
  saveServiceBtn.textContent = "Atualizar serviço";
  cancelServiceEditBtn.classList.remove("hidden");
  serviceNameInput.focus();
}

function resetServiceForm() {
  serviceForm.reset();
  serviceIdInput.value = "";
  serviceActiveInput.checked = true;
  saveServiceBtn.textContent = "Salvar serviço";
  cancelServiceEditBtn.classList.add("hidden");
}

async function saveService(event) {
  event.preventDefault();

  const id = serviceIdInput.value;
  const name = serviceNameInput.value.trim();
  const price = servicePriceInput.value;
  const active = serviceActiveInput.checked ? 1 : 0;

  if (!name || name.length < 2) {
    alert("Informe o nome do serviço.");
    return;
  }

  if (price === "" || Number(price) < 0) {
    alert("Informe um preço válido.");
    return;
  }

  const isEditing = Boolean(id);
  const url = isEditing
    ? `${API_URL}/admin/services/${id}`
    : `${API_URL}/admin/services`;

  try {
    const response = await adminFetch(url, {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify({
        name,
        price,
        active
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    if (!response.ok) {
      alert(data.error || "Erro ao salvar serviço.");
      return;
    }

    resetServiceForm();
    await loadServices();
    alert(data.message || "Serviço salvo com sucesso.");
  } catch (error) {
    alert("Erro ao conectar ao servidor.");
  }
}

async function disableService(id) {
  try {
    const response = await adminFetch(`${API_URL}/admin/services/${id}`, {
      method: "DELETE"
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    if (!response.ok) {
      alert(data.error || "Erro ao desativar serviço.");
      return;
    }

    await loadServices();
    alert(data.message || "Serviço desativado com sucesso.");
  } catch (error) {
    alert("Erro ao conectar ao servidor.");
  }
}


async function loadBusinessHours() {
  businessHoursList.innerHTML = `<p class="empty">Carregando funcionamento...</p>`;

  try {
    const response = await adminFetch(`${API_URL}/admin/business-hours`);

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      businessHoursList.innerHTML = `<p class="empty error">${escapeHTML(data.error || "Erro ao carregar funcionamento.")}</p>`;
      return;
    }

    businessHours = Array.isArray(data) ? data : [];
    renderBusinessHours();
  } catch (error) {
    businessHoursList.innerHTML = `<p class="empty error">Erro ao conectar ao servidor.</p>`;
  }
}

function renderBusinessHours() {
  businessHoursList.innerHTML = "";

  if (!businessHours.length) {
    businessHoursList.innerHTML = `<p class="empty">Nenhum horário de funcionamento cadastrado.</p>`;
    return;
  }

  businessHours.forEach((item) => {
    const row = document.createElement("article");
    row.className = `business-hour-card ${Number(item.is_open) ? "open-day" : "closed-day"}`;
    row.dataset.weekday = item.weekday;

    row.innerHTML = `
      <div class="business-day-title">
        <small>Dia</small>
        <strong>${escapeHTML(item.label)}</strong>
      </div>

      <label class="checkbox-label business-open-toggle">
        <input type="checkbox" class="business-is-open" ${Number(item.is_open) ? "checked" : ""} />
        Aberto
      </label>

      <label>
        Abre
        <input type="time" class="business-open-time" value="${escapeHTML(item.open_time || "08:00")}" />
      </label>

      <label>
        Fecha
        <input type="time" class="business-close-time" value="${escapeHTML(item.close_time || "20:00")}" />
      </label>
    `;

    businessHoursList.appendChild(row);
  });
}

function collectBusinessHoursFromForm() {
  return Array.from(businessHoursList.querySelectorAll(".business-hour-card")).map((row) => ({
    weekday: Number(row.dataset.weekday),
    is_open: row.querySelector(".business-is-open").checked ? 1 : 0,
    open_time: row.querySelector(".business-open-time").value,
    close_time: row.querySelector(".business-close-time").value
  }));
}

async function saveBusinessHours(event) {
  event.preventDefault();

  const hours = collectBusinessHoursFromForm();

  if (!hours.length) {
    alert("Nenhum horário para salvar.");
    return;
  }

  for (const item of hours) {
    if (!item.open_time || !item.close_time) {
      alert("Preencha os horários de abertura e fechamento.");
      return;
    }

    if (item.open_time >= item.close_time) {
      alert("O horário de abertura precisa ser menor que o de fechamento.");
      return;
    }
  }

  saveBusinessHoursBtn.disabled = true;
  saveBusinessHoursBtn.textContent = "Salvando...";

  try {
    const response = await adminFetch(`${API_URL}/admin/business-hours`, {
      method: "PUT",
      body: JSON.stringify({ hours })
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearAdminSession();
      showLogin();
      setLoginMessage("Faça login novamente.", "error");
      return;
    }

    if (!response.ok) {
      alert(data.error || "Erro ao salvar funcionamento.");
      return;
    }

    await loadBusinessHours();
    alert(data.message || "Funcionamento atualizado com sucesso.");
  } catch (error) {
    alert("Erro ao conectar ao servidor.");
  } finally {
    saveBusinessHoursBtn.disabled = false;
    saveBusinessHoursBtn.textContent = "Salvar funcionamento";
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
      servicesSection.classList.add("hidden");
      businessHoursSection.classList.add("hidden");
    }

    if (selectedTab === "completed") {
      completedSection.classList.remove("hidden");
      scheduledSection.classList.add("hidden");
      servicesSection.classList.add("hidden");
      businessHoursSection.classList.add("hidden");
    }

    if (selectedTab === "services") {
      servicesSection.classList.remove("hidden");
      scheduledSection.classList.add("hidden");
      completedSection.classList.add("hidden");
      businessHoursSection.classList.add("hidden");
    }

    if (selectedTab === "business-hours") {
      businessHoursSection.classList.remove("hidden");
      scheduledSection.classList.add("hidden");
      completedSection.classList.add("hidden");
      servicesSection.classList.add("hidden");
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
  services = [];
  businessHours = [];
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

    resetHistoryPagination();
    renderAppointments();
  });
});

historyDateFilter.addEventListener("change", () => {
  historyDate = historyDateFilter.value;
  historyDateMode = "manual";

  dateFilterButtons.forEach((item) => item.classList.remove("active"));

  resetHistoryPagination();
  renderAppointments();
});

resetHistoryFilters.addEventListener("click", () => {
  historyDate = "";
  historyDateMode = "all";
  historyDateFilter.value = "";

  dateFilterButtons.forEach((item) => {
    item.classList.toggle("active", item.dataset.filter === "all");
  });

  resetHistoryPagination();
  renderAppointments();
});

clearHistoryBtn.addEventListener("click", clearCompletedHistory);
exportScheduledBtn.addEventListener("click", exportScheduledAppointments);
exportHistoryBtn.addEventListener("click", exportHistoryAppointments);
exportBlocksBtn.addEventListener("click", exportBlocks);
serviceForm.addEventListener("submit", saveService);
cancelServiceEditBtn.addEventListener("click", resetServiceForm);
businessHoursForm.addEventListener("submit", saveBusinessHours);

if (adminToken) {
  showPanel();
  loadAll();
} else {
  showLogin();
}