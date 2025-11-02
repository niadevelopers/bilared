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
    errorEl.style.display = "block";
    errorEl.style.marginTop = "4px";
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
  if (!emailRegex.test(email)) return "Please enter a valid email address.";
  return "";
}

function validatePassword(password) {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  return "";
}

function validateUsername(username) {
  if (!username) return "Username is required.";
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return "Username can only contain letters, numbers, and underscores.";
  return "";
}

async function login() {
  clearErrors();
  const emailVal = sanitizeInput(email.value);
  const passwordVal = sanitizeInput(password.value);
  const emailMsg = validateEmail(emailVal);
  const passwordMsg = validatePassword(passwordVal);
  if (emailMsg) return showError(email, emailMsg);
  if (passwordMsg) return showError(password, passwordMsg);

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
    } else alert(data.message || "Login failed");
  } catch {
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
  if (usernameMsg) return showError(username, usernameMsg);
  if (emailMsg) return showError(email, emailMsg);
  if (passwordMsg) return showError(password, passwordMsg);

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameVal, email: emailVal, password: passwordVal }),
    });
    const data = await res.json();
    alert(data._id ? "Registered successfully." : data.message || "Registration failed");
  } catch {
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
  if (withdrawOverlay) withdrawOverlay.classList.add("hidden");
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
   WALLET
---------------------------- */
async function loadWallet() {
  try {
    const res = await fetch(`${API_BASE}/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (availableEl) availableEl.textContent = Number(data.available || 0).toFixed(2);
    if (balanceEl) balanceEl.textContent = Number(data.balance || 0).toFixed(2);
    if (lockedEl) lockedEl.textContent = Number(data.locked || 0).toFixed(2);
  } catch {}
}
setInterval(loadWallet, 10000);

/* ---------------------------
   DEPOSIT / WITHDRAW
---------------------------- */
depositBtn.onclick = async () => {
  if (!token) return alert("Please log in.");
  const amount = parseFloat(prompt("Enter deposit amount (KES):"));
  if (!amount || isNaN(amount)) return alert("Invalid amount.");
  if (amount < 100) return alert("Minimum deposit is KSh 100.");
  if (amount > 150000) return alert("Maximum is KSh 150,000.");
  const payerEmail = prompt("Enter your email:");
  if (!payerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) return alert("Invalid email.");
  try {
    const res = await fetch(`${API_BASE}/paystack/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount, email: payerEmail }),
    });
    const data = await res.json();
    if (!data.status) return alert(`Payment init failed: ${data.message}`);
    const handler = PaystackPop.setup({
      key: "pk_test_2b2ffe1c8b8f4b0da991dd13fc418bdf86dbed06",
      email: payerEmail,
      amount: Math.round(amount * 100),
      currency: "KES",
      reference: data.data.reference,
      callback: () => setTimeout(loadWallet, 2000),
    });
    handler.openIframe();
  } catch {
    alert("Deposit failed.");
  }
};

withdrawBtn.onclick = () => {
  if (!token) return alert("Login first.");
  withdrawOverlay.classList.remove("hidden");
};
closeWithdraw.onclick = () => withdrawOverlay.classList.add("hidden");

