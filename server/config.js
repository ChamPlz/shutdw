const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const configDir = path.join(app.getPath("userData"), "config");
const configPath = path.join(configDir, "config.json");

const defaultConfig = {
  pin: null,
  scheduledAt: null,
  autoStart: false
};

function loadConfig() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(defaultConfig, null, 2),
      "utf-8"
    );
    return defaultConfig;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    console.error("Erro ao ler config.json:", err);
    return defaultConfig;
  }
}

function saveConfig(config) {
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2),
    "utf-8"
  );
}

module.exports = { loadConfig, saveConfig };
