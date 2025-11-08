const passwordInput = document.getElementById("password");
const toggleBtn = document.getElementById("togglePassword");

let isVisible = false;

toggleBtn.addEventListener("click", () => {
  isVisible = !isVisible;

  passwordInput.type = isVisible ? "text" : "password";
  toggleBtn.textContent = isVisible ? "🙈" : "👁️";  
});

document.addEventListener("DOMContentLoaded", () => {
  const viewHistoryBtn = document.getElementById("viewHistoryBtn");

  const overlay = document.createElement("div");
  overlay.id = "historyOverlay";
  overlay.innerHTML = `
    <div class="history-content">
      <h3>Game History</h3>
      <div class="history-list" id="historyList"></div>
      <button id="closeHistory">Close</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const historyList = document.getElementById("historyList");
  const closeBtn = document.getElementById("closeHistory");

  viewHistoryBtn.addEventListener("click", () => {
    overlay.classList.add("active");
    loadHistory();
  });

  closeBtn.addEventListener("click", () => {
    overlay.classList.remove("active");
  });

  function saveGameResult(result) {
    let history = JSON.parse(sessionStorage.getItem("gameHistory")) || [];

    history.push({
      result,
      time: new Date().toLocaleTimeString(),
    });

    if (history.length > 10) {
      history = history.slice(-10); // keep last 10 entries
    }

    sessionStorage.setItem("gameHistory", JSON.stringify(history));
  }

  function loadHistory() {
    historyList.innerHTML = "";
    const history = JSON.parse(sessionStorage.getItem("gameHistory")) || [];

    if (history.length === 0) {
      historyList.innerHTML =
        "<p style='text-align:center;opacity:0.7;'>No games played this session.</p>";
      return;
    }

    history
      .slice()
      .reverse()
      .forEach((item) => {
        const div = document.createElement("div");
        div.className = `history-item ${item.result}`;
        div.innerHTML = `
          <span>${item.result === "win" ? "✅ Win" : "❌ Loss"}</span>
          <span>${item.time}</span>
          `;
        historyList.appendChild(div);
      });
  }
  window.saveGameResult = saveGameResult;
});
