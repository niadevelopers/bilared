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
   AUTH FUNCTIONS
---------------------------- */

function sanitizeInput(value) {
  return value.replace(/<[^>]*>?/gm, "").replace(/[{}<>;$]/g, "").trim();
}

function showError(input, message) {
  let errorEl = input.nextElementSibling;
  if (!errorEl || !errorEl.classList.contains("error-msg")) {
    errorEl = document.createElement("small");
    errorEl.className = "error-msg";
    errorEl.style.color = "#ff4d4d";
    input.insertAdjacentElement("afterend", errorEl);
  }
  errorEl.textContent = message;
}

function clearErrors() {
  document.querySelectorAll(".error-msg").forEach((el) => el.remove());
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return "Email is required.";
  if (!emailRegex.test(email)) return "Please enter a valid email.";
  return "";
}

function validatePassword(password) {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (!/[A-Z]/.test(password)) return "Must include one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Must include one number.";
  return "";
}

function validateUsername(username) {
  if (!username) return "Username required.";
  if (username.length < 3) return "At least 3 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return "Only letters, numbers, and underscores.";
  return "";
}

async function login() {
  clearErrors();
  const emailVal = sanitizeInput(email.value);
  const passwordVal = sanitizeInput(password.value);
  const emailMsg = validateEmail(emailVal);
  const passwordMsg = validatePassword(passwordVal);
  if (emailMsg) return alert(emailMsg);
  if (passwordMsg) return alert(passwordMsg);

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
      loadWallet();
    } else alert(data.message || "Login failed");
  } catch (err) {
    console.error(err);
    alert("Login error");
  }
}

async function register() {
  clearErrors();
  const usernameVal = sanitizeInput(username.value);
  const emailVal = sanitizeInput(email.value);
  const passwordVal = sanitizeInput(password.value);
  const usernameMsg = validateUsername(usernameVal);
  const emailMsg = validateEmail(emailVal);
  const passwordMsg = validatePassword(passwordVal);
  if (usernameMsg) return alert(usernameMsg);
  if (emailMsg) return alert(emailMsg);
  if (passwordMsg) return alert(passwordMsg);

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
    if (data._id) alert("Registered successfully. You can now login.");
    else alert(data.message || "Registration failed");
  } catch (err) {
    console.error(err);
    alert("Registration error");
  }
}

loginBtn.onclick = login;
registerBtn.onclick = register;

logoutBtn.onclick = () => {
  localStorage.clear();
  token = null;
  user = null;
  authSection.classList.remove("hidden");
  gameUI.classList.add("hidden");
};

/* ---------------------------
   INITIAL PAGE LOGIC
---------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  if (!token) {
    authSection.classList.remove("hidden");
    gameUI.classList.add("hidden");
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
    const data = await res.json();
    if (availableEl) availableEl.textContent = Number(data.available || 0).toFixed(2);
    if (balanceEl) balanceEl.textContent = Number(data.balance || 0).toFixed(2);
    if (lockedEl) lockedEl.textContent = Number(data.locked || 0).toFixed(2);
  } catch (err) {
    console.error(err);
  }
}
setInterval(loadWallet, 10000);

/* ---------------------------
   TIMER SYSTEM (FORCED INSTANT RESET)
---------------------------- */
let timer = 30;
let totalTime = 30;
let frameHandle = null;
let gameRunning = false;

function forceFullTimer() {
  timer = totalTime;
  if (timerFill) {
    timerFill.style.transition = "none"; // disable all animation
    timerFill.style.width = "100%"; // force instantly full
  }
}

function tickTimer() {
  if (!gameRunning) return;
  timer -= 1 / 60;
  if (timer < 0) {
    timer = 0;
    if (timerFill) timerFill.style.width = "0%";
    playLoseSound();
    endGame("lose");
    return;
  }
  if (timerFill) {
    timerFill.style.transition = "none"; // prevent smoothing
    timerFill.style.width = `${(timer / totalTime) * 100}%`;
  }
  frameHandle = requestAnimationFrame(tickTimer);
}

