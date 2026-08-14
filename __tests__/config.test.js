/**
 * Testes para server/config.js
 * Cobre o bug de cache de configuração: loadConfig/saveConfig devem
 * preservar a MESMA referência de objeto para todos os callers,
 * para que /status sempre reflita o scheduledAt mais recente.
 */

const fs = require("fs");
const path = require("path");

const mockUserDataDir = path.join(__dirname, ".test-userData-config");

jest.mock("electron", () => ({
  app: {
    getPath: () => mockUserDataDir,
  },
}));

describe("config.js — cache de configuração (referência estável)", () => {
  let config;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.rmSync(mockUserDataDir, { recursive: true, force: true });
    jest.resetModules();
    config = require("../server/config");
  });

  afterEach(() => {
    fs.rmSync(mockUserDataDir, { recursive: true, force: true });
  });

  test("loadConfig no primeiro uso retorna a MESMA referência em chamadas subsequentes", () => {
    const first = config.loadConfig();
    const second = config.loadConfig();

    expect(second).toBe(first);
  });

  test("saveConfig preserva a referência do objeto retornado por loadConfig", () => {
    const cfg = config.loadConfig();
    cfg.scheduledAt = 1234567890;

    config.saveConfig(cfg);

    const reloaded = config.loadConfig();
    expect(reloaded).toBe(cfg);
    expect(reloaded.scheduledAt).toBe(1234567890);
  });

  test("mudanças salvas por um caller são visíveis no objeto de outro caller", () => {
    const webServerConfig = config.loadConfig();
    const trayConfig = config.loadConfig();

    trayConfig.scheduledAt = 1234567890;
    config.saveConfig(trayConfig);

    expect(webServerConfig).toBe(trayConfig);
    expect(webServerConfig.scheduledAt).toBe(1234567890);
  });

  test("saveConfig persiste os valores atualizados no arquivo", () => {
    const cfg = config.loadConfig();
    cfg.pin = "hash-do-pin";
    cfg.autoStart = true;

    config.saveConfig(cfg);

    const content = JSON.parse(fs.readFileSync(config.configPath, "utf-8"));
    expect(content.pin).toBe("hash-do-pin");
    expect(content.autoStart).toBe(true);
  });
});