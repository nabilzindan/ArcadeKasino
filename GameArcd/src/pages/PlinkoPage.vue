<template>
  <div class="game-page">
    <router-link to="/" class="back">← Kembali</router-link>
    <div class="header">
      <span class="icon">🔵</span>
      <h1 class="title" style="color:var(--orange)">Biased Plinko</h1>
      <p class="desc">Jatuhkan bola — bola memantul di antara patokan dan jatuh ke slot hadiah!</p>
    </div>
    <div class="card">
      <canvas ref="canvas" :width="W" :height="H" class="canvas"></canvas>

      <div v-if="playsLeft === 0 && !running" class="limit-banner">
        🔒 Batas main hari ini tercapai (5/5). Kembali besok ({{ resetIn }})
      </div>
      <template v-else>
        <button class="btn" :disabled="running" @click="drop">
          <span v-if="!running">🔵 Jatuhkan Bola (5 🪙)</span><span v-else>Memantul...</span>
        </button>
        <p class="plays-note">Sisa {{ playsLeft }}/5 main hari ini</p>
      </template>

      <div class="info-row">
        <div class="info"><span class="info-l">Biaya</span><span class="info-v">5 🪙</span></div>
        <div class="info"><span class="info-l">Max Hadiah</span><span class="info-v">4 🪙</span></div>
        <div class="info"><span class="info-l">Bias</span><span class="info-v">60% Tengah</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { CasinoEngine, Sound, getPlaysLeft, usePlay, msUntilReset, formatReset } from '../utils/casinoEngine';

const W = 360, H = 500;
const playsLeft = ref(getPlaysLeft('plinko'));
const resetIn = ref(formatReset(msUntilReset()));
const canvas = ref(null);
const running = ref(false);
const lastResult = ref(null);
let ctx, animId;
let particles = [];
let ball = null;
let trails = [];
let landTimer = null;
let resultTimer = 0; // counts down while the floating +N result is visible

// Peg layout — placed high, well above the slots
const ROWS = 10;
const PEG_R = 4;
const PEGS = [];
for (let r = 1; r <= ROWS; r++) {
  const count = 4 + Math.floor((r - 1) * 5 / 9); // 4 → 9 pegs per row
  for (let c = 0; c < count; c++) {
    const x = (W / 2) - ((count - 1) / 2) * 36 + c * 36;
    const y = 48 + r * 36; // rows end at 48 + 360 = 408, slots start at ~H-48 = 452
    PEGS.push({ x, y });
  }
}

// Slot rewards at bottom
const SLOTS = [
  { label: '0', color: '#636e72', reward: 0 },
  { label: '1', color: '#2980b9', reward: 1 },
  { label: '0', color: '#636e72', reward: 0 },
  { label: '2', color: '#27ae60', reward: 2 },
  { label: '0', color: '#636e72', reward: 0 },
  { label: '3', color: '#e67e22', reward: 3 },
  { label: '0', color: '#636e72', reward: 0 },
  { label: '4', color: '#f1c40f', reward: 4 },
  { label: '0', color: '#636e72', reward: 0 },
  { label: '3', color: '#e67e22', reward: 3 },
  { label: '0', color: '#636e72', reward: 0 },
  { label: '1', color: '#2980b9', reward: 1 },
  { label: '0', color: '#636e72', reward: 0 },
];
const SLOT_W = (W - 40) / SLOTS.length;

onMounted(() => {
  ctx = canvas.value.getContext('2d');
  draw();
});

onUnmounted(() => {
  cancelAnimationFrame(animId);
  if (landTimer) clearTimeout(landTimer);
});

