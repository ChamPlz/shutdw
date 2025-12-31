const express = require("express");
const path = require("path");
const { exec } = require("child_process");
const { loadConfig, saveConfig } = require("./config");
const os = require("os");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../web")));

let config = loadConfig();
let shutdownTimeout = null;

// Middleware PIN
app.use((req, res, next) => {
  if (req.method === "GET") return next();
  if (req.headers["x-pin"] !== config.pin) {
    return res.status(401).json({ error: "PIN inválido" });
  }
  next();
});

function scheduleShutdown(date) {
  if (shutdownTimeout) clearTimeout(shutdownTimeout);

  const delay = date - Date.now();
  if (delay <= 0) return;

  shutdownTimeout = setTimeout(() => {
    exec("shutdown /s /t 0");
  }, delay);

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

app.get("/ip", (req, res) => {
  const nets = os.networkInterfaces();
  let ip = "localhost";

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        ip = net.address;
        break;
      }
    }
  }

  res.json({
    ip,
    url: `http://${ip}:3333`
  });
});


app.post("/shutdown", (_, res) => {
  exec("shutdown /s /t 0");
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
  if (shutdownTimeout) clearTimeout(shutdownTimeout);
  config.scheduledAt = null;
  saveConfig(config);
  exec("shutdown /a");
  res.json({ status: "Agendamento cancelado" });
});

app.post("/config/pin", (req, res) => {
  const { newPin } = req.body;

  if (!newPin || newPin.length < 4) {
    return res.status(400).json({ error: "PIN inválido" });
  }

  config.pin = newPin;
  saveConfig(config);

  res.json({ status: "PIN atualizado com sucesso" });
});

app.listen(3333);
