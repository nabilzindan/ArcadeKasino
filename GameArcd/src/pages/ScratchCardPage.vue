<template>
  <div class="game-page">
    <router-link to="/" class="back">← Kembali</router-link>
    <div class="header">
      <span class="icon">🎫</span>
      <h1 class="title" style="color:var(--red)">Scratch & Reveal</h1>
      <p class="desc">Gosok kartu dengan mouse atau sentuh untuk mengungkap simbol!</p>
    </div>
    <div class="card">
      <div class="scratch-wrap" ref="wrapRef">
        <!-- Hidden symbols underneath -->
        <div class="symbols-grid">
          <div v-for="(sym, i) in symbols" :key="i" class="sym-cell" :class="{ revealed: revealedCells[i] }">
            {{ sym }}
          </div>
        </div>
        <!-- Canvas overlay for scratch -->
        <canvas ref="scratchCanvas" :width="scrW" :height="scrH" class="scratch-overlay"
          @mousedown="startScratch" @mousemove="doScratch" @mouseup="endScratch"
          @touchstart.prevent="startScratch" @touchmove.prevent="doScratch" @touchend="endScratch"
          :class="{ hidden: allRevealed }">
        </canvas>
      </div>

      <div v-if="result" class="banner" :class="result">
        <span v-if="result === 'jackpot'">💎💎💎 TRIPLE! +12 Koin!</span>
        <span v-else-if="result === 'pair'">✨ Pair! +4 Koin!</span>
        <span v-else>😔 Tidak ada kombinasi</span>
      </div>

      <div v-if="playsLeft === 0 && !allRevealed" class="limit-banner">
        🔒 Batas main hari ini tercapai (5/5). Kembali besok ({{ resetIn }})
      </div>
      <button v-if="allRevealed && playsLeft > 0" class="btn" @click="resetCard">🎫 Gosok Lagi (5 🪙)</button>
      <p v-if="allRevealed && playsLeft === 0" class="scratch-hint">🔒 Batas hari ini — kembali besok ya</p>
      <p v-if="!allRevealed && !scratching" class="scratch-hint">👆 Gosok area abu-abu untuk mengungkap!</p>
      <p v-if="scratching && playsLeft > 0" class="scratch-hint plays-note">Sisa {{ playsLeft }}/5 main hari ini</p>

      <div class="info-row">
        <div class="info"><span class="info-l">Triple</span><span class="info-v">+12 🪙</span></div>
        <div class="info"><span class="info-l">Pair</span><span class="info-v">+4 🪙</span></div>
        <div class="info"><span class="info-l">Biaya</span><span class="info-v">5 🪙</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { CasinoEngine, Sound, getPlaysLeft, usePlay, msUntilReset, formatReset } from '../utils/casinoEngine';

const ALL_SYMBOLS = ['💎', '🍋', '🔔', '🍒', '⭐', '🍊', '🪙', '🎰'];
const playsLeft = ref(getPlaysLeft('scratch'));
const resetIn = ref(formatReset(msUntilReset()));
const scrW = 300, scrH = 180;
const wrapRef = ref(null);
const scratchCanvas = ref(null);
const symbols = ref([]);
const revealedCells = ref([]);
const allRevealed = ref(false);
const result = ref(null);
const scratching = ref(false);
let ctx;
let isDrawing = false;

onMounted(() => {
  initCard();
});

function initCard() {
  // Generate 3x2 grid of symbols (bitter odds)
  const isTriple = Math.random() < 0.12;
  const isPair = !isTriple && Math.random() < 0.30;

  if (isTriple) {
    const s = ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
    symbols.value = [s, s, s, randSym(), randSym(), randSym()];
    shuffle(symbols.value);
  } else if (isPair) {
    const s = ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
    symbols.value = [s, s, randSym(), randSym(), randSym(), randSym()];
    shuffle(symbols.value);
  } else {
    symbols.value = Array.from({ length: 6 }, () => randSym());
  }

  revealedCells.value = [false, false, false, false, false, false];
  allRevealed.value = false;
  result.value = null;

  nextTick(() => {
    if (!scratchCanvas.value) return;
    ctx = scratchCanvas.value.getContext('2d');
    drawScratchSurface();
  });
}

function randSym() {
  return ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function drawScratchSurface() {
  if (!ctx) return;
  // Gradient scratch coating
  const grad = ctx.createLinearGradient(0, 0, scrW, scrH);
  grad.addColorStop(0, '#636e72');
  grad.addColorStop(0.5, '#7d8590');
  grad.addColorStop(1, '#535c60');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, scrW, scrH);

  // Subtle pattern
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < scrW; x += 6) {
    for (let y = 0; y < scrH; y += 6) {
      if ((x + y) % 12 === 0) ctx.fillRect(x, y, 3, 3);
    }
  }

  // Hint text
  ctx.fillStyle = 'rgba(241,196,15,0.4)';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎫 GOSOK DI SINI 🎫', scrW / 2, scrH / 2 - 10);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(241,196,15,0.25)';
  ctx.fillText('Gunakan mouse atau sentuh', scrW / 2, scrH / 2 + 12);
}

