const { app, BrowserWindow, Tray, Menu, dialog } = require("electron");
const { autoUpdater } = require('electron-updater');
const path = require("path");

let win;
let tray;

function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 700,
    autoHideMenuBar: true, // REMOVE File | Window
  });

  win.loadFile("renderer/index.html");

  win.on("close", (e) => {
    e.preventDefault();
    win.hide(); // Vai para ícones ocultos
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // Remove menu global
  createWindow();

  tray = new Tray(path.join(__dirname, "icon.ico"));
  tray.setToolTip("ShutDW - Desligamento automatico");

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir", click: () => win.show() },
    { label: "Sair", click: () => app.exit() }
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
        setTimeout(() => autoUpdater.quitAndInstall(), 1000);
      }
    });
  } else {
    console.log('App is not packaged — auto-updates disabled in development');
  }
});
