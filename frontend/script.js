const API_URL = "https://barbearia-ygxt.onrender.com/api";

const dateInput = document.getElementById("date");
const timeSelect = document.getElementById("time");
const form = document.getElementById("appointmentForm");
const message = document.getElementById("message");

const today = new Date().toISOString().split("T")[0];
dateInput.min = today;

timeSelect.innerHTML = `<option value="">Escolha uma data primeiro</option>`;

dateInput.addEventListener("change", async () => {
  const selectedDate = dateInput.value;

  timeSelect.innerHTML = `<option value="">Carregando horários...</option>`;
  message.textContent = "";

  if (!selectedDate) {
    timeSelect.innerHTML = `<option value="">Escolha uma data primeiro</option>`;
    return;
  }

  try {
    const response = await fetch(`${API_URL}/times?date=${selectedDate}`);
    const data = await response.json();

    timeSelect.innerHTML = "";

    if (!data.available || data.available.length === 0) {
      timeSelect.innerHTML = `<option value="">Nenhum horário disponível</option>`;
      message.style.color = "#ffcc00";
      message.textContent = data.message || "Nenhum horário disponível para esta data.";
      return;
    }

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Selecione um horário";
    timeSelect.appendChild(defaultOption);

    data.available.forEach((time) => {
      const option = document.createElement("option");
      option.value = time;
      option.textContent = time;
      timeSelect.appendChild(option);
    });
  } catch (error) {
    timeSelect.innerHTML = `<option value="">Erro ao buscar horários</option>`;
    message.style.color = "#ff5c5c";
    message.textContent = "Erro ao conectar com o servidor.";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const appointment = {
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    service: document.getElementById("service").value,
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
  };

  if (
    !appointment.name ||
    !appointment.phone ||
    !appointment.service ||
    !appointment.date ||
    !appointment.time
  ) {
    message.style.color = "#ff5c5c";
    message.textContent = "Preencha todos os campos antes de agendar.";
    return;
  }

  message.style.color = "#ffffff";
  message.textContent = "Confirmando agendamento...";

  try {
    const response = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(appointment),
    });

    const data = await response.json();

    if (!response.ok) {
      message.style.color = "#ff5c5c";
      message.textContent = data.error || "Erro ao agendar.";
      return;
    }

    message.style.color = "#4dff88";
    message.textContent = "Agendamento confirmado com sucesso!";

    form.reset();
    timeSelect.innerHTML = `<option value="">Escolha uma data primeiro</option>`;
  } catch (error) {
    message.style.color = "#ff5c5c";
    message.textContent = "Erro de conexão com o servidor.";
  }
});
