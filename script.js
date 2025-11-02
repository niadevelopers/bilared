const API_BASE = "/api";
let token = localStorage.getItem("token");
let user = null;

/* ---------------------------
   DOM ELEMENTS
---------------------------- */
const email = document.getElementById("email");
const password = document.getElementById("password");
const username = document.getElementById("username");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const authSection = document.getElementById("auth-section");
const gameUI = document.getElementById("game-ui");
const arena = document.getElementById("arena");
const ctx = arena.getContext("2d");

// NOTE: We will create timerFill dynamically each round.
// Keep reference variable here but DO NOT rely on existing DOM element.
let timerFill = null;

const balanceEl = document.getElementById("balance");
const availableEl = document.getElementById("available");
const lockedEl = document.getElementById("locked");
const startGameBtn = document.getElementById("startGameBtn");
const stakeAmount = document.getElementById("stakeAmount");
const depositBtn = document.getElementById("depositBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const logoutBtn = document.getElementById("logoutBtn");

const withdrawOverlay = document.getElementById("withdrawOverlay");
const closeWithdraw = document.getElementById("closeWithdraw");
const submitWithdraw = document.getElementById("submitWithdraw");

if (withdrawOverlay) withdrawOverlay.classList.add("hidden");

/* ---------------------------
   AUTH FUNCTIONS (UPDATED)
---------------------------- */

// Utility: sanitize input (remove potential XSS and spaces)
function sanitizeInput(value) {
  return value
    .replace(/<[^>]*>?/gm, "") // remove HTML tags
    .replace(/[{}<>;$]/g, "") // remove code-like chars
    .trim();
}

// Utility: show error messages dynamically
function showError(input, message) {
  if (!input) return;
  let errorEl = input.nextElementSibling;
  if (!errorEl || !errorEl.classList.contains("error-msg")) {
    errorEl = document.createElement("small");
    errorEl.className = "error-msg";
    errorEl.style.color = "#ff4d4d";
    errorEl.style.display = "block";
    errorEl.style.marginTop = "4px";
    input.insertAdjacentElement("afterend", errorEl);
  }
  errorEl.textContent = message;
}

// Utility: clear existing errors
function clearErrors() {
  document.querySelectorAll(".error-msg").forEach((el) => el.remove());
}

// Validation helper functions
function validateEmail(emailVal) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailVal) return "Email is required.";
  if (!emailRegex.test(emailVal)) return "Please enter a valid email address.";
  return "";
}

function validatePassword(passwordVal) {
  if (!passwordVal) return "Password is required.";
  if (passwordVal.length < 6) return "Password must be at least 6 characters long.";
  if (!/[A-Z]/.test(passwordVal)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(passwordVal)) return "Password must contain at least one number.";
  return "";
}

function validateUsername(usernameVal) {
  if (!usernameVal) return "Username is required.";
  if (usernameVal.length < 3) return "Username must be at least 3 characters long.";
  if (!/^[a-zA-Z0-9_]+$/.test(usernameVal)) return "Username can only contain letters, numbers, and underscores.";
  return "";
}

// ============================
// LOGIN FUNCTION (Validated)
// ============================
async function login() {
  clearErrors();

  const emailVal = sanitizeInput(email ? email.value : "");
  const passwordVal = sanitizeInput(password ? password.value : "");

  const emailMsg = validateEmail(emailVal);
  const passwordMsg = validatePassword(passwordVal);

  if (emailMsg) {
    if (email) showError(email, emailMsg);
    return alert(emailMsg);
  }
  if (passwordMsg) {
    if (password) showError(password, passwordMsg);
    return alert(passwordMsg);
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailVal, password: passwordVal }),
    });
    const data = await res.json();

    if (data.token) {
      token = data.token;
      localStorage.setItem("token", token);
      user = data.user || null;
      if (authSection) authSection.classList.add("hidden");
      if (gameUI) gameUI.classList.remove("hidden");
      await loadWallet();
    } else {
      alert(data.message || "Login failed");
    }
  } catch (err) {
    console.error(err);
    alert("Login error");
  }
}