function draw() {
  // BG gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#111318');
  bg.addColorStop(1, '#080a10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Pegs with glow
  for (const p of PEGS) {
    ctx.beginPath();
    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#b8960b';
    ctx.arc(p.x, p.y, PEG_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Slots
  SLOTS.forEach((s, i) => {
    const x = 20 + i * SLOT_W;
    ctx.fillStyle = s.color + '22';
    ctx.strokeStyle = s.color + '66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 1, H - 46, SLOT_W - 2, 40, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = s.color;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.label, x + SLOT_W / 2, H - 22);
  });

  // Trails
  for (let i = trails.length - 1; i >= 0; i--) {
    const t = trails[i];
    t.life -= 0.02;
    if (t.life <= 0) { trails.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * t.life, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(231,76,60,${t.life * 0.5})`;
    ctx.fill();
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 0.025;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color.replace('1)', `${p.life})`);
    ctx.fill();
  }

  // Ball
  if (ball) {
    // Glow
    ctx.beginPath();
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 16;
    const grad = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 14);
    grad.addColorStop(0, '#e74c3c');
    grad.addColorStop(1, '#c0392b88');
    ctx.fillStyle = grad;
    ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Trail
    trails.push({ x: ball.x, y: ball.y, r: 5, life: 0.7 });
    if (trails.length > 30) trails.shift();
  }

  // Floating result (+N or 0) — top right, no banner text
  if (lastResult.value !== null && resultTimer > 0) {
    resultTimer -= 0.016;
    const life = Math.max(resultTimer / 1.6, 0);
    // Pop-in: scale from 1.5 → 1 during the first 0.3s, fade out at the end
    const pop = Math.min((1.6 - resultTimer) / 0.3, 1);
    const scale = 1.5 - 0.5 * Math.min(pop, 1);
    const alpha = resultTimer < 0.4 ? resultTimer / 0.4 : 1;

    ctx.save();
    ctx.translate(W - 34, 30);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow pill behind the number
    const txt = lastResult.value > 0 ? `+${lastResult.value}` : '0';
    ctx.font = 'bold 22px sans-serif';
    const w = ctx.measureText(txt).width + 26;
    const grad = ctx.createLinearGradient(-w / 2, -16, w / 2, 16);
    grad.addColorStop(0, lastResult.value > 0 ? 'rgba(46,204,113,0.18)' : 'rgba(99,110,114,0.15)');
    grad.addColorStop(1, lastResult.value > 0 ? 'rgba(46,204,113,0.05)' : 'rgba(99,110,114,0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -18, w, 36, 18);
    ctx.fill();
    ctx.strokeStyle = lastResult.value > 0 ? 'rgba(46,204,113,0.5)' : 'rgba(99,110,114,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = lastResult.value > 0 ? '#2ecc71' : '#636e72';
    ctx.fillText(txt, 0, 1);
    ctx.restore();
  }

  animId = requestAnimationFrame(draw);
}

function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      r: 2 + Math.random() * 3,
      life: 1,
      color: color || 'rgba(241,196,15,1)',
    });
  }
}

function drop() {
  if (playsLeft.value <= 0) return;
  if (!CasinoEngine.deductCoins(5)) return;
  if (!usePlay('plinko')) return;
  playsLeft.value--;
  resetIn.value = formatReset(msUntilReset());
  running.value = true;
  lastResult.value = null;
  resultTimer = 0;
  trails = [];
  particles = [];

  ball = {
    x: W / 2 + (Math.random() - 0.5) * 40,
    y: 20,
    vx: 0,
    vy: 0,
    pegHits: 0,
    landed: false,
  };

  Sound.play('drop');
  // Safety net: never let the game soft-lock, force-land after 12s
  if (landTimer) clearTimeout(landTimer);
  landTimer = setTimeout(finishLand, 12000);
  simulate();
}

function finishLand() {
  if (!ball || ball.landed) return;
  ball.landed = true;
  const slotIdx = Math.floor((ball.x - 20) / SLOT_W);
  const clamped = Math.max(0, Math.min(SLOTS.length - 1, slotIdx));
  const slot = SLOTS[clamped];
  ball.y = H - 52;

  if (slot.reward > 0) {
    CasinoEngine.addCoins(slot.reward);
    spawnParticles(ball.x, ball.y, 'rgba(46,204,113,1)', 20);
    window.__casino?.shake();
  } else {
    CasinoEngine.loseGame();
    Sound.play('lose');
    spawnParticles(ball.x, ball.y, 'rgba(231,76,60,1)', 8);
  }
  lastResult.value = slot.reward;
  resultTimer = 1.6;
  running.value = false;
  ball = null;
  if (landTimer) { clearTimeout(landTimer); landTimer = null; }
}

function simulate() {
  if (!ball || ball.landed) return;

  const GRAVITY = 0.5;
  const FRICTION = 0.99;
  const BOUNCE = 0.6;

  ball.vy += GRAVITY;
  ball.vy *= FRICTION;
  ball.vx *= FRICTION;

  // Bias: 60% chance push toward center
  if (Math.random() < 0.06) {
    ball.vx += (W / 2 - ball.x) * 0.005;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounce
  if (ball.x < 20) { ball.x = 20; ball.vx = Math.abs(ball.vx) * BOUNCE; Sound.play('bounce'); }
  if (ball.x > W - 20) { ball.x = W - 20; ball.vx = -Math.abs(ball.vx) * BOUNCE; Sound.play('bounce'); }

  // Peg collision
  for (const p of PEGS) {
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = PEG_R + 8;
    if (dist < minDist && dist > 0) {
      // Reflect
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = p.x + nx * minDist;
      ball.y = p.y + ny * minDist;
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 1.8 * dot * nx;
      ball.vy -= 1.8 * dot * ny;
      ball.vx *= BOUNCE;
      ball.vy *= BOUNCE;
      ball.pegHits++;
      Sound.play('bounce');
      spawnParticles(p.x, p.y, 'rgba(241,196,15,1)', 4);
      break;
    }
  }

  // Land in slot
  if (ball.y > H - 48) {
    finishLand();
    return;
  }

  requestAnimationFrame(simulate);
}
</script>

<style scoped>
.game-page { max-width: 500px; margin: 0 auto; padding: 20px 16px; }
.back { display: inline-block; color: var(--text-dim); font-size: 0.85rem; margin-bottom: 14px; transition: color 0.2s; }
.back:hover { color: var(--gold); }
.header { text-align: center; margin-bottom: 20px; }
.icon { font-size: 2.8rem; display: block; margin-bottom: 6px; filter: drop-shadow(0 0 10px rgba(230,126,34,0.4)); }
.title { font-size: 1.5rem; font-weight: 800; margin-bottom: 4px; }
.desc { color: var(--text-dim); font-size: 0.85rem; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 24px 20px; text-align: center; }
.canvas { display: block; margin: 0 auto 16px; border-radius: 14px; border: 1px solid var(--border); max-width: 100%; }
.btn {
  background: linear-gradient(135deg, #e67e22, #d35400); color: #fff; border: none;
  padding: 14px 32px; border-radius: 14px; font-size: 1rem; font-weight: 700;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 20px rgba(230,126,34,0.3);
}
.btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(230,126,34,0.5); }
.btn:active:not(:disabled) { transform: scale(0.96); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.limit-banner {
  padding: 12px 16px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;
  background: rgba(231,76,60,0.1); color: var(--red); border: 1px solid rgba(231,76,60,0.2);
  margin-bottom: 14px; animation: fadeInUp 0.3s ease;
}
.plays-note { color: var(--text-dim); font-size: 0.72rem; margin-top: 10px; }
.info-row { display: flex; gap: 12px; justify-content: center; margin-top: 16px; }
.info { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; display: flex; flex-direction: column; align-items: center; flex: 1; }
.info-l { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px; }
.info-v { font-size: 0.82rem; font-weight: 700; color: var(--gold); }
</style>