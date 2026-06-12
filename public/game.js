const socket = io({
  transports: ['websocket', 'polling']
});const COLORS = ['#ff4444','#4488ff','#44dd44','#ffaa00'];
const NAMES  = ['RED FURY','BLUE STORM','GREEN BEAST','GOLD VIPER'];

const W = 880, H = 400, GROUND = 320;
const GRAVITY = 1400, JUMP_VEL = -620, MOVE_SPD = 220;

let myId = null;
let players = {};
let gameStarted = false;
let myPlayerIndex = 0;

const canvas  = document.getElementById('gc');
const ctx     = canvas.getContext('2d');
canvas.width  = W;
canvas.height = H;

// ── INPUT ──
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup',   e => keys[e.key] = false);

// Mobile buttons
function addHold(id, key) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('touchstart', e => { e.preventDefault(); keys[key] = true; });
  btn.addEventListener('touchend',   e => { e.preventDefault(); keys[key] = false; });
  btn.addEventListener('mousedown',  () => keys[key] = true);
  btn.addEventListener('mouseup',    () => keys[key] = false);
}
addHold('btn-left',  'ArrowLeft');
addHold('btn-right', 'ArrowRight');
addHold('btn-jump',  'ArrowUp');
addHold('btn-punch', 'f');
addHold('btn-kick',  'g');
addHold('btn-slam',  'v');

// ── SOCKET EVENTS ──
socket.on('connect', () => { myId = socket.id; });

socket.on('roomFull', () => {
  document.getElementById('wait-msg').textContent = 'Room is full! Try again later.';
});

socket.on('playersUpdate', (data) => {
  players = data;
  updatePlayerList();
  updateHUD();
});

socket.on('gameStart', (data) => {
  players = data;
  gameStarted = true;
  document.getElementById('waiting-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
  myPlayerIndex = Object.keys(players).indexOf(myId);
  startLoop();
});

socket.on('playerAttack', (data) => {
  handleRemoteAttack(data);
});

socket.on('playerLeft', (id) => {
  delete players[id];
  updateHUD();
});

// ── WAITING SCREEN ──
function updatePlayerList() {
  const list = document.getElementById('player-list');
  list.innerHTML = '';
  let i = 0;
  for (let id in players) {
    const badge = document.createElement('div');
    badge.className = 'player-badge';
    badge.style.borderColor = COLORS[i];
    badge.style.color = COLORS[i];
    badge.textContent = (id === myId ? '⭐ ' : '') + NAMES[i];
    list.appendChild(badge);
    i++;
  }
  document.getElementById('wait-msg').textContent =
    ${Object.keys(players).length} player(s) connected — need at least 2 to start!;
}

// ── HUD ──
function updateHUD() {
  const hud = document.getElementById('hud');
  hud.innerHTML = '';
  let i = 0;
  for (let id in players) {
    const p = players[id];
    const hp = Math.max(0, p.hp);
    const card = document.createElement('div');
    card.className = 'hud-card' + (p.dead ? ' dead-card' : '');
    card.style.borderColor = COLORS[i];
    card.innerHTML = `
      <div class="hud-name" style="color:${COLORS[i]}">${NAMES[i]}${id===myId?' ⭐':''}</div>
      <div class="hp-bar-bg"><div class="hp-bar" style="width:${hp}%;background:${COLORS[i]}"></div></div>
      <div class="hud-hp">${p.dead ? 'KO!' : Math.round(hp) + ' HP'}</div>
    `;
    hud.appendChild(card);
    i++;
  }
}

// ── LOCAL PHYSICS ──
let localState = {};
let lastTime = 0;
let punchCD = 0, kickCD = 0, slamCD = 0;

function startLoop() {
  // Init local state
  for (let id in players) {
    localState[id] = { ...players[id], vy: 0, onGround: true, animFrame: 0, animTimer: 0, hurtFlash: 0 };
  }
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  punchCD = Math.max(0, punchCD - dt);
  kickCD  = Math.max(0, kickCD  - dt);
  slamCD  = Math.max(0, slamCD  - dt);

  // Sync server state into local
  for (let