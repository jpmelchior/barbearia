// frontend/script.js

const API_URL = "https://barbearia-ygxt.onrender.com/api";

const form = document.getElementById("appointmentForm");
const daysContainer = document.getElementById("daysContainer");
const timesContainer = document.getElementById("timesContainer");
const message = document.getElementById("message");

const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");

async function loadDays() {
  try {
    const response = await fetch(`${API_URL}/days`);
    const days = await response.json();

    daysContainer.innerHTML = "";

    days.forEach((day) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "day-btn";

      button.innerHTML = `
        <span>${day.weekday}</span>
        <strong>${day.day}/${day.month}</strong>
      `;

      button.addEventListener("click", () => {
        document.querySelectorAll(".day-btn").forEach((btn) => {
          btn.classList.remove("active");
        });

        button.classList.add("active");

        dateInput.value = day.date;
        timeInput.value = "";

        loadTimes(day.date);
      });

      daysContainer.appendChild(button);
    });
  } catch (error) {
    daysContainer.innerHTML = `<p>Erro ao carregar dias.</p>`;
  }
}

async function loadTimes(date) {
  timesContainer.innerHTML = `<p class="empty-text">Carregando horários...</p>`;

  try {
    const response = await fetch(`${API_URL}/times?date=${date}`);
    const data = await response.json();

    timesContainer.innerHTML = "";

    if (!data.times || data.times.length === 0) {
      timesContainer.innerHTML = `
        <p class="empty-text">
          Nenhum horário disponível.
        </p>
      `;
      return;
    }

    data.times.forEach((item) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "time-btn";

      button.textContent = item.time;

      if (!item.available) {
        button.classList.add("disabled");
        button.disabled = true;

        button.title = item.reason || "Horário indisponível";
      }

      button.addEventListener("click", () => {
        document.querySelectorAll(".time-btn").forEach((btn) => {
          btn.classList.remove("active");
        });

        button.classList.add("active");

        timeInput.value = item.time;
      });

      timesContainer.appendChild(button);
    });
  } catch (error) {
    timesContainer.innerHTML = `
      <p class="empty-text">
        Erro ao carregar horários.
      </p>
    `;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const appointment = {
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    service: document.getElementById("service").value,
    date: dateInput.value,
    time: timeInput.value,
  };

  if (
    !appointment.name ||
    !appointment.phone ||
    !appointment.service ||
    !appointment.date ||
    !appointment.time
  ) {
    message.textContent = "Preencha todos os campos.";
    return;
  }

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
      message.textContent = data.error || "Erro ao agendar.";
      return;
    }

    message.textContent = "Agendamento realizado com sucesso!";

    form.reset();

    dateInput.value = "";
    timeInput.value = "";

    timesContainer.innerHTML = `
      <p class="empty-text">
        Escolha um dia primeiro.
      </p>
    `;

    document.querySelectorAll(".day-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

  } catch (error) {
    message.textContent = "Erro ao conectar ao servidor.";
  }
});

loadDays();
