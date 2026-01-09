window.overlay.onUpdate((seconds) => {
  const s = seconds % 60;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) {
  document.getElementById("time").innerText = `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;   
} else { 
  document.getElementById("time").innerText = 
    `${m}:${s.toString().padStart(2, "0")}`;
  }
});
