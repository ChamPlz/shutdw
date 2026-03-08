const { contextBridge, ipcRenderer } = require("electron");

/**
 * API exposta para o renderer process
 */
contextBridge.exposeInMainWorld("api", {
  /**
   * Fecha o aplicativo
   */
  close: () => ipcRenderer.invoke("close-app"),

  /**
   * Redefine o PIN de acesso
   * @param {string} newPin - Novo PIN
   * @returns {Promise<{status?: string, error?: string}>}
   */
  resetPin: (newPin) => ipcRenderer.invoke('reset-pin', newPin),

  /**
   * Habilita ou desabilita o início automático com o sistema
   * @param {boolean} enable
   */
  autoStart: (enable) => ipcRenderer.invoke("set-auto-start", enable),

  /**
   * Verifica se o início automático está habilitado
   * @returns {Promise<boolean>}
   */
  checkAutoStart: () => ipcRenderer.invoke("check-auto-start"),

  /**
   * Abre URL no navegador padrão
   * @param {string} url
   * @returns {Promise<{success?: boolean, error?: string}>}
   */
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
