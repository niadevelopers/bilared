
const API_BASE = "/api";
let token = localStorage.getItem("token");
let user = null;

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

(function () {
  const style = document.createElement("style");
  style.textContent = `
    .custom-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .custom-modal-backdrop.show { opacity: 1; }

    .custom-modal {
      background: #fff;
      color: #333;
      border-radius: 12px;
      box-shadow: 0 5px 25px rgba(0,0,0,0.15);
      max-width: 90%;
      width: 360px;
      padding: 20px;
      text-align: center;
      transform: scale(0.9);
      transition: transform 0.25s ease;
    }
    .custom-modal-backdrop.show .custom-modal { transform: scale(1); }

    .custom-modal h3 {
      margin-bottom: 12px;
      font-size: 18px;
      font-weight: 600;
    }
    .custom-modal p {
      font-size: 15px;
      color: #555;
      margin-bottom: 20px;
    }
    .custom-modal input {
      width: 100%;
      padding: 10px;
      margin-bottom: 16px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 15px;
      outline: none;
    }
    .custom-modal-buttons {
      display: flex;
      justify-content: center;
      gap: 10px;
    }
    .custom-modal button {
      background: #333;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 15px;
      cursor: pointer;
      transition: background 0.25s;
    }
    .custom-modal button:hover {
      background: #111;
    }
  `;
  document.head.appendChild(style);

  function createBackdrop() {
    const backdrop = document.createElement("div");
    backdrop.className = "custom-modal-backdrop";
    document.body.appendChild(backdrop);
    setTimeout(() => backdrop.classList.add("show"), 10);
    return backdrop;
  }

  window.customAlert = function (message, title = "Notice") {
    return new Promise((resolve) => {
      const backdrop = createBackdrop();
      const modal = document.createElement("div");
      modal.className = "custom-modal";
      modal.innerHTML = `
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="custom-modal-buttons">
          <button id="okBtn">OK</button>
        </div>
      `;
      backdrop.appendChild(modal);

      const okBtn = modal.querySelector("#okBtn");
      okBtn.onclick = () => {
        backdrop.classList.remove("show");
        setTimeout(() => backdrop.remove(), 300);
        resolve(true);
      };
    });
  };

  window.customPrompt = function (message, defaultValue = "") {
    return new Promise((resolve) => {
      const backdrop = createBackdrop();
      const modal = document.createElement("div");
      modal.className = "custom-modal";
      modal.innerHTML = `
        <h3>Notice</h3>
        <p>${message}</p>
        <input type="text" id="promptInput" value="${defaultValue}" autofocus />
        <div class="custom-modal-buttons">
          <button id="cancelBtn">Cancel</button>
          <button id="okBtn">OK</button>
        </div>
      `;
      backdrop.appendChild(modal);

      const input = modal.querySelector("#promptInput");
      const cancelBtn = modal.querySelector("#cancelBtn");
      const okBtn = modal.querySelector("#okBtn");

      cancelBtn.onclick = () => {
        backdrop.classList.remove("show");
        setTimeout(() => backdrop.remove(), 300);
        resolve(null);
      };

      okBtn.onclick = () => {
        const val = input.value.trim();
        backdrop.classList.remove("show");
        setTimeout(() => backdrop.remove(), 300);
        resolve(val);
      };

      input.focus();
    });
  };

  window.alert = (msg) => customAlert(msg);
  window.prompt = (msg, def) => customPrompt(msg, def);
})();