// ============================
// REGISTER FUNCTION (Validated)
// ============================
async function register() {
  clearErrors();

  const usernameVal = sanitizeInput(username ? username.value : "");
  const emailVal = sanitizeInput(email ? email.value : "");
  const passwordVal = sanitizeInput(password ? password.value : "");

  const usernameMsg = validateUsername(usernameVal);
  const emailMsg = validateEmail(emailVal);
  const passwordMsg = validatePassword(passwordVal);

  if (usernameMsg) {
    if (username) showError(username, usernameMsg);
    return alert(usernameMsg);
  }
  if (emailMsg) {
    if (email) showError(email, emailMsg);
    return alert(emailMsg);
  }
  if (passwordMsg) {
    if (password) showError(password, passwordMsg);
    return alert(passwordMsg);
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: usernameVal,
        email: emailVal,
        password: passwordVal,
      }),
    });
    const data = await res.json();

    if (data._id) {
      alert("Registered successfully. You can now login.");
    } else {
      alert(data.message || "Registration failed");
    }
  } catch (err) {
    console.error(err);
    alert("Registration error");
  }
}

// ============================
// EVENT LISTENERS
// ============================
if (loginBtn) loginBtn.onclick = login;
if (registerBtn) registerBtn.onclick = register;

if (logoutBtn) {
  logoutBtn.onclick = () => {
    localStorage.clear();
    token = null;
    user = null;
    if (authSection) authSection.classList.remove("hidden");
    if (gameUI) gameUI.classList.add("hidden");
    if (withdrawOverlay) withdrawOverlay.classList.add("hidden");
  };
}

/* ---------------------------
   INITIAL PAGE LOGIC
---------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  if (!token) {
    if (authSection) authSection.classList.remove("hidden");
    if (gameUI) gameUI.classList.add("hidden");
    if (withdrawOverlay) withdrawOverlay.classList.add("hidden");
  } else {
    if (authSection) authSection.classList.add("hidden");
    if (gameUI) gameUI.classList.remove("hidden");
    loadWallet();
  }
});

/* ---------------------------
   WALLET FUNCTIONS
---------------------------- */
async function loadWallet() {
  try {
    const res = await fetch(`${API_BASE}/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.error("Wallet fetch failed:", data || "Unknown error");
      return;
    }

    const data = await res.json();

    if (availableEl) availableEl.textContent = Number(data.available || 0).toFixed(2);
    if (balanceEl) balanceEl.textContent = Number(data.balance || 0).toFixed(2);
    if (lockedEl) lockedEl.textContent = Number(data.locked || 0).toFixed(2);
  } catch (err) {
    console.error("Wallet load error:", err);
  }
}

setInterval(loadWallet, 10000);
loadWallet();

/* ---------------------------
   DEPOSIT FUNCTION
---------------------------- */
if (depositBtn) depositBtn.onclick = async () => {
  if (!token) {
    alert("⚠️ Please log in to continue.");
    return;
  }

  const amountInput = prompt("💰 Enter deposit amount (KES):");
  const amount = parseFloat(amountInput);

  if (!amountInput || isNaN(amount)) {
    return alert("❌ Please enter a valid numeric amount.");
  }
  if (amount < 100) return alert("⚠️ Minimum deposit is KSh 100. Please enter KSh 100 or more.");
  if (amount > 150000) return alert("⚠️ Maximum deposit limit is KSh 150,000. Please enter a smaller amount.");

  const payerEmail = prompt("📧 Enter your email for this deposit:");
  if (!payerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
    return alert("❌ Please enter a valid email address.");
  }

  try {
    const res = await fetch(`${API_BASE}/paystack/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount, email: payerEmail }),
    });

    const data = await res.json();

    if (!data.status) {
      return alert(`⚠️ Payment initialization failed: ${data.message}`);
    }

    const handler = PaystackPop.setup({
      key: "pk_test_2b2ffe1c8b8f4b0da991dd13fc418bdf86dbed06",
      email: payerEmail,
      amount: Math.round(amount * 100),
      currency: "KES",
      reference: data.data.reference,
      callback: function () {
        alert("✅ Deposit successful! Your wallet will update shortly.");
        setTimeout(loadWallet, 2000);
      },
      onClose: function () {
        alert("💡 Deposit window closed. No transaction was made.");
      },
    });

    handler.openIframe();
  } catch (err) {
    console.error("Deposit error:", err);
    alert("❌ Failed to initialize deposit. Please check your connection or try again later.");
  }
};

