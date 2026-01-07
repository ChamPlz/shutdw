const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let overlayWindow = null;

function createOverlay() {
  if (overlayWindow) return overlayWindow;

  overlayWindow = new BrowserWindow({
    width: 300,
    height: 120,
    frame: false,
    transparent: true,
    radii: [5,5,5,5],
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "overlayPreload.js")
    }
  });

  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

function closeOverlay() {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

function sendRemaining(seconds) {
  if (overlayWindow) {
    overlayWindow.webContents.send("overlay:update", seconds);
  }
}

ipcMain.on("overlay:cancel", () => {
  process.emit("cancel-shutdown");
});

module.exports = { createOverlay, closeOverlay, sendRemaining };
