const STEPS = [
  {
    title: "Register",
    sub: "Quick and secure. Create your account to begin.",
    html: `<p><strong>Step 1 — Register:</strong> Click <em>Register</em> on the landing page, enter a valid email, a unique username and a strong password. Complete registration to unlock gameplay.</p>
           <div class="hint">Tip: choose a memorable username — it will show on leaderboards.</div>`
  },
  {
    title: "Login",
    sub: "Sign in and view your wallet balance.",
    html: `<p><strong>Step 2 — Login:</strong> Use your email and password to sign in. After login the dashboard shows your Available balance and recent activity. Balances auto-refresh periodically.</p>
           <div class="hint">Tip: Keep your password safe and consider a strong passphrase.</div>`
  },
  {
    title: "Deposit",
    sub: "Fund your wallet securely with Paystack.",
    html: `<p><strong>Step 3 — Deposit:</strong> Click <em>Deposit</em>, enter an amount and complete the secure Paystack flow. Deposits are usually instant and reflected in your balance.</p>
           <div class="hint">Tip: check your Available balance after payment; if delayed, contact support.</div>`
  },
  {
    title: "Play",
    sub: "Stake, start, and dodge hazards to win.",
    html: `<p><strong>Step 4 — Play:</strong> Enter your stake, click <em>Start Game</em>. Control the white ball to avoid red hazards and collect green tokens. Survive until time runs out to win.</p>
           <div class="hint">Tip: Mobile drag and desktop mouse follow are supported — try gentle, small movements for control.</div>`
  },
  {
    title: "Withdraw",
    sub: "Withdraw your winnings quickly.",
    html: `<p><strong>Step 5 — Withdraw:</strong> When you win, open <em>Withdraw</em>, provide payout details and submit. Withdrawals are processed to your selected payout method.</p>
           <div class="hint">Tip: ensure payout info is accurate to avoid delays.</div>`
  },
  {
    title: "Logout & Safety",
    sub: "Secure your account after play.",
    html: `<p><strong>Step 6 — Logout:</strong> Click <em>Logout</em> when finished, especially on shared devices, to keep your account secure.</p>
           <div class="hint">Tip: never share your password or session tokens.</div>`
  }
];


const badge = document.getElementById('stepBadge');
const titleEl = document.getElementById('cardTitle');
const subEl = document.getElementById('cardSub');
const bodyEl = document.getElementById('cardBody');
const dotsEl = document.getElementById('dots');
const nextBtn = document.getElementById('nextBtn');
const backBtn = document.getElementById('backBtn');
const skipBtn = document.getElementById('skipBtn');
const progressFill = document.getElementById('progressFill');

let idx = 0;
let audioStarted = false;


function buildDots(){
  dotsEl.innerHTML = '';
  for(let i=0;i<STEPS.length;i++){
    const d=document.createElement('div');
    d.className='dot' + (i===0?' active':'');
    d.dataset.i=i;
    d.tabIndex = 0;
    d.addEventListener('click', ()=> goTo(i));
    d.addEventListener('keydown', e=> { if(e.key==='Enter') goTo(i); });
    dotsEl.appendChild(d);
  }
}
buildDots();


function render(i, opts={animate:true}){
  if(i<0)i=0;
  if(i>=STEPS.length)i=STEPS.length-1;
  idx=i;
  const s = STEPS[i];

  badge.textContent = (i+1);
  titleEl.textContent = s.title;
  subEl.textContent = s.sub;
  bodyEl.innerHTML = s.html;

 
  Array.from(dotsEl.children).forEach((d,ii)=> d.classList.toggle('active', ii===i));

  
  const pct = Math.round(((i+1)/STEPS.length)*100);
  progressFill.style.width = pct + '%';

  
  backBtn.disabled = (i===0);
  if(i === STEPS.length-1){
    nextBtn.textContent = 'Go to Game';
    nextBtn.onclick = ()=> { window.location.href='index.html'; };
    skipBtn.style.display='none';
  } else {
    nextBtn.textContent='Next';
    nextBtn.onclick = ()=> { playClick(); goTo(idx+1); };
    skipBtn.style.display='inline-block';
  }

  
  nextBtn.classList.add('pulse');
  setTimeout(()=> nextBtn.classList.remove('pulse'), 420);
}