function createLoader() {
  const loader = document.createElement("div");
  loader.id = "global-loader";
  loader.innerHTML = `<div class="loader-spinner"></div>`;
  Object.assign(loader.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: "0",
    visibility: "hidden",
    transition: "opacity 0.3s ease, visibility 0.3s ease",
    zIndex: "9998",
  });

  const spinner = loader.querySelector(".loader-spinner");
  Object.assign(spinner.style, {
    width: "60px",
    height: "60px",
    border: "6px solid rgba(245, 161, 6, 1)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  });

  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin { 
      0% { transform: rotate(0deg); } 
      100% { transform: rotate(360deg); } 
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(loader);
}

function showLoader() {
  let loader = document.getElementById("global-loader");
  if (!loader) createLoader();
  loader = document.getElementById("global-loader");
  loader.style.visibility = "visible";
  loader.style.opacity = "1";
}

function hideLoader() {
  const loader = document.getElementById("global-loader");
  if (loader) {
    loader.style.opacity = "0";
    loader.style.visibility = "hidden";
  }
}


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
  if (password.length < 6) return "Password must be at least 6 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  return "";
}

function validateUsername(username) {
  if (!username) return "Username is required.";
  if (username.length < 3) return "Username must be at least 3 characters long.";
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return "Username can only contain letters, numbers, and underscores.";
  return "";
}

async function login() {
  clearErrors();
  const emailVal = sanitizeInput(email.value);
  const passwordVal = sanitizeInput(password.value);

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

  const tokenTurnstile = turnstile.getResponse();
  if (!tokenTurnstile) {
    return alert("Please verify you’re not a robot before logging in.");
  }

  showLoader();
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailVal, password: passwordVal, "cf-turnstile-response": tokenTurnstile }),
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
  } finally {
    hideLoader();
    turnstile.reset();
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

  const tokenTurnstile = turnstile.getResponse();
  if (!tokenTurnstile) {
    return alert("Please verify you’re not a robot before registering.");
  }

  showLoader();
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameVal, email: emailVal, password: passwordVal, "cf-turnstile-response": tokenTurnstile }),
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
  } finally {
    hideLoader();
    turnstile.reset();
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

depositBtn.onclick = async () => {
  if (!token) {
    alert("Please log in to continue.");
    return;
  }

  const amountInput = await prompt("Enter deposit amount (KES):");
  const amount = parseFloat(amountInput);

  if (!amountInput || isNaN(amount)) return alert("Please enter a valid numeric amount.");
  if (amount < 100) return alert("Minimum deposit is KSh 100. Please enter KSh 100 or more.");
  if (amount > 150000) return alert("Maximum deposit limit is KSh 150,000. Please enter a smaller amount.");

  const payerEmail = await prompt("Enter your email for this deposit:");
  if (!payerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) return alert("Please enter a valid email address.");

  showLoader();
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

    if (!data.status) return alert(`Payment initialization failed: ${data.message}`);

    const handler = PaystackPop.setup({
      key: "pk_live_8b79c89f1bc7cd80a6b24d0d18bd580f49e9c646",
      email: payerEmail,
      amount: Math.round(amount * 100),
      currency: "KES",
      reference: data.data.reference,
      callback: function () {
        alert("Deposit successful! Your wallet will update shortly.");
        setTimeout(loadWallet, 2000);
      },
      onClose: function () {
        alert("Deposit window closed. No transaction was made.");
      },
    });

    handler.openIframe();
  } catch (err) {
    console.error("Deposit error:", err);
    alert("Failed to initialize deposit. Please check your connection or try again later.");
  } finally {
    hideLoader();
  }
};

withdrawBtn.onclick = () => {
  if (!token) return alert("Please login first.");
  withdrawOverlay.classList.remove("hidden");
};

closeWithdraw.onclick = () => withdrawOverlay.classList.add("hidden");

submitWithdraw.onclick = async () => {
  const name = document.getElementById("wName").value.trim();
  const wemail = document.getElementById("wEmail").value.trim();
  const phone = document.getElementById("wPhone").value.trim();

  if (!name || !wemail || !phone) return alert("Please fill all withdrawal fields.");

  const availableEl = document.getElementById("available");
  const availableBalance = parseFloat(availableEl.textContent.replace(/,/g, ""));

  if (isNaN(availableBalance)) return alert("Unable to read your available balance.");
  if (availableBalance < 200) return alert("Minimum withdrawal amount is KSh 200. You cannot withdraw below this limit.");

  showLoader();
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
    alert(data.message || "Withdrawal submitted for review.");
    withdrawOverlay.classList.add("hidden");
    loadWallet();
  } catch (err) {
    console.error("Withdraw error:", err);
    alert("Withdrawal request failed. Please try again.");
  } finally {
    hideLoader();
  }
};

