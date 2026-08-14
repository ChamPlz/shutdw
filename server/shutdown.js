const { exec } = require("child_process");
const { saveConfig } = require("./config");
const { createOverlay, closeOverlay, sendRemaining } = require("../overlay/overlayWindow");
const platform = require("./platform");
const { EXEC_TIMEOUT } = require("../shared/constants");

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
  // Valida o timestamp ANTES de tocar no timer ativo ou cancelar o shutdown do SO,
  // para que um timestamp inválido/não-futuro NÃO destrua um agendamento existente.
  const delay = timestamp - Date.now();
  if (!Number.isFinite(delay) || delay <= 0) return false;

  // Limpa o timer atual se existir, mas NÃO fecha o overlay para reaproveitá-lo
  if (shutdownTimer) {
    clearInterval(shutdownTimer);
    shutdownTimer = null;
  }

  // Tenta cancelar algum desligamento do SO pendente
  exec(platform.cancelSystemShutdown(), { timeout: EXEC_TIMEOUT }, (err) => {
    if (err && err.killed) console.warn("Comando de cancelamento de shutdown timeout");
  });

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
  return true;
}

/**
 * Restaura um agendamento pendente após reinício do app.
 * Re-agenda o desligamento se `scheduledAt` estiver no futuro.
 * @param {object} config - Referência ao objeto de configuração
 * @returns {boolean} True se um agendamento pendente foi restaurado
 */
function restorePendingShutdown(config) {
  const scheduledAt = config.scheduledAt;
  if (typeof scheduledAt !== "number" || !Number.isFinite(scheduledAt)) {
    return false;
  }
  if (scheduledAt <= Date.now()) {
    // Timestamp expirado: limpa o agendamento fantasma para o /status não reportar
    // um agendamento pendente que nunca vai acontecer.
    config.scheduledAt = null;
    saveConfig(config);
    return false;
  }
  return scheduleShutdown(scheduledAt, config);
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
  restorePendingShutdown,
};
