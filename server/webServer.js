const express = require("express");
const { rateLimit } = require("express-rate-limit");
const path = require("path");

const { loadConfig } = require("./config");
const { cancelShutdown } = require("./shutdown");
const { createRoutes } = require("./routes");
const { createLogger } = require("../logger");
const {
  PORT,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_READ_MAX,
  RATE_LIMIT_ACTION_MAX,
  RATE_LIMIT_AUTH_MAX,
  CORS_ALLOWED_ORIGINS,
  CORS_PREFLIGHT_MAX_AGE,
  GRACEFUL_SHUTDOWN_TIMEOUT,
} = require("../shared/constants");

// Logger com contexto "server"
const logger = createLogger("server");

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
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  // Permissions-Policy: bloqueia APIs sensíveis (geolocation, microphone, camera, etc)
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()");
  next();
});

// CORS restrito: permite apenas localhost (desktop app)
// A interface web remota é servida pelo mesmo servidor, então origin será file:// ou null
// Na prática, para app desktop, o origin é app://localhost ou http://localhost:3333

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Rejeitar origins não permitidas
  if (origin && !CORS_ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
    logger.warn("CORS blocked — origin not allowed", { origin });
    return res.status(403).json({ error: "Origin not allowed" });
  }

  // Resposta para preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Pin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", CORS_PREFLIGHT_MAX_AGE);
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    return res.status(204).end();
  }

  // Headers para requisições reais
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

app.use(express.json());

// Logging middleware — log todas requisições (sem bodies por segurança)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };
    if (res.statusCode >= 500) {
      logger.error("Request error", logData);
    } else if (res.statusCode >= 400) {
      logger.warn("Request warning", logData);
    } else {
      logger.info("Request handled", logData);
    }
  });
  next();
});

app.use(express.static(path.join(__dirname, "../web")));
app.use(express.static(path.join(__dirname, "../shared")));

// Rate limits diferenciados por tipo de operação
const readLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_READ_MAX,
  message: { error: "Muitas requisições, tente novamente em breve." },
  statusCode: 429,
});

const actionLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_ACTION_MAX,
  message: { error: "Muitas ações, aguarde antes de tentar novamente." },
  statusCode: 429,
});

const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_AUTH_MAX,
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

// Error handlers globais para o processo do servidor
process.on("uncaughtException", (err) => {
  logger.error("Server uncaughtException", {
    error: err.message,
    stack: err.stack
  });
  setTimeout(() => process.exit(1), 100);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Server unhandledRejection", {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: String(promise)
  });
  setTimeout(() => process.exit(1), 100);
});

// ============================================================================
// START
// ============================================================================
// Error handler — captura erros não tratados nas rotas
app.use((err, req, res, next) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ error: "Erro interno do servidor" });
});

app.listen(PORT, () => {
  logger.info("Servidor web iniciado", { port: PORT, url: `http://localhost:${PORT}` });
});

/**
 * Graceful shutdown — para o servidor sem perder conexões ativas
 * @param {number} [timeout] — Tempo máximo de espera em ms
 */
function gracefulShutdown(timeout = GRACEFUL_SHUTDOWN_TIMEOUT) {
  logger.info("Iniciando graceful shutdown", { timeout });

  const server = app;
  const deadline = Date.now() + timeout;

  return new Promise((resolve) => {
    // Contador de conexões ativas
    let activeConnections = 0;
    let connectionsDone = false;
    let forceExitTimer = null;

    const checkDone = () => {
      if (connectionsDone) {
        if (forceExitTimer) clearInterval(forceExitTimer);
        logger.info("Servidor Express fechado — toutes les connexions drainées");
        resolve();
      }
    };

    // Agora fechamos o servidor (server.close) fecha após conexões acabarem
    logger.info("Parando de aceitar novas conexões");
    server.close(() => {
      connectionsDone = true;
      checkDone();
    });

    // Monitorar conexões entrantes/saindo
    server.on("connection", (socket) => {
      activeConnections++;
      logger.info("Nova conexão estabelecida", { total: activeConnections });

      socket.on("close", () => {
        activeConnections = Math.max(0, activeConnections - 1);
        logger.info("Conexão finalizada", { remaining: activeConnections });
        if (activeConnections === 0 && connectionsDone) {
          checkDone();
        }
      });
    });

    // Timeout: forçar shutdown se demorar muito
    forceExitTimer = setInterval(() => {
      if (Date.now() >= deadline) {
        logger.error("Forçando shutdown — timeout excedido", {
          activeConnections,
          elapsed: Date.now() - (Date.now() - timeout)
        });
        if (forceExitTimer) clearInterval(forceExitTimer);
        process.exit(1);
      }
    }, 100);

    // Garantir cleanup em qualquer erro
    server.on("error", (err) => {
      logger.error("Erro no servidor durante graceful shutdown", { error: err.message });
      if (forceExitTimer) clearInterval(forceExitTimer);
    });
  });
}

// Handlers de sinal para graceful shutdown
app.on("SIGTERM", async () => {
  logger.info("Sinal SIGTERM recebido — iniciando graceful shutdown");
  await gracefulShutdown();
  logger.info("Shutdown completo — saindo");
  process.exit(0);
});

app.on("SIGINT", async () => {
  logger.info("Sinal SIGINT recebido — iniciando graceful shutdown");
  await gracefulShutdown();
  logger.info("Shutdown completo — saindo");
  process.exit(0);
});

module.exports = app;
