const express = require("express");
const { rateLimit } = require('express-rate-limit');
const path = require("path");
const { exec } = require("child_process");
const os = require("os");
const dgram = require("dgram");

const { loadConfig, saveConfig } = require("./config");
const auth = require("./auth");
const { createOverlay, closeOverlay, sendRemaining } = require("../overlay/overlayWindow");

// ============================================================================
// CONSTANTS
// ============================================================================
const PORT = 3333;
const SHUTDOWN_DELAY_MS = 15000;

const RATE_LIMIT_CONFIG = {
  windowMs: 1 * 60 * 1000,
  limit: 50,
  message: { error: "Muitas requisições, por favor tente novamente mais tarde." },
  statusCode: 429,
};

// ============================================================================
// STATE
// ============================================================================
let config = loadConfig();
let shutdownTimeout = null;

// ============================================================================
// EXPRESS APP
// ============================================================================
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../web")));
app.use(rateLimit(RATE_LIMIT_CONFIG));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verifica se um IP é IPv6
 * @param {string} ip - IP para verificar
 * @returns {boolean}
 */
function isIPv6(ip) {
  return ip.includes(':') && !ip.includes('.');
}

/**
 * Obtém IP de saída IPv4
 * @param {number} timeout - Timeout em ms
 * @returns {Promise<string>}
 */
async function getOutboundIp(timeout = 1000) {
  return new Promise((resolve) => {
    try {
      const socket = dgram.createSocket("udp4");
      const timer = setTimeout(() => {
        socket.close();
        resolve("localhost");
      }, timeout);

      socket.connect(53, "8.8.8.8", () => {
        clearTimeout(timer);
        try {
          const addr = socket.address();
          resolve(addr.address || "localhost");
        } catch {
          resolve("localhost");
        }
        socket.close();
      });

      socket.on("error", () => {
        clearTimeout(timer);
        socket.close();
        resolve("localhost");
      });
    } catch {
      resolve("localhost");
    }
  });
}

/**
 * Obtém IP de saída IPv6
 * @param {number} timeout - Timeout em ms
 * @returns {Promise<string|null>}
 */
