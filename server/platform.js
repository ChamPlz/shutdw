/**
 * Comandos de sistema adaptados por plataforma (Windows, Linux, macOS).
 * Centraliza toda a lógica de detecção de OS para shutdown/reboot/cancel.
 */

const { platform } = process;

/**
 * Retorna o comando para desligar o sistema imediatamente
 */
function shutdownNow() {
  switch (platform) {
    case "win32":
      return "shutdown /s /t 0";
    case "linux":
      return "shutdown -h now";
    case "darwin":
      return "osascript -e 'tell app \"System Events\" to shut down'";
    default:
      return "shutdown -h now";
  }
}

/**
 * Retorna o comando para desligar com delay (em segundos)
 * @param {number} seconds
 */
function shutdownWithDelay(seconds) {
  switch (platform) {
    case "win32":
      return `shutdown /s /t ${seconds}`;
    case "linux":
      return `shutdown -h +${Math.ceil(seconds / 60)}`;
    case "darwin":
      return `osascript -e 'tell app \"System Events\" to shut down'`;
    default:
      return `shutdown -h +${Math.ceil(seconds / 60)}`;
  }
}

/**
 * Retorna o comando para cancelar um desligamento agendado no OS
 */
function cancelSystemShutdown() {
  switch (platform) {
    case "win32":
      return "shutdown /a";
    case "linux":
      return "shutdown -c";
    case "darwin":
      return "killall shutdown";
    default:
      return "shutdown -c";
  }
}

/**
 * Verifica se a plataforma atual é suportada
 */
function isSupported() {
  return ["win32", "linux", "darwin"].includes(platform);
}

/**
 * Retorna o nome amigável da plataforma
 */
function platformName() {
  const names = { win32: "Windows", linux: "Linux", darwin: "macOS" };
  return names[platform] || platform;
}

module.exports = {
  shutdownNow,
  shutdownWithDelay,
  cancelSystemShutdown,
  isSupported,
  platformName,
};
