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
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 50,
  message: { error: "Muitas requisições, por favor tente novamente mais tarde." },
  statusCode: 429,
}));

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
