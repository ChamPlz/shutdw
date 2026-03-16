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
