const { exec } = require("child_process");
const { saveConfig } = require("./config");
const { createOverlay, closeOverlay, sendRemaining } = require("../overlay/overlayWindow");

// ============================================================================
// STATE
// ============================================================================
let shutdownTimer = null;

/**
 * Agenda o desligamento do sistema
 * @param {number} timestamp - Timestamp (ms) para o desligamento
 * @param {object} config - Referência ao objeto de configuração
 */
function scheduleShutdown(timestamp, config) {
  cancelShutdown(config);

  const delay = timestamp - Date.now();
  if (delay <= 0) return;

  createOverlay();

  shutdownTimer = setInterval(() => {
    const remaining = Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
    sendRemaining(remaining);

    if (remaining <= 0) {
      clearInterval(shutdownTimer);
      shutdownTimer = null;
      closeOverlay();
      exec("shutdown /s /t 0");
    }
  }, 1000);

  config.scheduledAt = timestamp;
  saveConfig(config);
}

/**
 * Cancela o desligamento agendado
 * @param {object} config - Referência ao objeto de configuração
 */
function cancelShutdown(config) {
  if (shutdownTimer) {
    clearInterval(shutdownTimer);
    shutdownTimer = null;
  }

  closeOverlay();
  config.scheduledAt = null;
  saveConfig(config);
  exec("shutdown /a");
}

module.exports = {
  scheduleShutdown,
  cancelShutdown,
};
