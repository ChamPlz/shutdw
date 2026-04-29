const fs = require("fs");
const path = require("path");
const { app } = require("electron");

/**
 * Caminho para o diretório de configuração
 */
const configDir = path.join(app.getPath("userData"), "config");
const configPath = path.join(configDir, "config.json");

/**
 * Configuração padrão
 */
const defaultConfig = {
  pin: null,
  scheduledAt: null,
  autoStart: false,
  useIPv6: false,
  telemetryEnabled: true,
  analyticsClientId: null,
};

/**
 * Cache em memória da configuração
 */
let configCache = null;

/**
 * Garante que o diretório de configuração exista
 */
function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Valida e normaliza a configuração
 * @param {object} config - Configuração para validar
 * @returns {object} Configuração validada
 */
function validateConfig(config) {
  return {
    pin: config.pin ?? null,
    scheduledAt: config.scheduledAt ?? null,
    autoStart: Boolean(config.autoStart),
    useIPv6: Boolean(config.useIPv6),
    telemetryEnabled: config.telemetryEnabled !== false, // default true
    analyticsClientId: config.analyticsClientId ?? null,
  };
}

/**
 * Carrega a configuração do arquivo (com cache em memória)
 * @returns {object} Configuração carregada
 */
function loadConfig() {
  if (configCache) return configCache;

  ensureConfigDir();

  if (!fs.existsSync(configPath)) {
    saveConfig(defaultConfig);
    return { ...defaultConfig };
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    configCache = validateConfig(parsed);
    return configCache;
  } catch (err) {
    console.error("Erro ao ler config.json:", err);
    configCache = { ...defaultConfig };
    return configCache;
  }
}

/**
 * Salva a configuração no arquivo
 * @param {object} config - Configuração para salvar
 */
function saveConfig(config) {
  ensureConfigDir();
  const validatedConfig = validateConfig(config);
  fs.writeFileSync(
    configPath,
    JSON.stringify(validatedConfig, null, 2),
    "utf-8"
  );
  configCache = validatedConfig; // Invalida/atualiza cache
}

module.exports = {
  loadConfig,
  saveConfig,
  defaultConfig,
  configPath,
};
