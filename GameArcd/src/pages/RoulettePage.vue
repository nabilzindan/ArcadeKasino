<template>
  <div class="game-page">
    <router-link to="/" class="back">← Kembali</router-link>
    <div class="header">
      <span class="icon">🎯</span>
      <h1 class="title" style="color:var(--purple)">Warna Roulette</h1>
      <p class="desc">Tebak warna sektor tempat bola berhenti — Hijau, Hitam, atau Putih!</p>
    </div>
    <div class="card">
      <div class="wheel-wrap">
        <canvas ref="canvas" :width="SIZE" :height="SIZE" class="canvas"></canvas>
        <div class="pointer">▼</div>
      </div>

      <!-- Spin history -->
      <div class="history" v-if="history.length">
        <span class="hist-lbl">Riwayat</span>
        <div class="hist-dots">
          <span
            v-for="(h, i) in history" :key="i"
            class="hist-dot" :class="['c-' + h.color, { won: h.win }]"
            :title="'Sektor ' + h.number">
            {{ h.number }}
          </span>
        </div>
      </div>

      <!-- Color chips -->
      <div class="bets">
        <button
          v-for="b in bets" :key="b.id"
          class="chip" :class="[b.cls, { selected: betColor === b.id, dim: spinning }]"
          @click="pick(b.id)">
          <span class="chip-face">
            <span class="chip-val">×{{ b.pay }}</span>
          </span>
          <span class="chip-label">{{ b.label }}</span>
        </button>
      </div>

      <!-- Bet preview -->
      <div class="bet-info">
        <div class="bi-item">
          <span class="bi-l">Taruhan</span>
          <span class="bi-v">5 🪙</span>
        </div>
        <span class="bi-arrow">→</span>
        <div class="bi-item">
          <span class="bi-l">Hadiah</span>
          <span class="bi-v" :class="{ ready: betColor }">{{ potentialWin }}</span>
        </div>
      </div>

      <div v-if="result" class="banner" :class="result.win ? 'win' : 'lose'">
        <span v-if="result.win">🎉 {{ result.label }}! +{{ result.payout }} Koin!</span>
        <span v-else>Sektor {{ result.number }} — {{ result.label }}. Coba lagi!</span>
      </div>

      <div v-if="playsLeft === 0 && !spinning" class="limit-banner">
        🔒 Batas main hari ini tercapai (5/5). Kembali besok ({{ resetIn }})
      </div>
      <template v-else>
        <button class="btn" :disabled="spinning || !betColor" @click="spin">
          <span v-if="!spinning">🎯 PUTAR (5 🪙)</span>
          <span v-else>Berputar...</span>
        </button>
        <p class="plays-note">Sisa {{ playsLeft }}/5 main hari ini</p>
      </template>

      <div class="info-row">
        <div class="info"><span class="dot" style="background:#2ecc71"></span><span class="info-l">Hijau</span><span class="info-v">×8</span></div>
        <div class="info"><span class="dot" style="background:#14161c; border-color:#3a4154"></span><span class="info-l">Hitam</span><span class="info-v">×2</span></div>
        <div class="info"><span class="dot" style="background:#e8ecf4"></span><span class="info-l">Putih</span><span class="info-v">×2</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { CasinoEngine, Sound, getPlaysLeft, usePlay, msUntilReset, formatReset } from '../utils/casinoEngine';

const SIZE = 300;
const playsLeft = ref(getPlaysLeft('roulette'));
const resetIn = ref(formatReset(msUntilReset()));
const canvas = ref(null);
const spinning = ref(false);
const betColor = ref(null);
const result = ref(null);
const history = ref([]);

let ctx, animId;
let angle = 0;
let speed = 0;
let spinning_ = false;
let glowTimer = 0;
let winIdx = -1;
let ballPhi = -Math.PI / 2; // ball screen angle, converges to pointer when wheel slows
let ballR = 0;

const SA = (Math.PI * 2) / 36;
const HUB = 30;            // center hub radius
const TRACK = SIZE / 2 - 8 - 13; // ball orbit radius

