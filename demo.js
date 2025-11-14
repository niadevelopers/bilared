let gameRunning = false; 
let gamePaused = false;
let isReplaying = false;
let player = { x: 0, y: 0, r: 10, color: "white", vx: 0, vy: 0 };
let tokens = [];
let hazards = [];
let timer = 30;
let totalTime = 30;
let lastFrameTime = null;
let tokenComboCount = 0;
let floatingTexts = [];
let particles = [];
let playerTrail = [];
let animationActive = false;
let replayFrames = [];

const arena = document.getElementById("arena");
const ctx = arena.getContext("2d");
const timerFill = document.getElementById("timerFill");
const startGameBtn = document.getElementById("startGameBtn");
const balanceEl = document.getElementById("balance");

balanceEl.textContent = "Infinite";

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
        osc.frequency.setValueAtTime(300 + i * 50, startTime + i * 0.5);
        gain.gain.setValueAtTime(0.12, startTime + i * 0.5);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(startTime + i * 0.5);
        osc.stop(startTime + i * 0.5 + 0.4);
    }
}

function playLoseSound() {
    let startTime = audioCtx.currentTime;
    for (let i = 0; i < 8; i++) {
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

function playComboJingle(combo) {
    if(combo % 5 === 0) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(1000 + combo*10, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
}

function random(min, max) { return Math.random() * (max - min) + min; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function setupGame() {
    arena.width = window.innerWidth;
    arena.height = window.innerHeight - 120;
    player.x = arena.width / 2;
    player.y = arena.height / 2;
    player.vx = 0; player.vy = 0;
    tokenComboCount = 0;
    replayFrames = [];

    const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent);
    const numTokens = isMobile ? 9 : 13;
    const numHazards = isMobile ? 6 : 9;

    tokens = [];
    for(let i=0;i<numTokens;i++){
        tokens.push({ 
            x: random(50, arena.width-50), 
            y: random(50, arena.height-50), 
            r: 8, 
            collected:false,
            dx: random(-0.7,0.7),
            dy: random(-0.7,0.7)
        });
    }

    hazards = [];
    for(let i=0;i<numHazards;i++){
        let hx, hy;
        do { hx = random(50, arena.width-50); hy = random(50, arena.height-50); }
        while(distance({x:hx,y:hy}, player) < 150);
        hazards.push({
            x: hx, y: hy, r: random(10,25), dx: random(-2,2), dy: random(-2,2),
            baseSpeed:1.5, jitterTimer: random(30,120), chase:false, chaseTimer:0, chaseCooldown:0, glowPhase:0
        });
    }
}

function spawnParticles(x,y,color="lime",count=10){
    for(let i=0;i<count;i++){
        particles.push({x,y,vx:random(-3,3),vy:random(-5,0),r:random(2,4),color,alpha:1});
    }
}

function drawParticles(){
    particles.forEach((p,idx)=>{
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.alpha -= 0.03;
        if(p.alpha<=0) particles.splice(idx,1);
    });
}

function drawBackground(){
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    const step = 50;
    for(let x=0;x<arena.width;x+=step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,arena.height); ctx.stroke(); }
    for(let y=0;y<arena.height;y+=step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(arena.width,y); ctx.stroke(); }

    ctx.strokeStyle = "rgba(0,255,0,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x,player.y,150,0,Math.PI*2); ctx.stroke();
}

function draw(){
    ctx.clearRect(0,0,arena.width,arena.height);
    drawBackground();

    playerTrail.push({x:player.x,y:player.y});
    if(playerTrail.length>15) playerTrail.shift();
    playerTrail.forEach((t,i)=>{
        ctx.fillStyle = `rgba(255,255,255,${i/15*0.5})`;
        ctx.beginPath(); ctx.arc(t.x,t.y,player.r*(i/15*0.5 + 0.5),0,Math.PI*2); ctx.fill();
    });

    tokens.forEach(t=>{ 
        if(!t.collected){ 
            ctx.fillStyle="lime"; 
            ctx.beginPath(); 
            ctx.arc(t.x,t.y,t.r,0,Math.PI*2); 
            ctx.fill(); 
        } 
    });

    hazards.forEach(h=>{
        if(h.chase){
            h.glowPhase+=0.1;
            const glow = 0.5+0.5*Math.sin(h.glowPhase);
            ctx.shadowBlur = 20*glow;
            ctx.shadowColor = "yellow";
            spawnParticles(h.x,h.y,"255,0,0",1);
        } else ctx.shadowBlur = 0;
        ctx.fillStyle="red"; ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
    });

    ctx.fillStyle="white"; ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill();

    floatingTexts.forEach((ft,idx)=>{
        ctx.fillStyle=`rgba(0,255,0,${ft.alpha})`;
        ctx.font="bold 16px Arial";
        ctx.fillText(ft.text, ft.x, ft.y);
        ft.y-=0.5; ft.alpha-=0.02;
        if(ft.alpha<=0) floatingTexts.splice(idx,1);
    });

    drawParticles();
}

function update(){
    if(gamePaused || animationActive) return;

    player.x = Math.max(player.r, Math.min(arena.width-player.r, player.x));
    player.y = Math.max(player.r, Math.min(arena.height-player.r, player.y));

    tokens.forEach(t=>{
        if(!t.collected){
            t.x += t.dx;
            t.y += t.dy;
            if(t.x < t.r || t.x > arena.width - t.r) t.dx *= -1;
            if(t.y < t.r || t.y > arena.height - t.r) t.dy *= -1;
            t.dx += random(-0.05, 0.05);
            t.dy += random(-0.05, 0.05);
            const spd = Math.hypot(t.dx, t.dy);
            if(spd > 1) { t.dx /= spd; t.dy /= spd; }
        }
    });

    hazards.forEach(h=>{
        const dist = distance(h,player);
        if(!h.chase && h.chaseCooldown<=0 && dist<150 && Math.random()<0.015){ h.chase=true; h.chaseTimer=120; }
        if(h.chase){
            const angle = Math.atan2(player.y-h.y, player.x-h.x);
            const speed = h.baseSpeed*1.7; 
            h.dx = Math.cos(angle)*speed; 
            h.dy = Math.sin(angle)*speed;
            h.chaseTimer--; 
            if(h.chaseTimer<=0){ h.chase=false; h.chaseCooldown=random(60,180); }
        } else {
            h.jitterTimer--; 
            if(h.jitterTimer<=0){ h.dx+=random(-0.5,0.5); h.dy+=random(-0.5,0.5); h.jitterTimer=random(30,120); }
            if(h.chaseCooldown>0) h.chaseCooldown--;
        }
        h.x+=h.dx; h.y+=h.dy;
        if(h.x<h.r){ h.x=h.r; h.dx*=-1; }
        if(h.x>arena.width-h.r){ h.x=arena.width-h.r; h.dx*=-1; }
        if(h.y<h.r){ h.y=h.r; h.dy*=-1; }
        if(h.y>arena.height-h.r){ h.y=arena.height-h.r; h.dy*=-1; }

        if(dist < player.r + h.r){ playHazardSound(); endGame("lose"); }
    });

    tokens.forEach(t=>{
        if(!t.collected && distance(player,t)<player.r+t.r){
            t.collected=true; tokenComboCount++;
            floatingTexts.push({x:t.x,y:t.y,text:"+1",alpha:1});
            spawnParticles(t.x,t.y,"0,255,0",8);
            playTokenSound(tokenComboCount);
            playComboJingle(tokenComboCount);
        }
    });

    if(tokens.every(t=>t.collected)){ playWinSound(); endGame("win"); }
}

function gameLoop(timestamp){
    if(!gameRunning) return;
    if(lastFrameTime===null) lastFrameTime=timestamp;
    const delta = (timestamp-lastFrameTime)/1000;
    lastFrameTime=timestamp;

    draw(); update();

    if(!gamePaused){
        if(!isReplaying){
            timer -= delta;
            timerFill.style.width = `${Math.max(0,(timer/totalTime)*100)}%`;
            if(timer<=0){ playLoseSound(); endGame("lose"); lastFrameTime=null; return; }
            replayFrames.push(ctx.getImageData(0,0,arena.width,arena.height));
        }
        requestAnimationFrame(gameLoop);
    } else requestAnimationFrame(gameLoop);
}

function startGame(){
    if(isReplaying) return; 
    showCountdown(3, ()=>{
        setupGame();
        timer=30; totalTime=30; gameRunning=true; lastFrameTime=null;
        animationActive=false;
        startGameBtn.disabled = true;
        requestAnimationFrame(gameLoop);
    });
}

function endGame(result){
    gameRunning=false;
    showOverlay(result);
}

function showOverlay(result){
    animationActive = true;
    startGameBtn.disabled = false;

    const overlay = document.createElement("div");
    Object.assign(overlay.style,{
        position:"fixed",top:"0",left:"0",width:"100%",height:"100%",
        background:"rgba(0,0,0,0.85)",color:"white",
        display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",
        zIndex:"9999",fontWeight:"bold",textAlign:"center"
    });
    document.body.appendChild(overlay);

    const message = document.createElement("div");
    message.style.fontSize = "80px";
    message.style.marginBottom = "40px";
    message.style.textShadow = "0 0 15px gold, 0 0 20px orange";
    message.textContent = result==="win"?"YOU WON!":"YOU LOST!";
    overlay.appendChild(message);

    const replayBtn = document.createElement("button");
    replayBtn.style.fontSize="30px";
    replayBtn.style.padding="12px 35px";
    replayBtn.style.cursor="pointer";
    replayBtn.style.border="2px solid white";
    replayBtn.style.borderRadius="12px";
    replayBtn.style.background="linear-gradient(45deg, #ff7f50, #ff4500)";
    replayBtn.style.color="white";
    replayBtn.style.boxShadow = "0 0 20px rgba(255,69,0,0.8)";
    replayBtn.textContent="Replay";
    replayBtn.onclick=()=>{
        overlay.style.display="none"; 
        startReplay();
    };
    overlay.appendChild(replayBtn);
}

function startReplay(){
    if(replayFrames.length===0) return;
    isReplaying = true;
    startGameBtn.disabled = true; 
    let idx = 0;

    const step = ()=>{
        if(idx>=replayFrames.length){ 
            isReplaying=false; 
            startGameBtn.disabled = false;
            replayFrames = [];
            ctx.clearRect(0,0,arena.width,arena.height); 
            draw(); 
            return; 
        }
        ctx.putImageData(replayFrames[idx],0,0);
        idx++;
        requestAnimationFrame(step);
    };
    step();
}

arena.addEventListener("mousemove", (e) => {
    if(!gameRunning) return;
    const rect = arena.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    player.x += (mx - player.x) * 0.45;
    player.y += (my - player.y) * 0.45;
});

arena.addEventListener("touchmove", (e) => {
    if(!gameRunning) return;
    const t = e.touches[0];
    const rect = arena.getBoundingClientRect();
    const tx = t.clientX - rect.left;
    const ty = t.clientY - rect.top;
    player.x += (tx - player.x) * 0.45;
    player.y += (ty - player.y) * 0.45;
});

function showCountdown(seconds, callback){
    const overlay=document.createElement("div");
    Object.assign(overlay.style,{
        position:"fixed",top:"0",left:"0",width:"100%",height:"100%",
        background:"rgba(0,0,0,0.85)",color:"white",fontSize:"90px",
        display:"flex",justifyContent:"center",alignItems:"center",zIndex:"9999",fontWeight:"bold"
    });
    document.body.appendChild(overlay);
    let count = seconds; overlay.textContent = count;
    const interval = setInterval(()=>{
        count--; 
        if(count>0) overlay.textContent=count;
        else { clearInterval(interval); document.body.removeChild(overlay); callback(); }
    },1000);
}

startGameBtn.onclick = startGame;
