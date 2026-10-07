import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/inicio' },
  { path: '/inicio', component: () => import('@/views/InicioPage.vue') },
  { path: '/nova-partida', component: () => import('@/views/NovaPartidaPage.vue') },
  { path: '/sala', component: () => import('@/views/SalaPage.vue') },
  { path: '/jogo', component: () => import('@/views/JogoPage.vue') },
  { path: '/resultado', component: () => import('@/views/ResultadoPage.vue') },
  { path: '/historico', component: () => import('@/views/HistoricoPage.vue') },
  { path: '/estatisticas', component: () => import('@/views/EstatisticasPage.vue') },
  { path: '/detalhes/:id', component: () => import('@/views/DetalhesPage.vue') },
  { path: '/regras', component: () => import('@/views/RegrasPage.vue') },
  { path: '/configuracoes', component: () => import('@/views/ConfiguracoesPage.vue') },
  { path: '/bluetooth', redirect: { path: '/sala', query: { modo: 'cliente' } } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
