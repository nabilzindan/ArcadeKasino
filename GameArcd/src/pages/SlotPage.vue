<template>
  <div class="game-page">
    <router-link to="/" class="back">← Kembali</router-link>
    <div class="header">
      <span class="icon">🎰</span>
      <h1 class="title" style="color:var(--green)">Skill-Stop Slot</h1>
      <p class="desc">Putar reel — tekan STOP dan lihat simbol melaju kencang!</p>
    </div>
    <div class="card">
      <!-- Machine frame -->
      <div class="machine-frame">
        <div class="frame-top">
          <span class="neon-text" :class="{ jackpot: winType === 'jackpot' }">
            {{ winType === 'jackpot' ? '🎉 JACKPOT! 🎉' : winType === 'bonus' ? '⭐ BONUS ⭐' : 'SLOT MACHINE' }}
          </span>
        </div>

        <!-- Reels: tall window shows symbols flying past -->
        <div class="reels">
          <div v-for="i in 3" :key="i" class="reel-wrapper">
            <div class="reel-window" :class="{ blur: spinning }">
              <div class="reel-strip" :style="{ transform: `translateY(${reelOffsets[i - 1]}px)` }">
                <span v-for="(sym, si) in reelSymbols" :key="si" class="reel-sym">{{ sym }}</span>
              </div>
              <div class="center-line"></div>
            </div>
          </div>
        </div>

        <div class="frame-bottom">
          <div class="lights">
            <span v-for="n in 12" :key="n" class="light" :class="{ on: spinning, delay: n % 2 === 0 }"></span>
          </div>
        </div>
      </div>

      <!-- Win banner -->
      <div v-if="winType" class="banner" :class="winType">
        <span v-if="winType === 'jackpot'">🎉 JACKPOT 777! +30 Koin!</span>
        <span v-else-if="winType === 'bonus'">⭐ Bonus! +10 Koin!</span>
        <span v-else-if="winType === 'near-miss'">😤 Hampir! 7-7-BAR!</span>
        <span v-else>😔 Tidak menang</span>
      </div>

      <!-- Controls -->
      <div v-if="playsLeft === 0 && !spinning" class="limit-banner">
        🔒 Batas main hari ini tercapai (5/5). Kembali besok ({{ resetIn }})
      </div>
      <template v-else>
        <div class="controls">
          <button class="btn spin" :disabled="spinning" @click="spin">🎰 SPIN (10 🪙)</button>
          <button class="btn stop" :disabled="!spinning || stopPressed" @click="stop">⏹ STOP</button>
        </div>
        <p class="plays-note">Sisa {{ playsLeft }}/5 main hari ini</p>
      </template>

      <div class="info-row">
        <div class="info"><span class="info-l">777</span><span class="info-v">+30 🪙</span></div>
        <div class="info"><span class="info-l">Bonus</span><span class="info-v">+10 🪙</span></div>
        <div class="info"><span class="info-l">Peluang JP</span><span class="info-v">5%</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import { CasinoEngine, Sound, getPlaysLeft, usePlay, msUntilReset, formatReset } from '../utils/casinoEngine';

const SYMBOLS = ['🍋', '🍒', '🔔', 'BAR', '💎', '🍊', '7', '⭐'];
const playsLeft = ref(getPlaysLeft('slot'));
const resetIn = ref(formatReset(msUntilReset()));
const SYM_H = 80;
const REPEAT = 6;                    // strip = 6x symbols so it never runs out
const STRIP_H = SYMBOLS.length * SYM_H * REPEAT;
const CENTER = 84;                   // center line of the 168px window

const reelSymbols = Array.from({ length: SYMBOLS.length * REPEAT }, (_, i) => SYMBOLS[i % SYMBOLS.length]);

// Initial offset centers symbol index 1 (🍒) on the center line
const reelOffsets = ref([44 - SYMBOLS.length * SYM_H - 1 * SYM_H, 44 - SYMBOLS.length * SYM_H - 1 * SYM_H, 44 - SYMBOLS.length * SYM_H - 1 * SYM_H]);
const spinning = ref(false);
const stopPressed = ref(false);
const winType = ref(null);

let outcome = null;
let finalSyms = [0, 0, 0];
let reels = [];        // { offset, speed, phase: 'spin'|'settle'|'done', target }
let stopTimes = [0, 0, 0];
let loopId = null;
let lastTick = 0;

