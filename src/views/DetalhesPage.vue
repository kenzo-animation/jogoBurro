<template>
    <GameLayout>
        <div class="section-heading">
            <p class="kicker">HISTÓRICO · DETALHES</p>
            <h2>Participantes</h2>
        </div><ion-list v-if="registro"><ion-item v-for="participante in registro.participantes"
                :key="participante.nome"><ion-label><strong>{{ participante.nome }}</strong>
                    <p>{{ participante.resultado }}</p>
                </ion-label></ion-item></ion-list>
        <p v-else>Registro não encontrado.</p>
    </GameLayout>
</template>
<script setup
    lang="ts">    import { computed } from 'vue'; import { useRoute } from 'vue-router'; import { IonItem, IonLabel, IonList } from '@ionic/vue'; import GameLayout from '@/components/GameLayout.vue'; import { historicoService } from '@/services/database/historico'; const route = useRoute(); const registro = computed(() => historicoService.buscar(String(route.params.id)));</script>
