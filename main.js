const { app, BrowserWindow, Tray, Menu, dialog, ipcMain } = require("electron");
const { autoUpdater } = require('electron-updater');
const { hashPin } = require('./server/auth');
const { loadConfig, saveConfig } = require('./server/config');
const path = require("path");

let win;
let tray;
let allowQuit = false; // when true, allow the window to close (used during auto-update)

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 500,
    frame: false,
    icon: path.join(__dirname, "build/icon.ico"),
    autoHideMenuBar: true, // REMOVE File | Window
    fullscreenable: false,
    resizable: false,
    fullscreen: false,
    maxHeight: 500,
    maxWidth: 800,
    minHeight: 500,
    minWidth: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    transparent: true,
  });

  win.loadFile("renderer/index.html");

  win.on("close", (e) => {
    if (!allowQuit) {
      e.preventDefault();
      win.hide(); // Vai para ícones ocultos
    }
    // if allowQuit is true, allow the default close behavior so app can exit for updates
  });
}

function closeApp() {
  allowQuit = false;
  win.close();
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  allowQuit = true;
  app.exit();
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // Remove menu global
  createWindow();

  tray = new Tray(path.join(__dirname, "icon.ico"));
  tray.setToolTip("ShutDW - Desligamento automatico");

  tray.setContextMenu(Menu.buildFromTemplate([
    {label:"Desligar agora", click: () => ipcMain.emit('shutdown-now')},
    { label: "Abrir", click: () => win.show() },
    { label: "Sair", click: () => app.exit() },
  ]));

  tray.on("double-click", () => win.show());
});

app.whenReady().then(() => {
  require("./server/webServer");

  // Auto-updater: only run in packaged builds
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
    });

    autoUpdater.on('update-available', info => {
      console.log('Update available:', info.version);
    });

    autoUpdater.on('update-not-available', () => {
      console.log('No update available');
    });

    autoUpdater.on('error', err => {
      console.error('AutoUpdater error:', err);
    });

    autoUpdater.on('download-progress', progress => {
      console.log(`Download progress: ${Math.round(progress.percent)}%`);
    });

    autoUpdater.on('update-downloaded', async (info) => {
      const result = await dialog.showMessageBox(win, {
        type: 'info',
        buttons: ['Instalar e reiniciar', 'Depois'],
        defaultId: 0,
        cancelId: 1,
        title: 'Atualização disponível',
        message: `Versão ${info.version} baixada. Deseja instalar agora?`
      });

      if (result.response === 0) {
        // allow the window to actually close when updater quits the app
        allowQuit = true;
        setTimeout(() => autoUpdater.quitAndInstall(), 1000);
      }
    });
  } else {
    console.log('App is not packaged — auto-updates disabled in development');
  }

  // IPC: reset PIN (desktop only)
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
    if (enable !== true && enable !== false) {
      return;
    }
    if (enable == true){
    app.setLoginItemSettings({
      openAtLogin: enable,
    });
  } else {
    app.setLoginItemSettings({
      openAtLogin: false,
    });
  }
  const cfg = loadConfig();
  cfg.autoStart = enable;
  saveConfig(cfg);
  });
});
