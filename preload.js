const { contextBridge, ipcRenderer } = require("electron");

/**
 * API exposta para o renderer process
 */
contextBridge.exposeInMainWorld("api", {
  /** Fecha o aplicativo (minimiza para tray) */
  close: () => ipcRenderer.invoke("close-app"),

  /** Redefine o PIN de acesso */
  resetPin: (newPin) => ipcRenderer.invoke("reset-pin", newPin),

  /** Habilita ou desabilita o início automático com o sistema */
  autoStart: (enable) => ipcRenderer.invoke("set-auto-start", enable),

  /** Verifica se o início automático está habilitado */
  checkAutoStart: () => ipcRenderer.invoke("check-auto-start"),

  /** Abre URL no navegador padrão */
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  /** Obtém a versão do app */
  getVersion: () => ipcRenderer.invoke("get-app-version"),

  /** Verifica atualizações manualmente */
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),

  /** Instala a atualização baixada e reinicia */
  installUpdate: () => ipcRenderer.invoke("install-update"),

  /** Registra listener para eventos de atualização */
  onUpdateEvent: (callback) => {
    ipcRenderer.on("update-event", (_event, data) => callback(data));
  },
});
