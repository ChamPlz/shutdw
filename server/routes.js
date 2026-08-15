const { Router } = require("express");
const auth = require("./auth");
const { loadConfig, saveConfig } = require("./config");
const { getOutboundIp, getIPv6StatusCached, isIPv6 } = require("./network");
const { scheduleShutdown, cancelShutdown } = require("./shutdown");
const { exec } = require("child_process");
const platform = require("./platform");
const {
  EXEC_TIMEOUT,
  QR_CACHE_TTL,
  PORT,
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
} = require("../shared/constants");

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normaliza o IP para lidar com endereços dual-stack (IPv4-mapped IPv6).
 * Ex: "::ffff:127.0.0.1" → "127.0.0.1"
 * @param {string} ip
 * @returns {string}
 */
function normalizeIp(ip) {
  return ip && ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

/**
 * Valida um horário no formato HH:MM (24h)
 * @param {string} time
 * @returns {boolean}
 */
function isValidTime(time) {
  return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

// ============================================================================
// QR CODE CACHE
// ============================================================================
const qrCache = new Map(); // key: ip/ipv6, value: { data, timestamp }

function getCachedIP(key) {
  const entry = qrCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > QR_CACHE_TTL) {
    qrCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedIP(key, data) {
  qrCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Cria e configura todas as rotas da aplicação
 * @param {object} config - Referência ao objeto de configuração
 * @returns {Router}
 */
function createRoutes(config) {
  const router = Router();

  // ==========================================================================
  // MIDDLEWARE — Bloqueio de IPv6
  // ==========================================================================
  router.use((req, res, next) => {
    const ip = normalizeIp(req.ip);
    if (ip === '::1') return next();
    if (!config.useIPv6 && isIPv6(req.ip)) {
      return res.status(403).json({ error: "Acesso via IPv6 desabilitado" });
    }
    next();
  });

  // ==========================================================================
  // ROTAS PÚBLICAS (sem autenticação)
  // ==========================================================================

  router.get('/config/pin', (req, res) => {
    const currentConfig = loadConfig();
    res.json({ configured: !!currentConfig.pin });
  });

  router.get('/config/ipv6-available', async (req, res) => {
    const status = await getIPv6StatusCached();
    res.json({ ...status, enabled: config.useIPv6 });
  });

  // ==========================================================================
  // MIDDLEWARE — Autenticação por PIN
  // ==========================================================================
  router.use(async (req, res, next) => {
    if (req.method === "GET") return next();

    const provided = (req.headers["x-pin"] || "").toString();
    const stored = config.pin;

    // Sem PIN configurado: permite apenas criar o primeiro
    if (!stored) {
      if (req.method === 'POST' && req.path === '/config/pin') return next();
      return res.status(401).json({ error: "PIN não configurado." });
    }

    try {
      // Verificação com hash Argon2
      if (auth.isHash(stored)) {
        const ok = await auth.verifyPin(stored, provided);
        if (!ok) return res.status(401).json({ error: "PIN inválido" });
        return next();
      }

      // Legacy: PIN em texto puro
      if (typeof stored === 'string' && provided === stored) return next();

      return res.status(401).json({ error: "PIN inválido" });
    } catch (err) {
      console.error("Erro ao verificar PIN:", err);
      return res.status(500).json({ error: "Erro ao verificar PIN" });
    }
  });

  // ==========================================================================
  // ROTAS — Status
  // ==========================================================================

  router.get("/status", (req, res) => {
    if (!config.scheduledAt) return res.json({ remaining: null });
    const remaining = Math.max(0, Math.floor((config.scheduledAt - Date.now()) / 1000));
    res.json({ remaining });
  });

  // ==========================================================================
  // ROTAS — Rede
  // ==========================================================================

  router.get("/ip", async (req, res) => {
    const cached = getCachedIP("ipv4");
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.json(cached);
    }
    const ip = await getOutboundIp();
    const data = { ip, url: `http://${ip}:${PORT}`, ipVersion: "IPv4" };
    setCachedIP("ipv4", data);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=30");
    res.json(data);
  });

  router.get("/ip6", async (req, res) => {
    if (!config.useIPv6) {
      return res.status(403).json({ error: "Acesso IPv6 desabilitado" });
    }
    const cached = getCachedIP("ipv6");
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.json(cached);
    }
    const status = await getIPv6StatusCached();
    const ipv6Address = status.publicIp || status.ipv6;
    if (!ipv6Address) {
      return res.status(404).json({ error: "IPv6 não disponível" });
    }
    const data = { ipv6: ipv6Address, url: `http://[${ipv6Address}]:${PORT}`, enabled: true, external: status.status === "external" };
    setCachedIP("ipv6", data);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=30");
    res.json(data);
  });

  // ==========================================================================
  // ROTAS — Configurações
  // ==========================================================================

  router.post('/config/ipv6', (req, res) => {
    const { useIPv6 } = req.body;
    if (typeof useIPv6 !== 'boolean') {
      return res.status(400).json({ error: "Valor inválido" });
    }
    config.useIPv6 = useIPv6;
    saveConfig(config);
    res.json({ status: "Preferência de IPv6 atualizada", useIPv6 });
  });

  router.post("/config/pin", async (req, res) => {
    const { newPin } = req.body;
    if (!newPin || typeof newPin !== 'string' || newPin.length < PIN_MIN_LENGTH) {
      return res.status(400).json({ error: "PIN inválido" });
    }
    if (newPin.length > PIN_MAX_LENGTH) {
      return res.status(400).json({ error: "PIN muito longo" });
    }
    try {
      config.pin = await auth.hashPin(newPin);
      saveConfig(config);
      res.json({ status: "PIN atualizado com sucesso" });
    } catch (err) {
      console.error("Erro ao hashear novo PIN:", err);
      res.status(500).json({ error: "Erro ao atualizar PIN" });
    }
  });

  // ==========================================================================
  // ROTAS — Shutdown
  // ==========================================================================

  router.post("/shutdown", (req, res) => {
    exec(platform.shutdownWithDelay(15), { timeout: EXEC_TIMEOUT }, (err) => {
      if (err && err.killed) console.error("Comando de shutdown timeout");
    });
    res.json({ status: "Desligando agora" });
  });

  router.post("/shutdown/:minutes", (req, res) => {
    const minutes = Number(req.params.minutes);
    const timestamp = Date.now() + minutes * 60000;
    if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(timestamp)) {
      return res.status(400).json({ error: "Minutos inválidos" });
    }
    scheduleShutdown(timestamp, config);
    res.json({ status: `Desligamento em ${minutes} minutos` });
  });

  router.post("/schedule", (req, res) => {
    const { time } = req.body;
    if (!isValidTime(time)) {
      return res.status(400).json({ error: "Horário inválido (use HH:MM)" });
    }

    const [h, m] = time.split(":").map(Number);

    const date = new Date();
    date.setHours(h, m, 0, 0);
    if (date < new Date()) date.setDate(date.getDate() + 1);

    scheduleShutdown(date.getTime(), config);
    res.json({ status: `Desligamento agendado para ${time}` });
  });

  router.post("/cancel", (req, res) => {
    cancelShutdown(config);
    res.json({ status: "Agendamento cancelado" });
  });

  return router;
}

module.exports = { createRoutes, PORT };
