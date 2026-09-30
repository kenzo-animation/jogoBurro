<template>
    <GameLayout>
        <div class="section-heading">
            <p class="kicker">COMO JOGAR</p>
            <h2>Regras claras,<br /><em>mesa justa.</em></h2>
        </div>
        <ol class="rules">
            <li><strong>Distribuir</strong><span>Cada pessoa recebe quatro cartas. O baralho usa um valor por jogador e
                    quatro naipes.</span></li>
            <li><strong>Passar</strong><span>Na sua vez, escolha uma carta e passe ao jogador seguinte na ordem
                    circular.</span></li>
            <li><strong>Bater</strong><span>Ao juntar quatro cartas do mesmo valor, você completa o grupo e bate.</span>
            </li>
            <li><strong>BURRO</strong><span>Quem ainda tiver cartas daquele valor recebe uma letra. Ao formar BURRO,
                    está eliminado.</span></li>
        </ol>
    </GameLayout>
</template>
<script setup lang="ts">import GameLayout from '@/components/GameLayout.vue';</script>
