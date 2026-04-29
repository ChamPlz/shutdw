/**
 * ShutDW — Renderer Script (Desktop)
 * Usa shared/api.js para funções compartilhadas
 */

// ============================================================================
// CONSTANTS
// ============================================================================
const API_URL = "http://localhost:3333";

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const el = {};

// ============================================================================
// POLLING CLEANUP
// ============================================================================
let statusPollingCleanup = null;

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
  cacheElements();
  setupAutoStart();
  setupIPv6Settings();
  setupTelemetry();
  setupAbout();
  loadQRCode(API_URL, el.qr, el.link, (url) => window.api?.openExternal(url));
  checkPinConfigured();
  statusPollingCleanup = startStatusPolling(API_URL, el.timer, el.statusCard);
}

function cacheElements() {
  const $ = (id) => document.getElementById(id);
  el.pinInput = $("pin");
  el.status = $("status");
  el.statusCard = $("statuscard");
  el.timer = $("timer");
  el.configStatus = $("configStatus");
  el.pinModal = $("pinModal");
  el.firstPin = $("firstPin");
  el.firstPinConfirm = $("firstPinConfirm");
  el.pinModalMsg = $("pinModalMsg");
  el.timePicker = $("timePicker");
  el.currentPin = $("currentPin");
  el.newPin = $("newPin");
  el.ipv6Message = $("ipv6Message");
  el.ipv6Toggle = $("ipv6Toggle");
  el.ipv6ToggleContainer = $("ipv6ToggleContainer");
  el.ipv6StatusText = $("ipv6StatusText");
  el.telemetryToggle = $("telemetryToggle");
  el.qrLocalBtn = $("qrLocalBtn");
  el.qrRemotoBtn = $("qrRemotoBtn");
  el.qrLocalContent = $("qrLocalContent");
  el.qrRemotoContent = $("qrRemotoContent");
  el.qr = $("qr");
  el.qrIpv6 = $("qr-ipv6");
  el.link = $("link");
  el.ipv6Link = $("ipv6Link");
  // About / Updates
  el.appVersion = $("appVersion");
  el.updateMessage = $("updateMessage");
  el.updateProgress = $("updateProgress");
  el.updateProgressBar = $("updateProgressBar");
  el.updatePercent = $("updatePercent");
  el.btnCheckUpdate = $("btnCheckUpdate");
  el.btnInstallUpdate = $("btnInstallUpdate");
}

