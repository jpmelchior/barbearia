const API_URL = "https://barbearia-ygxt.onrender.com/api";

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const loginMessage = document.getElementById("loginMessage");

const appointmentsList = document.getElementById("appointmentsList");
const blocksList = document.getElementById("blocksList");

const appointmentsCount = document.getElementById("appointmentsCount");
const blocksCount = document.getElementById("blocksCount");

const blockForm = document.getElementById("blockForm");

function getAuth() {
  const user = localStorage.getItem("admin_user");
  const password = localStorage.getItem("admin_password");

  if (!user || !password) return null;

  return "Basic " + btoa(`${user}:${password}`);
}

function showDashboard() {
  loginSection.style.display = "none";
  dashboardSection.style.display = "block";
}

function showLogin() {
  loginSection.style.display = "block";
  dashboardSection.style.display = "none";
}

async function login() {
  const user = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  if (!user || !password) {
    loginMessage.textContent = "Preencha usuário e senha.";
    return;
  }

  const auth = "Basic " + btoa(`${user}:${password}`);

  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: {
        Authorization: auth
      }
    });

    const data = await response.json();

    if (!response.ok) {
      loginMessage.textContent = data.error || "Erro no login.";
      return;
    }

    localStorage.setItem("admin_user", user);
    localStorage.setItem("admin_password", password);

    showDashboard();

    loadAppointments();
    loadBlocks();

  } catch (error) {
    loginMessage.textContent = "Erro ao conectar.";
  }
}

async function loadAppointments() {
  appointmentsList.innerHTML = "Carregando...";

  try {
    const response = await fetch(`${API_URL}/admin/appointments`, {
      headers: {
        Authorization: getAuth()
      }
    });

    const data = await response.json();

    appointmentsList.innerHTML = "";

    appointmentsCount.textContent = data.length;

    if (!data.length) {
      appointmentsList.innerHTML = `
        <p class="empty-text">
          Nenhum agendamento encontrado.
        </p>
      `;
      return;
    }

    data.forEach((appointment) => {
      const item = document.createElement("div");

      item.className = "admin-card";

      item.innerHTML = `
        <div class="admin-card-top">
          <strong>${appointment.service}</strong>
          <span>${appointment.date}</span>
        </div>

        <div class="admin-card-content">
          <p><b>Cliente:</b> ${appointment.name}</p>
          <p><b>WhatsApp:</b> ${appointment.phone}</p>
          <p><b>Horário:</b> ${appointment.time}</p>
        </div>

        <button class="danger-btn">
          Cancelar horário
        </button>
      `;

      const button = item.querySelector("button");

      button.addEventListener("click", async () => {
        if (!confirm("Cancelar esse agendamento?")) return;

        await fetch(`${API_URL}/admin/appointments/${appointment.id}`, {
          method: "DELETE",
          headers: {
            Authorization: getAuth()
          }
        });

        loadAppointments();
      });

      appointmentsList.appendChild(item);
    });

  } catch (error) {
    appointmentsList.innerHTML = `
      <p class="empty-text">
        Erro ao carregar agendamentos.
      </p>
    `;
  }
}

async function loadBlocks() {
  blocksList.innerHTML = "Carregando...";

  try {
    const response = await fetch(`${API_URL}/admin/blocks`, {
      headers: {
        Authorization: getAuth()
      }
    });

    const data = await response.json();

    blocksList.innerHTML = "";

    blocksCount.textContent = data.length;

    if (!data.length) {
      blocksList.innerHTML = `
        <p class="empty-text">
          Nenhum bloqueio encontrado.
        </p>
      `;
      return;
    }

    data.forEach((block) => {
      const item = document.createElement("div");

      item.className = "admin-card";

      item.innerHTML = `
        <div class="admin-card-top">
          <strong>${block.date}</strong>
          <span>${block.time || "Dia inteiro"}</span>
        </div>

        <div class="admin-card-content">
          <p><b>Motivo:</b> ${block.reason}</p>
        </div>

        <button class="danger-btn">
          Remover bloqueio
        </button>
      `;

      const button = item.querySelector("button");

      button.addEventListener("click", async () => {
        if (!confirm("Remover bloqueio?")) return;

        await fetch(`${API_URL}/admin/blocks/${block.id}`, {
          method: "DELETE",
          headers: {
            Authorization: getAuth()
          }
        });

        loadBlocks();
      });

      blocksList.appendChild(item);
    });

  } catch (error) {
    blocksList.innerHTML = `
      <p class="empty-text">
        Erro ao carregar bloqueios.
      </p>
    `;
  }
}

blockForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const date = document.getElementById("blockDate").value;
  const time = document.getElementById("blockTime").value;
  const reason = document.getElementById("blockReason").value.trim();

  if (!date || !reason) {
    alert("Preencha os campos.");
    return;
  }

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

  blockForm.reset();

  loadBlocks();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("admin_user");
  localStorage.removeItem("admin_password");

  showLogin();
});

loginBtn.addEventListener("click", login);

if (getAuth()) {
  showDashboard();
  loadAppointments();
  loadBlocks();
} else {
  showLogin();
}
