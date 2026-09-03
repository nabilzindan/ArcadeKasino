<template>
  <div class="game-page">
    <router-link to="/" class="back">← Kembali</router-link>
    <div class="header">
      <span class="icon">🃏</span>
      <h1 class="title" style="color:var(--blue)">High-Low Ladder</h1>
      <p class="desc">Naik 5 langkah — langkah 4-5 ada House Edge 12%!</p>
    </div>
    <div class="card">
      <!-- Ladder -->
      <div class="ladder">
        <div v-for="step in 5" :key="step" class="step"
          :class="{
            reached: currentStep >= step,
            current: currentStep === step && currentStep <= 5,
            danger: step >= 4 && currentStep === step,
            done: currentStep > 5,
          }">
          <div class="step-num">
            <span v-if="currentStep > 5 && step === 5" class="trophy">🏆</span>
            <span v-else>{{ step }}</span>
          </div>
          <div class="step-bar"></div>
          <div class="step-info">
            <span v-if="step >= 4" class="danger-tag">⚠ House Edge</span>
            <span v-if="currentStep >= step && step < 5" class="check">✓</span>
          </div>
        </div>
      </div>

      <!-- Progress -->
      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: Math.min(currentStep / 5, 1) * 100 + '%' }"></div>
        </div>
        <span class="progress-label">{{ Math.min(currentStep, 5) }} / 5</span>
      </div>

      <!-- Result -->
      <div v-if="result" class="banner" :class="result">
        <span v-if="result === 'win'">🏆 Lengkap! +25 Koin!</span>
        <span v-else-if="result === 'trap'">🪤 Tergelincir di trap!</span>
        <span v-else>😔 Jatuh!</span>
      </div>

      <div v-if="playsLeft === 0 && currentStep === 1" class="limit-banner">
        🔒 Batas main hari ini tercapai (5/5). Kembali besok ({{ resetIn }})
      </div>

      <!-- Controls -->
      <div v-if="currentStep <= 5" class="controls">
        <button class="btn up" :disabled="waiting || (currentStep === 1 && playsLeft === 0)" @click="guess(true)">⬆ HIGHER</button>
        <button class="btn down" :disabled="waiting || (currentStep === 1 && playsLeft === 0)" @click="guess(false)">⬇ LOWER</button>
      </div>
      <div v-if="currentStep === 1 && result !== 'win' && playsLeft > 0" class="cost-note">Biaya masuk: 5 🪙 · Sisa {{ playsLeft }}/5 main</div>

      <div class="info-row">
        <div class="info"><span class="info-l">Langkah</span><span class="info-v">{{ Math.min(currentStep, 5) }}</span></div>
        <div class="info"><span class="info-l">Hadiah</span><span class="info-v">25 🪙</span></div>
        <div class="info"><span class="info-l">Trap</span><span class="info-v">Langkah 4-5</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { CasinoEngine, Sound, getPlaysLeft, usePlay, msUntilReset, formatReset } from '../utils/casinoEngine';

const currentStep = ref(1);
const result = ref(null);
const waiting = ref(false);
const playsLeft = ref(getPlaysLeft('ladder'));
const resetIn = ref(formatReset(msUntilReset()));

function guess(isHigher) {
  if (currentStep.value === 1) {
    if (playsLeft.value <= 0) return;
    if (!CasinoEngine.deductCoins(5)) return;
    if (!usePlay('ladder')) return;
    playsLeft.value--;
    resetIn.value = formatReset(msUntilReset());
  }
  waiting.value = true;
  result.value = null;
  Sound.play('click');

  setTimeout(() => {
    const win = CasinoEngine.getCardProbability(currentStep.value);
    if (win) {
      Sound.play('tick');
      currentStep.value++;
      if (currentStep.value > 5) {
        CasinoEngine.addCoins(25);
        result.value = 'win';
        window.__casino?.shake();
      }
    } else {
      if (currentStep.value >= 4) {
        result.value = 'trap';
        Sound.play('lose');
        window.__casino?.shake();
      } else {
        result.value = 'lose';
        Sound.play('lose');
      }
      CasinoEngine.loseGame();
      setTimeout(() => { currentStep.value = 1; result.value = null; }, 1500);
    }
    waiting.value = false;
  }, 400);
}
</script>

