/**
 * ShutDW - Web App Script
 * Controle de Energia - Interface Web Standalone
 */

// ============================================================================
// CONSTANTS
// ============================================================================
const API_URL = ""; // Relative URL for web server

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const elements = {};

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
  cacheElements();
  loadQRCode();
  checkPinConfigured();
  startStatusPolling();
}

function cacheElements() {
  elements.pin = document.getElementById("pin");
  elements.status = document.getElementById("status");
  elements.timer = document.getElementById("timer");
  elements.statusContainer = document.querySelector(".status-container");
  elements.configStatus = document.getElementById("configStatus");
  elements.pinModal = document.getElementById("pinModal");
  elements.firstPin = document.getElementById("firstPin");
  elements.firstPinConfirm = document.getElementById("firstPinConfirm");
  elements.pinModalMsg = document.getElementById("pinModalMsg");
  elements.timePicker = document.getElementById("timePicker");
  elements.currentPin = document.getElementById("currentPin");
  elements.newPin = document.getElementById("newPin");
  elements.qr = document.getElementById("qr");
  elements.link = document.getElementById("link");
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================
function showTab(tabName) {
  document.querySelectorAll(".tab").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(tab => tab.classList.add("hidden"));

  const activeBtn = document.querySelector(`[onclick="showTab('${tabName}')"]`);
  if (activeBtn) {
    activeBtn.classList.add("active");
  }
  document.getElementById(tabName)?.classList.remove("hidden");
}

// ============================================================================
// API COMMUNICATION
// ============================================================================
async function apiRequest(route, options = {}) {
  const response = await fetch(`${API_URL}${route}`, options);
  return response.json();
}

function send(route) {
  apiRequest(route, {
    method: "POST",
    headers: { "x-pin": elements.pin?.value }
  })
    .then(data => {
      showStatus(data.status || data.error, !!data.error);
    })
    .catch(() => {
      showStatus("Erro de conexão", true);
    });
}

// ============================================================================
// STATUS DISPLAY
// ============================================================================
function showStatus(message, isError = false) {
  if (!elements.statusContainer || !elements.status) return;

  elements.statusContainer.classList.remove("hidden");
  elements.status.textContent = message;
  elements.status.className = isError
    ? "status-message error"
    : "status-message success";
}

function updateTimer(remaining) {
  if (!elements.timer) return;

  if (remaining == null || remaining <= 0) {
    elements.timer.textContent = "";
    elements.statusContainer?.classList.add("hidden");
    return;
  }

  elements.statusContainer?.classList.remove("hidden");
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  elements.timer.textContent = `⏱️ ${minutes}m ${seconds}s restantes`;
  elements.timer.className = 'status-timer active';
}

function startStatusPolling() {
  setInterval(() => {
    apiRequest("/status")
      .then(data => updateTimer(data.remaining))
      .catch(() => {
        elements.timer.textContent = "";
      });
  }, 1000);
}

// ============================================================================
// SHUTDOWN ACTIONS
// ============================================================================
function scheduleExact() {
  const timeValue = elements.timePicker?.value;

  if (!timeValue) {
    showStatus("Por favor, selecione um horário", true);
    return;
  }

  apiRequest("/schedule", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pin": elements.pin?.value
    },
    body: JSON.stringify({ time: timeValue })
  })
    .then(data => {
      showStatus(data.status || data.error, !!data.error);
    })
    .catch(() => {
      showStatus("Erro de conexão", true);
    });
}

// ============================================================================
// PIN MANAGEMENT
// ============================================================================
function savePin() {
  const currentPin = elements.currentPin?.value;
  const newPin = elements.newPin?.value;

  if (!currentPin || !newPin) {
    showConfigStatus("Preencha todos os campos", true);
    return;
  }

  apiRequest("/config/pin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pin": currentPin
    },
    body: JSON.stringify({ newPin })
  })
    .then(data => {
      showConfigStatus(data.status || data.error, !!data.error);
      if (!data.error) {
        if (elements.currentPin) elements.currentPin.value = "";
        if (elements.newPin) elements.newPin.value = "";
      }
    })
    .catch(() => {
      showConfigStatus("Erro de conexão", true);
    });
}

function showConfigStatus(message, isError = false) {
  if (!elements.configStatus) return;
  elements.configStatus.textContent = message;
  elements.configStatus.className = isError
    ? "status-message error"
    : "status-message success";
}

// ============================================================================
// FIRST-TIME PIN MODAL
// ============================================================================
function showPinModal() {
  if (elements.pinModal) {
    elements.pinModal.classList.remove("hidden");
  }
}

function hidePinModal() {
  if (elements.pinModal) {
    elements.pinModal.classList.add("hidden");
  }
}

function createFirstPin() {
  const pin = elements.firstPin?.value;
  const confirm = elements.firstPinConfirm?.value;
  const msg = elements.pinModalMsg;

  if (!pin || pin.length < 4) {
    if (msg) msg.textContent = "PIN precisa ter ao menos 4 caracteres";
    return;
  }

  if (pin !== confirm) {
    if (msg) msg.textContent = "PIN e confirmação não conferem";
    return;
  }

  apiRequest("/config/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPin: pin })
  })
    .then(data => {
      if (data.error) {
        if (msg) msg.textContent = data.error;
        return;
      }
      if (msg) {
        msg.textContent = data.status || "PIN criado com sucesso";
      }
      setTimeout(hidePinModal, 900);
    })
    .catch(() => {
      if (msg) msg.textContent = "Erro de conexão";
    });
}

function checkPinConfigured() {
  // Adiciona timestamp para evitar cache da requisição
  apiRequest(`/config/pin?t=${Date.now()}`)
    .then(data => {
      console.log("[checkPinConfigured] PIN configurado:", data.configured);
      if (!data.configured) {
        showPinModal();
      } else {
        // Garante que o modal esteja escondido se PIN já existe
        hidePinModal();
      }
    })
    .catch(err => {
      console.error("Erro ao verificar PIN:", err);
      // Em caso de erro, esconde o modal para não bloquear o usuário
      hidePinModal();
    });
}

// ============================================================================
// QR CODE
// ============================================================================
function loadQRCode() {
  apiRequest("/ip")
    .then(data => {
      const url = data.url;

      if (elements.qr) {
        elements.qr.src =
          "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
          encodeURIComponent(url);
      }

      if (elements.link) {
        elements.link.href = url;
        elements.link.textContent = url;
      }
    })
    .catch(() => {
      if (elements.link) {
        elements.link.textContent = "Erro ao carregar";
      }
    });
}

// ============================================================================
// GLOBAL EXPOSED FUNCTIONS
// ============================================================================
window.showTab = showTab;
window.send = send;
window.scheduleExact = scheduleExact;
window.savePin = savePin;
window.createFirstPin = createFirstPin;

// ============================================================================
// START APP
// ============================================================================
document.addEventListener("DOMContentLoaded", init);