function spin() {
  if (playsLeft.value <= 0) return;
  if (!CasinoEngine.deductCoins(10)) return;
  if (!usePlay('slot')) return;
  playsLeft.value--;
  resetIn.value = formatReset(msUntilReset());
  spinning.value = true;
  stopPressed.value = false;
  winType.value = null;
  outcome = CasinoEngine.getSlotResult();

  // Predetermined landing symbols (house edge)
  if (outcome.type === 'JACKPOT') finalSyms = [6, 6, 6];
  else if (outcome.type === 'BONUS') finalSyms = [5, 5, 5];
  else if (outcome.type === 'NEAR_MISS') finalSyms = [6, 6, 3];
  else {
    // Random combo, never three-of-a-kind (would look like a win)
    let a, b, c;
    do {
      a = Math.floor(Math.random() * SYMBOLS.length);
      b = Math.floor(Math.random() * SYMBOLS.length);
      c = Math.floor(Math.random() * SYMBOLS.length);
    } while (a === b && b === c);
    finalSyms = [a, b, c];
  }

  // Reel target offset: center finalSyms[i] on the center line, keep strip filling the window
  // Target: center symbol value t on the center line. We offset by one full
  // 8-symbol cycle (SYMBOLS.length * SYM_H) so the strip never shows blank
  // space above the window, while still displaying symbol t.
  reels = finalSyms.map((t, i) => ({
    offset: reelOffsets.value[i],
    speed: 2 + Math.random() * 3,
    phase: 'spin',
    target: CENTER - SYM_H / 2 - SYMBOLS.length * SYM_H - t * SYM_H,
  }));

  // Reels stop one-by-one: player click → quick, auto → slow
  const now = performance.now();
  stopTimes = [
    now + 350, now + 850, now + 1350,
  ];

  Sound.play('spin');
  if (!loopId) loopId = setInterval(tick, 16);
}

function stop() {
  if (!spinning.value || stopPressed.value) return;
  stopPressed.value = true;
  Sound.play('click');
  const now = performance.now();
  stopTimes = [now + 100, now + 650, now + 1200];
}

function tick() {
  const now = performance.now();
  let allDone = true;

  // Tick sound while anything is moving fast
  if (spinning.value && now - lastTick > 70) {
    Sound.play('tick');
    lastTick = now;
  }

  reels.forEach((r, i) => {
    if (r.phase === 'spin') {
      r.speed = Math.min(r.speed + 0.7, 22);
      r.offset -= r.speed;
      // keep offset within the strip
      r.offset = ((r.offset % STRIP_H) - STRIP_H) % STRIP_H;

      if (now > stopTimes[i]) {
        r.phase = 'settle';
        Sound.play('click');
      }
      allDone = false;
    } else if (r.phase === 'settle') {
      r.offset += (r.target - r.offset) * 0.16;
      if (Math.abs(r.target - r.offset) < 0.4) {
        r.offset = r.target;
        r.phase = 'done';
        Sound.play('bounce');
      } else {
        allDone = false;
      }
    }
    reelOffsets.value[i] = r.offset;
  });

  if (allDone) {
    clearInterval(loopId);
    loopId = null;
    spinning.value = false;
    resolve();
  }
}

function resolve() {
  if (outcome.type === 'JACKPOT') {
    winType.value = 'jackpot';
    CasinoEngine.addCoins(30);
    window.__casino?.shake();
  } else if (outcome.type === 'BONUS') {
    winType.value = 'bonus';
    CasinoEngine.addCoins(10);
  } else if (outcome.type === 'NEAR_MISS') {
    winType.value = 'near-miss';
    CasinoEngine.loseGame();
    Sound.play('lose');
  } else {
    winType.value = 'lose';
    CasinoEngine.loseGame();
    Sound.play('lose');
  }
}

onUnmounted(() => {
  if (loopId) clearInterval(loopId);
});
</script>

<style scoped>
.game-page { max-width: 500px; margin: 0 auto; padding: 20px 16px; }
.back { display: inline-block; color: var(--text-dim); font-size: 0.85rem; margin-bottom: 14px; transition: color 0.2s; }
.back:hover { color: var(--gold); }
.header { text-align: center; margin-bottom: 20px; }
.icon { font-size: 2.8rem; display: block; margin-bottom: 6px; filter: drop-shadow(0 0 10px rgba(46,204,113,0.4)); }
.title { font-size: 1.5rem; font-weight: 800; margin-bottom: 4px; }
.desc { color: var(--text-dim); font-size: 0.85rem; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 24px 20px; text-align: center; }

