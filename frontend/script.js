const API_URL = "https://barbearia-ygxt.onrender.com/api";

const form = document.getElementById("appointmentForm");
const daysContainer = document.getElementById("daysContainer");
const timesContainer = document.getElementById("timesContainer");
const message = document.getElementById("message");

const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");

let currentPage = 0;
const DAYS_PER_PAGE = 15;

function formatISODate(date) {
  return date.toISOString().split("T")[0];
}

function formatWeekday(date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    timeZone: "America/Sao_Paulo"
  });
}

function createPaginationControls() {
  const oldControls = document.querySelector(".pagination-controls");

  if (oldControls) {
    oldControls.remove();
  }

  const controls = document.createElement("div");
  controls.className = "pagination-controls";

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "pagination-btn";
  prevButton.textContent = "← Dias anteriores";

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "pagination-btn";
  nextButton.textContent = "Próximos dias →";

  if (currentPage === 0) {
    prevButton.disabled = true;
    prevButton.classList.add("disabled");
  }

  prevButton.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage--;
      generateDays();
      resetSelectedTime();
    }
  });

  nextButton.addEventListener("click", () => {
    currentPage++;
    generateDays();
    resetSelectedTime();
  });

  controls.appendChild(prevButton);
  controls.appendChild(nextButton);

  daysContainer.after(controls);
}

function resetSelectedTime() {
  dateInput.value = "";
  timeInput.value = "";

  timesContainer.innerHTML = `
    <p class="empty-text">Escolha um dia primeiro.</p>
  `;
}

function generateDays() {
  daysContainer.innerHTML = "";

  const oldControls = document.querySelector(".pagination-controls");

  if (oldControls) {
    oldControls.remove();
  }

  const today = new Date();
  const startIndex = currentPage * DAYS_PER_PAGE;

  let added = 0;
  let index = startIndex;

  while (added < DAYS_PER_PAGE) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const dayOfWeek = date.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dateString = formatISODate(date);

      const weekday = formatWeekday(date).replace(".", "");
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "day-btn";

      button.innerHTML = `
        <span>${weekday}</span>
        <strong>${day}/${month}</strong>
      `;

      button.addEventListener("click", () => {
        document.querySelectorAll(".day-btn").forEach((btn) => {
          btn.classList.remove("active");
        });

        button.classList.add("active");

        dateInput.value = dateString;
        timeInput.value = "";

        loadTimes(dateString);
      });

      daysContainer.appendChild(button);

      added++;
    }

    index++;
  }

  createPaginationControls();
}

async function loadTimes(date) {
  timesContainer.innerHTML = `
    <p class="empty-text">Carregando horários...</p>
  `;

  message.textContent = "";

  try {
    const response = await fetch(`${API_URL}/times?date=${date}`);
    const data = await response.json();

    timesContainer.innerHTML = "";

    const times = data.times || data.available || [];

    if (!times.length) {
      timesContainer.innerHTML = `
        <p class="empty-text">Nenhum horário disponível para este dia.</p>
      `;
      return;
    }

    times.forEach((item) => {
      let time = item;
      let available = true;
      let reason = "Horário indisponível";

      if (typeof item === "object") {
        time = item.time;
        available = item.available;
        reason = item.reason || "Horário indisponível";
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "time-btn";

      if (available) {
        button.innerHTML = `
          <strong>${time}</strong>
          <span>Disponível</span>
        `;
      } else {
        button.innerHTML = `
          <strong>${time}</strong>
          <span>${reason}</span>
        `;

        button.disabled = true;
        button.classList.add("disabled");
      }

      button.addEventListener("click", () => {
        if (!available) return;

        document.querySelectorAll(".time-btn").forEach((btn) => {
          btn.classList.remove("active");
        });

        button.classList.add("active");
        timeInput.value = time;
      });

      timesContainer.appendChild(button);
    });
  } catch (error) {
    timesContainer.innerHTML = `
      <p class="empty-text">Erro ao carregar horários.</p>
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
    time: timeInput.value
  };

  if (
    !appointment.name ||
    !appointment.phone ||
    !appointment.service ||
    !appointment.date ||
    !appointment.time
  ) {
    message.textContent = "Preencha todos os campos e escolha dia e horário.";
    return;
  }

  message.textContent = "Confirmando agendamento...";

  try {
    const response = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(appointment)
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

    document.querySelectorAll(".day-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    timesContainer.innerHTML = `
      <p class="empty-text">Escolha um dia primeiro.</p>
    `;
  } catch (error) {
    message.textContent = "Erro ao conectar ao servidor.";
  }
});

generateDays();
