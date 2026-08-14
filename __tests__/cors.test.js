/**
 * Testes para o middleware CORS (BUG-02: acesso IPv6 / same-origin)
 * Garante que a allowlist não bloqueie requisições same-origin
 * e que prefix-matching frouxo seja corrigido (compara exata).
 */

const request = require("supertest");
const express = require("express");
const { createCorsMiddleware } = require("../server/cors");

function buildApp(extraOrigins = []) {
  const app = express();
  app.use(createCorsMiddleware(extraOrigins));
  app.post("/test", (req, res) => res.json({ ok: true }));
  app.get("/test", (req, res) => res.json({ ok: true }));
  return app;
}

describe("CORS middleware — BUG-02", () => {
  test("permite requisição same-origin IPv4 (Origin == Host)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/test")
      .set("Origin", "http://192.168.1.10:3333")
      .set("Host", "192.168.1.10:3333");

    expect(res.status).toBe(200);
  });

  test("permite requisição same-origin IPv6 (Origin == Host com [])", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/test")
      .set("Origin", "http://[fe80::1]:3333")
      .set("Host", "[fe80::1]:3333");

    expect(res.status).toBe(200);
  });

  test("permite origem localhost explícita", async () => {
    const app = buildApp(["http://localhost:3333"]);
    const res = await request(app)
      .post("/test")
      .set("Origin", "http://localhost:3333")
      .set("Host", "localhost:3333");

    expect(res.status).toBe(200);
  });

  test("permite origem da allowlist (IP local detectado)", async () => {
    const app = buildApp(["http://192.168.1.50:3333"]);
    const res = await request(app)
      .post("/test")
      .set("Origin", "http://192.168.1.50:3333")
      .set("Host", "192.168.1.50:3333");

    expect(res.status).toBe(200);
  });

  test("NÃO permite origem com prefixo enganoso (localhost:3333.evil.com)", async () => {
    const app = buildApp(["http://localhost:3333"]);
    const res = await request(app)
      .post("/test")
      .set("Origin", "http://localhost:3333.evil.com")
      .set("Host", "localhost:3333");

    expect(res.status).toBe(403);
  });

  test("NÃO permite origem desconhecida (cross-origin)", async () => {
    const app = buildApp(["http://localhost:3333"]);
    const res = await request(app)
      .post("/test")
      .set("Origin", "http://evil.com")
      .set("Host", "localhost:3333");

    expect(res.status).toBe(403);
  });

  test("permite requisição sem Origin (curl, scripts)", async () => {
    const app = buildApp();
    const res = await request(app).post("/test");

    expect(res.status).toBe(200);
  });

  test("responde preflight OPTIONS com 204", async () => {
    const app = buildApp(["http://localhost:3333"]);
    const res = await request(app)
      .options("/test")
      .set("Origin", "http://localhost:3333")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3333");
  });
});