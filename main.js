const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { hashPin } = require("./server/auth");
const { loadConfig, saveConfig } = require("./server/config");
const path = require("path");

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
  win.show();

  if (win.isMinimized()) {
    win.restore();
  }

  win.focus();
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
    icon: path.join(__dirname, "build/icon.ico"),
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
  tray = new Tray(path.join(__dirname, "icon.ico"));
  tray.setToolTip("ShutDW - Desligamento automático");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Abrir", click: () => restoreWindow() },
    { label: "Sair", click: () => app.exit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => restoreWindow());
}

// ============================================================================
// AUTO-UPDATER
// ============================================================================
function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log("Auto-updates disabled in development");
    return;
  }

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
  });

  autoUpdater.on("error", (err) => {
    console.error("AutoUpdater error:", err);
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const result = await dialog.showMessageBox(win, {
      type: "info",
      buttons: ["Instalar e reiniciar o App", "Depois"],
      defaultId: 0,
      cancelId: 1,
      title: "Atualização disponível",
      message: `Versão ${info.version} baixada. Deseja instalar agora?`,
    });

    if (result.response === 0) {
      allowQuit = true;
      setTimeout(() => autoUpdater.quitAndInstall(), 1000);
    }
  });
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
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      console.error("Erro ao abrir link externo:", err);
      return { error: err.message };
    }
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