// ============================================================================
// STATUS HELPERS (delegam para shared/api.js)
// ============================================================================
function displayStatus(message, isError = false) {
  showStatus(el.statusCard, el.status, message, isError);
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================
function send(route) {
  sendAction(API_URL, route, el.pinInput.value, displayStatus);
}

function handleScheduleExact() {
  scheduleExactTime(API_URL, el.timePicker, el.pinInput.value, displayStatus);
}

function handleSavePin() {
  savePinChange(API_URL, el.currentPin, el.newPin, el.configStatus);
}

function handleCreateFirstPin() {
  createInitialPin(API_URL, el.firstPin, el.firstPinConfirm, el.pinModalMsg, () => {
    el.pinModal?.classList.add("hidden");
  });
}

async function resetPinDesktop() {
  const newPin = el.newPin?.value;
  if (!newPin || newPin.length < 4) {
    showConfigStatus(el.configStatus, "Novo PIN precisa ter ao menos 4 caracteres", true);
    return;
  }
  if (!window.api?.resetPin) {
    showConfigStatus(el.configStatus, "Funcionalidade disponível somente no cliente desktop", true);
    return;
  }
  try {
    const result = await window.api.resetPin(newPin);
    showConfigStatus(el.configStatus, result.status || "PIN redefinido com sucesso", !!result.error);
    if (!result.error) {
      if (el.currentPin) el.currentPin.value = "";
      if (el.newPin) el.newPin.value = "";
    }
  } catch {
    showConfigStatus(el.configStatus, "Erro ao redefinir PIN", true);
  }
}

// ============================================================================
// PIN CHECK
// ============================================================================
let pinCheckPromise = null;

function checkPinConfigured() {
  if (!pinCheckPromise) {
    pinCheckPromise = apiRequest(API_URL, "/config/pin")
      .then(data => {
        if (!data.configured) {
          el.pinModal?.classList.remove("hidden");
          const closeBtn = document.querySelector(".close-btn");
          if (closeBtn) {
            closeBtn.disabled = true;
            closeBtn.style.opacity = "0.5";
            closeBtn.style.cursor = "not-allowed";
          }
        } else {
          if (el.pinModal) el.pinModal.style.display = "none";
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
        pinCheckPromise = null;
      });
  }
  return pinCheckPromise;
}

// ============================================================================
// AUTO-START
// ============================================================================
function setupAutoStart() {
  window.api?.checkAutoStart().then(isEnabled => {
    const checkbox = document.getElementById("cb3-8");
    if (checkbox) checkbox.checked = isEnabled;
  });
}

// ============================================================================
// TELEMETRY
// ============================================================================
function setupTelemetry() {
  window.api?.checkTelemetry().then(isEnabled => {
    const checkbox = document.getElementById("telemetryToggle");
    if (checkbox) checkbox.checked = isEnabled;
  });
}

// ============================================================================
// IPv6 SETTINGS
// ============================================================================
function setupIPv6Settings() {
  apiRequest(API_URL, "/config/ipv6-available")
    .then(data => {
      if (!el.ipv6Message) return;

      if (data.available) {
        el.ipv6Message.textContent = "IPv6 está disponível na sua rede";
        el.ipv6Message.style.color = "#27ae60";
        el.ipv6ToggleContainer?.style.setProperty("display", "flex");
        if (el.ipv6Toggle) el.ipv6Toggle.checked = data.enabled;
        if (el.ipv6StatusText) {
          el.ipv6StatusText.textContent = data.enabled
            ? "✓ IPv6 habilitado - acesso disponível"
            : "IPv6 desabilitado - sem acesso remoto via IPv6";
        }
        if (data.enabled) loadIPv6Link();
      } else {
        el.ipv6Message.textContent = "IPv6 não está disponível na sua rede";
        el.ipv6Message.style.color = "#e74c3c";
        if (el.ipv6ToggleContainer) el.ipv6ToggleContainer.style.display = "none";
        if (el.ipv6StatusText) el.ipv6StatusText.textContent = "Seu dispositivo não tem suporte a IPv6";
      }
    })
    .catch(() => {
      if (el.ipv6Message) {
        el.ipv6Message.textContent = "Erro ao verificar IPv6";
        el.ipv6Message.style.color = "#e74c3c";
      }
    });
}

function toggleIPv6(enabled) {
  apiRequest(API_URL, "/config/ipv6", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ useIPv6: enabled }),
  })
    .then(data => {
      if (data.error) {
        if (el.ipv6StatusText) {
          el.ipv6StatusText.textContent = "Erro ao atualizar preferência de IPv6";
          el.ipv6StatusText.style.color = "#e74c3c";
        }
      } else {
        if (el.ipv6StatusText) {
          el.ipv6StatusText.textContent = data.useIPv6
            ? "✓ IPv6 habilitado - acesso disponível"
            : "IPv6 desabilitado - sem acesso remoto via IPv6";
          el.ipv6StatusText.style.color = "#27ae60";
        }
        loadIPv6Link();
      }
    })
    .catch(() => {
      if (el.ipv6StatusText) {
        el.ipv6StatusText.textContent = "Erro de conexão";
        el.ipv6StatusText.style.color = "#e74c3c";
      }
    });
}

