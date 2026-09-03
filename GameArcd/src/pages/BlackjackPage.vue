<template>
  <div class="game-page">
    <router-link to="/" class="back">← Kembali</router-link>
    <div class="header">
      <span class="icon">♠️</span>
      <h1 class="title" style="color:var(--cyan)">Blackjack 21</h1>
      <p class="desc">Kalahkan dealer — makin dekat ke 21 tanpa melewatinya!</p>
    </div>
    <div class="card">
      <!-- Table -->
      <div class="table" :class="tableClass">
        <!-- Table meta -->
        <div class="table-meta">
          <span class="chip-bet">🪙 5</span>
          <span class="deck-info" :class="{ low: deckCount < 10 }">🂠 {{ deckCount }} kartu</span>
        </div>

        <!-- Dealer zone -->
        <div class="zone">
          <div class="zone-label">
            <span class="zone-icon">👤</span>
            <span>Dealer</span>
            <span class="score-chip" :key="'d' + dealerScoreKey"
              :class="{ bust: dealerTotal > 21, blackjack: dealerBJ && revealDealer }">
              {{ dealerTotal }}
            </span>
            <span v-if="dealerSoft && revealDealer" class="soft-tag">soft</span>
          </div>
          <div class="hand">
            <div
              v-for="(c, i) in dealerHand" :key="'d' + i"
              class="pcard" :class="{ flip: i === 1 && !revealDealer }"
              :style="{ animationDelay: c.delay + 'ms' }">
              <div class="pcard-inner">
                <div class="pcard-face pcard-front" :class="isRed(c.suit) ? 'red' : 'dark'">
                  <div class="corner tl"><span class="cr">{{ c.rank }}</span><span class="cs">{{ c.suit }}</span></div>
                  <div class="center-suit">{{ c.suit }}</div>
                  <div class="corner br"><span class="cr">{{ c.rank }}</span><span class="cs">{{ c.suit }}</span></div>
                </div>
                <div class="pcard-face pcard-back">
                  <div class="back-frame"><span class="back-mono">♠</span></div>
                </div>
              </div>
            </div>
            <div v-if="dealerHand.length === 0" class="empty-slot">Kartu dealer</div>
          </div>
        </div>

        <!-- Divider -->
        <div class="divider">
          <span v-if="state === 'dealing'" class="dots-anim">Membagikan<span>.</span><span>.</span><span>.</span></span>
          <span v-else>{{ statusText }}</span>
        </div>

        <!-- Player zone -->
        <div class="zone">
          <div class="zone-label">
            <span class="zone-icon">🧑</span>
            <span>Kamu</span>
            <span class="score-chip" :key="'p' + playerScoreKey"
              :class="{ bust: playerTotal > 21, blackjack: playerBJ }">
              {{ playerTotal }}
            </span>
            <span v-if="playerSoft" class="soft-tag">soft</span>
          </div>
          <div class="hand">
            <div
              v-for="(c, i) in playerHand" :key="'p' + i"
              class="pcard"
              :style="{ animationDelay: c.delay + 'ms' }">
              <div class="pcard-inner">
                <div class="pcard-face pcard-front" :class="isRed(c.suit) ? 'red' : 'dark'">
                  <div class="corner tl"><span class="cr">{{ c.rank }}</span><span class="cs">{{ c.suit }}</span></div>
                  <div class="center-suit">{{ c.suit }}</div>
                  <div class="corner br"><span class="cr">{{ c.rank }}</span><span class="cs">{{ c.suit }}</span></div>
                </div>
                <div class="pcard-face pcard-back">
                  <div class="back-frame"><span class="back-mono">♠</span></div>
                </div>
              </div>
            </div>
            <div v-if="playerHand.length === 0" class="empty-slot">Kartumu</div>
          </div>
        </div>
      </div>

      <!-- Result -->
      <div v-if="resultMsg" class="banner" :class="resultType">
        {{ resultMsg }}
      </div>

      <!-- Controls -->
      <div v-if="playsLeft === 0 && state !== 'dealing' && state !== 'dealer' && state !== 'player'" class="limit-banner">
        🔒 Batas main hari ini tercapai (5/5). Kembali besok ({{ resetIn }})
      </div>

      <div class="controls">
        <template v-if="state === 'player'">
          <button class="btn hit" @click="hit"><span class="btn-ico">🃏</span> HIT</button>
          <button class="btn stand" @click="stand"><span class="btn-ico">✋</span> STAND</button>
        </template>
        <template v-else-if="state === 'dealing' || state === 'dealer'">
          <button class="btn busy" disabled>
            {{ state === 'dealing' ? 'Membagikan kartu...' : 'Dealer bermain...' }}
          </button>
        </template>
        <template v-else>
          <button class="btn deal" :disabled="playsLeft === 0" @click="deal">
            <span class="btn-ico">🔁</span>
            {{ playsLeft === 0 ? 'Batas hari ini 🔒' : 'Main Lagi (5 🪙)' }}
          </button>
        </template>
      </div>
      <p v-if="playsLeft > 0 && state === 'result'" class="plays-note">Sisa {{ playsLeft }}/5 main hari ini</p>

      <div class="info-row">
        <div class="info"><span class="info-l">Taruhan</span><span class="info-v">5 🪙</span></div>
        <div class="info"><span class="info-l">Blackjack</span><span class="info-v">+8 🪙</span></div>
        <div class="info"><span class="info-l">Menang</span><span class="info-v">+5 🪙</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { CasinoEngine, Sound, getPlaysLeft, usePlay, msUntilReset, formatReset } from '../utils/casinoEngine';

