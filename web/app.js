/**
 * ShutDW — Web App Script
 * Usa shared/api.js para funções compartilhadas
 */

// ============================================================================
// CONSTANTS
// ============================================================================
const API_URL = ""; // Relative URL — servido pelo próprio Express

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const el = {};

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
  cacheElements();
  loadQRCode(API_URL, el.qr, el.link, (url) => window.open(url, "_blank"));
  checkPinConfigured();
  startStatusPolling(API_URL, el.timer, el.statusContainer);
}

function cacheElements() {
  const $ = (id) => document.getElementById(id);
  el.pin = $("pin");
  el.status = $("status");
  el.timer = $("timer");
  el.statusContainer = document.querySelector(".status-container");
  el.configStatus = $("configStatus");
  el.pinModal = $("pinModal");
  el.firstPin = $("firstPin");
  el.firstPinConfirm = $("firstPinConfirm");
  el.pinModalMsg = $("pinModalMsg");
  el.timePicker = $("timePicker");
  el.currentPin = $("currentPin");
  el.newPin = $("newPin");
  el.qr = $("qr");
  el.link = $("link");

  // Configurar validação e proteção de inputs de PIN
  const pinInputs = [el.pin, el.firstPin, el.firstPinConfirm, el.currentPin, el.newPin];
  pinInputs.forEach(setupPinValidation);
}

/**
 * Configura validação e proteção contra ataques em um input de PIN
 * @param {HTMLInputElement} input - Elemento input de PIN
 */
function setupPinValidation(input) {
  if (!input) return;

  // Permite apenas dígitos durante a digitação
  input.addEventListener("input", (e) => {
    const original = input.value;
    // Remove qualquer caractere não numérico
    const numericOnly = original.replace(/\D/g, "");
    if (original !== numericOnly) {
      input.value = numericOnly;
    }
    // Limita comprimento máximo
    if (input.value.length > 20) {
      input.value = input.value.slice(0, 20);
    }
  });

  // Validação no blur - limpa se inválido
  input.addEventListener("blur", () => {
    validatePinInput(input);
  });

  // Validação no ENTER
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      validatePinInput(input);
    }
  });

  // Bloqueia colagem (paste) maliciosa
  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text");
    // Extrai apenas dígitos
    const numericOnly = pasted.replace(/\D/g, "");
    if (numericOnly) {
      input.value = numericOnly.slice(0, 20);
      // Dispara input para atualizar estado
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

/**
 * Valida um input de PIN e fornece feedback visual
 * @param {HTMLInputElement} input - Elemento input de PIN
 */
function validatePinInput(input) {
  const value = input.value;
  if (!value || value.length >= 4) {
    input.classList.remove("invalid");
    input.classList.add("valid");
  } else {
    input.classList.remove("valid");
    input.classList.add("invalid");
  }
}

// ============================================================================
// STATUS HELPERS
// ============================================================================
function displayStatus(message, isError = false) {
  showStatus(el.statusContainer, el.status, message, isError);
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================
function send(route) {
  sendAction(API_URL, route, el.pin?.value, displayStatus);
}

function handleScheduleExact() {
  scheduleExactTime(API_URL, el.timePicker, el.pin?.value, displayStatus);
}

function handleSavePin() {
  savePinChange(API_URL, el.currentPin, el.newPin, el.configStatus);
}

function handleCreateFirstPin() {
  createInitialPin(API_URL, el.firstPin, el.firstPinConfirm, el.pinModalMsg, () => {
    el.pinModal?.classList.add("hidden");
  });
}

// ============================================================================
// PIN CHECK
// ============================================================================
function checkPinConfigured() {
  apiRequest(API_URL, `/config/pin?t=${Date.now()}`)
    .then(data => {
      if (!data.configured) {
        el.pinModal?.classList.remove("hidden");
      } else {
        el.pinModal?.classList.add("hidden");
      }
    })
    .catch(() => {
      el.pinModal?.classList.add("hidden");
    });
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================
window.showTab = (tabName) => switchTab(tabName, ".tab");
window.send = send;
window.scheduleExact = handleScheduleExact;
window.savePin = handleSavePin;
window.createFirstPin = handleCreateFirstPin;

// ============================================================================
// START
// ============================================================================
document.addEventListener("DOMContentLoaded", init);