function goTo(i){
  render(i);
}


document.addEventListener('keydown', (e)=>{
  if(e.key === 'ArrowRight') {
    if(idx < STEPS.length-1) { playClick(); goTo(idx+1); }
    else window.location.href='index.html';
  }
  if(e.key === 'ArrowLeft') {
    if(idx > 0) goTo(idx-1);
  }
  if(e.key === 'Escape') {
    goTo(STEPS.length-1);
  }
});


backBtn.addEventListener('click', ()=> { playBack(); if(idx>0) goTo(idx-1); });
skipBtn.addEventListener('click', ()=> { playClick(); goTo(STEPS.length-1); });


const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
const particles = [];
const P_COUNT = Math.round((W*H)/90000); 
for(let i=0;i<P_COUNT;i++){
  particles.push({
    x: Math.random()*W,
    y: Math.random()*H,
    r: 2 + Math.random()*6,
    dx: (Math.random()-0.5)*0.2,
    dy: -0.15 - Math.random()*0.3,
    alpha: 0.05 + Math.random()*0.25,
    rot: Math.random()*Math.PI*2,
    rotSpeed: (Math.random()-0.5)*0.01
  });
}
function drawParticles(){
  ctx.clearRect(0,0,W,H);
  for(const p of particles){
    p.x += p.dx;
    p.y += p.dy;
    p.rot += p.rotSpeed;
    if(p.y < -20) { p.y = H + 20; p.x = Math.random()*W; }
    if(p.x < -40) p.x = W + 40;
    if(p.x > W + 40) p.x = -40;
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x,p.y);
    ctx.rotate(p.rot);
    
    const grd = ctx.createLinearGradient(-p.r,-p.r,p.r,p.r);
    grd.addColorStop(0, 'rgba(255,230,140,0.08)');
    grd.addColorStop(1, 'rgba(0,220,200,0.06)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0,0,p.r*1.2,p.r*0.7,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}
function loopParticles(){
  drawParticles();
  requestAnimationFrame(loopParticles);
}
loopParticles();
window.addEventListener('resize', ()=>{ W = canvas.width = innerWidth; H = canvas.height = innerHeight; });


let audioCtx, masterGain, ambientGain;
let ambientOsc1, ambientOsc2, ambientFilter;
let chimeOsc1, chimeOsc2;

function initAudio(){
  if(audioStarted) return;
  audioStarted = true;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(audioCtx.destination);

  
  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 0.0;
  ambientGain.connect(masterGain);

  ambientOsc1 = audioCtx.createOscillator();
  ambientOsc1.type = 'sine';
  ambientOsc1.frequency.value = 60; 
  ambientOsc2 = audioCtx.createOscillator();
  ambientOsc2.type = 'triangle';
  ambientOsc2.frequency.value = 90;

  ambientFilter = audioCtx.createBiquadFilter();
  ambientFilter.type = 'lowpass';
  ambientFilter.frequency.value = 800;
  ambientFilter.Q.value = 0.7;

  ambientOsc1.connect(ambientFilter);
  ambientOsc2.connect(ambientFilter);
  ambientFilter.connect(ambientGain);

  ambientOsc1.start();
  ambientOsc2.start();

 
  ambientGain.gain.cancelScheduledValues(audioCtx.currentTime);
  ambientGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
  ambientGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 1.5);

 
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.type = 'sine'; lfo.frequency.value = 0.08;
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain);
  lfoGain.connect(ambientFilter.frequency);
  lfo.start();
}