/* ---------------------------
   GAME CORE
---------------------------- */
let player = { x: 0, y: 0, r: 10, color: "white", vx: 0, vy: 0 };
let tokens = [];
let hazards = [];
let sessionId = null;
let sessionToken = null;
let baseSpeed = 1.5;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTokenSound() { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(800, audioCtx.currentTime); g.gain.setValueAtTime(0.1, audioCtx.currentTime); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.15); }
function playHazardSound() { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(200, audioCtx.currentTime); g.gain.setValueAtTime(0.15, audioCtx.currentTime); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.15); }
function playWinSound() { let t = audioCtx.currentTime; for (let i = 0; i < 15; i++) { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(300 + i * 40, t + i * 0.6); g.gain.setValueAtTime(0.12, t + i * 0.6); o.connect(g).connect(audioCtx.destination); o.start(t + i * 0.6); o.stop(t + i * 0.6 + 0.5); } }
function playLoseSound() { let t = audioCtx.currentTime; for (let i = 0; i < 10; i++) { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(700 - i * 40, t + i * 0.5); g.gain.setValueAtTime(0.12, t + i * 0.5); o.connect(g).connect(audioCtx.destination); o.start(t + i * 0.5); o.stop(t + i * 0.5 + 0.4); } }

function random(min, max) { return Math.random() * (max - min) + min; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function setupGame() {
  arena.width = window.innerWidth;
  arena.height = window.innerHeight - 120;
  player.x = arena.width / 2;
  player.y = arena.height / 2;
  const numHazards = 8, numTokens = 10;
  tokens = Array.from({ length: numTokens }, () => ({
    x: random(50, arena.width - 50),
    y: random(50, arena.height - 50),
    r: 8,
    collected: false,
  }));
  hazards = Array.from({ length: numHazards }, () => ({
    x: random(50, arena.width - 50),
    y: random(50, arena.height - 50),
    r: random(10, 25),
    dx: random(-2, 2),
    dy: random(-2, 2),
  }));
}

function draw() {
  ctx.clearRect(0, 0, arena.width, arena.height);
  ctx.fillStyle = "lime";
  tokens.forEach(t => { if (!t.collected) { ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill(); } });
  ctx.fillStyle = "red";
  hazards.forEach(h => { ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();
}

function update() {
  hazards.forEach(h => {
    h.x += h.dx; h.y += h.dy;
    if (h.x < h.r || h.x > arena.width - h.r) h.dx *= -1;
    if (h.y < h.r || h.y > arena.height - h.r) h.dy *= -1;
    if (distance(player, h) < player.r + h.r) { playHazardSound(); endGame("lose"); }
  });
  tokens.forEach(t => {
    if (!t.collected && distance(player, t) < player.r + t.r) { t.collected = true; playTokenSound(); }
  });
  if (tokens.every(t => t.collected)) { playWinSound(); endGame("win"); }
}

function gameLoop() {
  if (!gameRunning) return;
  draw();
  update();
  frameHandle = requestAnimationFrame(gameLoop);
}

/* ---------------------------
   GAME START / END
---------------------------- */
async function startGame() {
  if (!token) return alert("Please login first.");
  const stake = parseInt(stakeAmount.value);
  if (isNaN(stake) || stake < 10 || stake > 100000) return alert("Invalid stake");

  forceFullTimer();

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
      gameRunning = true;
      forceFullTimer(); // full before actual loop
      requestAnimationFrame(gameLoop);
      tickTimer();
    } else alert(data.message || "Could not start session");
  } catch (err) {
    console.error(err);
    alert("Start game error");
  }
}

async function endGame(result) {
  if (!gameRunning) return;
  gameRunning = false;
  cancelAnimationFrame(frameHandle);
  forceFullTimer();

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

startGameBtn.onclick = startGame;
