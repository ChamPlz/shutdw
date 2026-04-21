const { exec } = require("child_process");
const { saveConfig } = require("./config");
const { createOverlay, closeOverlay, sendRemaining } = require("../overlay/overlayWindow");
const platform = require("./platform");

const EXEC_TIMEOUT = 5000; // 5 segundos

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
  // Limpa o timer atual se existir, mas NÃO fecha o overlay para reaproveitá-lo
  if (shutdownTimer) {
    clearInterval(shutdownTimer);
    shutdownTimer = null;
  }
  
  // Tenta cancelar algum desligamento do SO pendente
  exec(platform.cancelSystemShutdown(), { timeout: EXEC_TIMEOUT }, (err) => {
    if (err && err.killed) console.warn("Comando de cancelamento de shutdown timeout");
  });

  const delay = timestamp - Date.now();
  if (delay <= 0) return;

  createOverlay();

  // Envia o tempo imediatamente para não ter delay visual
  const initialRemaining = Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
  sendRemaining(initialRemaining);

  shutdownTimer = setInterval(() => {
    const remaining = Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
    sendRemaining(remaining);

    if (remaining <= 0) {
      clearInterval(shutdownTimer);
      shutdownTimer = null;
      closeOverlay();
      config.scheduledAt = null;
      saveConfig(config);
      exec(platform.shutdownNow());
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
  exec(platform.cancelSystemShutdown(), { timeout: EXEC_TIMEOUT }, (err) => {
    if (err && err.killed) console.warn("Comando de cancelamento de shutdown timeout");
  });
}

module.exports = {
  scheduleShutdown,
  cancelShutdown,
};
