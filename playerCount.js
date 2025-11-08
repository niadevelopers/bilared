(() => {
  window.addEventListener("DOMContentLoaded", () => {
    loadWallet();
  });

  const playerCountEl = document.getElementById("currentPlayers");
  const updatePlayerCount = () => {
    const randomPlayers = Math.floor(200 + Math.random() * 250);
    playerCountEl.textContent = `Online: ${randomPlayers.toLocaleString()}`;
  };

  setInterval(updatePlayerCount, 15000);
  updatePlayerCount();
})();