const bets = [
  { id: 'green', label: 'Hijau', hex: '#2ecc71', pay: 8, cls: 'bet-green' },
  { id: 'black', label: 'Hitam', hex: '#14161c', pay: 2, cls: 'bet-black' },
  { id: 'white', label: 'Putih', hex: '#e8ecf4', pay: 2, cls: 'bet-white' },
];

// Sector colors: sector 7 (index 6) green, even = black, odd = white
const COLORS = [];
for (let i = 0; i < 36; i++) {
  if (i === 6) COLORS.push('green');
  else COLORS.push(i % 2 === 0 ? 'black' : 'white');
}
const NUMS = Array.from({ length: 36 }, (_, i) => i + 1);
const COLOR_HEX = { green: '#2ecc71', black: '#14161c', white: '#e8ecf4' };

const PAYOUT = { green: 40, black: 10, white: 10 }; // addCoins amount (bet 5 deducted)

const potentialWin = computed(() =>
  betColor.value ? '+' + PAYOUT[betColor.value].toLocaleString() : '—'
);

onMounted(() => {
  ctx = canvas.value.getContext('2d');
  draw();
});

onUnmounted(() => cancelAnimationFrame(animId));

function pick(id) {
  if (spinning.value) return;
  betColor.value = id;
  Sound.play('click');
}

