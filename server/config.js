const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../data/config.json");

const defaultConfig = {
  pin: "1234",
  scheduledAt: null
};

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(configPath));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

module.exports = { loadConfig, saveConfig };
