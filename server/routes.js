const { Router } = require("express");
const auth = require("./auth");
const { loadConfig, saveConfig } = require("./config");
const { getOutboundIp, getOutboundIpv6, hasIPv6Available, isIPv6 } = require("./network");
const { scheduleShutdown, cancelShutdown } = require("./shutdown");
const { exec } = require("child_process");
const platform = require("./platform");

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
  const publicRoutes = ['/config/pin', '/config/ipv6-available'];
  
  router.use(async (req, res, next) => {
    const provided = (req.headers["x-pin"] || "").toString();
    const stored = config.pin;

    // Rotas públicas sempre acessíveis
    if (publicRoutes.includes(req.path)) return next();

    // Sem PIN configurado: bloqueia tudo exceto criação do primeiro PIN
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
    const remaining = Math.floor((config.scheduledAt - Date.now()) / 1000);
    
    if (remaining <= 0) {
      config.scheduledAt = null;
      saveConfig(config);
      return res.json({ remaining: 0 });
    }
    
    res.json({ remaining });
  });

  // ==========================================================================
  // ROTAS — Rede
  // ==========================================================================

  router.get("/ip", async (req, res) => {
    const ip = await getOutboundIp();
    res.json({ ip, url: `http://${ip}:${PORT}`, ipVersion: "IPv4" });
  });

  router.get("/ip6", async (req, res) => {
    if (!config.useIPv6) {
      return res.status(403).json({ error: "Acesso IPv6 desabilitado" });
    }
    const ipv6Address = await getOutboundIpv6();
    if (!ipv6Address) {
      return res.status(404).json({ error: "IPv6 não disponível" });
    }
    res.json({ ipv6: ipv6Address, url: `http://[${ipv6Address}]:${PORT}`, enabled: true });
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

  router.post('/config/exec-timeout', (req, res) => {
    const { execTimeout } = req.body;
    if (typeof execTimeout !== 'number' || execTimeout <= 0) {
      return res.status(400).json({ error: "Timeout deve ser um número positivo" });
    }
    config.execTimeout = execTimeout;
    saveConfig(config);
    res.json({ status: "Timeout de execução atualizado", execTimeout });
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
    exec(platform.shutdownWithDelay(15), { timeout: config.execTimeout }, (err) => {
      if (err && err.killed) console.error("Comando de shutdown timeout");
      if (err && !err.killed) console.error("Erro ao executar shutdown:", err);
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
    
    if (!time || typeof time !== 'string') {
      return res.status(400).json({ error: "Horário é obrigatório" });
    }
    
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const match = time.match(timeRegex);
    
    if (!match) {
      return res.status(400).json({ error: "Formato de horário inválido. Use HH:MM" });
    }
    
    const h = Number(match[1]);
    const m = Number(match[2]);
    
    if (h < 0 || h > 23) {
      return res.status(400).json({ error: "Hora deve estar entre 00 e 23" });
    }
    
    if (m < 0 || m > 59) {
      return res.status(400).json({ error: "Minutos devem estar entre 00 e 59" });
    }

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
