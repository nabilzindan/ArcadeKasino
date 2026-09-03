import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'CasinoFloor',
    component: () => import('../pages/CasinoFloorPage.vue'),
  },
  {
    path: '/plinko',
    name: 'Plinko',
    component: () => import('../pages/PlinkoPage.vue'),
  },
  {
    path: '/slot',
    name: 'Slot',
    component: () => import('../pages/SlotPage.vue'),
  },
  {
    path: '/roulette',
    name: 'Roulette',
    component: () => import('../pages/RoulettePage.vue'),
  },
  {
    path: '/blackjack',
    name: 'Blackjack',
    component: () => import('../pages/BlackjackPage.vue'),
  },
  {
    path: '/card-ladder',
    name: 'CardLadder',
    component: () => import('../pages/CardLadderPage.vue'),
  },
  {
    path: '/scratch',
    name: 'ScratchCard',
    component: () => import('../pages/ScratchCardPage.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
