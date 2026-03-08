const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");

/**
 * Estado da janela de overlay
 */
let overlayWindow = null;

/**
 * Cria a janela de overlay de contagem regressiva
 * @returns {BrowserWindow|null}
 */
function createOverlay() {
  if (overlayWindow) {
    return overlayWindow;
  }

  overlayWindow = new BrowserWindow({
    width: 300,
    height: 120,
    frame: false,
    transparent: true,
    roundedCorners: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "overlayPreload.js"),
    },
  });

  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

/**
 * Fecha e destrói a janela de overlay
 */
function closeOverlay() {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

/**
 * Envia o tempo restante para o overlay
 * @param {number} seconds - Segundos restantes
 */
function sendRemaining(seconds) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay:update", seconds);
  }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

ipcMain.on("overlay:cancel", () => {
  process.emit("cancel-shutdown");
});

ipcMain.on("overlay:close", () => {
  closeOverlay();
});

module.exports = {
  createOverlay,
  closeOverlay,
  sendRemaining,
};
