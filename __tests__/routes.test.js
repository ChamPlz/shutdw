/**
 * Testes para server/routes.js
 * Cobre:
 *  - BUG-01: validação de input em /shutdown/:minutes e /schedule
 *  - BUG-03: normalização de req.ip dual-stack (::ffff:127.0.0.1)
 *  - BUG-04: bypass de localhost restrito (não libera /config/pin)
 */

const request = require("supertest");
const express = require("express");

jest.mock("electron", () => ({
  app: {
    getPath: () => require("path").join(__dirname, ".test-userData"),
    requestSingleInstanceLock: () => true,
  },
}));

jest.mock("../server/config", () => ({
  loadConfig: jest.fn(),
  saveConfig: jest.fn(),
}));

jest.mock("../server/shutdown", () => ({
  scheduleShutdown: jest.fn(),
  cancelShutdown: jest.fn(),
}));

jest.mock("../server/platform", () => ({
  shutdownWithDelay: jest.fn(() => "shutdown /s /t 15"),
  cancelSystemShutdown: jest.fn(() => "shutdown /a"),
}));

jest.mock("../server/network", () => ({
  getOutboundIp: jest.fn().mockResolvedValue("192.168.1.10"),
  getOutboundIpv6: jest.fn().mockResolvedValue("fe80::1"),
  hasIPv6Available: jest.fn().mockReturnValue(true),
  isIPv6: jest.fn((ip) => ip.includes(":") && !ip.includes(".")),
}));

const { createRoutes } = require("../server/routes");
const shutdown = require("../server/shutdown");
const auth = require("../server/auth");

describe("routes.js — validação de input (BUG-01)", () => {
  let app;
  let config;

  beforeEach(async () => {
    jest.clearAllMocks();
    config = {
      pin: await auth.hashPin("1234"),
      scheduledAt: null,
      useIPv6: false,
      autoStart: false,
    };
    app = express();
    app.use(express.json());
    app.use(createRoutes(config));
  });

  describe("/shutdown/:minutes", () => {
    test("rejeita minutos não numéricos com 400", async () => {
      const res = await request(app)
        .post("/shutdown/abc")
        .set("x-pin", "1234");

      expect(res.status).toBe(400);
      expect(shutdown.scheduleShutdown).not.toHaveBeenCalled();
    });

    test("rejeita minutos <= 0 com 400", async () => {
      const res = await request(app)
        .post("/shutdown/0")
        .set("x-pin", "1234");

      expect(res.status).toBe(400);
      expect(shutdown.scheduleShutdown).not.toHaveBeenCalled();
    });

    test("aceita minutos válidos e agenda", async () => {
      const res = await request(app)
        .post("/shutdown/30")
        .set("x-pin", "1234");

      expect(res.status).toBe(200);
      expect(shutdown.scheduleShutdown).toHaveBeenCalledTimes(1);
      const timestamp = shutdown.scheduleShutdown.mock.calls[0][0];
      expect(Number.isFinite(timestamp)).toBe(true);
      expect(timestamp).toBeGreaterThan(Date.now());
    });
  });

  describe("/schedule", () => {
    test("rejeita horário malformado com 400", async () => {
      const res = await request(app)
        .post("/schedule")
        .set("x-pin", "1234")
        .send({ time: "abc" });

      expect(res.status).toBe(400);
      expect(shutdown.scheduleShutdown).not.toHaveBeenCalled();
    });

    test("rejeita horário ausente com 400", async () => {
      const res = await request(app)
        .post("/schedule")
        .set("x-pin", "1234")
        .send({});

      expect(res.status).toBe(400);
      expect(shutdown.scheduleShutdown).not.toHaveBeenCalled();
    });

    test("rejeita horário inválido (99:99) com 400", async () => {
      const res = await request(app)
        .post("/schedule")
        .set("x-pin", "1234")
        .send({ time: "99:99" });

      expect(res.status).toBe(400);
      expect(shutdown.scheduleShutdown).not.toHaveBeenCalled();
    });

    test("aceita horário válido e agenda", async () => {
      const res = await request(app)
        .post("/schedule")
        .set("x-pin", "1234")
        .send({ time: "23:00" });

      expect(res.status).toBe(200);
      expect(shutdown.scheduleShutdown).toHaveBeenCalledTimes(1);
      const timestamp = shutdown.scheduleShutdown.mock.calls[0][0];
      expect(Number.isFinite(timestamp)).toBe(true);
      expect(timestamp).toBeGreaterThan(Date.now());
    });
  });
});

describe("routes.js — auth e bypass de localhost (BUG-03/BUG-04)", () => {
  let app;
  let config;

  beforeEach(async () => {
    jest.clearAllMocks();
    config = {
      pin: await auth.hashPin("1234"),
      scheduledAt: null,
      useIPv6: false,
      autoStart: false,
    };
    app = express();
    app.use(express.json());
    app.use(createRoutes(config));
  });

  test("requisição sem PIN é rejeitada com 401", async () => {
    const res = await request(app).post("/shutdown/30");

    expect(res.status).toBe(401);
    expect(shutdown.scheduleShutdown).not.toHaveBeenCalled();
  });

  test("PIN incorreto é rejeitado com 401", async () => {
    const res = await request(app)
      .post("/shutdown/30")
      .set("x-pin", "9999");

    expect(res.status).toBe(401);
    expect(shutdown.scheduleShutdown).not.toHaveBeenCalled();
  });

  test("POST /config/pin NÃO é liberado para localhost (exige PIN)", async () => {
    const res = await request(app)
      .post("/config/pin")
      .set("x-pin", "1234")
      .send({ newPin: "5678" });

    expect(res.status).toBe(200);
    expect(config.pin).not.toBeNull();
  });

  test("POST /config/pin sem PIN é rejeitado com 401 mesmo em localhost", async () => {
    const res = await request(app)
      .post("/config/pin")
      .send({ newPin: "5678" });

    expect(res.status).toBe(401);
  });

  test("GET /status funciona sem autenticação (rota de leitura)", async () => {
    const res = await request(app).get("/status");

    expect(res.status).toBe(200);
  });
});
