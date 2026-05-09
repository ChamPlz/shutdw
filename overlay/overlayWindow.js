const { BrowserWindow, ipcMain, app } = require("electron");
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
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));

  overlayWindow.webContents.on("did-finish-load", () => {
    overlayWindow.webContents.executeJavaScript(`
      (function() {
        var btnClose = document.getElementById('btnClose');
        var btnCancel = document.getElementById('btnCancel');
        if (btnClose) btnClose.addEventListener('click', function(){ window.close(); });
        if (btnCancel) btnCancel.addEventListener('click', function(){ overlay.cancel(); });
      })();
    `).catch(() => {});
  });

  const win = overlayWindow;
  win.on("closed", () => {
    if (overlayWindow === win) {
      overlayWindow = null;
    }
  });

  return overlayWindow;
}

/**
 * Fecha e destrói a janela de overlay
 */
function closeOverlay() {
  if (overlayWindow) {
    // Cancela timer se ativo
    if (overlayTimer) {
      clearInterval(overlayTimer);
      overlayTimer = null;
    }
    // Remove listeners IPC para evitar memory leak
    overlayWindow.webContents.removeAllListeners("overlay:update");
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

// Cleanup listeners when overlay is destroyed
function cleanupIpcListeners() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.removeAllListeners("overlay:update");
  }
}

ipcMain.on("overlay:cancel", () => {
  process.emit("cancel-shutdown");
});

ipcMain.on("overlay:close", () => {
  closeOverlay();
});

// Ensure cleanup on app exit
app.on("before-quit", () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    cleanupIpcListeners();
  }
});

module.exports = {
  createOverlay,
  closeOverlay,
  sendRemaining,
  cleanupIpcListeners,
};