function loadIPv6Link() {
  apiRequest(API_URL, "/ip6")
    .then(data => {
      if (!el.qrRemotoBtn) return;
      if (!data.url) {
        el.qrRemotoBtn.style.display = "none";
        return;
      }
      el.qrRemotoBtn.style.display = "inline-block";
      if (el.qrIpv6) {
        el.qrIpv6.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(data.url)}`;
      }
      if (el.ipv6Link) {
        el.ipv6Link.href = "#";
        el.ipv6Link.textContent = data.url;
        el.ipv6Link.style.cursor = "pointer";
        el.ipv6Link.onclick = (e) => {
          e.preventDefault();
          window.api?.openExternal(data.url);
        };
      }
    })
    .catch(() => {
      if (el.qrRemotoBtn) el.qrRemotoBtn.style.display = "none";
    });
}

// ============================================================================
// QR TOGGLE
// ============================================================================
function showQRCode(mode) {
  if (mode === "local") {
    el.qrLocalBtn?.classList.add("active");
    el.qrRemotoBtn?.classList.remove("active");
    if (el.qrLocalContent) el.qrLocalContent.style.display = "flex";
    if (el.qrRemotoContent) el.qrRemotoContent.style.display = "none";
  } else if (mode === "remoto") {
    el.qrLocalBtn?.classList.remove("active");
    el.qrRemotoBtn?.classList.add("active");
    if (el.qrLocalContent) el.qrLocalContent.style.display = "none";
    if (el.qrRemotoContent) el.qrRemotoContent.style.display = "flex";
  }
}

// ============================================================================
// ABOUT / UPDATES
// ============================================================================
function setupAbout() {
  // Exibir versão
  window.api?.getVersion().then(version => {
    if (el.appVersion) el.appVersion.textContent = `v${version}`;
  });

  // Listener de eventos de atualização
  window.api?.onUpdateEvent((data) => {
    switch (data.event) {
      case "checking":
        setUpdateMessage("Verificando atualizações...");
        if (el.btnCheckUpdate) el.btnCheckUpdate.disabled = true;
        break;

      case "available":
        setUpdateMessage(`Nova versão ${data.version} encontrada! Baixando...`);
        showProgress(true);
        break;

      case "not-available":
        setUpdateMessage("✓ Você está na versão mais recente!");
        if (el.btnCheckUpdate) el.btnCheckUpdate.disabled = false;
        break;

      case "progress":
        updateProgress(data.percent);
        break;

      case "downloaded":
        setUpdateMessage(`Versão ${data.version} baixada e pronta para instalar!`);
        showProgress(false);
        if (el.btnCheckUpdate) el.btnCheckUpdate.style.display = "none";
        if (el.btnInstallUpdate) el.btnInstallUpdate.style.display = "inline-flex";
        break;

      case "error":
        setUpdateMessage(`Erro ao verificar: ${data.message}`);
        if (el.btnCheckUpdate) el.btnCheckUpdate.disabled = false;
        showProgress(false);
        break;
    }
  });
}

function setUpdateMessage(msg) {
  if (el.updateMessage) el.updateMessage.textContent = msg;
}

function showProgress(show) {
  if (el.updateProgress) el.updateProgress.style.display = show ? "block" : "none";
}

function updateProgress(percent) {
  if (el.updateProgressBar) el.updateProgressBar.style.width = `${percent}%`;
  if (el.updatePercent) el.updatePercent.textContent = `${percent}%`;
}

function checkForUpdates() {
  if (!window.api?.checkForUpdates) {
    setUpdateMessage("Indisponível neste ambiente");
    return;
  }
  window.api.checkForUpdates().then(result => {
    if (result.status === "dev") {
      setUpdateMessage(result.message);
    }
  });
}

function installUpdate() {
  setUpdateMessage("Instalando e reiniciando...");
  window.api?.installUpdate();
}

// ============================================================================
// GLOBAL EXPORTS (para onclick no HTML)
// ============================================================================
window.showTab = (tabName) => {
  // Tratar aba About (usa display flex para centralizar)
  const aboutPanel = document.getElementById("about");
  if (aboutPanel) {
    aboutPanel.style.display = tabName === "about" ? "flex" : "none";
  }
  switchTab(tabName, ".nav-item");
};
window.send = send;
window.scheduleExact = handleScheduleExact;
window.savePin = handleSavePin;
window.resetPinDesktop = resetPinDesktop;
window.createFirstPin = handleCreateFirstPin;
window.showQRCode = showQRCode;
window.toggleIPv6 = toggleIPv6;
window.checkForUpdates = checkForUpdates;
window.installUpdate = installUpdate;

// ============================================================================
// START
// ============================================================================
document.addEventListener("DOMContentLoaded", init);