<style scoped>
.game-page { max-width: 500px; margin: 0 auto; padding: 20px 16px; }
.back { display: inline-block; color: var(--text-dim); font-size: 0.85rem; margin-bottom: 14px; transition: color 0.2s; }
.back:hover { color: var(--gold); }
.header { text-align: center; margin-bottom: 20px; }
.icon { font-size: 2.8rem; display: block; margin-bottom: 6px; filter: drop-shadow(0 0 10px rgba(52,152,219,0.4)); }
.title { font-size: 1.5rem; font-weight: 800; margin-bottom: 4px; }
.desc { color: var(--text-dim); font-size: 0.85rem; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 24px 20px; text-align: center; }

.ladder { display: flex; flex-direction: column-reverse; gap: 6px; max-width: 260px; margin: 0 auto 20px; }
.step {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 12px;
  background: var(--bg-surface); border: 2px solid var(--border);
  transition: all 0.35s cubic-bezier(.4,0,.2,1);
}
.step.reached { border-color: var(--blue); background: rgba(52,152,219,0.08); }
.step.current { border-color: var(--gold); background: rgba(241,196,15,0.06); box-shadow: 0 0 16px rgba(241,196,15,0.15); animation: glowPulse 2s ease infinite; }
.step.danger { border-color: var(--red); background: rgba(231,76,60,0.08); animation: shake 0.5s ease; }
.step.done { border-color: var(--green); background: rgba(46,204,113,0.08); }

.step-num {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.9rem;
  background: var(--bg-elevated); color: var(--text-dim);
  transition: all 0.3s;
  flex-shrink: 0;
}
.step.reached .step-num { background: var(--blue); color: #fff; }
.step.current .step-num { background: var(--gold); color: #080a10; }
.step.danger .step-num { background: var(--red); color: #fff; }

.trophy { font-size: 1.1rem; }
.step-bar { flex: 1; height: 3px; background: var(--border); border-radius: 2px; }
.step.reached .step-bar { background: var(--blue); }
.step-info { display: flex; align-items: center; gap: 6px; min-width: 80px; justify-content: flex-end; }
.danger-tag { font-size: 0.55rem; color: var(--red); background: rgba(231,76,60,0.1); padding: 2px 6px; border-radius: 6px; }
.check { color: var(--green); font-weight: 700; font-size: 0.9rem; }

.progress-wrap { position: relative; margin-bottom: 14px; }
.progress-bar { height: 8px; background: var(--bg-surface); border-radius: 4px; border: 1px solid var(--border); overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--blue), var(--gold)); border-radius: 4px; transition: width 0.5s cubic-bezier(.4,0,.2,1); }
.progress-label { position: absolute; top: -1px; right: 8px; font-size: 0.7rem; font-weight: 700; color: var(--gold); }

.banner { padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 1rem; margin-bottom: 14px; animation: fadeInUp 0.3s ease; }
.banner.win { background: rgba(241,196,15,0.12); color: var(--gold); border: 1px solid rgba(241,196,15,0.25); }
.banner.trap { background: rgba(231,76,60,0.1); color: var(--red); border: 1px solid rgba(231,76,60,0.2); animation: fadeInUp 0.3s ease, shake 0.5s ease; }
.banner.lose { background: rgba(99,110,114,0.1); color: #636e72; border: 1px solid rgba(99,110,114,0.2); }

.controls { display: flex; gap: 12px; justify-content: center; margin-bottom: 10px; }
.btn { border: none; padding: 12px 28px; border-radius: 12px; font-size: 0.95rem; font-weight: 700; transition: transform 0.15s, box-shadow 0.15s; }
.btn:active:not(:disabled) { transform: scale(0.95); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.up { background: linear-gradient(135deg, #2ecc71, #219a52); color: #fff; box-shadow: 0 4px 16px rgba(46,204,113,0.3); }
.up:hover:not(:disabled) { transform: translateY(-2px); }
.down { background: linear-gradient(135deg, #e74c3c, #c0392b); color: #fff; box-shadow: 0 4px 16px rgba(231,76,60,0.3); }
.down:hover:not(:disabled) { transform: translateY(-2px); }

.cost-note { color: var(--text-dim); font-size: 0.75rem; margin-bottom: 14px; }
.limit-banner {
  padding: 12px 16px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;
  background: rgba(231,76,60,0.1); color: var(--red); border: 1px solid rgba(231,76,60,0.2);
  margin-bottom: 14px; animation: fadeInUp 0.3s ease;
}

.info-row { display: flex; gap: 12px; justify-content: center; }
.info { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; display: flex; flex-direction: column; align-items: center; flex: 1; }
.info-l { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; }
.info-v { font-size: 0.82rem; font-weight: 700; color: var(--gold); }
</style>
