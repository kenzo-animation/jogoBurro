<template>
    <GameLayout>
        <div class="section-heading">
            <p class="kicker">LEITURA DA MESA</p>
            <h2>Estatísticas</h2>
            <p>Resumo calculado a partir das partidas salvas neste aparelho.</p>
        </div>
        <div class="stats-grid">
            <div class="stat"><strong>{{ stats.partidas }}</strong><span>partidas</span></div>
            <div class="stat"><strong>{{ stats.concluidas }}</strong><span>concluídas</span></div>
            <div class="stat"><strong>{{ stats.rodadas }}</strong><span>rodadas</span></div>
            <div class="stat"><strong>{{ stats.jogadores }}</strong><span>jogadores</span></div>
        </div>
        <div class="stat-feature">
            <p class="kicker">MAIS VITÓRIAS</p>
            <h3>{{ stats.vencedorMaisFrequente?.nome || 'Ainda sem vencedor' }}</h3>
            <p>{{ stats.vencedorMaisFrequente?.vitorias || 0 }} vitória(s) registrada(s).</p>
        </div>
    </GameLayout>
</template>
<script setup
    lang="ts">    import { computed } from 'vue'; import GameLayout from '@/components/GameLayout.vue'; import { calcularEstatisticas } from '@/services/database/historico'; const stats = computed(() => calcularEstatisticas());</script>
