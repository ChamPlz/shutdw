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
