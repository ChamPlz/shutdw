const { exec } = require("child_process");
const { saveConfig } = require("./config");
const { createOverlay, closeOverlay, sendRemaining } = require("../overlay/overlayWindow");
const platform = require("./platform");

// ============================================================================
// STATE
// ============================================================================
let shutdownTimer = null;
let shutdownVersion = 0;

function cancelSystemShutdown(config) {
  return new Promise((resolve) => {
    exec(platform.cancelSystemShutdown(), { timeout: config.execTimeout }, (err) => {
      if (err && err.killed) console.warn("Comando de cancelamento de shutdown timeout");
      resolve();
    });
  });
}

/**
 * Agenda o desligamento do sistema
 * @param {number} timestamp - Timestamp (ms) para o desligamento
 * @param {object} config - Referência ao objeto de configuração
 */
async function scheduleShutdown(timestamp, config) {
  shutdownVersion += 1;
  const currentVersion = shutdownVersion;

  if (shutdownTimer) {
    clearInterval(shutdownTimer);
    shutdownTimer = null;
  }

  await cancelSystemShutdown(config);

  if (currentVersion !== shutdownVersion) return;

  const delay = timestamp - Date.now();
  if (delay <= 0) return;

  createOverlay();

  const initialRemaining = Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
  sendRemaining(initialRemaining);

  shutdownTimer = setInterval(() => {
    if (currentVersion !== shutdownVersion) {
      clearInterval(shutdownTimer);
      shutdownTimer = null;
      return;
    }

    const remaining = Math.floor((timestamp - Date.now()) / 1000);

    if (remaining <= 0) {
      clearInterval(shutdownTimer);
      shutdownTimer = null;
      closeOverlay();
      exec(platform.shutdownNow(), (err) => {
        if (err) {
          console.error("Falha ao executar shutdown:", err);
          return;
        }
        config.scheduledAt = null;
        saveConfig(config);
      });
      return;
    }

    sendRemaining(remaining);
  }, 1000);

  config.scheduledAt = timestamp;
  saveConfig(config);
}

/**
 * Cancela o desligamento agendado
 * @param {object} config - Referência ao objeto de configuração
 */
async function cancelShutdown(config) {
  shutdownVersion += 1;
  const currentVersion = shutdownVersion;

  if (shutdownTimer) {
    clearInterval(shutdownTimer);
    shutdownTimer = null;
  }

  closeOverlay();
  config.scheduledAt = null;
  saveConfig(config);
  await cancelSystemShutdown(config);

  if (currentVersion !== shutdownVersion) return;
}

module.exports = {
  scheduleShutdown,
  cancelShutdown,
};
