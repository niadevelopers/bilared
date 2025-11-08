/*window.addEventListener("DOMContentLoaded", () => {
  loadWallet();
});*/

const playerCountEl = document.getElementById("currentPlayers");
function updatePlayerCount() {
  const randomPlayers = Math.floor(200 + Math.random() * 250);
  playerCountEl.textContent = `Current Players: ${randomPlayers.toLocaleString()}`;
}
setInterval(updatePlayerCount, 15000);
updatePlayerCount();