let gameRunning = false;
let gamePaused = false;
let player = { x: 0, y: 0, r: 10, color: "white", vx: 0, vy: 0 };
let tokens = [];
let hazards = [];
let sessionId = null;
let sessionToken = null;
let timer = 15;
let totalTime = 15;
let dragActive = false;
let touchStart = null;
let baseSpeed = 1.58;
let safeZoneRadius = 150;
let lastFrameTime = null;
let tokenComboCount = 0;
let floatingTexts = [];
let particles = [];
let playerTrail = [];
let animationActive = false;
let replayFrames = [];
let replayMode = false;
let replayIndex = 0;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTokenSound(combo = 1) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(800 + combo * 20, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

function playComboJingle(combo){
  if(combo >= 3 && combo <= 5){
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(600 + combo*50, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  }
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
  if (navigator.vibrate) navigator.vibrate(100);
}

function playWinSound() {
  let startTime = audioCtx.currentTime;
  for (let i = 0; i < 8; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300 + i * 40, startTime + i * 0.45);
    gain.gain.setValueAtTime(0.12, startTime + i * 0.45);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startTime + i * 0.45);
    osc.stop(startTime + i * 0.45 + 0.4);
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

function random(min, max) { return Math.random() * (max - min) + min; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function setupGame() {
  arena.width = window.innerWidth;
  arena.height = window.innerHeight - 120;
  player.x = arena.width / 2;
  player.y = arena.height / 2;
  player.vx = 0;
  player.vy = 0;

  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = /android/i.test(ua);
  const isMobile = /mobile|iphone|ipad|ipod|android/i.test(ua);
  const isDesktop = !isMobile;

  if (isAndroid || isMobile) {
    baseSpeed = 1.9; 
  } else if (isDesktop) {
    baseSpeed = 1.5;
  }

  let numHazards = (isAndroid || isMobile) ? 6 : 9;
  let numTokens = (isAndroid || isMobile) ? 9 : 13;

  tokens = [];
  for (let i = 0; i < numTokens; i++) {
    tokens.push({
      x: random(50, arena.width - 50),
      y: random(50, arena.height - 50),
      r: 8,
      collected: false,
      dx: random(-0.4, 0.4),
      dy: random(-0.4, 0.4),
      jitterTimer: random(60, 180)
    });
  }

  hazards = [];
  for (let i = 0; i < numHazards; i++) {
    let hx, hy;
    do { hx = random(50, arena.width - 50); hy = random(50, arena.height - 50); } 
    while (distance({ x: hx, y: hy }, player) < safeZoneRadius);

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
      glowPhase: 0
    });
  }

  replayFrames = [];
}


function spawnParticles(x, y, color="lime", count=10){
  for(let i=0;i<count;i++){
    particles.push({
      x, y, vx: random(-3,3), vy: random(-5,0),
      r: random(2,4), color, alpha:1
    });
  }
}

function drawParticles(){
  particles.forEach((p,idx)=>{
    ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.2;
    p.alpha -= 0.03;
    if(p.alpha <= 0) particles.splice(idx,1);
  });
}

function drawBackground() {
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const step = 50;
  for (let x=0; x<arena.width; x+=step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,arena.height); ctx.stroke(); }
  for (let y=0; y<arena.height; y+=step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(arena.width,y); ctx.stroke(); }

  ctx.strokeStyle = "rgba(0,255,0,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, safeZoneRadius, 0, Math.PI*2);
  ctx.stroke();
}

function draw(){
  ctx.clearRect(0,0,arena.width,arena.height);

  drawBackground();

  playerTrail.push({x: player.x, y: player.y});
  if(playerTrail.length>15) playerTrail.shift();
  playerTrail.forEach((t,i)=>{
    ctx.fillStyle = `rgba(255,255,255,${i/15*0.5})`;
    ctx.beginPath(); ctx.arc(t.x,t.y,player.r*(i/15*0.5 + 0.5),0,Math.PI*2); ctx.fill();
  });

  tokens.forEach(t=>{
    if(!t.collected){ ctx.fillStyle="lime"; ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,Math.PI*2); ctx.fill(); }
  });

  hazards.forEach(h=>{
    if(h.chase){
      h.glowPhase += 0.1;
      const glow = 0.5 + 0.5 * Math.sin(h.glowPhase);
      ctx.shadowBlur = 20 * glow; ctx.shadowColor = "yellow";
      spawnParticles(h.x, h.y, "255,0,0", 1);
    } else ctx.shadowBlur = 0;
    ctx.fillStyle="red"; ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  });

  ctx.fillStyle="white"; ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill();

  floatingTexts.forEach((ft, idx)=>{
    ctx.fillStyle = `rgba(0,255,0,${ft.alpha})`;
    ctx.font = "bold 16px Arial";
    ctx.fillText(ft.text, ft.x, ft.y);
    ft.y -= 0.5; ft.alpha -= 0.02;
    if(ft.alpha<=0) floatingTexts.splice(idx,1);
  });

  drawParticles();
}