function playChime(){
  if(!audioStarted) return;
  const t = audioCtx.currentTime;
  const o1 = audioCtx.createOscillator();
  o1.type = 'sine'; o1.frequency.setValueAtTime(880, t);
  const g1 = audioCtx.createGain(); g1.gain.setValueAtTime(0.0,t);
  o1.connect(g1); g1.connect(masterGain);
  o1.start(t); o1.stop(t+0.5);
  g1.gain.linearRampToValueAtTime(0.08,t+0.01);
  g1.gain.exponentialRampToValueAtTime(0.0001,t+0.5);

  
  const o2 = audioCtx.createOscillator();
  o2.type = 'triangle'; o2.frequency.setValueAtTime(440, t);
  const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.0,t);
  const f2 = audioCtx.createBiquadFilter(); f2.type='bandpass'; f2.frequency.value=1000;
  o2.connect(f2); f2.connect(g2); g2.connect(masterGain);
  o2.start(t); o2.stop(t+0.6);
  g2.gain.linearRampToValueAtTime(0.06,t+0.01);
  g2.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
}


function safeStartAudio(){
  if(audioStarted) return;
  try{
    initAudio();
  }catch(e){
    console.warn('Audio init failed',e);
  }
}

function playClick(){
  safeStartAudio();
  playChime();
  if(navigator.vibrate) navigator.vibrate(20);
}

function playBack(){
  safeStartAudio();
 
  if(!audioStarted) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(300,t);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.0,t);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t+0.28);
  g.gain.linearRampToValueAtTime(0.06, t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.28);
}

render(0); 

document.addEventListener('pointerdown', function once(){
  safeStartAudio();
  document.removeEventListener('pointerdown', once);
});

bodyEl = document.getElementById('cardBody');
bodyEl && bodyEl.focus();

function render(i){
 
  if(i<0) i=0;
  if(i>STEPS.length-1) i=STEPS.length-1;
  idx = i;
  const s = STEPS[i];
  badge.textContent = (i+1);
  titleEl.textContent = s.title;
  subEl.textContent = s.sub;
  bodyEl.innerHTML = s.html;

  Array.from(dotsEl.children).forEach((d,ii)=> d.classList.toggle('active', ii===i));

  const pct = Math.round(((i+1)/STEPS.length)*100);
  progressFill.style.width = pct + '%';

  backBtn.disabled = (i===0);
  if(i === STEPS.length-1){
    nextBtn.textContent = 'Go to Game';
    nextBtn.onclick = ()=> { window.location.href = 'index.html'; };
    skipBtn.style.display = 'none';
  } else {
    nextBtn.textContent = 'Next';
    nextBtn.onclick = ()=> { playClick(); render(idx+1); };
    skipBtn.style.display = 'inline-block';
  }

  nextBtn.classList.add('pulse');
  setTimeout(()=> nextBtn.classList.remove('pulse'), 420);
}

backBtn.addEventListener('click', ()=> { playBack(); if(idx>0) render(idx-1); });
skipBtn.addEventListener('click', ()=> { playClick(); render(STEPS.length-1); });

document.addEventListener('keydown', (e)=>{
  if(e.key === 'ArrowRight'){ if(idx<STEPS.length-1){ playClick(); render(idx+1);} else { window.location.href='index.html'; } }
  if(e.key === 'ArrowLeft'){ if(idx>0){ playBack(); render(idx-1);} }
  if(e.key === 'Escape'){ render(STEPS.length-1); }
});

(function ensureDots(){
  if(dotsEl.children.length === 0) buildDots();
  function buildDots(){
    dotsEl.innerHTML = '';
    for(let i=0;i<STEPS.length;i++){
      const d = document.createElement('div');
      d.className = 'dot' + (i===0 ? ' active' : '');
      d.dataset.i = i;
      d.tabIndex = 0;
      d.addEventListener('click', ()=> render(i));
      d.addEventListener('keydown', (ev)=> { if(ev.key==='Enter') render(i); });
      dotsEl.appendChild(d);
    }
  }
})();

setTimeout(()=> { const btn = document.getElementById('nextBtn'); btn && btn.focus(); }, 600);
