const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require('electron-updater');
const { hashPin } = require('./server/auth');
const { loadConfig, saveConfig } = require('./server/config');
const path = require("path");

// ============================================================================
// CONSTANTS
// ============================================================================
const WINDOW_CONFIG = {
  width: 800,
  height: 500,
  minWidth: 800,
  minHeight: 500,
  maxWidth: 800,
  maxHeight: 500,
};

// ============================================================================
// STATE
// ============================================================================
let win = null;
let tray = null;
let allowQuit = false;

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================
function createWindow() {
  win = new BrowserWindow({
    width: WINDOW_CONFIG.width,
    height: WINDOW_CONFIG.height,
    frame: false,
    icon: path.join(__dirname, "build/icon.ico"),
    autoHideMenuBar: true,
    fullscreenable: false,
    resizable: false,
    fullscreen: false,
    maxHeight: WINDOW_CONFIG.maxHeight,
    maxWidth: WINDOW_CONFIG.maxWidth,
    minHeight: WINDOW_CONFIG.minHeight,
    minWidth: WINDOW_CONFIG.minWidth,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    transparent: true,
  });

  win.loadFile("renderer/index.html");

  win.on("close", (e) => {
    if (!allowQuit) {
      e.preventDefault();
      win.hide();
    }
  });
}

function closeApp() {
  allowQuit = false;
  if (win) {
    win.close();
  }
}

// ============================================================================
// TRAY MENU
// ============================================================================
function createTray() {
  tray = new Tray(path.join(__dirname, "icon.ico"));
  tray.setToolTip("ShutDW - Desligamento automatico");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Abrir", click: () => win?.show() },
    { label: "Sair", click: () => app.exit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => win?.show());
}

// ============================================================================
// AUTO-UPDATER
// ============================================================================
function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log('App is not packaged — auto-updates disabled in development');
    return;
  }

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('No update available');
  });

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater error:', err);
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const result = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Instalar e reiniciar o App', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização disponível',
      message: `Versão ${info.version} baixada. Deseja instalar agora?`
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
  ipcMain.handle('reset-pin', async (event, newPin) => {
    try {
      if (typeof newPin !== 'string' || newPin.length < 4) {
        return { error: 'PIN inválido: mínimo 4 caracteres' };
      }

      const hash = await hashPin(newPin);
      const cfg = loadConfig();
      cfg.pin = hash;
      saveConfig(cfg);
      return { status: 'PIN redefinido com sucesso' };
    } catch (err) {
      console.error('Erro ao redefinir PIN:', err);
      return { error: 'Erro ao redefinir PIN' };
    }
  });

  ipcMain.handle('close-app', () => {
    closeApp();
  });

  ipcMain.handle('set-auto-start', (event, enable) => {
    if (typeof enable !== 'boolean') {
      return;
    }

    app.setLoginItemSettings({
      openAtLogin: enable,
    });

    const cfg = loadConfig();
    cfg.autoStart = enable;
    saveConfig(cfg);
  });

  ipcMain.handle('check-auto-start', () => {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  });

  ipcMain.handle('open-external', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      console.error('Erro ao abrir link externo:', err);
      return { error: err.message };
    }
  });
}

// ============================================================================
// APP INITIALIZATION
// ============================================================================
function initializeApp() {
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  setupIpcHandlers();
  setupAutoUpdater();
}

// ============================================================================
// SINGLE INSTANCE LOCK
// ============================================================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  allowQuit = true;
  app.exit();
}

// ============================================================================
// APP EVENTS
// ============================================================================
app.whenReady().then(() => {
  require("./server/webServer");
  initializeApp();
});