function update() {
  if(gamePaused || animationActive) return;

  replayFrames.push({
    player:{...player},
    tokens:tokens.map(t=>({...t})),
    hazards:hazards.map(h=>({...h}))
  });

  if(!dragActive){ player.vx*=0.92; player.vy*=0.92; }
  player.x += player.vx; player.y += player.vy;
  player.x = Math.max(player.r,Math.min(arena.width-player.r,player.x));
  player.y = Math.max(player.r,Math.min(arena.height-player.r,player.y));

  hazards.forEach(h=>{
    const dist = distance(h,player);
    if(!h.chase && h.chaseCooldown<=0 && dist<150 && Math.random()<0.015){ h.chase=true; h.chaseTimer=120; }
    if(h.chase){
      const angle=Math.atan2(player.y-h.y,player.x-h.x);
      const speed=h.baseSpeed*1.9; h.dx=Math.cos(angle)*speed; h.dy=Math.sin(angle)*speed;
      h.chaseTimer--; if(h.chaseTimer<=0){ h.chase=false; h.chaseCooldown=random(60,180); }
    } else {
      h.jitterTimer--; if(h.jitterTimer<=0){ h.dx+=random(-0.5,0.5); h.dy+=random(-0.5,0.5); h.jitterTimer=random(30,120);}
      if(h.chaseCooldown>0) h.chaseCooldown--;
    }
    h.x+=h.dx; h.y+=h.dy;
    if(h.x<h.r||h.x>arena.width-h.r) h.dx*=-1;
    if(h.y<h.r||h.y>arena.height-h.r) h.dy*=-1;
  });

  tokens.forEach(t=>{
    if(!t.collected){
      t.jitterTimer--;
      if(t.jitterTimer <= 0){
        t.dx += random(-0.25, 0.25);
        t.dy += random(-0.25, 0.25);
        t.dx = Math.max(-0.9, Math.min(0.9, t.dx));
        t.dy = Math.max(-0.9, Math.min(0.9, t.dy));
        t.jitterTimer = random(60, 180);
      }
      t.x += t.dx;
      t.y += t.dy;
      if(t.x < t.r){ t.x = t.r; t.dx *= -1; }
      if(t.x > arena.width - t.r){ t.x = arena.width - t.r; t.dx *= -1; }
      if(t.y < t.r){ t.y = t.r; t.dy *= -1; }
      if(t.y > arena.height - t.r){ t.y = arena.height - t.r; t.dy *= -1; }
    }
  });

  tokens.forEach(t=>{
    if(!t.collected && distance(player,t)<player.r+t.r){
      t.collected=true; tokenComboCount++; playTokenSound(tokenComboCount); playComboJingle(tokenComboCount);
      floatingTexts.push({x:t.x,y:t.y,text:"+1",alpha:1});
      spawnParticles(t.x, t.y, "0,255,0", 8);
    }
  });

  hazards.forEach(h=>{
    if(distance(player,h)<player.r+h.r){ 
      playHazardSound(); 
      endGame("lose"); 
    }
  });

  if(tokens.every(t=>t.collected)){ 
    playWinSound(); 
    endGame("win"); 
  }
}

