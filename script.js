// Mini Royale - protótipo 2D (single-player)
// Simples mecânica: mover, atirar, inimigos, zona segura que encolhe.
// Controle: WASD ou setas, mouse para mirar, clique esquerdo para atirar.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let keys = {};
let mouse = {x:0, y:0, down:false};
let lastTime = 0;
let elapsed = 0;
let gameOver = false;

// UI
const hpEl = document.getElementById('hp');
const ammoEl = document.getElementById('ammo');
const timeEl = document.getElementById('time');
const msgEl = document.getElementById('msg');
const restartBtn = document.getElementById('restart');

restartBtn.onclick = () => location.reload();

addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
  mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});
canvas.addEventListener('mousedown', e => mouse.down = true);
canvas.addEventListener('mouseup', e => mouse.down = false);

// Player
let player = {
  x: W/2, y: H/2, r: 12,
  speed: 180, hp: 100,
  fireRate: 300, lastFire: 0
};

// bullets
let bullets = [];

// enemies
let enemies = [];
let enemyTimer = 0;
let enemySpawnInterval = 2000; // ms

// safe zone (circle)
let safe = {
  x: W/2, y: H/2, r: Math.max(W,H),
  targetR: Math.min(W,H) * 0.2,
  shrinkStart: 15000, // ms before start shrinking
  shrinkDuration: 90000, // ms to fully shrink
  startedAt: 0
};

function spawnEnemy(){
  // spawn at random edge
  const edge = Math.floor(Math.random()*4);
  let x,y;
  if(edge===0){ x = -20; y = Math.random()*H; }
  if(edge===1){ x = W+20; y = Math.random()*H; }
  if(edge===2){ x = Math.random()*W; y = -20; }
  if(edge===3){ x = Math.random()*W; y = H+20; }
  enemies.push({x,y,r:10,spd:50 + Math.random()*60,hp:20});
}

// helper distance
function dist(a,b,c,d){ return Math.hypot(a-c,b-d); }

function update(dt){
  if(gameOver) return;

  elapsed += dt;
  timeEl.textContent = 'Tempo: ' + Math.floor(elapsed/1000) + 's';
  // player movement
  let vx = 0, vy = 0;
  if(keys['w']||keys['arrowup']) vy -= 1;
  if(keys['s']||keys['arrowdown']) vy += 1;
  if(keys['a']||keys['arrowleft']) vx -= 1;
  if(keys['d']||keys['arrowright']) vx += 1;
  const len = Math.hypot(vx,vy);
  if(len>0){ vx/=len; vy/=len; }
  player.x += vx * player.speed * dt/1000;
  player.y += vy * player.speed * dt/1000;
  // bounds
  player.x = Math.max(0, Math.min(W, player.x));
  player.y = Math.max(0, Math.min(H, player.y));

  // firing
  if(mouse.down && elapsed - player.lastFire > player.fireRate){
    player.lastFire = elapsed;
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    bullets.push({x:player.x + Math.cos(angle)*player.r, y:player.y + Math.sin(angle)*player.r, vx:Math.cos(angle)*420, vy:Math.sin(angle)*420, r:4});
  }

  // update bullets
  bullets.forEach(b => {
    b.x += b.vx * dt/1000;
    b.y += b.vy * dt/1000;
  });
  bullets = bullets.filter(b => b.x>-50 && b.x<W+50 && b.y>-50 && b.y<H+50);

  // spawn enemies
  enemyTimer += dt;
  if(enemyTimer > enemySpawnInterval){
    enemyTimer = 0;
    spawnEnemy();
    if(enemySpawnInterval>600) enemySpawnInterval *= 0.98; // aumenta a pressão
  }

  // enemies AI
  enemies.forEach(e => {
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(angle) * e.spd * dt/1000;
    e.y += Math.sin(angle) * e.spd * dt/1000;

    // collide with player
    if(dist(e.x,e.y,player.x,player.y) < e.r + player.r){
      player.hp -= 12 * dt/1000; // dano com o tempo
    }
  });

  // bullets vs enemies
  enemies.forEach(e => {
    bullets.forEach(b => {
      if(dist(e.x,e.y,b.x,b.y) < e.r + b.r){
        e.hp -= 30;
        b.x = -9999; // remove
      }
    });
  });
  enemies = enemies.filter(e => e.hp > 0);

  // safe zone shrinking
  if(elapsed*1000 > safe.shrinkStart){
    if(safe.startedAt === 0) safe.startedAt = elapsed*1000;
    const t = Math.min(1, (elapsed*1000 - safe.startedAt)/safe.shrinkDuration);
    safe.r = ( (Math.max(W,H)) * (1 - t) ) + safe.targetR * t;
  }

  // outside safe zone damage
  const dToCenter = dist(player.x,player.y,safe.x,safe.y);
  if(dToCenter > safe.r){
    player.hp -= 18 * dt/1000; // dano por segundo fora
  }

  // hp clamp
  if(player.hp <= 0){
    player.hp = 0;
    onGameOver();
  }
  hpEl.textContent = 'HP: ' + Math.floor(player.hp);
  ammoEl.textContent = 'Munição: ∞';
}

function draw(){
  // clear
  ctx.clearRect(0,0,W,H);

  // draw safe zone (dark overlay outside)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(safe.x, safe.y, safe.r, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // draw safe circle border
  ctx.beginPath();
  ctx.strokeStyle = '#8be5a8';
  ctx.lineWidth = 2;
  ctx.arc(safe.x, safe.y, safe.r, 0, Math.PI*2);
  ctx.stroke();

  // player
  ctx.save();
  ctx.translate(player.x, player.y);
  const ang = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  ctx.rotate(ang);
  // body
  ctx.fillStyle = '#e5e7eb';
  roundRect(ctx, -player.r, -player.r, player.r*2, player.r*2, 4, true, false);
  // barrel
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(player.r-2, -4, 12, 8);
  ctx.restore();

  // bullets
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.fillStyle = '#ffd166';
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();
  });

  // enemies
  enemies.forEach(e => {
    ctx.beginPath();
    ctx.fillStyle = '#f87171';
    ctx.arc(e.x, e.y, e.r, 0, Math.PI*2);
    ctx.fill();
  });

  // optional HUD crosshair
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI*2);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  if (typeof r === 'undefined') r = 5;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function onGameOver(){
  gameOver = true;
  msgEl.textContent = 'Você morreu. Tempo: ' + Math.floor(elapsed/1000) + 's';
  restartBtn.style.display = 'inline-block';
  // show final state
}

function loop(ts){
  if(!lastTime) lastTime = ts;
  const dt = ts - lastTime; lastTime = ts;
  update(dt);
  draw();
  if(!gameOver) requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
