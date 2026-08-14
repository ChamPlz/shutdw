const express = require("express");
const { rateLimit } = require("express-rate-limit");
const path = require("path");

const { loadConfig } = require("./config");
const { cancelShutdown, restorePendingShutdown } = require("./shutdown");
const { createRoutes } = require("./routes");
const { createLogger } = require("../logger");
const {
  PORT,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_READ_MAX,
  RATE_LIMIT_ACTION_MAX,
  RATE_LIMIT_AUTH_MAX,
  CORS_ALLOWED_ORIGINS,
  GRACEFUL_SHUTDOWN_TIMEOUT,
} = require("../shared/constants");
const { getOutboundIp } = require("./network");
const { createCorsMiddleware } = require("./cors");

// Logger com contexto "server"
const logger = createLogger("server");

// ============================================================================
// CONFIG & STATE
// ============================================================================
const config = loadConfig();

// Restaura um agendamento pendente após reinício do app (BUG-06)
if (restorePendingShutdown(config)) {
  logger.info("Agendamento pendente restaurado após reinício", {
    scheduledAt: config.scheduledAt,
  });
}
// Referência ao http.Server para graceful shutdown
let server = null;

// Origens CORS permitidas — dinâmica pois inclui IP local da rede
let allowedOrigins = [...CORS_ALLOWED_ORIGINS];

// Descobre o IP local da máquina na inicialização e adiciona às origens permitidas
getOutboundIp(500)
  .then((ip) => {
    if (ip && ip !== "localhost") {
      const ipOrigin = `http://${ip}:${PORT}`;
      if (!allowedOrigins.includes(ipOrigin)) {
        allowedOrigins.push(ipOrigin);
        logger.info("IP local detectado — CORS habilitado para origem", { ip, origin: ipOrigin });
      }
    }
  })
  .catch((err) => {
    logger.warn("Não foi possível detectar IP local para CORS", { error: err.message });
  });

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

// CORS restrito: permite localhost, app://localhost, file:// e o IP local da rede
// A interface web remota é servida pelo mesmo servidor, então origin pode ser:
// - http://localhost:3333 (desktop)
// - app://localhost (Electron preload)
// - file:// (web local)
// - http://<IP-da-rede>:3333 (acesso remoto via QR code)
// Requisições same-origin (incluindo IPv6) são sempre permitidas.
app.use(createCorsMiddleware(allowedOrigins));

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

server = app.listen(PORT, () => {
  logger.info("Servidor web iniciado", { port: PORT, url: `http://localhost:${PORT}` });
});

/**
 * Graceful shutdown — para o servidor sem perder conexões ativas
 * @param {number} [timeout] — Tempo máximo de espera em ms
 */
async function gracefulShutdown(timeout = GRACEFUL_SHUTDOWN_TIMEOUT) {
  logger.info("Iniciando graceful shutdown", { timeout });

  const srv = server;
  if (!srv) {
    logger.warn("Servidor HTTP não está disponível, pulando graceful shutdown");
    return;
  }

  return new Promise((resolve) => {
    let activeConnections = 0;
    let connectionsDone = false;
    let forceExitTimer = null;

    const checkDone = () => {
      if (connectionsDone) {
        if (forceExitTimer) clearTimeout(forceExitTimer);
        logger.info("Todas as conexões drenadas — servidor fechado");
        resolve();
      }
    };

    logger.info("Parando de aceitar novas conexões");
    srv.close(() => {
      connectionsDone = true;
      checkDone();
    });

    srv.on("connection", (socket) => {
      activeConnections++;
      logger.debug("Nova conexão estabelecida", { activeConnections });

      socket.on("close", () => {
        activeConnections = Math.max(0, activeConnections - 1);
        logger.debug("Conexão finalizada", { activeConnections });
        if (activeConnections === 0 && connectionsDone) {
          checkDone();
        }
      });
    });

    srv.on("error", (err) => {
      logger.error("Erro no servidor durante graceful shutdown", { error: err.message });
      if (forceExitTimer) clearTimeout(forceExitTimer);
    });

    forceExitTimer = setTimeout(() => {
      logger.error("Timeout de graceful shutdown excedido — forçando saída", {
        activeConnections,
        timeout,
      });
      if (forceExitTimer) clearTimeout(forceExitTimer);
      resolve(); // deixa o fluxo normal chamar process.exit
    }, timeout);
  });
}

// Handlers de sinal para graceful shutdown — USA process.on, NÃO app.on
process.on("SIGTERM", async () => {
  logger.info("Sinal SIGTERM recebido — iniciando graceful shutdown");
  try {
    await gracefulShutdown();
  } catch (e) {
    logger.error("Erro durante graceful shutdown (SIGTERM)", { error: e.message });
  }
  logger.info("Shutdown completo — saindo");
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Sinal SIGINT recebido — iniciando graceful shutdown");
  try {
    await gracefulShutdown();
  } catch (e) {
    logger.error("Erro durante graceful shutdown (SIGINT)", { error: e.message });
  }
  logger.info("Shutdown completo — saindo");
  process.exit(0);
});

module.exports = app;
