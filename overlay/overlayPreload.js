const { contextBridge, ipcRenderer } = require("electron");

/**
 * API exposta para o overlay
 */
contextBridge.exposeInMainWorld("overlay", {
  /**
   * Registra callback para atualizações de tempo
   * @param {function} callback - Função chamada com o tempo restante em segundos
   */
  onUpdate: (callback) => {
    ipcRenderer.on("overlay:update", (_, seconds) => callback(seconds));
  },

  /**
   * Cancela o desligamento agendado
   */
  cancel: () => {
    ipcRenderer.send("overlay:cancel");
  },

  /**
   * Fecha a janela de overlay
   */
  close: () => {
    ipcRenderer.send("overlay:close");
  },
});