const playsLeft = ref(getPlaysLeft('blackjack'));
const resetIn = ref(formatReset(msUntilReset()));

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const state = ref('result'); // 'dealing' | 'player' | 'dealer' | 'result'
const playerHand = ref([]);
const dealerHand = ref([]);
const deck = ref([]);
const revealDealer = ref(false);
const resultMsg = ref(null);
const resultType = ref('lose');
const playerScoreKey = ref(0);
const dealerScoreKey = ref(0);

let delayCounter = 0;
let timers = [];

function valueOf(rank) {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function handTotal(hand) {
  let total = hand.reduce((s, c) => s + valueOf(c.rank), 0);
  let aces = hand.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

// True when at least one ace is counted as 11 in the displayed total
function isSoft(hand) {
  const soft = handTotal(hand);
  const aces = hand.filter(c => c.rank === 'A').length;
  const hard = hand.reduce((s, c) => s + valueOf(c.rank), 0) - aces * 10;
  return soft !== hard && soft <= 21;
}

const isBJ = (hand) => hand.length === 2 && handTotal(hand) === 21;
const isRed = (suit) => suit === '♥' || suit === '♦';

const playerTotal = computed(() => handTotal(playerHand.value));
const dealerTotal = computed(() => handTotal(dealerHand.value));
const playerSoft = computed(() => isSoft(playerHand.value));
const dealerSoft = computed(() => isSoft(dealerHand.value));
const playerBJ = computed(() => isBJ(playerHand.value));
const dealerBJ = computed(() => isBJ(dealerHand.value));
const deckCount = computed(() => deck.value.length);

watch(playerTotal, () => playerScoreKey.value++);
watch(dealerTotal, () => dealerScoreKey.value++);

const statusText = computed(() => {
  if (state.value === 'player') return 'Giliranmu';
  if (state.value === 'dealer') return 'Dealer bermain...';
  if (state.value === 'result') {
    if (resultType.value === 'win') return 'Kamu menang!';
    if (resultType.value === 'jackpot') return 'Blackjack!';
    if (resultType.value === 'push') return 'Seri';
    return 'Dealer menang';
  }
  return '';
});

const tableClass = computed(() => (state.value === 'result' ? resultType.value : ''));

function buildDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
  // Fisher-Yates
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function pushCard(hand, delay) {
  // Reshuffle when the shoe runs low
  if (deck.value.length < 10) deck.value = buildDeck();
  const card = deck.value.pop();
  card.delay = delay;
  hand.value.push(card);
}

function after(ms, fn) {
  timers.push(setTimeout(fn, ms));
}

function deal() {
  if (playsLeft.value <= 0) return;
  if (!CasinoEngine.deductCoins(5)) return;
  if (!usePlay('blackjack')) return;
  playsLeft.value--;
  resetIn.value = formatReset(msUntilReset());
  // reset round
  timers.forEach(clearTimeout);
  timers = [];
  playerHand.value = [];
  dealerHand.value = [];
  revealDealer.value = false;
  resultMsg.value = null;
  state.value = 'dealing'; // lock buttons while dealing

  deck.value = buildDeck();
  delayCounter = 0;

  Sound.play('click');
  // p1, d1, p2, d2 (d1 = hole card, revealed later)
  after(0, () => pushCard(playerHand, 0));
  after(220, () => pushCard(dealerHand, 220));
  after(440, () => pushCard(playerHand, 440));
  after(660, () => {
    pushCard(dealerHand, 660);
    state.value = 'player';
    Sound.play('win');
    checkNatural();
  });
}

function checkNatural() {
  const p = handTotal(playerHand.value);
  const d = handTotal(dealerHand.value);
  if (p === 21 || d === 21) finish();
}

function hit() {
  if (state.value !== 'player') return;
  Sound.play('click');
  delayCounter += 120;
  pushCard(playerHand, 400);
  if (handTotal(playerHand.value) > 21) {
    after(500, () => {
      revealDealer.value = true;
      state.value = 'result';
      endGame('bust');
    });
  }
}

function stand() {
  if (state.value !== 'player') return;
  Sound.play('click');
  state.value = 'dealer';
  revealDealer.value = true;
  Sound.play('reveal');
  dealerTurn();
}

function dealerTurn() {
  after(900, () => {
    const t = handTotal(dealerHand.value);
    if (t < 17) {
      pushCard(dealerHand, 300);
      Sound.play('click');
      dealerTurn();
    } else {
      finish();
    }
  });
}

function finish() {
  revealDealer.value = true;
  state.value = 'result';
  endGame('compare');
}

function endGame(reason) {
  const p = handTotal(playerHand.value);
  const d = handTotal(dealerHand.value);
  const pBJ = playerBJ.value;
  const dBJ = dealerBJ.value;

  if (reason === 'bust' || (p < d && d <= 21) || (dBJ && !pBJ)) {
    // lose
    CasinoEngine.loseGame();
    Sound.play('lose');
    resultMsg.value = p > 21 ? '💥 BUST! Kamu melewati 21' : `Dealer menang ${d} - ${p}`;
    resultType.value = 'lose';
  } else if (p === d && p <= 21) {
    // push — refund bet
    CasinoEngine.addCoins(5);
    resultMsg.value = `Seri ${p} - ${d} — taruhan kembali!`;
    resultType.value = 'push';
  } else {
    // win
    if (pBJ && !dBJ) {
      CasinoEngine.addCoins(8); // 3:2 of 5 ≈ +8
      resultMsg.value = '♠️ BLACKJACK! +8 Koin!';
      resultType.value = 'jackpot';
      window.__casino?.shake();
    } else {
      CasinoEngine.addCoins(5); // 2:1
      resultMsg.value = `🎉 Kamu menang ${p} - ${d}! +5 Koin!`;
      resultType.value = 'win';
    }
  }
}

onUnmounted(() => timers.forEach(clearTimeout));
</script>

<style scoped>
.game-page { max-width: 500px; margin: 0 auto; padding: 20px 16px; }
.back { display: inline-block; color: var(--text-dim); font-size: 0.85rem; margin-bottom: 14px; transition: color 0.2s; }
.back:hover { color: var(--gold); }
.header { text-align: center; margin-bottom: 20px; }
.icon { font-size: 2.8rem; display: block; margin-bottom: 6px; filter: drop-shadow(0 0 10px rgba(0,210,211,0.4)); }
.title { font-size: 1.5rem; font-weight: 800; margin-bottom: 4px; }
.desc { color: var(--text-dim); font-size: 0.85rem; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 24px 20px; text-align: center; }

/* ── Table ── */
.table {
  position: relative;
  background:
    radial-gradient(ellipse at 50% 18%, rgba(46,204,113,0.14) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 30%, #125c44 0%, #0a3327 65%, #07231b 100%);
  border: 2px solid #b8960b55;
  border-radius: 22px;
  padding: 14px 12px 12px;
  margin-bottom: 16px;
  box-shadow: inset 0 0 50px rgba(0,0,0,0.5), 0 6px 24px rgba(0,0,0,0.35);
  transition: box-shadow 0.5s ease;
}
.table.win { box-shadow: inset 0 0 50px rgba(0,0,0,0.5), 0 0 34px rgba(46,204,113,0.28); }
.table.lose { box-shadow: inset 0 0 50px rgba(0,0,0,0.5), 0 0 34px rgba(231,76,60,0.22); }
.table.push { box-shadow: inset 0 0 50px rgba(0,0,0,0.5), 0 0 34px rgba(52,152,219,0.22); }

.table-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 0 4px; }
.chip-bet {
  background: radial-gradient(circle at 35% 30%, #f5d76e, #b8960b 75%);
  color: #5c4700; font-weight: 800; font-size: 0.72rem;
  border-radius: 999px; padding: 5px 14px;
  border: 1px dashed #8a6d00;
  box-shadow: 0 2px 8px rgba(0,0,0,0.45);
}
.deck-info {
  color: #9fb8c9; font-size: 0.68rem;
  background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 999px;
  border: 1px solid #ffffff14;
}
.deck-info.low { color: var(--red); border-color: rgba(231,76,60,0.4); }

.zone {
  padding: 10px 8px;
  border-radius: 14px;
  background: rgba(0,0,0,0.18);
  border: 1px solid #ffffff0d;
}
.zone-label {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-bottom: 8px;
  color: #bfe8d6; font-size: 0.7rem; font-weight: 700;
  letter-spacing: 1px; text-transform: uppercase;
}
.zone-icon { font-size: 0.95rem; }
.soft-tag {
  font-size: 0.52rem; font-weight: 700; color: var(--cyan);
  background: rgba(0,210,211,0.12); padding: 2px 6px; border-radius: 8px;
}

/* Score chip */
.score-chip {
  min-width: 30px; height: 30px; padding: 0 7px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, #2b3140, #14181f);
  border: 2px solid #3a4154;
  color: var(--text-bright);
  font-weight: 800; font-size: 0.85rem;
  display: inline-flex; align-items: center; justify-content: center;
  animation: chipPop 0.35s cubic-bezier(.34,1.56,.64,1);
}
.score-chip.bust { border-color: var(--red); color: var(--red); box-shadow: 0 0 12px rgba(231,76,60,0.45); }
.score-chip.blackjack { border-color: var(--gold); color: var(--gold); box-shadow: 0 0 12px rgba(241,196,15,0.5); }

@keyframes chipPop {
  from { transform: scale(1.45); }
  to { transform: scale(1); }
}

.hand {
  display: flex; justify-content: center; align-items: center;
  flex-wrap: wrap; gap: 7px; min-height: 92px;
}
.empty-slot {
  color: #ffffff30; font-size: 0.72rem; font-style: italic;
  border: 1px dashed #ffffff1f; border-radius: 10px; padding: 8px 16px;
}

.divider {
  display: flex; align-items: center; gap: 10px;
  margin: 10px 0;
  color: var(--gold); font-size: 0.7rem; font-weight: 800;
  letter-spacing: 2px; text-transform: uppercase;
}
.divider::before, .divider::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, #f1c40f66, transparent);
}
.dots-anim span { animation: dotBlink 1s ease infinite; }
.dots-anim span:nth-child(2) { animation-delay: 0.2s; }
.dots-anim span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotBlink { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }

/* ── Playing cards (pcard — distinct from the .card container) ── */
.pcard {
  width: 58px; height: 86px;
  perspective: 400px;
  animation: dealIn 0.4s cubic-bezier(.34,1.56,.64,1) both;
  flex-shrink: 0;
}
.pcard-inner {
  position: relative; width: 100%; height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.45s cubic-bezier(.4,.2,.2,1);
}
.pcard.flip .pcard-inner { transform: rotateY(180deg); }
.pcard-face {
  position: absolute; inset: 0;
  border-radius: 7px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.pcard-front {
  background: linear-gradient(150deg, #ffffff 0%, #eef1f5 55%, #dfe4ea 100%);
  border: 1px solid #c9cfd8;
  box-shadow: 0 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 #ffffffcc;
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 4px 5px;
}
.pcard-front.red { color: #d92b3a; }
.pcard-front.dark { color: #1c2333; }
.corner { display: flex; flex-direction: column; align-items: center; line-height: 1; }
.corner .cr { font-size: 0.95rem; font-weight: 800; }
.corner .cs { font-size: 0.72rem; }
.corner.br { transform: rotate(180deg); align-self: flex-end; }
.corner.tl { align-self: flex-start; }
.center-suit {
  font-size: 1.75rem; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  text-shadow: 0 1px 0 rgba(255,255,255,0.6);
}
.pcard-back {
  background:
    repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 6px),
    repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 6px),
    linear-gradient(150deg, #16324f 0%, #0e2238 60%, #0a1a2c 100%);
  border: 1px solid #1f4a75;
  transform: rotateY(180deg);
  display: flex; align-items: center; justify-content: center;
}
.back-frame {
  border: 2px solid #f1c40f;
  border-radius: 5px;
  width: calc(100% - 12px); height: calc(100% - 12px);
  display: flex; align-items: center; justify-content: center;
}
.back-mono { color: #f1c40f; font-size: 1.25rem; text-shadow: 0 0 8px rgba(241,196,15,0.5); }

@keyframes dealIn {
  from { opacity: 0; transform: translateY(-130px) rotate(-14deg) scale(0.8); }
  to { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
}

/* ── Result / Controls ── */
.banner {
  padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 0.95rem;
  margin-bottom: 14px; animation: fadeInUp 0.3s ease;
}
.banner.win { background: rgba(46,204,113,0.12); color: var(--green); border: 1px solid rgba(46,204,113,0.25); }
.banner.jackpot { background: rgba(241,196,15,0.12); color: var(--gold); border: 1px solid rgba(241,196,15,0.3); animation: fadeInUp 0.3s ease, glowPulse 1s ease infinite; }
.banner.push { background: rgba(52,152,219,0.1); color: var(--blue); border: 1px solid rgba(52,152,219,0.25); }
.banner.lose { background: rgba(231,76,60,0.1); color: var(--red); border: 1px solid rgba(231,76,60,0.2); }

.controls { display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; }
.btn {
  border: none; padding: 13px 24px; border-radius: 14px;
  font-size: 0.95rem; font-weight: 700; color: #fff;
  display: inline-flex; align-items: center; gap: 6px;
  transition: transform 0.15s, box-shadow 0.15s;
}
.btn-ico { font-size: 1.05rem; }
.btn:active:not(:disabled) { transform: scale(0.95); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.hit { background: linear-gradient(135deg, #27ae60, #1e8a4c); box-shadow: 0 4px 16px rgba(46,204,113,0.3); }
.hit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(46,204,113,0.5); }
.stand { background: linear-gradient(135deg, #e8b33b, #b8860b); box-shadow: 0 4px 16px rgba(232,179,59,0.3); }
.stand:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(232,179,59,0.5); }
.deal { background: linear-gradient(135deg, #00d2d3, #0aa2a3); box-shadow: 0 4px 16px rgba(0,210,211,0.3); }
.deal:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,210,211,0.5); }
.busy { background: var(--bg-elevated); color: var(--text-dim); border: 1px solid var(--border); }
.limit-banner {
  padding: 12px 16px; border-radius: 12px; font-weight: 700; font-size: 0.85rem;
  background: rgba(231,76,60,0.1); color: var(--red); border: 1px solid rgba(231,76,60,0.2);
  margin-bottom: 14px; animation: fadeInUp 0.3s ease;
}
.plays-note { color: var(--text-dim); font-size: 0.72rem; margin-bottom: 12px; }

.info-row { display: flex; gap: 12px; justify-content: center; }
.info { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; display: flex; flex-direction: column; align-items: center; flex: 1; }
.info-l { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px; }
.info-v { font-size: 0.82rem; font-weight: 700; color: var(--gold); }
</style>