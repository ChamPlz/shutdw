const express = require("express");
const { rateLimit } = require("express-rate-limit");
const path = require("path");

const { loadConfig, setupConfigWatcher } = require("./config");
const { cancelShutdown } = require("./shutdown");
const { createRoutes, PORT } = require("./routes");

// ============================================================================
// CONFIG & STATE
// ============================================================================
const config = loadConfig();
setupConfigWatcher();

// ============================================================================
// EXPRESS SETUP
// ============================================================================
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../web")));
app.use(express.static(path.join(__dirname, "../shared")));

// Rate limits diferenciados por tipo de operação
// Limites mais generosos para melhor UX (app local com proteção por PIN)
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  message: { error: "Muitas requisições, tente novamente em breve." },
  statusCode: 429,
});

const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: "Muitas ações, aguarde antes de tentar novamente." },
  statusCode: 429,
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
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
