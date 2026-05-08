const API_URL = "https://barbearia-ygxt.onrender.com/api";

const form = document.getElementById("appointmentForm");
const daysContainer = document.getElementById("daysContainer");
const timesContainer = document.getElementById("timesContainer");
const message = document.getElementById("message");

const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");

let selectedDate = "";
let selectedTime = "";

function formatDateBR(dateString) {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}`;
}

function getWeekdayName(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString("pt-BR", { weekday: "long" });
}

function generateDays(quantity = 30) {
  daysContainer.innerHTML = "";

  const today = new Date();
  let added = 0;
  let index = 0;

  while (added < quantity) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const day = date.getDay();

    if (day !== 0 && day !== 6) {
      const dateString = date.toISOString().split("T")[0];

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${getWeekdayName(dateString)} ${formatDateBR(dateString)}`;
      button.dataset.date = dateString;

      button.addEventListener("click", () => {
        document.querySelectorAll("#daysContainer button").forEach(btn => {
          btn.classList.remove("active");
        });

        button.classList.add("active");

        selectedDate = dateString;
        selectedTime = "";

        dateInput.value = selectedDate;
        timeInput.value = "";

        loadTimes(selectedDate);
      });

      daysContainer.appendChild(button);
      added++;
    }

    index++;
  }
}

async function loadTimes(date) {
  timesContainer.innerHTML = "<p>Carregando horários...</p>";
  message.textContent = "";

  try {
    const response = await fetch(`${API_URL}/times?date=${date}`);
    const data = await response.json();

    timesContainer.innerHTML = "";

    if (!data.available || data.available.length === 0) {
      timesContainer.innerHTML = "<p>Nenhum horário disponível para este dia.</p>";
      return;
    }

    data.available.forEach(time => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = time;
      button.dataset.time = time;

      button.addEventListener("click", () => {
        document.querySelectorAll("#timesContainer button").forEach(btn => {
          btn.classList.remove("active");
        });

        button.classList.add("active");

        selectedTime = time;
        timeInput.value = selectedTime;
      });

      timesContainer.appendChild(button);
    });
  } catch (error) {
    timesContainer.innerHTML = "<p>Erro ao carregar horários.</p>";
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

  if (!appointment.name || !appointment.phone || !appointment.service || !appointment.date || !appointment.time) {
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

    message.textContent = "Agendamento confirmado com sucesso!";

    form.reset();
    selectedDate = "";
    selectedTime = "";
    dateInput.value = "";
    timeInput.value = "";

    document.querySelectorAll("#daysContainer button").forEach(btn => btn.classList.remove("active"));
    timesContainer.innerHTML = "";

    generateDays();
  } catch (error) {
    message.textContent = "Erro ao conectar com o servidor.";
  }
});

generateDays();