/* ---------------------------
   WITHDRAW FUNCTION
---------------------------- */
if (withdrawBtn) withdrawBtn.onclick = () => {
  if (!token) return alert("⚠️ Please login first.");
  if (withdrawOverlay) withdrawOverlay.classList.remove("hidden");
};

if (closeWithdraw) closeWithdraw.onclick = () => withdrawOverlay.classList.add("hidden");

if (submitWithdraw) submitWithdraw.onclick = async () => {
  const name = document.getElementById("wName").value.trim();
  const wemail = document.getElementById("wEmail").value.trim();
  const phone = document.getElementById("wPhone").value.trim();

  if (!name || !wemail || !phone) {
    return alert("❌ Please fill all withdrawal fields.");
  }

  const availableElLocal = document.getElementById("available");
  const availableBalance = parseFloat((availableElLocal ? availableElLocal.textContent : "0").replace(/,/g, ""));

  if (isNaN(availableBalance)) {
    return alert("⚠️ Unable to read your available balance.");
  }

  if (availableBalance < 200) {
    return alert("⚠️ Minimum withdrawal amount is KSh 200. You cannot withdraw below this limit.");
  }

  try {
    const res = await fetch(`${API_BASE}/wallet/withdraw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, email: wemail, phone }),
    });

    const data = await res.json();
    alert(data.message || "✅ Withdrawal submitted for review.");
    if (withdrawOverlay) withdrawOverlay.classList.add("hidden");
    loadWallet();
  } catch (err) {
    console.error("Withdraw error:", err);
    alert("❌ Withdrawal request failed. Please try again.");
  }
};

/* ----- FINAL GAME LOGIC (CLEAN + HARD TIMER) ----- */

let gameRunning = false;
let player = { x: 0, y: 0, r: 10, color: "white", vx: 0, vy: 0 };
let tokens = [];
let hazards = [];
let sessionId = null;
let sessionToken = null;
let frameHandle = null;
let gameFrame = null;
let timerFrame = null;
let timer = 30;
let totalTime = 30;
let lastFrameTime = null;

/* ----- AUDIO SETUP ----- */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTokenSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

function playHazardSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

function playWinSound() {
  let startTime = audioCtx.currentTime;
  for (let i = 0; i < 8; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400 + i * 60, startTime + i * 0.1);
    gain.gain.setValueAtTime(0.08, startTime + i * 0.1);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startTime + i * 0.1);
    osc.stop(startTime + i * 0.1 + 0.08);
  }
}

function playLoseSound() {
  let startTime = audioCtx.currentTime;
  for (let i = 0; i < 6; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(700 - i * 50, startTime + i * 0.07);
    gain.gain.setValueAtTime(0.08, startTime + i * 0.07);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startTime + i * 0.07);
    osc.stop(startTime + i * 0.07 + 0.06);
  }
}

/* ----- UTILITIES ----- */
function random(min, max) {
  return Math.random() * (max - min) + min;
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ----- TIMER & BAR CREATION (FORCE CONTROL) ----- */
function createTimerBar() {
  // Ensure there is a parent #timerBar at bottom. If it doesn't exist, create it.
  let bar = document.getElementById("timerBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "timerBar";
    // minimal inline style to place at bottom — user CSS can override layout.
    Object.assign(bar.style, {
      position: "absolute",
      left: "0",
      right: "0",
      bottom: "0",
      height: "10px",
      width: "100%",
      background: "#333",
      zIndex: "9999",
    });
    document.body.appendChild(bar);
  } else {
    // clear previous fills
    bar.innerHTML = "";
  }

  // Create fresh fill
  const fill = document.createElement("div");
  fill.id = "timerFill";
  // Inline style controlled by JS so CSS transitions do not interfere
  Object.assign(fill.style, {
    height: "100%",
    width: "100%",
    background: "linear-gradient(to right, #ffcc00, #ff5500)",
    boxShadow: "0 0 8px #ffcc00",
    transition: "none",
  });

  bar.appendChild(fill);
  return fill;
}

/* ----- GAME SETUP ----- */
function setupGame() {
  arena.width = window.innerWidth;
  arena.height = window.innerHeight - 120;
  player.x = arena.width / 2;
  player.y = arena.height / 2;
  player.vx = player.vy = 0;

  const isMobile = /mobile|iphone|ipad|ipod|android/i.test(navigator.userAgent);
  const numHazards = isMobile ? 5 : 9;
  const numTokens = isMobile ? 8 : 12;

  tokens = [];
  for (let i = 0; i < numTokens; i++) {
    tokens.push({
      x: random(50, arena.width - 50),
      y: random(50, arena.height - 50),
      r: 8,
      collected: false,
    });
  }

  hazards = [];
  for (let i = 0; i < numHazards; i++) {
    let hx, hy;
    do {
      hx = random(50, arena.width - 50);
      hy = random(50, arena.height - 50);
    } while (distance({ x: hx, y: hy }, player) < 150);

    hazards.push({
      x: hx,
      y: hy,
      r: random(10, 25),
      dx: random(-2, 2),
      dy: random(-2, 2),
    });
  }
}

/* ----- DRAW ALL GAME ELEMENTS ----- */
function draw() {
  ctx.clearRect(0, 0, arena.width, arena.height);

  // Tokens
  ctx.fillStyle = "lime";
  tokens.forEach((t) => {
    if (!t.collected) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Hazards
  ctx.fillStyle = "red";
  hazards.forEach((h) => {
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Player
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
}

/* ----- UPDATE MOVEMENT, COLLISIONS ----- */
function update() {
  if (!gameRunning) return;

  // simple friction-less movement (your original logic may update vx/vy elsewhere)
  player.x += player.vx;
  player.y += player.vy;
  player.x = Math.max(player.r, Math.min(arena.width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(arena.height - player.r, player.y));

  hazards.forEach((h) => {
    h.x += h.dx;
    h.y += h.dy;
    if (h.x < h.r || h.x > arena.width - h.r) h.dx *= -1;
    if (h.y < h.r || h.y > arena.height - h.r) h.dy *= -1;
  });

  tokens.forEach((t) => {
    if (!t.collected && distance(player, t) < player.r + t.r) {
      t.collected = true;
      playTokenSound();
    }
  });

  hazards.forEach((h) => {
    if (distance(player, h) < player.r + h.r) {
      playHazardSound();
      endGame("lose");
    }
  });

  if (tokens.every((t) => t.collected)) {
    playWinSound();
    endGame("win");
  }
}

/* ----- TIMER CONTROL (PURE JS) ----- */
function resetTimerBarAndState() {
  // Cancel any running timer animation frames
  if (timerFrame) {
    cancelAnimationFrame(timerFrame);
    timerFrame = null;
  }
  if (gameFrame) {
    cancelAnimationFrame(gameFrame);
    gameFrame = null;
  }
  // Recreate the timer bar and fill fresh
  timerFill = createTimerBar();
  // Reset timer state variables
  timer = totalTime = 30; // enforce 30 seconds per round
  lastFrameTime = null;
}

let timerStartPerf = null;
function timerLoop(now) {
  if (!gameRunning) return; // do nothing if not running
  if (!timerStartPerf) timerStartPerf = now;
  const elapsedSec = (now - timerStartPerf) / 1000;
  const remaining = Math.max(0, totalTime - elapsedSec);
  timer = remaining;

  if (timerFill) {
    // set width strictly from JS (no CSS transitions)
    timerFill.style.transition = "none";
    timerFill.style.width = `${(timer / totalTime) * 100}%`;
  }

  if (remaining <= 0) {
    // time's up
    if (timerFill) timerFill.style.width = "0%";
    playLoseSound();
    endGame("lose");
    return;
  }
  timerFrame = requestAnimationFrame(timerLoop);
}

/* ----- START / END GAME ----- */
async function startGame() {
  if (!token) return alert("Please login first.");
  const stake = parseInt(stakeAmount ? stakeAmount.value : "0", 10);
  if (isNaN(stake) || stake < 10 || stake > 100000) return alert("Invalid stake");

  // Forcefully reset timer bar and internal state now (fresh every round)
  resetTimerBarAndState();

  try {
    const res = await fetch(`${API_BASE}/game/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ stake }),
    });
    const data = await res.json();

    if (data.sessionId) {
      sessionId = data.sessionId;
      sessionToken = data.sessionToken;
      setupGame();

      // Show countdown then start game and timer simultaneously from JS-controlled clock
      showCountdown(5, () => {
        // ensure any previous frames canceled
        if (timerFrame) {
          cancelAnimationFrame(timerFrame);
          timerFrame = null;
        }
        if (gameFrame) {
          cancelAnimationFrame(gameFrame);
          gameFrame = null;
        }
        // start fresh
        timerStartPerf = null;
        gameRunning = true;
        // start game loop and timer loop: both use requestAnimationFrame and independent clocks
        gameFrame = requestAnimationFrame(gameLoop);
        timerFrame = requestAnimationFrame(timerLoop);
      });
    } else {
      alert(data.message || "Could not start session");
    }
  } catch (err) {
    console.error(err);
    alert("Start game error");
  }
}