/* Machine Frame */
.machine-frame {
  background: linear-gradient(180deg, #1a1d24 0%, #111318 100%);
  border: 2px solid #f1c40f44;
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: inset 0 0 30px rgba(0,0,0,0.3), 0 0 20px rgba(241,196,15,0.08);
}

.frame-top { margin-bottom: 14px; }
.neon-text {
  font-size: 0.9rem; font-weight: 800; color: var(--gold);
  text-shadow: 0 0 8px rgba(241,196,15,0.4), 0 0 16px rgba(241,196,15,0.2);
  letter-spacing: 2px;
}
.neon-text.jackpot { animation: neonPulse 0.5s ease infinite; }

/* Reels: tall window, symbols fly past visibly */
.reels { display: flex; gap: 10px; justify-content: center; margin-bottom: 14px; }
.reel-wrapper { position: relative; }
.reel-window {
  width: 84px; height: 168px;
  overflow: hidden;
  background: linear-gradient(180deg, #0d0f14 0%, #161920 50%, #0d0f14 100%);
  border: 2px solid #f1c40f33;
  border-radius: 12px;
  position: relative;
  box-shadow: inset 0 0 24px rgba(0,0,0,0.5);
}
.reel-window.blur .reel-strip { filter: blur(1.6px); }

.reel-strip {
  display: flex;
  flex-direction: column;
  will-change: transform;
}
.reel-sym {
  width: 84px; height: 80px;
  display: flex; align-items: center; justify-content: center;
  font-size: 2.1rem;
  flex-shrink: 0;
  text-shadow: 0 0 8px rgba(241,196,15,0.15);
}

/* Bright center line */
.center-line {
  position: absolute;
  left: 0; right: 0; top: 84px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #f1c40f 20%, #f1c40f 80%, transparent);
  box-shadow: 0 0 8px rgba(241,196,15,0.8);
  pointer-events: none;
}

/* Lights */
.frame-bottom { overflow: hidden; }
.lights { display: flex; justify-content: space-around; padding: 0 4px; }
.light {
  width: 6px; height: 6px; border-radius: 50%;
  background: #30363d;
  transition: background 0.2s;
}
.light.on { background: var(--gold); box-shadow: 0 0 6px var(--gold); animation: pulse 0.6s ease infinite; }
.light.delay { animation-delay: 0.3s; }

.banner {
  padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 1rem; margin-bottom: 14px;
  animation: fadeInUp 0.3s ease;
}
.banner.jackpot { background: rgba(241,196,15,0.12); color: var(--gold); border: 1px solid rgba(241,196,15,0.3); animation: fadeInUp 0.3s ease, glowPulse 1s ease infinite; }
.banner.bonus { background: rgba(230,126,34,0.1); color: var(--orange); border: 1px solid rgba(230,126,34,0.25); }
.banner.near-miss { background: rgba(231,76,60,0.1); color: var(--red); border: 1px solid rgba(231,76,60,0.2); }
.banner.lose { background: rgba(99,110,114,0.1); color: #636e72; border: 1px solid rgba(99,110,114,0.2); }

.controls { display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; }
.btn {
  border: none; padding: 12px 24px; border-radius: 12px;
  font-size: 0.95rem; font-weight: 700;
  transition: transform 0.15s, box-shadow 0.15s;
}
.btn:active:not(:disabled) { transform: scale(0.95); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.limit-banner {
  padding: 12px 16px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;
  background: rgba(231,76,60,0.1); color: var(--red); border: 1px solid rgba(231,76,60,0.2);
  margin-bottom: 14px; animation: fadeInUp 0.3s ease;
}
.plays-note { color: var(--text-dim); font-size: 0.72rem; margin-top: 10px; }
.spin { background: linear-gradient(135deg, #27ae60, #219a52); color: #fff; box-shadow: 0 4px 16px rgba(46,204,113,0.3); }
.spin:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(46,204,113,0.5); }
.stop { background: linear-gradient(135deg, #e74c3c, #c0392b); color: #fff; box-shadow: 0 4px 16px rgba(231,76,60,0.3); }
.stop:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(231,76,60,0.5); }

.info-row { display: flex; gap: 12px; justify-content: center; }
.info { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; display: flex; flex-direction: column; align-items: center; flex: 1; }
.info-l { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px; }
.info-v { font-size: 0.82rem; font-weight: 700; color: var(--gold); }
</style>