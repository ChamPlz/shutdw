const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const { hashPin } = require("./server/auth");
const { loadConfig, saveConfig } = require("./server/config");
const path = require("path");
const http = require("http");

// Ícone correto por plataforma (.ico para Windows, .png para Linux/macOS)
const iconExt = process.platform === "win32" ? "ico" : "png";
const appIcon = path.join(__dirname, `build/icon.${iconExt}`);
const trayIcon = process.platform === "win32"
  ? path.join(__dirname, "icon.ico")
  : path.join(__dirname, "build/icon.png");

// ============================================================================
// STATE
// ============================================================================
let win = null;
let tray = null;
let allowQuit = false;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Restaura a janela garantindo visibilidade correta na taskbar.
 * Resolve o bug de ícone invisível em janelas transparent+frameless.
 */
function restoreWindow() {
  if (!win) return;

  win.setSkipTaskbar(false);

  if (win.isMinimized()) {
    win.restore();
  }

  win.show();
  win.focus();
}

/**
 * Exibe uma notificação nativa do sistema
 */
function showNotification(title, body) {
  if (!Notification.isSupported()) return;

  const notif = new Notification({
    title,
    body,
    icon: appIcon,
    silent: false,
  });

  notif.on("click", () => {
    restoreWindow();
  });

  notif.show();
}

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 500,
    minWidth: 800,
    minHeight: 500,
    maxWidth: 800,
    maxHeight: 500,
    frame: false,
    icon: appIcon,
    autoHideMenuBar: true,
    resizable: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile("renderer/index.html");

  win.on("close", (e) => {
    if (!allowQuit) {
      e.preventDefault();
      win.hide();
      win.setSkipTaskbar(true);
    }
  });
}

// ============================================================================
// TRAY
// ============================================================================
function createTray() {
  tray = new Tray(trayIcon);
  tray.setToolTip("ShutDW - Desligamento automático");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Abrir ShutDW", click: () => restoreWindow() },
    { type: "separator" },
    {
      label: "Desligar em...",
      submenu: [
        { label: "10 minutos", click: () => triggerShutdown(10) },
        { label: "30 minutos", click: () => triggerShutdown(30) },
        { label: "60 minutos", click: () => triggerShutdown(60) },
      ],
    },
    { label: "Cancelar Agendamento", click: () => triggerCancel() },
    { type: "separator" },
    {
      label: "Sair",
      click: () => {
        allowQuit = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => restoreWindow());
}

/**
 * Dispara agendamento de shutdown via requisição local
 */
function triggerShutdown(minutes) {
  const req = http.request({ hostname: "localhost", port: 3333, path: `/shutdown/${minutes}`, method: "POST" });
  req.on("error", (err) => console.error("Erro ao agendar pelo tray:", err));
  req.end();
}

/**
 * Cancela o agendamento via requisição local
 */
function triggerCancel() {
  const req = http.request({ hostname: "localhost", port: 3333, path: "/cancel", method: "POST" });
  req.on("error", (err) => console.error("Erro ao cancelar pelo tray:", err));
  req.end();
}

// ============================================================================
// AUTO-UPDATER
// ============================================================================

/**
 * Envia evento de atualização para o renderer
 */
function sendUpdateEvent(event, data = {}) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("update-event", { event, ...data });
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log("Auto-updates disabled in development");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    sendUpdateEvent("checking");
  });

  autoUpdater.on("update-available", (info) => {
    sendUpdateEvent("available", { version: info.version });
    showNotification(
      "ShutDW - Atualização Disponível",
      `Nova versão ${info.version} encontrada! Baixando...`
    );
  });

  autoUpdater.on("update-not-available", (info) => {
    sendUpdateEvent("not-available", { version: info.version });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendUpdateEvent("progress", { percent: Math.round(progress.percent) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateEvent("downloaded", { version: info.version });
    showNotification(
      "ShutDW - Atualização Pronta",
      `Versão ${info.version} baixada! Clique aqui para instalar.`
    );
  });

  autoUpdater.on("error", (err) => {
    console.error("AutoUpdater error:", err);
    sendUpdateEvent("error", { message: err.message });
  });

  // Verificação automática ao iniciar (com delay para não bloquear startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
}

// ============================================================================
// IPC HANDLERS
// ============================================================================
function setupIpcHandlers() {
  ipcMain.handle("reset-pin", async (_event, newPin) => {
    try {
      if (typeof newPin !== "string" || newPin.length < 4) {
        return { error: "PIN inválido: mínimo 4 caracteres" };
      }
      const hash = await hashPin(newPin);
      const cfg = loadConfig();
      cfg.pin = hash;
      saveConfig(cfg);
      return { status: "PIN redefinido com sucesso" };
    } catch (err) {
      console.error("Erro ao redefinir PIN:", err);
      return { error: "Erro ao redefinir PIN" };
    }
  });

  ipcMain.handle("close-app", () => {
    if (!win) return;
    allowQuit = false;
    win.close();
  });

  ipcMain.handle("set-auto-start", (_event, enable) => {
    if (typeof enable !== "boolean") return;
    app.setLoginItemSettings({ openAtLogin: enable });
    const cfg = loadConfig();
    cfg.autoStart = enable;
    saveConfig(cfg);
  });

  ipcMain.handle("check-auto-start", () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle("open-external", async (_event, url) => {
    try {
      if (typeof url !== "string") {
        return { error: "URL inválida" };
      }

      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return { error: "Protocolo não permitido" };
      }

      await shell.openExternal(parsedUrl.toString());
      return { success: true };
    } catch (err) {
      console.error("Erro ao abrir link externo:", err);
      return { error: "URL inválida" };
    }
  });

  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });

  ipcMain.handle("check-for-updates", async () => {
    if (!app.isPackaged) {
      return { status: "dev", message: "Atualizações desabilitadas em desenvolvimento" };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { status: "ok", version: result?.updateInfo?.version };
    } catch (err) {
      return { status: "error", message: err.message };
    }
  });

  ipcMain.handle("install-update", () => {
    allowQuit = true;
    setTimeout(() => autoUpdater.quitAndInstall(), 1000);
  });
}

// ============================================================================
// SINGLE INSTANCE LOCK
// ============================================================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.exit();
} else {
  app.on("second-instance", () => {
    restoreWindow();
  });
}

// ============================================================================
// APP START
// ============================================================================
app.whenReady().then(() => {
  require("./server/webServer");
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  setupIpcHandlers();
  setupAutoUpdater();
});