function draw() {
  const now = performance.now();
  const t = now / 1000;
  const cx = SIZE / 2, cy = SIZE / 2, R = SIZE / 2 - 8;

  ctx.clearRect(0, 0, SIZE, SIZE);

  // ── Outer gold ring + tick marks ──
  ctx.beginPath();
  ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#b8960b';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#f1c40f66';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 36; i++) {
    const a = angle + i * SA;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R + 1), cy + Math.sin(a) * (R + 1));
    ctx.lineTo(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10));
    ctx.stroke();
  }

  // ── Ball track (dark ring) ──
  ctx.beginPath();
  ctx.arc(cx, cy, TRACK, 0, Math.PI * 2);
  ctx.strokeStyle = '#07090d';
  ctx.lineWidth = 11;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, TRACK, 0, Math.PI * 2);
  ctx.strokeStyle = '#f1c40f22';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Sectors (annulus HUB → R) ──
  for (let i = 0; i < 36; i++) {
    const a1 = angle + i * SA;
    const a2 = a1 + SA;
    const col = COLORS[i];

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * HUB, cy + Math.sin(a1) * HUB);
    ctx.arc(cx, cy, R, a1, a2);
    ctx.arc(cx, cy, HUB, a2, a1, true);
    ctx.closePath();
    ctx.fillStyle = COLOR_HEX[col];
    ctx.fill();
    ctx.strokeStyle = '#f1c40f33';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Number label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a1 + SA / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = col === 'white' ? '#14161c' : '#fff';
    ctx.fillText(NUMS[i], (R + HUB) / 2 + 3, 0);
    ctx.restore();
  }

  // Winning sector glow
  if (glowTimer > 0) {
    glowTimer -= 0.02;
    const a1 = angle + winIdx * SA;
    const a2 = a1 + SA;
    const pulse = 0.5 + 0.5 * Math.sin(t * 10);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * HUB, cy + Math.sin(a1) * HUB);
    ctx.arc(cx, cy, R, a1, a2);
    ctx.arc(cx, cy, HUB, a2, a1, true);
    ctx.closePath();
    ctx.strokeStyle = `rgba(241,196,15,${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // ── Center hub ──
  const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, HUB);
  hubGrad.addColorStop(0, '#f1c40f');
  hubGrad.addColorStop(1, '#b8960b');
  ctx.beginPath();
  ctx.arc(cx, cy, HUB, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = '#080a10';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, HUB - 9, 0, Math.PI * 2);
  ctx.strokeStyle = '#7d5f06';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#5c4700';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎯', cx, cy + 1);

  // ── Ball: orbits opposite the wheel while it spins fast, then eases to
  //     the pointer as the wheel slows — rests exactly in the reported sector.
  const fast = spinning_ && speed > 0.06;
  if (fast) {
    ballPhi = -angle + Math.PI / 2 + Math.sin(t * 30) * 0.05;
    ballR = TRACK + Math.sin(t * 20) * 2.5;
  } else {
    ballPhi += (-Math.PI / 2 - ballPhi) * 0.12;
    ballR += (TRACK - 1 - ballR) * 0.1;
    if (Math.abs(-Math.PI / 2 - ballPhi) < 0.02) ballPhi = -Math.PI / 2;
  }
  const bx = cx + Math.cos(ballPhi) * ballR;
  const by = cy + Math.sin(ballPhi) * ballR;
  ctx.beginPath();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = spinning_ ? 10 : 4;
  const ballGrad = ctx.createRadialGradient(bx - 2, by - 2, 0, bx, by, 7);
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(1, '#b8bec9');
  ctx.fillStyle = ballGrad;
  ctx.arc(bx, by, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  animId = requestAnimationFrame(draw);
}

function spin() {
  if (!betColor.value) return;
  if (playsLeft.value <= 0) return;
  if (!CasinoEngine.deductCoins(5)) return;
  if (!usePlay('roulette')) return;
  playsLeft.value--;
  resetIn.value = formatReset(msUntilReset());
  result.value = null;
  spinning.value = true;
  spinning_ = true;
  speed = 0.4 + Math.random() * 0.15; // radians per frame
  Sound.play('spin');
  decelerate();
}

function decelerate() {
  if (speed <= 0.003) {
    spinning.value = false;
    spinning_ = false;
    resolveResult();
    return;
  }
  angle += speed;
  speed *= 0.986; // friction
  if (Math.random() < 0.06) Sound.play('tick');
  requestAnimationFrame(decelerate);
}

// Sector under the pointer (top = -PI/2). Correct angle math so the
// ball actually rests inside the sector we report.
function sectorUnderPointer() {
  const norm = (((-Math.PI / 2 - angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(norm / SA) % 36;
}

function resolveResult() {
  const idx = sectorUnderPointer();
  const num = NUMS[idx];
  const color = COLORS[idx];
  const label = bets.find(b => b.id === color).label;
  const win = color === betColor.value;
  winIdx = idx;
  glowTimer = 2.0;

  if (win) {
    const payout = PAYOUT[color];
    CasinoEngine.addCoins(payout);
    result.value = { win: true, number: num, label, payout };
    window.__casino?.shake();
  } else {
    CasinoEngine.loseGame();
    Sound.play('lose');
    result.value = { win: false, number: num, label };
  }

  // History (most recent first)
  history.value.unshift({ number: num, color, win });
  if (history.value.length > 9) history.value.pop();
}
</script>

<style scoped>
.game-page { max-width: 500px; margin: 0 auto; padding: 20px 16px; }
.back { display: inline-block; color: var(--text-dim); font-size: 0.85rem; margin-bottom: 14px; transition: color 0.2s; }
.back:hover { color: var(--gold); }
.header { text-align: center; margin-bottom: 20px; }
.icon { font-size: 2.8rem; display: block; margin-bottom: 6px; filter: drop-shadow(0 0 10px rgba(155,89,182,0.4)); }
.title { font-size: 1.5rem; font-weight: 800; margin-bottom: 4px; }
.desc { color: var(--text-dim); font-size: 0.85rem; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 24px 20px; text-align: center; }

.wheel-wrap {
  position: relative; display: inline-block; margin-bottom: 14px;
  filter: drop-shadow(0 10px 22px rgba(0,0,0,0.5));
}
.canvas { display: block; border-radius: 50%; }
.pointer {
  position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
  font-size: 1.5rem; color: var(--gold);
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));
  z-index: 2;
}

/* ── History ── */
.history {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 16px;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 8px 12px;
}
.hist-lbl {
  font-size: 0.62rem; color: var(--text-dim);
  text-transform: uppercase; letter-spacing: 1px; flex-shrink: 0;
}
.hist-dots { display: flex; gap: 5px; flex-wrap: wrap; }
.hist-dot {
  width: 22px; height: 22px; border-radius: 50%;
  font-size: 0.58rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #ffffff1a;
}
.hist-dot.c-green { background: #2ecc71; color: #06381f; }
.hist-dot.c-black { background: #14161c; color: #c9d1d9; border-color: #3a4154; }
.hist-dot.c-white { background: #e8ecf4; color: #14161c; }
.hist-dot.won { box-shadow: 0 0 8px rgba(241,196,15,0.8); border-color: #f1c40f; }

/* ── Bet chips ── */
.bets { display: flex; gap: 18px; justify-content: center; margin-bottom: 14px; }
.chip {
  background: none; border: none; cursor: pointer;
  display: flex; flex-direction: column; align-items: center;
  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), opacity 0.2s;
}
.chip.dim { opacity: 0.45; cursor: not-allowed; }
.chip-face {
  width: 62px; height: 62px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 4px dashed rgba(0,0,0,0.25);
  box-shadow: 0 4px 12px rgba(0,0,0,0.45), inset 0 0 0 3px rgba(255,255,255,0.08);
  transition: box-shadow 0.2s;
}
.bet-green .chip-face { background: radial-gradient(circle at 35% 30%, #58d68d, #1e8449 85%); }
.bet-black .chip-face { background: radial-gradient(circle at 35% 30%, #3a3f4b, #0d0f14 85%); }
.bet-white .chip-face { background: radial-gradient(circle at 35% 30%, #ffffff, #b9c2ce 85%); }
.chip-val {
  width: 34px; height: 34px; border-radius: 50%;
  background: #0b0d12; color: var(--gold);
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.68rem;
  border: 2px solid #ffffff1f;
}
.chip:hover:not(.dim) .chip-face { transform: translateY(-3px); }
.chip.selected { transform: translateY(-6px); }
.chip.selected .chip-face {
  box-shadow: 0 10px 20px rgba(0,0,0,0.5), 0 0 0 3px #f1c40f, 0 0 24px rgba(241,196,15,0.55);
}
.chip-label {
  font-size: 0.68rem; font-weight: 700; margin-top: 7px;
  color: var(--text-dim); transition: color 0.2s;
}
.chip.selected .chip-label { color: var(--gold); }

/* ── Bet preview ── */
.bet-info {
  display: flex; align-items: center; justify-content: center; gap: 14px;
  margin-bottom: 14px;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 8px 16px;
}
.bi-item { display: flex; flex-direction: column; align-items: center; min-width: 64px; }
.bi-l { font-size: 0.58rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; }
.bi-v { font-size: 0.95rem; font-weight: 800; color: var(--gold); }
.bi-v.ready { color: var(--green); text-shadow: 0 0 10px rgba(46,204,113,0.4); }
.bi-arrow { color: var(--text-dim); font-size: 0.9rem; }

.banner { padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 0.95rem; margin-bottom: 14px; animation: fadeInUp 0.3s ease; }
.banner.win { background: rgba(46,204,113,0.12); color: var(--green); border: 1px solid rgba(46,204,113,0.25); }
.banner.lose { background: rgba(99,110,114,0.1); color: #636e72; border: 1px solid rgba(99,110,114,0.2); }

.btn {
  background: linear-gradient(135deg, #9b59b6, #7d3c98); color: #fff; border: none;
  padding: 14px 32px; border-radius: 14px; font-size: 1rem; font-weight: 700;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 20px rgba(155,89,182,0.3);
}
.btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(155,89,182,0.5); }
.btn:active:not(:disabled) { transform: scale(0.96); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.limit-banner {
  padding: 12px 16px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;
  background: rgba(231,76,60,0.1); color: var(--red); border: 1px solid rgba(231,76,60,0.2);
  margin-bottom: 14px; animation: fadeInUp 0.3s ease;
}
.plays-note { color: var(--text-dim); font-size: 0.72rem; margin-top: 10px; }

.info-row { display: flex; gap: 12px; justify-content: center; margin-top: 16px; }
.info {
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 8px 10px; display: flex; flex-direction: column; align-items: center; flex: 1; gap: 3px;
}
.dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #ffffff22; }
.info-l { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; }
.info-v { font-size: 0.82rem; font-weight: 700; color: var(--gold); }
</style>