function showOverlay(result){
  animationActive = true;
  startGameBtn.disabled = true;
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.7);display:flex;flex-direction:column;
    justify-content:center;align-items:center;z-index:9999;color:white;
  `;
  document.body.appendChild(overlay);

  const text = document.createElement("div");
  text.style.fontSize="70px"; text.style.fontWeight="bold"; text.style.marginBottom="30px";
  text.textContent = result==="win"?"YOU WON!":"YOU LOST!";
  text.style.color = result==="win"?"gold":"red";
  overlay.appendChild(text);

  const replayBtn = document.createElement("button");
  replayBtn.textContent="Replay Last Round";
  replayBtn.style.padding="10px 20px"; replayBtn.style.fontSize="20px"; replayBtn.style.cursor="pointer";
  overlay.appendChild(replayBtn);

  replayBtn.onclick = ()=>{
    overlay.remove();
    runReplay();
  };

  const closeBtn = document.createElement("button");
  closeBtn.textContent="Close";
  closeBtn.style.padding="10px 20px"; closeBtn.style.fontSize="20px"; replayBtn.style.cursor="pointer";
  closeBtn.style.marginTop="15px";
  overlay.appendChild(closeBtn);

  closeBtn.onclick = ()=>{
    overlay.remove();
    animationActive = false;
    startGameBtn.disabled = false;
  };
}

function runReplay(){
  if(replayFrames.length===0) return;
  replayMode = true;
  replayIndex = 0;
  animationActive = true;

  function step(){
    if(replayIndex>=replayFrames.length){
      replayMode=false; animationActive=false; startGameBtn.disabled=false;
      return;
    }
    const frame = replayFrames[replayIndex];
    player = {...frame.player};
    tokens = frame.tokens.map(t=>({...t}));
    hazards = frame.hazards.map(h=>({...h}));
    draw();
    replayIndex++;
    requestAnimationFrame(step);
  }
  step();
}

function gameLoop(timestamp){
  if(!gameRunning) return;
  if(lastFrameTime===null) lastFrameTime=timestamp;
  const delta = (timestamp-lastFrameTime)/1000;
  lastFrameTime=timestamp;

  draw(); update();

  if(!gamePaused){
    timer -= delta;
    timerFill.style.width = `${Math.max(0,(timer/totalTime)*100)}%`;
    if(timer<=0){ playLoseSound(); endGame("lose"); lastFrameTime=null; }
    else requestAnimationFrame(gameLoop);
  } else requestAnimationFrame(gameLoop);
}

arena.addEventListener("touchstart", (e)=>{
  if(!gameRunning) return;
  e.preventDefault();
  const t = e.touches[0];
  const rect = arena.getBoundingClientRect();
  const tx = t.clientX - rect.left;
  const ty = t.clientY - rect.top;
  if(distance({x:tx, y:ty}, player) <= player.r + 25){
    dragActive = true;
    player.vx = 0;
    player.vy = 0;
  }
});

arena.addEventListener("touchmove", (e)=>{
  if(!dragActive || !gameRunning) return;
  e.preventDefault();
  const t = e.touches[0];
  const rect = arena.getBoundingClientRect();
  const tx = t.clientX - rect.left;
  const ty = t.clientY - rect.top;

  player.vx = (tx - player.x) * 0.5;
  player.vy = (ty - player.y) * 0.5;
  player.x += player.vx;
  player.y += player.vy;

  player.x = Math.max(player.r, Math.min(arena.width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(arena.height - player.r, player.y));
});

arena.addEventListener("touchend", ()=>{
  dragActive = false;
  player.vx = 0;
  player.vy = 0;
});

arena.addEventListener("mousemove", (e)=>{
  if(!gameRunning) return;
  const rect = arena.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  player.x += (mx - player.x) * 0.1;
  player.y += (my - player.y) * 0.1;
});

function showCountdown(seconds, callback){
  const overlay=document.createElement("div");
  Object.assign(overlay.style,{
    position:"fixed",top:"0",left:"0",width:"100%",height:"100%",
    background:"rgba(0,0,0,0.7)",color:"white",fontSize:"90px",
    display:"flex",justifyContent:"center",alignItems:"center",zIndex:"9999",fontWeight:"bold"
  });
  document.body.appendChild(overlay);
  let count=seconds; overlay.textContent=count;
  const interval=setInterval(()=>{
    count--; 
    if(count>0) overlay.textContent=count;
    else{
      clearInterval(interval); 
      document.body.removeChild(overlay); 
      callback();
    }
  },1000);
}

async function startGame() {
  if(!token) return alert("Please login first.");
  const stake = parseInt(stakeAmount.value);
  if(isNaN(stake)||stake<10||stake>100000) return alert("Invalid stake");
  try{
    const res = await fetch(`${API_BASE}/game/start`,{
      method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
      body:JSON.stringify({stake})
    });
    const data = await res.json();
    if(data.sessionId){
      sessionId = data.sessionId; sessionToken=data.sessionToken; setupGame();
      let deviceTime=15; const ua=navigator.userAgent.toLowerCase();
      if(/android/i.test(ua)) deviceTime=10;
      else if(/ipad|tablet|kindle|playbook|silk|android(?!.*mobi)/i.test(ua)) deviceTime=12;
      showCountdown(5,()=>{
        timer=deviceTime; totalTime=deviceTime; gameRunning=true; lastFrameTime=null; requestAnimationFrame(gameLoop);
      });
    } else alert(data.message||"Could not start session");
  } catch(err){ console.error(err); alert("Start game error"); }
}

async function endGame(result){
  if(!gameRunning) return;
  gameRunning=false;
  try{
    await fetch(`${API_BASE}/game/result`,{
      method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
      body:JSON.stringify({sessionId,result})
    });
    showOverlay(result);
    if(typeof saveGameResult==="function") saveGameResult(result);
    loadWallet();
  } catch(err){ console.error(err); alert("Error submitting game result."); }
}

startGameBtn.onclick=startGame;

