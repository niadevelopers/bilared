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
const timerFill = document.getElementById("timerFill");

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
    .replace(/<[^>]*>?/gm, "")  // remove HTML tags
    .replace(/[{}<>;$]/g, "")   // remove code-like chars
    .trim();
}

// Utility: show error messages dynamically
function showError(input, message) {
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
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return "Email is required.";
  if (!emailRegex.test(email)) return "Please enter a valid email address.";
  return "";
}

function validatePassword(password) {
  if (!password) return "Password is required.";
  if (password.length < 6)
    return "Password must be at least 6 characters long.";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number.";
  return "";
}

function validateUsername(username) {
  if (!username) return "Username is required.";
  if (username.length < 3)
    return "Username must be at least 3 characters long.";
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return "Username can only contain letters, numbers, and underscores.";
  return "";
}

// ============================
// LOGIN FUNCTION (Validated)
// ============================
async function login() {
  clearErrors();

  const emailVal = sanitizeInput(email.value);
  const passwordVal = sanitizeInput(password.value);

  // Validation checks
  const emailMsg = validateEmail(emailVal);
  const passwordMsg = validatePassword(passwordVal);

  if (emailMsg) {
    showError(email, emailMsg);
    return alert(emailMsg);
  }
  if (passwordMsg) {
    showError(password, passwordMsg);
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
      authSection.classList.add("hidden");
      gameUI.classList.remove("hidden");
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

  const usernameVal = sanitizeInput(username.value);
  const emailVal = sanitizeInput(email.value);
  const passwordVal = sanitizeInput(password.value);

  // Validation checks
  const usernameMsg = validateUsername(usernameVal);
  const emailMsg = validateEmail(emailVal);
  const passwordMsg = validatePassword(passwordVal);

  if (usernameMsg) {
    showError(username, usernameMsg);
    return alert(usernameMsg);
  }
  if (emailMsg) {
    showError(email, emailMsg);
    return alert(emailMsg);
  }
  if (passwordMsg) {
    showError(password, passwordMsg);
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
loginBtn.onclick = login;
registerBtn.onclick = register;


logoutBtn.onclick = () => {
  localStorage.clear();
  token = null;
  user = null;
  authSection.classList.remove("hidden");
  gameUI.classList.add("hidden");
  if (withdrawOverlay) withdrawOverlay.classList.add("hidden");
};

/* ---------------------------
   INITIAL PAGE LOGIC
---------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  if (!token) {
    authSection.classList.remove("hidden");
    gameUI.classList.add("hidden");
    if (withdrawOverlay) withdrawOverlay.classList.add("hidden");
  } else {
    authSection.classList.add("hidden");
    gameUI.classList.remove("hidden");
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
    
    // Grab elements if they exist
    const balanceEl = document.getElementById("balance");
    const availableEl = document.getElementById("available");
    const lockedEl = document.getElementById("locked");

    // Display available balance always
    if (availableEl) availableEl.textContent = Number(data.available || 0).toFixed(2);

    // Optional: display balance and locked only if elements exist
    if (balanceEl) balanceEl.textContent = Number(data.balance || 0).toFixed(2);
    if (lockedEl) lockedEl.textContent = Number(data.locked || 0).toFixed(2);

  } catch (err) {
    console.error("Wallet load error:", err);
  }
}

// Auto-refresh wallet every 10 seconds
setInterval(loadWallet, 10000);
loadWallet();


/* ---------------------------
   DEPOSIT FUNCTION
---------------------------- */
depositBtn.onclick = async () => {
  if (!token) {
    alert("⚠️ Please log in to continue.");
    return;
  }

  const amountInput = prompt("💰 Enter deposit amount (KES):");
  const amount = parseFloat(amountInput);

  // Validate entered amount
  if (!amountInput || isNaN(amount)) {
    return alert("❌ Please enter a valid numeric amount.");
  }

  // Check minimum and maximum limits
  if (amount < 100) {
    return alert("⚠️ Minimum deposit is KSh 100. Please enter KSh 100 or more.");
  }
  if (amount > 150000) {
    return alert("⚠️ Maximum deposit limit is KSh 150,000. Please enter a smaller amount.");
  }

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

    // Initialize Paystack
    const handler = PaystackPop.setup({
      key: "pk_test_2b2ffe1c8b8f4b0da991dd13fc418bdf86dbed06",
      email: payerEmail,
      amount: Math.round(amount * 100), // Convert to kobo
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
withdrawBtn.onclick = () => {
  if (!token) return alert("⚠️ Please login first.");
  withdrawOverlay.classList.remove("hidden");
};

closeWithdraw.onclick = () => withdrawOverlay.classList.add("hidden");

submitWithdraw.onclick = async () => {
  const name = document.getElementById("wName").value.trim();
  const wemail = document.getElementById("wEmail").value.trim();
  const phone = document.getElementById("wPhone").value.trim();

  if (!name || !wemail || !phone) {
    return alert("❌ Please fill all withdrawal fields.");
  }

  // ✅ Check available balance
  const availableEl = document.getElementById("available");
  const availableBalance = parseFloat(availableEl.textContent.replace(/,/g, ""));
  
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
    withdrawOverlay.classList.add("hidden");
    loadWallet();
  } catch (err) {
    console.error("Withdraw error:", err);
    alert("❌ Withdrawal request failed. Please try again.");
  }
};

/* ----- FINAL GAME LOGIC (CLEAN + FORCED TIMER) ----- */

let gameRunning = false;
let player = { x: 0, y: 0, r: 10, color: "white", vx: 0, vy: 0 };
let tokens = [];
let hazards = [];
let sessionId = null;
let sessionToken = null;
let dragActive = false;
let touchStart = null;
let baseSpeed = 1.5;
let safeZoneRadius = 150;
let frameHandle = null;
let timer = 30;
let totalTime = 30;

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
  for (let i = 0; i < 15; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300 + i * 40, startTime + i * 0.6);
    gain.gain.setValueAtTime(0.12, startTime + i * 0.6);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startTime + i * 0.6);
    osc.stop(startTime + i * 0.6 + 0.5);
  }
}

function playLoseSound() {
  let startTime = audioCtx.currentTime;
  for (let i = 0; i < 10; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(700 - i * 40, startTime + i * 0.5);
    gain.gain.setValueAtTime(0.12, startTime + i * 0.5);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startTime + i * 0.5);
    osc.stop(startTime + i * 0.5 + 0.4);
  }
}

/* ----- UTILITIES ----- */
function random(min, max) {
  return Math.random() * (max - min) + min;
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ----- SETUP GAME ENVIRONMENT ----- */
function setupGame() {
  arena.width = window.innerWidth;
  arena.height = window.innerHeight - 120;
  player.x = arena.width / 2;
  player.y = arena.height / 2;
  player.vx = 0;
  player.vy = 0;

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
    } while (distance({ x: hx, y: hy }, player) < safeZoneRadius);

    hazards.push({
      x: hx,
      y: hy,
      r: random(10, 25),
      dx: random(-2, 2) * baseSpeed,
      dy: random(-2, 2) * baseSpeed,
      baseSpeed,
      jitterTimer: random(30, 120),
      chase: false,
      chaseTimer: 0,
      chaseCooldown: 0,
      glowPhase: 0,
    });
  }
}

