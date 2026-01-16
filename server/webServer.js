const express = require("express");
const path = require("path");
const { exec } = require("child_process");
const { loadConfig, saveConfig } = require("./config");
const os = require("os");
const dgram = require("dgram");
const auth = require("./auth");

const {
  createOverlay,
  closeOverlay,
  sendRemaining
} = require("../overlay/overlayWindow");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../web")));

let config = loadConfig();
let shutdownTimeout = null;

// Middleware PIN
// - Allow all GET requests
// - If no PIN is configured, allow only POST /config/pin so user can set the first PIN
// - Otherwise require verification (supports Argon2 hashes or plain-text legacy PINs)
app.use(async (req, res, next) => {
  if (req.method === "GET") return next();

  const provided = (req.headers["x-pin"] || "").toString();
  const stored = config.pin;

  if (!stored) {
    if (req.method === 'POST' && req.path === '/config/pin') return next();
    return res.status(401).json({ error: "PIN não configurado. Use POST /config/pin para criar um." });
  }

  try {
    if ((req.ip === '::1' || req.ip === '127.0.0.1') && req.path !== '/shutdown') {
      return next();
    }
    if (auth.isHash(stored)) {
      const ok = await auth.verifyPin(stored, provided);
      if (!ok) return res.status(401).json({ error: "PIN inválido" });
      return next();
    }

    // Legacy plain-text PIN support (no migration performed automatically)
    if (typeof stored === 'string' && provided === stored) return next();

    return res.status(401).json({ error: "PIN inválido" });
  } catch (err) {
    console.error("Erro ao verificar PIN:", err);
    return res.status(500).json({ error: "Erro ao verificar PIN" });
  }
});

function scheduleShutdown(date) {
  if (shutdownTimeout) clearTimeout(shutdownTimeout);

  const delay = date - Date.now();
  if (delay <= 0) return;

  createOverlay();

  shutdownTimeout = setInterval(() => {
    const remaining = Math.max(
      0,
      Math.floor((date - Date.now()) / 1000)
    );

    sendRemaining(remaining);

    if (remaining <= 0) {
      clearInterval(shutdownTimeout);
      closeOverlay();
      exec("shutdown /s /t 0");
    }
  }, 1000);

  config.scheduledAt = date;
  saveConfig(config);
}

app.get("/status", (req, res) => {
  if (!config.scheduledAt) return res.json({ remaining: null });

  const remaining = Math.max(
    0,
    Math.floor((config.scheduledAt - Date.now()) / 1000)
  );

  res.json({ remaining });
});

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
        } catch (e) {
          resolve("localhost");
        }
        socket.close();
      });

      socket.on("error", () => {
        clearTimeout(timer);
        socket.close();
        resolve("localhost");
      });
    } catch (e) {
      resolve("localhost");
    }
  });
}

app.get("/ip", async (req, res) => {
  const ip = await getOutboundIp();
  res.json({
    ip,
    url: `http://${ip}:3333`
  });
});

// Return whether a PIN is configured (used by UI to prompt first-time setup)
app.get('/config/pin', (req, res) => {
  res.json({ configured: !!config.pin });
});


app.post("/shutdown", (_, res) => {
  exec("shutdown /s /t 15");
  res.json({ status: "Desligando agora" });
});

app.post("/shutdown/:minutes", (req, res) => {
  const minutes = Number(req.params.minutes);
  const date = Date.now() + minutes * 60000;
  scheduleShutdown(date);
  res.json({ status: `Desligamento em ${minutes} minutos` });
});

app.post("/schedule", (req, res) => {
  const { time } = req.body; // "23:30"
  const [h, m] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(h, m, 0, 0);
  if (date < new Date()) date.setDate(date.getDate() + 1);

  scheduleShutdown(date.getTime());
  res.json({ status: `Desligamento agendado para ${time}` });
});

app.post("/cancel", (_, res) => {
  if (shutdownTimeout) clearInterval(shutdownTimeout);

  closeOverlay();

  config.scheduledAt = null;
  saveConfig(config);
  exec("shutdown /a");

  res.json({ status: "Agendamento cancelado" });
});

process.on("cancel-shutdown", () => {
  if (shutdownTimeout) clearInterval(shutdownTimeout);
  closeOverlay();
  exec("shutdown /a");

  config.scheduledAt = null;
  saveConfig(config);
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

app.listen(3333);
