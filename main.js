const { app, BrowserWindow, Tray, Menu } = require("electron");
const path = require("path");
require("./server/webServer");

let win;
let tray;

function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 700,
    autoHideMenuBar: true, // REMOVE File | Window
  });

  win.loadURL("http://localhost:3333");

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
