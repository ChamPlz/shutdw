const { Router } = require("express");
const auth = require("./auth");
const { loadConfig, saveConfig } = require("./config");
const { getOutboundIp, getOutboundIpv6, hasIPv6Available, isIPv6 } = require("./network");
const { scheduleShutdown, cancelShutdown } = require("./shutdown");
const { exec } = require("child_process");
const platform = require("./platform");

const EXEC_TIMEOUT = 5000; // 5 segundos

// ============================================================================
// QR CODE CACHE — 5 minutos TTL
// ============================================================================
const QR_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
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

const PORT = 3333;

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
    if (req.ip === '::1') return next();
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

  router.get('/config/ipv6-available', (req, res) => {
    res.json({ available: hasIPv6Available(), enabled: config.useIPv6 });
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
      // Localhost liberado (exceto /shutdown)
      if ((req.ip === '::1' || req.ip === '127.0.0.1') && req.path !== '/shutdown') {
        return next();
      }

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
    const ipv6Address = await getOutboundIpv6();
    if (!ipv6Address) {
      return res.status(404).json({ error: "IPv6 não disponível" });
    }
    const data = { ipv6: ipv6Address, url: `http://[${ipv6Address}]:${PORT}`, enabled: true };
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
    if (!newPin || typeof newPin !== 'string' || newPin.length < 4) {
      return res.status(400).json({ error: "PIN inválido" });
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
    scheduleShutdown(Date.now() + minutes * 60000, config);
    res.json({ status: `Desligamento em ${minutes} minutos` });
  });

  router.post("/schedule", (req, res) => {
    const { time } = req.body;
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
