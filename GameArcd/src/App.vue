<template>
  <div id="app-container" :class="{ 'screen-shake': shaking }">
    <!-- Header -->
    <header class="hud">
      <router-link to="/" class="hud-left">
        <span class="hud-logo">🎰</span>
        <span class="hud-title">Arcade<br/>Casino 2D</span>
      </router-link>

      <div class="hud-center">
        <transition name="toast">
          <div v-if="toast" :key="toastKey" class="toast" :class="toast.type">
            {{ toast.text }}
          </div>
        </transition>
      </div>

      <div class="hud-right">
        <div class="wallet-pill">
          <span class="wallet-coin">🪙</span>
          <span class="wallet-amount" :key="walletKey">{{ userWallet.toLocaleString() }}</span>
        </div>
        <button class="topup-btn" :class="{ locked: topUpsLeft === 0 }" :disabled="topUpsLeft === 0" @click="topUp" :title="topUpsLeft === 0 ? 'Batas isi ulang hari ini habis' : ''">
          <span class="topup-plus">{{ topUpsLeft === 0 ? '🔒' : '+' }}</span>
          <span class="topup-num">25</span>
        </button>
      </div>
    </header>

    <!-- Main -->
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <transition :name="route.meta.transition || 'page'" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </main>

    <!-- Bottom Nav -->
    <nav class="bottom-bar">
      <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="bar-item" :class="{ active: $route.path === item.to }">
        <span class="bar-icon">{{ item.icon }}</span>
        <span class="bar-label">{{ item.label }}</span>
        <span v-if="$route.path === item.to" class="bar-dot"></span>
      </router-link>
    </nav>

    <!-- Sound toggle -->
    <button class="sound-toggle" @click="toggleSound" :title="soundOn ? 'Mute' : 'Unmute'">
      {{ soundOn ? '🔊' : '🔇' }}
    </button>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { userWallet, CasinoEngine, Sound, getTopUpsLeft, useTopUp } from './utils/casinoEngine';

const shaking = ref(false);
const walletKey = ref(0);
const toast = ref(null);
const toastKey = ref(0);
const soundOn = ref(true);
const topUpsLeft = ref(getTopUpsLeft());

const navItems = [
  { to: '/', icon: '🏠', label: 'Lobi' },
  { to: '/plinko', icon: '🔵', label: 'Plinko' },
  { to: '/slot', icon: '🎰', label: 'Slot' },
  { to: '/roulette', icon: '🎯', label: 'Roulette' },
  { to: '/blackjack', icon: '♠️', label: 'Blackjack' },
  { to: '/card-ladder', icon: '🃏', label: 'Ladder' },
  { to: '/scratch', icon: '🎫', label: 'Scratch' },
];

// Listen for global events
window.__casino = {
  toast(text, type = 'info') {
    toast.value = null;
    setTimeout(() => {
      toast.value = { text, type };
      toastKey.value++;
      setTimeout(() => (toast.value = null), 2500);
    }, 50);
  },
  shake() {
    shaking.value = true;
    setTimeout(() => (shaking.value = false), 400);
  },
  sound: Sound,
};

// Wallet animation
watch(userWallet, (n, o) => {
  walletKey.value++;
  if (n > o) {
    window.__casino?.toast(`+${(n - o).toLocaleString()} Koin`, 'win');
  }
});

function topUp() {
  if (topUpsLeft.value <= 0) {
    window.__casino?.toast('Batas isi ulang hari ini habis 🔒', 'lose');
    Sound.play('error');
    return;
  }
  if (!useTopUp()) return;
  topUpsLeft.value--;
  CasinoEngine.addFreeCoins();
  window.__casino?.toast(`+25 Koin Gratis (sisa ${topUpsLeft.value})`, 'topup');
}

function toggleSound() {
  soundOn.value = Sound.toggle();
}
</script>

<style scoped>
#app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  transition: transform 0.1s;
}
#app-container.screen-shake { animation: shake 0.4s ease; }

