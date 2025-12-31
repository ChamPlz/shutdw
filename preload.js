const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  shutdown: () => ipcRenderer.invoke("shutdown-now"),
  restart: () => ipcRenderer.invoke("restart-now")
});