/* ----- DRAW EVERYTHING ----- */
function draw() {
  ctx.clearRect(0, 0, arena.width, arena.height);

  ctx.fillStyle = "lime";
  tokens.forEach((t) => {
    if (!t.collected) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  hazards.forEach((h) => {
    if (h.chase) {
      h.glowPhase += 0.1;
      const glow = 0.5 + 0.5 * Math.sin(h.glowPhase);
      ctx.shadowBlur = 20 * glow;
      ctx.shadowColor = "yellow";
    } else ctx.shadowBlur = 0;

    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();
}

/* ----- UPDATE LOGIC ----- */
function update() {
  if (!dragActive) {
    player.vx *= 0.92;
    player.vy *= 0.92;
  }

  player.x += player.vx;
  player.y += player.vy;
  player.x = Math.max(player.r, Math.min(arena.width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(arena.height - player.r, player.y));

  hazards.forEach((h) => {
    const distToPlayer = distance(h, player);
    if (!h.chase && h.chaseCooldown <= 0 && distToPlayer < 150 && Math.random() < 0.015) {
      h.chase = true;
      h.chaseTimer = 120;
    }

    if (h.chase) {
      const angle = Math.atan2(player.y - h.y, player.x - h.x);
      const chaseSpeed = h.baseSpeed * 1.5;
      h.dx = Math.cos(angle) * chaseSpeed;
      h.dy = Math.sin(angle) * chaseSpeed;
      h.chaseTimer--;
      if (h.chaseTimer <= 0) {
        h.chase = false;
        h.chaseCooldown = random(60, 180);
      }
    } else {
      h.jitterTimer--;
      if (h.jitterTimer <= 0) {
        h.dx += random(-0.5, 0.5);
        h.dy += random(-0.5, 0.5);
        h.jitterTimer = random(30, 120);
      }
      if (h.chaseCooldown > 0) h.chaseCooldown--;
    }

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

/* ----- COUNTDOWN ----- */
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
      document.body.removeChild(overlay);
      callback();
    }
  }, 1000);
}

/* ----- CUSTOM ALERT ----- */
function showGameAlert(message, callback) {
  const modal = document.createElement("div");
  Object.assign(modal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "10000",
  });
  modal.innerHTML = `
    <div style="background:#fff;padding:30px 50px;border-radius:15px;text-align:center;max-width:300px;">
      <p style="font-size:20px;color:#222;">${message}</p>
      <button id="okBtn" style="margin-top:20px;padding:8px 20px;border:none;background:#007bff;color:white;border-radius:6px;cursor:pointer;">OK</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector("#okBtn").onclick = () => {
    document.body.removeChild(modal);
    if (callback) callback();
  };
}


function resetTimer() {
  cancelAnimationFrame(frameHandle);
  timer = totalTime;
  if (timerFill) {
    timerFill.style.transition = "none";
    timerFill.style.width = "100%";
  }
}

function startTimer() {
  resetTimer();
  tickTimer();
}

function tickTimer() {
  if (!gameRunning) return;
  timer -= 1 / 60;
  if (timer <= 0) {
    timer = 0;
    if (timerFill) timerFill.style.width = "0%";
    playLoseSound();
    endGame("lose");
    return;
  }
  if (timerFill) timerFill.style.width = `${(timer / totalTime) * 100}%`;
  frameHandle = requestAnimationFrame(tickTimer);
}

/* ----- START GAME ----- */
async function startGame() {
  if (!token) return alert("Please login first.");
  const stake = parseInt(stakeAmount.value);
  if (isNaN(stake) || stake < 10 || stake > 100000)
    return alert("Invalid stake");

  resetTimer();

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

      showCountdown(5, () => {
        resetTimer();
        gameRunning = true;
        requestAnimationFrame(gameLoop);
        startTimer();
      });
    } else alert(data.message || "Could not start session");
  } catch (err) {
    console.error(err);
    alert("Start game error");
  }
}

/* ----- END GAME ----- */
async function endGame(result) {
  if (!gameRunning) return;
  gameRunning = false;
  cancelAnimationFrame(frameHandle);
  resetTimer();

  try {
    await fetch(`${API_BASE}/game/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId, result }),
    });
    alert(result === "win" ? "You won!" : "You lost!");
    loadWallet();
  } catch (err) {
    console.error(err);
    alert("Error submitting game result.");
  }
}

/* ----- GAME LOOP ----- */
function gameLoop() {
  if (!gameRunning) return;
  draw();
  update();
  frameHandle = requestAnimationFrame(gameLoop);
}

startGameBtn.onclick = startGame;