async function endGame(result) {
  // If game already stopped, still ensure timer bar is frozen and state cleared
  if (!gameRunning) {
    // Still ensure any frames are canceled and timer bar is full (so next start recreates)
    if (timerFrame) {
      cancelAnimationFrame(timerFrame);
      timerFrame = null;
    }
    if (gameFrame) {
      cancelAnimationFrame(gameFrame);
      gameFrame = null;
    }
  }

  // Stop gameplay
  gameRunning = false;

  // Cancel frames
  if (timerFrame) {
    cancelAnimationFrame(timerFrame);
    timerFrame = null;
  }
  if (gameFrame) {
    cancelAnimationFrame(gameFrame);
    gameFrame = null;
  }

  // Freeze timer visual at current or full state (we choose to leave at current state).
  // But to meet your requirement - fill instantly on round end and keep it full until next start:
  if (timerFill) {
    timerFill.style.transition = "none";
    // Keep the bar full so player can't gain extra time: as requested, fill on round end
    timerFill.style.width = "100%";
  }

  // Submit result in background; keep UI immediate
  try {
    fetch(`${API_BASE}/game/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId, result }),
    }).catch((e) => console.error("Result submit failed:", e));
  } catch (err) {
    console.error("Result submit error:", err);
  }

  // Show message and refresh wallet
  try {
    alert(result === "win" ? "You won!" : "You lost!");
  } catch (e) {}

  loadWallet();

  // Keep timerFill as-is (full) until a user clicks Start which will recreate and reset everything
}

/* ----- GAME LOOP ----- */
function gameLoop() {
  if (!gameRunning) return;
  draw();
  update();
  gameFrame = requestAnimationFrame(gameLoop);
}

/* ----- COUNTDOWN (same as before) ----- */
function showCountdown(seconds, callback) {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.7)",
    color: "white",
    fontSize: "90px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "9999",
    fontWeight: "bold",
  });
  document.body.appendChild(overlay);
  let count = seconds;
  overlay.textContent = count;
  const interval = setInterval(() => {
    count--;
    if (count > 0) overlay.textContent = count;
    else {
      clearInterval(interval);
      try {
        document.body.removeChild(overlay);
      } catch (e) {}
      callback();
    }
  }, 1000);
}

/* ----- HOOK START BUTTON ----- */
if (startGameBtn) startGameBtn.onclick = startGame;

/* ----- END OF FILE ----- */
