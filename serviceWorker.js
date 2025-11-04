  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log(' Service Worker Registered'))
      .catch(err => console.log(' SW registration failed:', err));
  }
    
    window.addEventListener("DOMContentLoaded", () => {
  loadWallet();
});

const playerCountEl = document.getElementById("currentPlayers");
function updatePlayerCount() {
  const randomPlayers = Math.floor(200 + Math.random() * 250);
  playerCountEl.textContent = `Current Players: ${randomPlayers.toLocaleString()}`;
}
setInterval(updatePlayerCount, 15000);
updatePlayerCount();
