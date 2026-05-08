const API_URL = "https://barbearia-ygxt.onrender.com/api";

const loginArea = document.getElementById("loginArea");
const adminArea = document.getElementById("adminArea");
const loginMessage = document.getElementById("loginMessage");
const appointmentsList = document.getElementById("appointmentsList");
const blocksList = document.getElementById("blocksList");

function getAuthHeader() {
  const user = localStorage.getItem("adminUser");
  const password = localStorage.getItem("adminPassword");

  return "Basic " + btoa(`${user}:${password}`);
}

async function loginAdmin() {
  const user = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  if (!user || !password) {
    loginMessage.textContent = "Preencha usuário e senha.";
    return;
  }

  localStorage.setItem("adminUser", user);
  localStorage.setItem("adminPassword", password);

  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader()
      }
    });

    const data = await response.json();

    if (!response.ok) {
      loginMessage.textContent = data.error || "Login inválido.";
      localStorage.removeItem("adminUser");
      localStorage.removeItem("adminPassword");
      return;
    }

    loginArea.style.display = "none";
    adminArea.style.display = "block";

    loadAppointments();
    loadBlocks();
  } catch (error) {
    loginMessage.textContent = "Erro ao conectar com o servidor.";
  }
}

function logoutAdmin() {
  localStorage.removeItem("adminUser");
  localStorage.removeItem("adminPassword");
  location.reload();
}

async function loadAppointments() {
  appointmentsList.innerHTML = "Carregando...";

  try {
    const response = await fetch(`${API_URL}/admin/appointments`, {
      headers: {
        Authorization: getAuthHeader()
      }
    });

    const appointments = await response.json();

    if (!response.ok) {
      appointmentsList.innerHTML = "Erro ao carregar agendamentos.";
      return;
    }

    if (appointments.length === 0) {
      appointmentsList.innerHTML = "<p>Nenhum agendamento encontrado.</p>";
      return;
    }

    appointmentsList.innerHTML = appointments.map((item) => `
      <div class="admin-item">
        <strong>${item.date} - ${item.time}</strong>
        <p>Cliente: ${item.name}</p>
        <p>Telefone: ${item.phone}</p>
        <p>Serviço: ${item.service}</p>
        <button onclick="cancelAppointment(${item.id})">Cancelar</button>
      </div>
    `).join("");
  } catch (error) {
    appointmentsList.innerHTML = "Erro de conexão.";
  }
}

async function cancelAppointment(id) {
  const confirmCancel = confirm("Deseja cancelar este agendamento?");

  if (!confirmCancel) return;

  await fetch(`${API_URL}/admin/appointments/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: getAuthHeader()
    }
  });

  loadAppointments();
}

async function createBlock() {
  const date = document.getElementById("blockDate").value;
  const time = document.getElementById("blockTime").value;
  const reason = document.getElementById("blockReason").value.trim();

  if (!date) {
    alert("Escolha uma data.");
    return;
  }

  const response = await fetch(`${API_URL}/admin/blocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader()
    },
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

  document.getElementById("blockDate").value = "";
  document.getElementById("blockTime").value = "";
  document.getElementById("blockReason").value = "";

  loadBlocks();
}

async function loadBlocks() {
  blocksList.innerHTML = "Carregando bloqueios...";

  try {
    const response = await fetch(`${API_URL}/admin/blocks`, {
      headers: {
        Authorization: getAuthHeader()
      }
    });

    const blocks = await response.json();

    if (!response.ok) {
      blocksList.innerHTML = "Erro ao carregar bloqueios.";
      return;
    }

    if (blocks.length === 0) {
      blocksList.innerHTML = "<p>Nenhum bloqueio ativo.</p>";
      return;
    }

    blocksList.innerHTML = blocks.map((item) => `
      <div class="admin-item">
        <strong>${item.date} ${item.time ? "- " + item.time : "- Dia inteiro"}</strong>
        <p>Motivo: ${item.reason || "Indisponível"}</p>
        <button onclick="deleteBlock(${item.id})">Remover bloqueio</button>
      </div>
    `).join("");
  } catch (error) {
    blocksList.innerHTML = "Erro de conexão.";
  }
}

async function deleteBlock(id) {
  const confirmDelete = confirm("Deseja remover este bloqueio?");

  if (!confirmDelete) return;

  await fetch(`${API_URL}/admin/blocks/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: getAuthHeader()
    }
  });

  loadBlocks();
}

if (localStorage.getItem("adminUser") && localStorage.getItem("adminPassword")) {
  loginArea.style.display = "none";
  adminArea.style.display = "block";
  loadAppointments();
  loadBlocks();
}