function getPos(e) {
  const rect = scratchCanvas.value.getBoundingClientRect();
  const scaleX = scrW / rect.width;
  const scaleY = scrH / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function startScratch(e) {
  if (allRevealed.value) return;
  if (playsLeft.value <= 0) return;
  // Charge only once per card (first press), not on every touch/click
  if (!scratching.value) {
    if (!CasinoEngine.deductCoins(5)) return;
    if (!usePlay('scratch')) return;
    playsLeft.value--;
    resetIn.value = formatReset(msUntilReset());
    scratching.value = true;
    // Redraw scratch canvas fresh
    drawScratchSurface();
  }
  isDrawing = true;
  scratch(e);
}

function doScratch(e) {
  if (!isDrawing || allRevealed.value) return;
  scratch(e);
}

function endScratch() {
  isDrawing = false;
}

function scratch(e) {
  const pos = getPos(e);
  ctx.globalCompositeOperation = 'destination-out';

  // Big scratch circle
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
  ctx.fill();

  // Smaller random scratches for texture
  for (let i = 0; i < 3; i++) {
    const ox = (Math.random() - 0.5) * 20;
    const oy = (Math.random() - 0.5) * 20;
    ctx.beginPath();
    ctx.arc(pos.x + ox, pos.y + oy, 8 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  Sound.play('scratch');

  checkRevealed();
}

function checkRevealed() {
  if (!ctx) return;
  const cellW = scrW / 3;
  const cellH = scrH / 2;
  let anyNew = false;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      if (revealedCells.value[idx]) continue;

      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;
      const data = ctx.getImageData(cx - 4, cy - 4, 8, 8).data;

      // Check if enough pixels are transparent
      let transparent = 0;
      for (let p = 3; p < data.length; p += 4) {
        if (data[p] < 128) transparent++;
      }
      if (transparent > 40) {
        revealedCells.value[idx] = true;
        anyNew = true;
        Sound.play('reveal');
      }
    }
  }

  if (revealedCells.value.every(Boolean)) {
    allRevealed.value = true;
    evaluateResult();
  }
}

function evaluateResult() {
  // Count duplicates
  const counts = {};
  for (const s of symbols.value) {
    counts[s] = (counts[s] || 0) + 1;
  }
  const max = Math.max(...Object.values(counts));

  if (max >= 3) {
    CasinoEngine.addCoins(12);
    result.value = 'jackpot';
    window.__casino?.shake();
  } else if (max >= 2) {
    CasinoEngine.addCoins(4);
    result.value = 'pair';
  } else {
    result.value = 'none';
    CasinoEngine.loseGame();
  }
}

function resetCard() {
  initCard();
}
</script>

<style scoped>
.game-page { max-width: 500px; margin: 0 auto; padding: 20px 16px; }
.back { display: inline-block; color: var(--text-dim); font-size: 0.85rem; margin-bottom: 14px; transition: color 0.2s; }
.back:hover { color: var(--gold); }
.header { text-align: center; margin-bottom: 20px; }
.icon { font-size: 2.8rem; display: block; margin-bottom: 6px; filter: drop-shadow(0 0 10px rgba(231,76,60,0.4)); }
.title { font-size: 1.5rem; font-weight: 800; margin-bottom: 4px; }
.desc { color: var(--text-dim); font-size: 0.85rem; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 24px 20px; text-align: center; }

.scratch-wrap {
  position: relative; width: 300px; height: 180px; margin: 0 auto 16px;
  border-radius: 14px; overflow: hidden;
  border: 2px solid var(--border);
}

.symbols-grid {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);
  background: var(--bg-surface);
}

.sym-cell {
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; opacity: 0.15;
  transition: opacity 0.4s ease, transform 0.3s ease;
}
.sym-cell.revealed { opacity: 1; transform: scale(1.1); }

.scratch-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  cursor: crosshair; touch-action: none;
  transition: opacity 0.5s ease;
}
.scratch-overlay.hidden { opacity: 0; pointer-events: none; }

.scratch-hint { color: var(--text-dim); font-size: 0.8rem; margin-bottom: 14px; animation: pulse 2s ease infinite; }
.limit-banner {
  padding: 12px 16px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;
  background: rgba(231,76,60,0.1); color: var(--red); border: 1px solid rgba(231,76,60,0.2);
  margin-bottom: 14px; animation: fadeInUp 0.3s ease;
}
.plays-note { color: var(--text-dim); font-size: 0.72rem; }

.banner { padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 1rem; margin-bottom: 14px; animation: fadeInUp 0.3s ease; }
.banner.jackpot { background: rgba(241,196,15,0.12); color: var(--gold); border: 1px solid rgba(241,196,15,0.25); animation: fadeInUp 0.3s ease, glowPulse 1s ease infinite; }
.banner.pair { background: rgba(0,210,211,0.1); color: var(--cyan); border: 1px solid rgba(0,210,211,0.2); }
.banner.none { background: rgba(99,110,114,0.1); color: #636e72; border: 1px solid rgba(99,110,114,0.2); }

.btn {
  background: linear-gradient(135deg, #c0392b, #e74c3c); color: #fff; border: none;
  padding: 14px 32px; border-radius: 14px; font-size: 1rem; font-weight: 700;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 20px rgba(192,57,43,0.3);
  margin-bottom: 14px;
}
.btn:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(192,57,43,0.5); }
.btn:active { transform: scale(0.96); }

.info-row { display: flex; gap: 12px; justify-content: center; }
.info { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; display: flex; flex-direction: column; align-items: center; flex: 1; }
.info-l { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; }
.info-v { font-size: 0.82rem; font-weight: 700; color: var(--gold); }
</style>
