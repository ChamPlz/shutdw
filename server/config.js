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
};

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
  };
}

/**
 * Carrega a configuração do arquivo
 * @returns {object} Configuração carregada
 */
function loadConfig() {
  ensureConfigDir();

  if (!fs.existsSync(configPath)) {
    saveConfig(defaultConfig);
    return { ...defaultConfig };
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    return validateConfig(parsed);
  } catch (err) {
    console.error("Erro ao ler config.json:", err);
    return { ...defaultConfig };
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
}

module.exports = {
  loadConfig,
  saveConfig,
  defaultConfig,
  configPath,
};
