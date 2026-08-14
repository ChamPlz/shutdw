/**
 * Testes para server/shutdown.js
 * Cobre o BUG-01: timer infinito/overlay travado com timestamp inválido (NaN).
 */

jest.mock("../overlay/overlayWindow", () => ({
  createOverlay: jest.fn(),
  closeOverlay: jest.fn(),
  sendRemaining: jest.fn(),
}));

jest.mock("../server/config", () => ({
  saveConfig: jest.fn(),
}));

jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

jest.mock("../server/platform", () => ({
  cancelSystemShutdown: jest.fn(() => "shutdown /a"),
  shutdownNow: jest.fn(() => "shutdown /s /t 0"),
}));

const { scheduleShutdown, cancelShutdown, restorePendingShutdown } = require("../server/shutdown");
const overlay = require("../overlay/overlayWindow");
const { saveConfig } = require("../server/config");
const { exec } = require("child_process");

describe("shutdown.js — validação de timestamp", () => {
  let config;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    config = { scheduledAt: null };
  });

  afterEach(() => {
    cancelShutdown(config);
    jest.useRealTimers();
  });

  test("scheduleShutdown com timestamp NaN NÃO deve criar overlay nem agendar", () => {
    const result = scheduleShutdown(NaN, config);

    expect(result).toBe(false);
    expect(overlay.createOverlay).not.toHaveBeenCalled();
    expect(overlay.sendRemaining).not.toHaveBeenCalled();
    expect(config.scheduledAt).toBeNull();
    expect(saveConfig).not.toHaveBeenCalled();
  });

  test("scheduleShutdown com timestamp no passado NÃO deve criar overlay", () => {
    const result = scheduleShutdown(Date.now() - 1000, config);

    expect(result).toBe(false);
    expect(overlay.createOverlay).not.toHaveBeenCalled();
    expect(config.scheduledAt).toBeNull();
  });

  test("scheduleShutdown com timestamp futuro DEVE criar overlay e agendar", () => {
    const future = Date.now() + 60000;
    const result = scheduleShutdown(future, config);

    expect(result).toBe(true);
    expect(overlay.createOverlay).toHaveBeenCalled();
    expect(overlay.sendRemaining).toHaveBeenCalled();
    expect(config.scheduledAt).toBe(future);
    expect(saveConfig).toHaveBeenCalled();
  });

  test("scheduleShutdown com NaN NÃO deve cancelar um agendamento ativo existente (regressão)", () => {
    const future = Date.now() + 60000;
    scheduleShutdown(future, config);

    // Agendamento ativo: timer rodando (1 envio inicial + 1 do timer)
    jest.advanceTimersByTime(1000);
    expect(overlay.sendRemaining).toHaveBeenCalledTimes(2);

    const result = scheduleShutdown(NaN, config);

    expect(result).toBe(false);
    // O agendamento original continua ativo:
    expect(config.scheduledAt).toBe(future);
    expect(overlay.createOverlay).toHaveBeenCalledTimes(1);
    // exec de cancelamento do SO foi chamado apenas 1x (pelo agendamento válido, não pelo NaN)
    expect(exec).toHaveBeenCalledTimes(1);
    // O timer continua vivo após o NaN:
    jest.advanceTimersByTime(1000);
    expect(overlay.sendRemaining).toHaveBeenCalledTimes(3);
  });
});

describe("shutdown.js — restauração no boot (BUG-06)", () => {
  let config;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    config = { scheduledAt: null };
  });

  afterEach(() => {
    cancelShutdown(config);
    jest.useRealTimers();
  });

  test("restorePendingShutdown re-agenda quando scheduledAt está no futuro", () => {
    const future = Date.now() + 60000;
    config.scheduledAt = future;

    const restored = restorePendingShutdown(config);

    expect(restored).toBe(true);
    expect(overlay.createOverlay).toHaveBeenCalled();
    expect(config.scheduledAt).toBe(future);
  });

  test("restorePendingShutdown limpa scheduledAt expirado e persiste a config", () => {
    config.scheduledAt = Date.now() - 1000;

    const restored = restorePendingShutdown(config);

    expect(restored).toBe(false);
    expect(config.scheduledAt).toBeNull();
    expect(saveConfig).toHaveBeenCalledWith(config);
    expect(overlay.createOverlay).not.toHaveBeenCalled();
  });

  test("restorePendingShutdown NÃO persiste nem re-agenda quando scheduledAt é null", () => {
    const restored = restorePendingShutdown(config);

    expect(restored).toBe(false);
    expect(saveConfig).not.toHaveBeenCalled();
    expect(overlay.createOverlay).not.toHaveBeenCalled();
  });
});
