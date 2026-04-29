const Sentry = require("@sentry/electron/main");
const { app } = require("electron");
const { loadConfig } = require("./config");

let isInitialized = false;

/**
 * Inicializa o Sentry para telemetria anônima
 * Deve ser chamado após o app estar pronto
 */
function initTelemetry() {
  const cfg = loadConfig();
  const dsn = process.env.SENTRY_DSN;

  // Não inicializa se não houver DSN ou usuário desabilitou
  if (!dsn || cfg.telemetryEnabled === false) {
    if (!app.isPackaged) {
      console.log("[Telemetry] Sentry não inicializado:", {
        hasDsn: !!dsn,
        telemetryEnabled: cfg.telemetryEnabled,
      });
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: app.isPackaged ? "production" : "development",
    release: `shutdw@${app.getVersion()}`,
    // Não envia dados pessoais automaticamente
    sendDefaultPii: false,
    // Integrações padrão já são suficientes
  });

  isInitialized = true;

  if (!app.isPackaged) {
    console.log("[Telemetry] Sentry inicializado com sucesso");
  }
}

/**
 * Envia evento de telemetria anônima
 * @param {string} eventName - Nome do evento (ex: "app_started", "shutdown_scheduled")
 * @param {object} properties - Propriedades adicionais (opcional)
 */
function trackEvent(eventName, properties = {}) {
  if (!isInitialized) {
    return;
  }

  Sentry.captureMessage(eventName, {
    level: "info",
    extra: properties,
  });
}

module.exports = { initTelemetry, trackEvent };
