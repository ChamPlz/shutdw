/**
 * ShutDW - Renderer Script
 * Controle de Energia - Interface Desktop
 */

// ============================================================================
// CONSTANTS
// ============================================================================
const API_URL = "http://localhost:3333";

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const elements = {
  pinInput: null,
  status: null,
  statusCard: null,
  timer: null,
  configStatus: null,
  pinModal: null,
  firstPin: null,
  firstPinConfirm: null,
  pinModalMsg: null,
  timePicker: null,
  currentPin: null,
  newPin: null,
  ipv6Message: null,
  ipv6Toggle: null,
  ipv6ToggleContainer: null,
  ipv6StatusText: null,
  qrLocalBtn: null,
  qrRemotoBtn: null,
  qrLocalContent: null,
  qrRemotoContent: null,
  qr: null,
  qrIpv6: null,
  link: null,
  ipv6Link: null,
};

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
  cacheElements();
  setupAutoStart();
  setupIPv6Settings();
  loadQRCode();
  checkPinConfigured();
  startStatusPolling();
}

function cacheElements() {
  elements.pinInput = document.getElementById("pin");
  elements.status = document.getElementById("status");
  elements.statusCard = document.getElementById("statuscard");
  elements.timer = document.getElementById("timer");
  elements.configStatus = document.getElementById("configStatus");
  elements.pinModal = document.getElementById("pinModal");
  elements.firstPin = document.getElementById("firstPin");
  elements.firstPinConfirm = document.getElementById("firstPinConfirm");
  elements.pinModalMsg = document.getElementById("pinModalMsg");
  elements.timePicker = document.getElementById("timePicker");
  elements.currentPin = document.getElementById("currentPin");
  elements.newPin = document.getElementById("newPin");
  elements.ipv6Message = document.getElementById("ipv6Message");
  elements.ipv6Toggle = document.getElementById("ipv6Toggle");
  elements.ipv6ToggleContainer = document.getElementById("ipv6ToggleContainer");
  elements.ipv6StatusText = document.getElementById("ipv6StatusText");
  elements.qrLocalBtn = document.getElementById("qrLocalBtn");
  elements.qrRemotoBtn = document.getElementById("qrRemotoBtn");
  elements.qrLocalContent = document.getElementById("qrLocalContent");
  elements.qrRemotoContent = document.getElementById("qrRemotoContent");
  elements.qr = document.getElementById("qr");
  elements.qrIpv6 = document.getElementById("qr-ipv6");
  elements.link = document.getElementById("link");
  elements.ipv6Link = document.getElementById("ipv6Link");
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================
function showTab(tabName) {
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
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
    headers: { "x-pin": elements.pinInput.value }
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
  if (!elements.statusCard || !elements.status) return;

  elements.statusCard.classList.remove("hidden");
  elements.status.textContent = message;
  elements.status.className = isError
    ? "status-message error"
    : "status-message success";
}

function hideStatus() {
  if (!elements.statusCard) return;
  elements.statusCard.classList.add("hidden");
}

function updateTimer(remaining) {
  if (!elements.timer) return;

  if (remaining == null || remaining <= 0) {
    elements.timer.textContent = "";
    elements.timer.classList.add("hidden");
    hideStatus();
    return;
  }

  elements.statusCard?.classList.remove("hidden");
  elements.timer.classList.remove("hidden");

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  elements.timer.textContent = `⏱️ ${minutes}m ${seconds}s restantes`;
}

function startStatusPolling() {
  setInterval(() => {
    apiRequest("/status")
      .then(data => updateTimer(data.remaining))
      .catch(() => {
        elements.timer.textContent = "";
        elements.timer.classList.add("hidden");
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
      "x-pin": elements.pinInput.value
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

async function resetPinDesktop() {
  const newPin = elements.newPin?.value;

  if (!newPin || newPin.length < 4) {
    showConfigStatus("Novo PIN precisa ter ao menos 4 caracteres", true);
    return;
  }

  if (!window.api?.resetPin) {
    showConfigStatus("Funcionalidade disponível somente no cliente desktop", true);
    return;
  }

  try {
    const result = await window.api.resetPin(newPin);
    showConfigStatus(result.status || "PIN redefinido com sucesso", !!result.error);
    if (!result.error) {
      if (elements.currentPin) elements.currentPin.value = "";
      if (elements.newPin) elements.newPin.value = "";
    }
  } catch {
    showConfigStatus("Erro ao redefinir PIN", true);
  }
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
  elements.pinModal?.classList.remove("hidden");
}

function hidePinModal() {
  elements.pinModal?.classList.add("hidden");
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
  apiRequest("/config/pin")
    .then(data => {
      if (!data.configured) {
        showPinModal();
        const closeBtn = document.querySelector(".close-btn");
        if (closeBtn) {
          closeBtn.disabled = true;
          closeBtn.style.opacity = "0.5";
          closeBtn.style.cursor = "not-allowed";
        }
      } else {
        elements.pinModal.style.display = "none";
      }
    })
    .catch(() => {})
    .finally(() => {
      const closeBtn = document.querySelector(".close-btn");
      if (closeBtn) {
        closeBtn.disabled = false;
        closeBtn.style.opacity = "1";
        closeBtn.style.cursor = "pointer";
      }
    });
}

// ============================================================================
// AUTO-START
// ============================================================================
function setupAutoStart() {
  window.api?.checkAutoStart().then(isEnabled => {
    const checkbox = document.getElementById("cb3-8");
    if (checkbox) {
      checkbox.checked = isEnabled;
    }
  });
}

// ============================================================================
// IPv6 SETTINGS
// ============================================================================
function setupIPv6Settings() {
  apiRequest("/config/ipv6-available")
    .then(data => {
      const message = elements.ipv6Message;
      const toggleContainer = elements.ipv6ToggleContainer;
      const toggle = elements.ipv6Toggle;
      const statusText = elements.ipv6StatusText;

      if (!message) return;

      if (data.available) {
        message.textContent = "IPv6 está disponível na sua rede";
        message.style.color = "#27ae60";
        toggleContainer?.style.setProperty("display", "flex");
        if (toggle) {
          toggle.checked = data.enabled;
        }
        if (statusText) {
          statusText.textContent = data.enabled
            ? "✓ IPv6 habilitado - acesso disponível"
            : "IPv6 desabilitado - sem acesso remoto via IPv6";
        }
        if (data.enabled) {
          loadIPv6Link();
        }
      } else {
        message.textContent = "IPv6 não está disponível na sua rede";
        message.style.color = "#e74c3c";
        if (toggleContainer) {
          toggleContainer.style.display = "none";
        }
        if (statusText) {
          statusText.textContent = "Seu dispositivo não tem suporte a IPv6";
        }
      }
    })
    .catch(() => {
      if (elements.ipv6Message) {
        elements.ipv6Message.textContent = "Erro ao verificar IPv6";
        elements.ipv6Message.style.color = "#e74c3c";
      }
    });
}

function toggleIPv6(enabled) {
  apiRequest("/config/ipv6", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ useIPv6: enabled })
  })
    .then(data => {
      const statusText = elements.ipv6StatusText;
      if (data.error) {
        if (statusText) {
          statusText.textContent = "Erro ao atualizar preferência de IPv6";
          statusText.style.color = "#e74c3c";
        }
      } else {
        if (statusText) {
          statusText.textContent = data.useIPv6
            ? "✓ IPv6 habilitado - acesso disponível"
            : "IPv6 desabilitado - sem acesso remoto via IPv6";
          statusText.style.color = "#27ae60";
        }
        loadIPv6Link();
      }
    })
    .catch(() => {
      if (elements.ipv6StatusText) {
        elements.ipv6StatusText.textContent = "Erro de conexão";
        elements.ipv6StatusText.style.color = "#e74c3c";
      }
    });
}

// ============================================================================
// QR CODE
// ============================================================================
function loadQRCode() {
  apiRequest("/ip")
    .then(data => {
      const qrUrl = data.url;

      if (elements.qr) {
        elements.qr.src =
          "https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=" +
          encodeURIComponent(qrUrl);
      }

      if (elements.link) {
        elements.link.href = "#";
        elements.link.textContent = qrUrl;
        elements.link.style.cursor = "pointer";
        elements.link.onclick = (e) => {
          e.preventDefault();
          if (window.api?.openExternal) {
            window.api.openExternal(qrUrl);
          } else {
            console.error("API não disponível");
          }
        };
      }
    })
    .catch(() => {
      if (elements.link) {
        elements.link.textContent = "Erro ao carregar";
      }
    });
}

function loadIPv6Link() {
  apiRequest("/ip6")
    .then(data => {
      if (!elements.qrRemotoBtn) return;

      if (!data.url) {
        elements.qrRemotoBtn.style.display = "none";
        return;
      }

      elements.qrRemotoBtn.style.display = "inline-block";

      if (elements.qrIpv6) {
        elements.qrIpv6.src =
          "https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=" +
          encodeURIComponent(data.url);
      }

      if (elements.ipv6Link) {
        elements.ipv6Link.href = "#";
        elements.ipv6Link.textContent = data.url;
        elements.ipv6Link.style.cursor = "pointer";
        elements.ipv6Link.onclick = (e) => {
          e.preventDefault();
          if (window.api?.openExternal) {
            window.api.openExternal(data.url);
          } else {
            console.error("API não disponível");
          }
        };
      }
    })
    .catch(() => {
      if (elements.qrRemotoBtn) {
        elements.qrRemotoBtn.style.display = "none";
      }
    });
}

function showQRCode(mode) {
  const localBtn = elements.qrLocalBtn;
  const remotoBtn = elements.qrRemotoBtn;
  const localContent = elements.qrLocalContent;
  const remotoContent = elements.qrRemotoContent;

  if (mode === "local") {
    localBtn?.classList.add("active");
    remotoBtn?.classList.remove("active");
    if (localContent) localContent.style.display = "flex";
    if (remotoContent) remotoContent.style.display = "none";
  } else if (mode === "remoto") {
    localBtn?.classList.remove("active");
    remotoBtn?.classList.add("active");
    if (localContent) localContent.style.display = "none";
    if (remotoContent) remotoContent.style.display = "flex";
  }
}

// ============================================================================
// GLOBAL EXPOSED FUNCTIONS
// ============================================================================
window.showTab = showTab;
window.send = send;
window.scheduleExact = scheduleExact;
window.savePin = savePin;
window.resetPinDesktop = resetPinDesktop;
window.createFirstPin = createFirstPin;
window.showQRCode = showQRCode;
window.toggleIPv6 = toggleIPv6;

// ============================================================================
// START APP
// ============================================================================
document.addEventListener("DOMContentLoaded", init);
