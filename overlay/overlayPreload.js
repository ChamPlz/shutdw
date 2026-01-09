const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  onUpdate: (cb) => ipcRenderer.on("overlay:update", (_, s) => cb(s)),
  cancel: () => ipcRenderer.send("overlay:cancel"),
  close: () => ipcRenderer.send("overlay:close"), 
});