submitWithdraw.onclick = async () => {
  const name = document.getElementById("wName").value.trim();
  const wemail = document.getElementById("wEmail").value.trim();
  const phone = document.getElementById("wPhone").value.trim();
  if (!name || !wemail || !phone) return alert("Fill all fields.");
  const availableBalance = parseFloat(availableEl.textContent.replace(/,/g, ""));
  if (availableBalance < 200) return alert("Min withdrawal is KSh 200.");
  try {
    const res = await fetch(`${API_BASE}/wallet/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, email: wemail, phone }),
    });
    const data = await res.json();
    alert(data.message || "Withdrawal sent.");
    withdrawOverlay.classList.add("hidden");
    loadWallet();
  } catch {
    alert("Withdraw failed.");
  }
};

/* ---------------------------
   FINAL GAME LOGIC
---------------------------- */
let gameRunning = false;
let player = { x: 0, y: 0, r: 10, color: "white", vx: 0, vy: 0 };
let tokens = [];
let hazards = [];
let sessionId = null;
let sessionToken = null;
let frameHandle = null;
let timer = 30;
let totalTime = 30;
let lastFrameTime = null;
let timerFill = null;

/* ----- AUDIO ----- */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(type, freq, dur, vol = 0.1) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}
const playTokenSound = () => playTone("triangle", 800, 0.15);
const playHazardSound = () => playTone("sawtooth", 200, 0.15);
const playWinSound = () => playTone("sine", 600, 0.4);
const playLoseSound = () => playTone("sine", 150, 0.4);

/* ----- UTILITIES ----- */
function random(min, max) { return Math.random() * (max - min) + min; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

/* ----- TIMER CREATION ----- */
function createTimerBar() {
  const bar = document.getElementById("timerBar");
  if (!bar) return null;
  bar.innerHTML = ""; // clear any old fill

  const fill = document.createElement("div");
  fill.id = "timerFill";
  fill.style.height = "100%";
  fill.style.width = "100%";
  fill.style.background = "linear-gradient(to right, #ffcc00, #ff5500)";
  fill.style.boxShadow = "0 0 8px #ffcc00";
  fill.style.transition = "none"; // no CSS animation
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

/* ----- DRAW ----- */
function draw() {
  ctx.clearRect(0, 0, arena.width, arena.height);
  ctx.fillStyle = "lime";
  tokens.forEach((t) => { if (!t.collected) ctx.beginPath(), ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2), ctx.fill(); });
  ctx.fillStyle = "red";
  hazards.forEach((h) => { ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();
}

/* ----- UPDATE ----- */
function update() {
  player.x = Math.max(player.r, Math.min(arena.width - player.r, player.x + player.vx));
  player.y = Math.max(player.r, Math.min(arena.height - player.r, player.y + player.vy));
  hazards.forEach((h) => {
    h.x += h.dx; h.y += h.dy;
    if (h.x < h.r || h.x > arena.width - h.r) h.dx *= -1;
    if (h.y < h.r || h.y > arena.height - h.r) h.dy *= -1;
  });
  tokens.forEach((t) => {
    if (!t.collected && distance(player, t) < player.r + t.r) {
      t.collected = true; playTokenSound();
    }
  });
  hazards.forEach((h) => {
    if (distance(player, h) < player.r + h.r) { playHazardSound(); endGame("lose"); }
  });
  if (tokens.every((t) => t.collected)) { playWinSound(); endGame("win"); }
}

/* ----- TIMER LOGIC ----- */
function resetTimer() {
  cancelAnimationFrame(frameHandle);
  timer = totalTime;
  lastFrameTime = null;
  if (timerFill) {
    timerFill.style.transition = "none";
    timerFill.style.width = "100%";
  }
}

function updateTimer(now) {
  if (!gameRunning) return;
  if (!lastFrameTime) lastFrameTime = now;
  const delta = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  timer -= delta;
  if (timer <= 0) {
    timer = 0;
    if (timerFill) timerFill.style.width = "0%";
    playLoseSound();
    endGame("lose");
    return;
  }
  if (timerFill) timerFill.style.width = `${(timer / totalTime) * 100}%`;
  frameHandle = requestAnimationFrame(updateTimer);
}

/* ----- START / END GAME ----- */
async function startGame() {
  if (!token) return alert("Please login first.");
  const stake = parseInt(stakeAmount.value);
  if (isNaN(stake) || stake < 10 || stake > 100000) return alert("Invalid stake.");

  // recreate the timer bar fresh
  timerFill = createTimerBar();
  resetTimer();

  try {
    const res = await fetch(`${API_BASE}/game/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stake }),
    });
    const data = await res.json();
    if (!data.sessionId) return alert(data.message || "Could not start session.");
    sessionId = data.sessionId;
    sessionToken = data.sessionToken;
    setupGame();
    showCountdown(5, () => {
      gameRunning = true;
      timer = totalTime = 30;
      requestAnimationFrame(gameLoop);
      requestAnimationFrame(updateTimer);
    });
  } catch (err) {
    console.error(err);
    alert("Start game error.");
  }
}

async function endGame(result) {
  if (!gameRunning) return;
  gameRunning = false;
  cancelAnimationFrame(frameHandle);
  resetTimer();
  try {
    await fetch(`${API_BASE}/game/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, result }),
    });
    alert(result === "win" ? "You won!" : "You lost!");
    loadWallet();
  } catch {
    alert("Error submitting result.");
  }
}

/* ----- LOOP / COUNTDOWN ----- */
function gameLoop() {
  if (!gameRunning) return;
  draw();
  update();
  requestAnimationFrame(gameLoop);
}

function showCountdown(seconds, callback) {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed", top: "0", left: "0", width: "100%", height: "100%",
    background: "rgba(0,0,0,0.7)", color: "white", fontSize: "90px",
    display: "flex", justifyContent: "center", alignItems: "center",
    zIndex: "9999", fontWeight: "bold",
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

startGameBtn.onclick = startGame;
