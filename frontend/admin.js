// frontend/admin.js

const API_URL = "https://barbearia-ygxt.onrender.com/api";

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");

const loginMessage = document.getElementById("loginMessage");

const appointmentsList = document.getElementById("appointmentsList");
const blocksList = document.getElementById("blocksList");

const appointmentsCount = document.getElementById("appointmentsCount");
const blocksCount = document.getElementById("blocksCount");

const blockForm = document.getElementById("blockForm");

function getAuth() {
  const user = sessionStorage.getItem("admin_user");
  const password = sessionStorage.getItem("admin_password");

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

async function login() {
  const user = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  if (!user || !password) {
    setLoginMessage("Preencha usuário e senha.", "error");
    return;
  }

  const auth = "Basic " + btoa(`${user}:${password}`);
  const loginButton = loginForm.querySelector(".submit-btn");

  setLoginMessage("Entrando...");
  loginButton.disabled = true;

  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: {
        Authorization: auth
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setLoginMessage(data.error || "Erro no login.", "error");
      return;
    }

    sessionStorage.setItem("admin_user", user);
    sessionStorage.setItem("admin_password", password);

    setLoginMessage("");
    showDashboard();

    loadAppointments();
    loadBlocks();
  } catch (error) {
    setLoginMessage("Erro ao conectar.", "error");
  } finally {
    loginButton.disabled = false;
  }
}

async function loadAppointments() {
  setListMessage(appointmentsList, "Carregando...");

  try {
    const response = await fetch(`${API_URL}/admin/appointments`, {
      headers: {
        Authorization: getAuth()
      }
    });

    if (handleUnauthorized(response)) return;

    if (!response.ok) {
      throw new Error("Erro ao carregar agendamentos.");
    }

    const parsedData = await response.json();
    const data = Array.isArray(parsedData) ? parsedData : [];

    appointmentsList.innerHTML = "";
    appointmentsCount.textContent = data.length;

    if (!data.length) {
      setListMessage(appointmentsList, "Nenhum agendamento encontrado.");
      return;
    }

    data.forEach((appointment) => {
      const item = document.createElement("article");
      item.className = "admin-card";

      const top = document.createElement("div");
      top.className = "admin-card-top";

      const service = document.createElement("strong");
      service.textContent = appointment.service || "Serviço";

      const date = document.createElement("span");
      date.textContent = appointment.date || "-";

      const content = document.createElement("div");
      content.className = "admin-card-content";
      content.appendChild(createInfoLine("Cliente", appointment.name));
      content.appendChild(createInfoLine("WhatsApp", appointment.phone));
      content.appendChild(createInfoLine("Horário", appointment.time));

      const button = document.createElement("button");
      button.type = "button";
      button.className = "danger-btn";
      button.textContent = "Cancelar horário";

      button.addEventListener("click", async () => {
        if (!confirm("Cancelar esse agendamento?")) return;

        button.disabled = true;

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
      });

      top.appendChild(service);
      top.appendChild(date);

      item.appendChild(top);
      item.appendChild(content);
      item.appendChild(button);

      appointmentsList.appendChild(item);
    });
  } catch (error) {
    setListMessage(appointmentsList, "Erro ao carregar agendamentos.");
  }
}

async function loadBlocks() {
  setListMessage(blocksList, "Carregando...");

  try {
    const response = await fetch(`${API_URL}/admin/blocks`, {
      headers: {
        Authorization: getAuth()
      }
    });

    if (handleUnauthorized(response)) return;

    if (!response.ok) {
      throw new Error("Erro ao carregar bloqueios.");
    }

    const parsedData = await response.json();
    const data = Array.isArray(parsedData) ? parsedData : [];

    blocksList.innerHTML = "";
    blocksCount.textContent = data.length;

    if (!data.length) {
      setListMessage(blocksList, "Nenhum bloqueio encontrado.");
      return;
    }

    data.forEach((block) => {
      const item = document.createElement("article");
      item.className = "admin-card";

      const top = document.createElement("div");
      top.className = "admin-card-top";

      const date = document.createElement("strong");
      date.textContent = block.date || "-";

      const time = document.createElement("span");
      time.textContent = block.time || "Dia inteiro";

      const content = document.createElement("div");
      content.className = "admin-card-content";
      content.appendChild(createInfoLine("Motivo", block.reason));

      const button = document.createElement("button");
      button.type = "button";
      button.className = "danger-btn";
      button.textContent = "Remover bloqueio";

      button.addEventListener("click", async () => {
        if (!confirm("Remover bloqueio?")) return;

        button.disabled = true;

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
  }
}

blockForm.addEventListener("submit", async (event) => {
  event.preventDefault();

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

    if (!response.ok) {
      alert("Erro ao criar bloqueio.");
      return;
    }

    blockForm.reset();
    loadBlocks();
  } catch (error) {
    alert("Erro ao conectar.");
  } finally {
    submitButton.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => {
  clearAuth();
  showLogin();
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login();
});

if (getAuth()) {
  showDashboard();
  loadAppointments();
  loadBlocks();
} else {
  showLogin();
}
