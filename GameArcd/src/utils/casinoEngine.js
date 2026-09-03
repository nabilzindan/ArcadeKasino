import { ref } from 'vue';

// ══════════════════════════════════════════════
// WALLET (small & bitter)
// ══════════════════════════════════════════════
export const userWallet = ref(100);
export const totalWins = ref(0);
export const totalLosses = ref(0);

// ══════════════════════════════════════════════
// DAILY LIMITS — anti-addiction caps
// ══════════════════════════════════════════════
export const DAILY_LIMITS = {
  plinko: 5,
  slot: 5,
  roulette: 5,
  blackjack: 5,
  ladder: 5,
  scratch: 5,
};

export const TOPUP_LIMIT = 3;
export const TOPUP_AMOUNT = 25;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadDaily() {
  try {
    const raw = localStorage.getItem('arcade_daily');
    const data = raw ? JSON.parse(raw) : null;
    if (data && data.date === todayKey()) return data;
  } catch {}
  return { date: todayKey(), plays: {}, topups: 0 };
}

let daily = loadDaily();

function saveDaily() {
  try {
    localStorage.setItem('arcade_daily', JSON.stringify(daily));
  } catch {}
}

function ensureDaily() {
  if (daily.date !== todayKey()) {
    daily = loadDaily();
  }
}

// How many plays remain today for a machine
export function getPlaysLeft(machineId) {
  ensureDaily();
  const limit = DAILY_LIMITS[machineId] ?? 0;
  return Math.max(0, limit - (daily.plays[machineId] || 0));
}

// Consume one play. Returns false when the daily cap is reached.
export function usePlay(machineId) {
  ensureDaily();
  if (getPlaysLeft(machineId) <= 0) return false;
  daily.plays[machineId] = (daily.plays[machineId] || 0) + 1;
  saveDaily();
  return true;
}

// Free top-ups remaining today
export function getTopUpsLeft() {
  ensureDaily();
  return Math.max(0, TOPUP_LIMIT - (daily.topups || 0));
}

export function useTopUp() {
  ensureDaily();
  if (getTopUpsLeft() <= 0) return false;
  daily.topups = (daily.topups || 0) + 1;
  saveDaily();
  return true;
}

// Milliseconds until the daily cap resets (midnight)
export function msUntilReset() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return next - now;
}

export function formatReset(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}j ${m}m`;
}

function persist() {
  try {
    localStorage.setItem('arcade_wallet', String(userWallet.value));
    localStorage.setItem('arcade_wins', String(totalWins.value));
    localStorage.setItem('arcade_losses', String(totalLosses.value));
  } catch {}
}

// Load saved state
try {
  const saved = localStorage.getItem('arcade_wallet');
  if (saved !== null) userWallet.value = Number(saved);
  const w = localStorage.getItem('arcade_wins');
  if (w !== null) totalWins.value = Number(w);
  const l = localStorage.getItem('arcade_losses');
  if (l !== null) totalLosses.value = Number(l);
} catch {}

export const CasinoEngine = {
  deductCoins(amount) {
    if (userWallet.value >= amount) {
      userWallet.value -= amount;
      persist();
      Sound.play('coin');
      return true;
    }
    Sound.play('error');
    return false;
  },

  addCoins(amount) {
    userWallet.value += amount;
    totalWins.value++;
    persist();
    if (amount >= 100) Sound.play('jackpot');
    else Sound.play('win');
  },

  loseGame() {
    totalLosses.value++;
    persist();
  },

  addFreeCoins(amount = TOPUP_AMOUNT) {
    userWallet.value += amount;
    persist();
    Sound.play('coin');
  },

  // ── RNG with house edge ──
  getPlinkoBounce() {
    return Math.random() < 0.6;
  },

  getSlotResult() {
    const rand = Math.random();
    if (rand < 0.05) return { type: 'JACKPOT', multiplier: 10 };
    if (rand < 0.15) return { type: 'BONUS', multiplier: 3 };
    if (rand < 0.40) return { type: 'NEAR_MISS', multiplier: 0 };
    return { type: 'LOSE', multiplier: 0 };
  },

  getCardProbability(step) {
    // Bitter: house edge kicks in early and bites harder up top
    const houseEdge = step > 3 ? 0.15 : step > 1 ? 0.04 : 0.0;
    return Math.random() < (0.5 - houseEdge);
  },

  getRouletteResult() {
    const num = Math.floor(Math.random() * 36) + 1;
    const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num);
    const isGreen = num === 0;
    return { number: num, color: isGreen ? 'green' : isRed ? 'red' : 'black' };
  },
};

// ══════════════════════════════════════════════
// SOUND ENGINE (Web Audio API synthesis)
// ══════════════════════════════════════════════
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export const Sound = {
  _enabled: true,

  play(name) {
    if (!this._enabled) return;
    try {
      const ctx = getCtx();
      switch (name) {
        case 'coin': this._playCoin(ctx); break;
        case 'win': this._playWin(ctx); break;
        case 'jackpot': this._playJackpot(ctx); break;
        case 'lose': this._playLose(ctx); break;
        case 'click': this._playClick(ctx); break;
        case 'error': this._playError(ctx); break;
        case 'spin': this._playSpin(ctx); break;
        case 'tick': this._playTick(ctx); break;
        case 'reveal': this._playReveal(ctx); break;
        case 'scratch': this._playScratch(ctx); break;
        case 'drop': this._playDrop(ctx); break;
        case 'bounce': this._playBounce(ctx); break;
      }
    } catch {}
  },

  _playCoin(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  },

  _playWin(ctx) {
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.25);
    });
  },

  _playJackpot(ctx) {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });
  },

  _playLose(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  },

  _playClick(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  },

  _playError(ctx) {
    [200, 150].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.15);
    });
  },

  _playSpin(ctx) {
    for (let i = 0; i < 10; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 400 + Math.random() * 200;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + i * 0.05 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + i * 0.05 + 0.06);
    }
  },

  _playTick(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.02);
  },

  _playReveal(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  },

  _playScratch(ctx) {
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    source.connect(gain).connect(ctx.destination);
    source.start(ctx.currentTime);
  },

  _playDrop(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  },

  _playBounce(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800 + Math.random() * 400;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
  },

  toggle() {
    this._enabled = !this._enabled;
    return this._enabled;
  },
};
