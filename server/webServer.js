const express = require("express");
const { rateLimit } = require("express-rate-limit");
const path = require("path");

const { loadConfig } = require("./config");
const { cancelShutdown } = require("./shutdown");
const { createRoutes, PORT } = require("./routes");

// ============================================================================
// CONFIG & STATE
// ============================================================================
const config = loadConfig();

// ============================================================================
// EXPRESS SETUP
// ============================================================================
const app = express();

// ============================================================================
// SECURITY HEADERS
// ============================================================================
// CSP: Content Security Policy — backup da meta tag no HTML
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:3333; img-src 'self' data: blob:;"
  );
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  next();
});

// CORS restrito: permite apenas localhost (desktop app)
// A interface web remota é servida pelo mesmo servidor, então origin será file:// ou null
// Na prática, para app desktop, o origin é app://localhost ou http://localhost:3333
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ["http://localhost:3333", "app://localhost", "file://"];
  if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed))) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "../web")));
app.use(express.static(path.join(__dirname, "../shared")));

// Rate limits diferenciados por tipo de operação
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  message: { error: "Muitas requisições, tente novamente em breve." },
  statusCode: 429,
});

const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  message: { error: "Muitas ações, aguarde antes de tentar novamente." },
  statusCode: 429,
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  message: { error: "Muitas tentativas de autenticação. Tente novamente em 1 minuto." },
  statusCode: 429,
});

// Aplicar limiters por tipo de rota
app.use("/config/pin", authLimiter);
// Aplica rate limiting diferenciado:
// - GET endpoints: readLimiter (120 req/min) — Leituras de status/config
// - POST/PUT/DELETE endpoints: actionLimiter (20 req/min) — Operações destrutivas (shutdown, schedule, config changes)
// - POST /config/pin: authLimiter (5 req/min) — Aplicado separadamente ANTES deste middleware
app.use((req, res, next) => {
  if (req.method === "GET") return readLimiter(req, res, next);
  return actionLimiter(req, res, next);
});

app.use(createRoutes(config));

// ============================================================================
// EVENTS
// ============================================================================
process.on("cancel-shutdown", () => cancelShutdown(config));

// ============================================================================
// START
// ============================================================================
app.listen(PORT, () => {
  console.log(`Servidor web rodando em http://localhost:${PORT}`);
});

module.exports = app;
