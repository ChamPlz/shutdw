window.overlay.onUpdate((seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  document.getElementById("time").innerText =
    `${m}:${s.toString().padStart(2, "0")}`;
});
