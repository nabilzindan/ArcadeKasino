<template>
  <div class="lobby">
    <div class="lobby-header">
      <h1 class="lobby-title">
        <span class="title-icon">🎰</span>
        <span class="title-text">Pilih Mesin</span>
      </h1>
      <p class="lobby-sub">Masuk ke mesin favoritmu dan menangkan koin!</p>
      <div class="stats-bar">
        <div class="stat"><span class="stat-val" style="color:var(--green)">{{ totalWins }}</span><span class="stat-lbl">Menang</span></div>
        <div class="stat"><span class="stat-val" style="color:var(--red)">{{ totalLosses }}</span><span class="stat-lbl">Kalah</span></div>
        <div class="stat"><span class="stat-val" style="color:var(--gold)">{{ userWallet.toLocaleString() }}</span><span class="stat-lbl">Koin</span></div>
      </div>
    </div>

    <div class="grid">
      <router-link v-for="(m, i) in machines" :key="m.route" :to="m.route" class="card"
        :class="{ locked: playsLeft[m.id] === 0 }"
        :style="{ '--mc': m.color, 'animation-delay': i * 60 + 'ms' }">
        <div class="card-glow"></div>
        <div class="card-icon">{{ playsLeft[m.id] === 0 ? '🔒' : m.icon }}</div>
        <div class="card-info">
          <h3 class="card-name">{{ m.name }}</h3>
          <p class="card-desc">{{ m.desc }}</p>
        </div>
        <div class="card-bottom">
          <span class="card-cost">🪙 {{ m.cost }}</span>
          <span class="card-plays" :class="{ empty: playsLeft[m.id] === 0 }">
            {{ playsLeft[m.id] === 0 ? 'Besok lagi' : `Sisa ${playsLeft[m.id]}` }}
          </span>
          <span class="card-arrow">→</span>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { userWallet, totalWins, totalLosses, getPlaysLeft } from '../utils/casinoEngine';

const machines = [
  { id: 'plinko', name: 'Biased Plinko', desc: 'Jatuhkan bola dengan fisika nyata — menangkan hingga 4 koin!', icon: '🔵', route: '/plinko', cost: 5, color: '#e67e22' },
  { id: 'slot', name: 'Skill-Stop Slot', desc: 'Putar reel dan tekan STOP di waktu tepat untuk Jackpot!', icon: '🎰', route: '/slot', cost: 10, color: '#2ecc71' },
  { id: 'roulette', name: 'Warna Roulette', desc: 'Tebak warna sektor tempat bola berhenti!', icon: '🎯', route: '/roulette', cost: 5, color: '#9b59b6' },
  { id: 'blackjack', name: 'Blackjack 21', desc: 'Kalahkan dealer — hitung kartu sampai 21 tanpa bust!', icon: '♠️', route: '/blackjack', cost: 5, color: '#00d2d3' },
  { id: 'ladder', name: 'High-Low Ladder', desc: 'Naik 5 langkah — langkah 4-5 punya House Edge!', icon: '🃏', route: '/card-ladder', cost: 5, color: '#3498db' },
  { id: 'scratch', name: 'Scratch Card', desc: 'Gosok kartu untuk temukan simbol kemenangan!', icon: '🎫', route: '/scratch', cost: 5, color: '#e74c3c' },
];

const playsLeft = ref({});

onMounted(() => {
  const counts = {};
  for (const m of machines) counts[m.id] = getPlaysLeft(m.id);
  playsLeft.value = counts;
});
</script>

<style scoped>
.lobby { max-width: 700px; margin: 0 auto; padding: 24px 16px; }
.lobby-header { text-align: center; margin-bottom: 28px; }
.lobby-title { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 6px; }
.title-icon { font-size: 2rem; filter: drop-shadow(0 0 8px rgba(241,196,15,0.5)); }
.title-text { font-size: 1.6rem; font-weight: 800; background: linear-gradient(135deg, var(--gold), var(--orange)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.lobby-sub { color: var(--text-dim); font-size: 0.88rem; margin-bottom: 16px; }
.stats-bar { display: flex; justify-content: center; gap: 20px; }
.stat { display: flex; flex-direction: column; align-items: center; }
.stat-val { font-size: 1.1rem; font-weight: 800; }
.stat-lbl { font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }

.card {
  position: relative; overflow: hidden;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 16px; padding: 20px 16px 16px;
  text-decoration: none; color: inherit;
  display: flex; flex-direction: column; gap: 12px;
  transition: transform 0.25s cubic-bezier(.4,0,.2,1), border-color 0.25s, box-shadow 0.25s;
  animation: fadeInUp 0.5s ease both;
}
.card:hover:not(.locked) {
  transform: translateY(-6px) scale(1.02);
  border-color: var(--mc);
  box-shadow: 0 8px 32px color-mix(in srgb, var(--mc) 30%, transparent);
}
.card:active:not(.locked) { transform: translateY(-2px) scale(0.98); }
.card.locked { opacity: 0.55; filter: grayscale(0.4); cursor: not-allowed; }

.card-glow {
  position: absolute; top: -40%; left: -40%; width: 180%; height: 180%;
  background: radial-gradient(circle, color-mix(in srgb, var(--mc) 8%, transparent) 0%, transparent 60%);
  pointer-events: none; transition: opacity 0.3s; opacity: 0;
}
.card:hover .card-glow { opacity: 1; }

.card-icon { font-size: 2.2rem; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--mc) 40%, transparent)); }
.card-info { flex: 1; }
.card-name { font-size: 0.95rem; font-weight: 700; color: var(--text-bright); margin-bottom: 4px; }
.card-desc { font-size: 0.72rem; color: var(--text-dim); line-height: 1.4; }
.card-bottom { display: flex; justify-content: space-between; align-items: center; }
.card-cost {
  font-size: 0.75rem; font-weight: 700; color: var(--gold);
  background: rgba(241,196,15,0.08); padding: 3px 10px; border-radius: 10px;
  border: 1px solid rgba(241,196,15,0.15);
}
.card-plays {
  font-size: 0.68rem; font-weight: 700; color: var(--green);
  background: rgba(46,204,113,0.08); padding: 3px 8px; border-radius: 10px;
  border: 1px solid rgba(46,204,113,0.15);
  margin-left: auto;
}
.card-plays.empty { color: var(--red); background: rgba(231,76,60,0.08); border-color: rgba(231,76,60,0.2); }
.card-arrow { font-size: 1.1rem; color: var(--text-dim); transition: transform 0.2s, color 0.2s; }
.card:hover .card-arrow { transform: translateX(4px); color: var(--mc); }

@media (max-width: 480px) { .grid { grid-template-columns: 1fr 1fr; gap: 10px; } .card { padding: 14px 12px 12px; } .card-icon { font-size: 1.8rem; } .card-desc { display: none; } }
</style>
