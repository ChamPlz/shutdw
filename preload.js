const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  shutdown: () => ipcRenderer.invoke("shutdown-now"),
  restart: () => ipcRenderer.invoke("restart-now"),
  close: () => ipcRenderer.invoke("close-app"),
  resetPin: (newPin) => ipcRenderer.invoke('reset-pin', newPin),
  autoStart: (enable) => ipcRenderer.invoke("set-auto-start", enable),
});