async function getOutboundIpv6(timeout = 1000) {
  return new Promise((resolve) => {
    try {
      const socket = dgram.createSocket("udp6");
      const timer = setTimeout(() => {
        socket.close();
        resolve(null);
      }, timeout);

      socket.connect(53, "2001:4860:4860::8888", () => {
        clearTimeout(timer);
        try {
          const addr = socket.address();
          resolve(addr.address || null);
        } catch {
          resolve(null);
        }
        socket.close();
      });

      socket.on("error", () => {
        clearTimeout(timer);
        socket.close();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Verifica se há IPv6 disponível nas interfaces de rede
 * @returns {boolean}
 */
function hasIPv6Available() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === "IPv6" && !addr.internal) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Agenda o desligamento do sistema
 * @param {number} timestamp - Timestamp para o desligamento
 */
function scheduleShutdown(timestamp) {
  if (shutdownTimeout) {
    clearInterval(shutdownTimeout);
  }

  const delay = timestamp - Date.now();
  if (delay <= 0) {
    return;
  }

  createOverlay();

  shutdownTimeout = setInterval(() => {
    const remaining = Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
    sendRemaining(remaining);

    if (remaining <= 0) {
      clearInterval(shutdownTimeout);
      closeOverlay();
      exec("shutdown /s /t 0");
    }
  }, 1000);

  config.scheduledAt = timestamp;
  saveConfig(config);
}

/**
 * Cancela o desligamento agendado
 */
function cancelShutdown() {
  if (shutdownTimeout) {
    clearInterval(shutdownTimeout);
    shutdownTimeout = null;
  }

  closeOverlay();
  config.scheduledAt = null;
  saveConfig(config);
  exec("shutdown /a");
}

// ============================================================================
// MIDDLEWARES
// ============================================================================

/**
 * Middleware para bloquear acesso IPv6 quando desabilitado
 */
app.use((req, res, next) => {
  if (req.ip === '::1') {
    return next();
  }

  if (!config.useIPv6 && isIPv6(req.ip)) {
    return res.status(403).json({ error: "Acesso via IPv6 desabilitado" });
  }

  next();
});

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

/**
 * Verifica se um PIN está configurado
 * Esta rota deve estar ANTES do middleware de autenticação
 * Retorna apenas true/false, não expõe o PIN
 */
app.get('/config/pin', (req, res) => {
  const currentConfig = loadConfig();
  const hasPin = !!currentConfig.pin;
  res.json({ configured: hasPin });
});

/**
 * Verifica disponibilidade de IPv6
 * Esta rota deve estar ANTES do middleware de autenticação
 */
app.get('/config/ipv6-available', (req, res) => {
  const available = hasIPv6Available();
  res.json({ available, enabled: config.useIPv6 });
});

/**
 * Middleware de autenticação por PIN
 * - Rotas GET são liberadas (o PIN é verificado apenas em ações modificadoras)
 * - Rotas POST exigem PIN válido (exceto /config/pin quando não há PIN configurado)
 */
app.use(async (req, res, next) => {
  // GET requests são liberados para leitura de status
  if (req.method === "GET") {
    return next();
  }

  const provided = (req.headers["x-pin"] || "").toString();
  const stored = config.pin;

  // Se não há PIN configurado, permite apenas criar o primeiro PIN
  if (!stored) {
    if (req.method === 'POST' && req.path === '/config/pin') {
      return next();
    }
    return res.status(401).json({ error: "PIN não configurado." });
  }

  try {
    // Localhost é liberado para todas as rotas exceto /shutdown (ação crítica)
    if ((req.ip === '::1' || req.ip === '127.0.0.1') && req.path !== '/shutdown') {
      return next();
    }

    // Verifica PIN com hash Argon2
    if (auth.isHash(stored)) {
      const ok = await auth.verifyPin(stored, provided);
      if (!ok) {
        return res.status(401).json({ error: "PIN inválido" });
      }
      return next();
    }

    // Legacy: PIN em texto puro (não recomendado)
    if (typeof stored === 'string' && provided === stored) {
      return next();
    }

    return res.status(401).json({ error: "PIN inválido" });
  } catch (err) {
    console.error("Erro ao verificar PIN:", err);
    return res.status(500).json({ error: "Erro ao verificar PIN" });
  }
});

// ============================================================================
// ROUTES - STATUS
// ============================================================================

app.get("/status", (req, res) => {
  if (!config.scheduledAt) {
    return res.json({ remaining: null });
  }

  const remaining = Math.max(0, Math.floor((config.scheduledAt - Date.now()) / 1000));
  res.json({ remaining });
});

// ============================================================================
// ROUTES - NETWORK
// ============================================================================

app.get("/ip", async (req, res) => {
  const ip = await getOutboundIp();
  res.json({
    ip,
    url: `http://${ip}:${PORT}`,
    ipVersion: "IPv4"
  });
});

app.get("/ip6", async (req, res) => {
  if (!config.useIPv6) {
    return res.status(403).json({ error: "Acesso IPv6 desabilitado" });
  }

  const ipv6Address = await getOutboundIpv6();

  if (!ipv6Address) {
    return res.status(404).json({ error: "IPv6 não disponível" });
  }

  res.json({
    ipv6: ipv6Address,
    url: `http://[${ipv6Address}]:${PORT}`,
    enabled: true
  });
});

// ============================================================================
// ROUTES - CONFIG
// ============================================================================

app.post('/config/ipv6', async (req, res) => {
  const { useIPv6 } = req.body;

  if (typeof useIPv6 !== 'boolean') {
    return res.status(400).json({ error: "Valor inválido" });
  }

  config.useIPv6 = useIPv6;
  saveConfig(config);
  res.json({ status: "Preferência de IPv6 atualizada", useIPv6 });
});

app.post("/config/pin", async (req, res) => {
  const { newPin } = req.body;

  if (!newPin || typeof newPin !== 'string' || newPin.length < 4) {
    return res.status(400).json({ error: "PIN inválido" });
  }

  try {
    const hash = await auth.hashPin(newPin);
    config.pin = hash;
    saveConfig(config);
    res.json({ status: "PIN atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao hashear novo PIN:", err);
    res.status(500).json({ error: "Erro ao atualizar PIN" });
  }
});

// ============================================================================
// ROUTES - SHUTDOWN
// ============================================================================

app.post("/shutdown", () => {
  exec("shutdown /s /t 15");
  return { status: "Desligando agora" };
});

app.post("/shutdown/:minutes", (req, res) => {
  const minutes = Number(req.params.minutes);
  const date = Date.now() + minutes * 60000;
  scheduleShutdown(date);
  res.json({ status: `Desligamento em ${minutes} minutos` });
});

app.post("/schedule", (req, res) => {
  const { time } = req.body;
  const [h, m] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(h, m, 0, 0);
  if (date < new Date()) {
    date.setDate(date.getDate() + 1);
  }

  scheduleShutdown(date.getTime());
  res.json({ status: `Desligamento agendado para ${time}` });
});

app.post("/cancel", (req, res) => {
  cancelShutdown();
  res.json({ status: "Agendamento cancelado" });
});

// ============================================================================
// EVENT HANDLERS
// ============================================================================

process.on("cancel-shutdown", () => {
  cancelShutdown();
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log(`Servidor web rodando em http://localhost:${PORT}`);
});

module.exports = app;
