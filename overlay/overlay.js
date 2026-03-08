/**
 * ShutDW - Overlay Script
 * Atualiza o display de tempo restante
 */

/**
 * Formata e exibe o tempo restante
 * @param {number} seconds - Segundos restantes
 */
function formatTime(seconds) {
  const s = seconds % 60;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const timeElement = document.getElementById("time");
  if (!timeElement) return;

  if (h > 0) {
    timeElement.innerText = `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  } else {
    timeElement.innerText = `${m}:${s.toString().padStart(2, "0")}`;
  }
}

// Register update callback
window.overlay?.onUpdate?.(formatTime);