/* ── HUD ── */
.hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: linear-gradient(180deg, #0f1219 0%, #0c0e14 100%);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 200;
  gap: 12px;
}

.hud-left {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  flex-shrink: 0;
}

.hud-logo {
  font-size: 1.5rem;
  filter: drop-shadow(0 0 6px rgba(241,196,15,0.4));
}

.hud-title {
  font-size: 0.65rem;
  font-weight: 800;
  line-height: 1.1;
  background: linear-gradient(135deg, var(--gold), var(--orange));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.5px;
}

.hud-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-height: 32px;
}

.toast {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  animation: toastIn 0.3s ease;
}
.toast.win { background: rgba(46,204,113,0.15); color: var(--green); border: 1px solid rgba(46,204,113,0.3); }
.toast.lose { background: rgba(231,76,60,0.15); color: var(--red); border: 1px solid rgba(231,76,60,0.3); }
.toast.info { background: rgba(52,152,219,0.15); color: var(--blue); border: 1px solid rgba(52,152,219,0.3); }
.toast.topup { background: rgba(241,196,15,0.15); color: var(--gold); border: 1px solid rgba(241,196,15,0.3); }
.toast.jackpot { background: rgba(241,196,15,0.2); color: var(--gold); border: 1px solid rgba(241,196,15,0.5); animation: toastIn 0.3s ease, neonPulse 1s ease infinite; }

@keyframes toastIn {
  from { opacity: 0; transform: translateY(-10px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.toast-enter-active { animation: toastIn 0.3s ease; }
.toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-leave-to { opacity: 0; transform: translateY(-10px); }

.hud-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.wallet-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(241,196,15,0.08);
  border: 1px solid rgba(241,196,15,0.2);
  border-radius: 20px;
  padding: 5px 12px;
}

.wallet-coin { font-size: 0.9rem; }

.wallet-amount {
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--gold);
  animation: fadeInUp 0.3s ease;
}

.topup-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  background: linear-gradient(135deg, var(--green), #219a52);
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.75rem;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 8px rgba(46,204,113,0.3);
}
.topup-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 4px 16px rgba(46,204,113,0.5); }
.topup-btn:active:not(:disabled) { transform: scale(0.95); }
.topup-btn:disabled { opacity: 0.45; cursor: not-allowed; filter: grayscale(0.6); }
.topup-plus { font-size: 0.9rem; }

/* ── Main ── */
.main-content { flex: 1; padding-bottom: 72px; }

/* ── Page Transitions ── */
.page-enter-active { animation: fadeInUp 0.3s ease; }
.page-leave-active { transition: opacity 0.15s, transform 0.15s; }
.page-leave-to { opacity: 0; transform: translateY(-8px); }

/* ── Bottom Bar ── */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: linear-gradient(180deg, rgba(15,18,25,0.95) 0%, rgba(8,10,16,0.98) 100%);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
  padding: 6px 0 max(8px, env(safe-area-inset-bottom));
  z-index: 200;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 6px;
  border-radius: 10px;
  text-decoration: none;
  color: var(--text-dim);
  transition: color 0.2s;
  position: relative;
  min-width: 42px;
}
.bar-item.active { color: var(--gold); }
.bar-item:hover { color: var(--text); }

.bar-icon { font-size: 1.15rem; }
.bar-label { font-size: 0.55rem; font-weight: 600; letter-spacing: 0.2px; }

.bar-dot {
  position: absolute;
  top: 2px;
  right: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--gold);
  animation: pulse 2s ease infinite;
}

.sound-toggle {
  position: fixed;
  bottom: 76px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  transition: transform 0.15s;
}
.sound-toggle:hover { transform: scale(1.1); }

/* ── Responsive ── */
@media (max-width: 480px) {
  .hud { padding: 8px 12px; }
  .hud-title { display: none; }
  .wallet-pill { padding: 4px 8px; }
}
</style>
