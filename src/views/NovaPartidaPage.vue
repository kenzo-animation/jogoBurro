<template>
    <GameLayout>
        <div class="section-heading">
            <p class="kicker">NOVA PARTIDA · ANFITRIÃO</p>
            <h2>Abra sua sala</h2>
            <p>Os outros jogadores entram pelo Bluetooth e informam seus nomes.</p>
        </div>
        <ion-item class="name-input">
            <ion-input
                v-model="nome"
                label="Seu nome"
                label-placement="stacked"
                placeholder="Ex.: Ana"
                :maxlength="18"
            />
        </ion-item>
        <ion-button expand="block" size="large" :disabled="!nome.trim()" @click="criar">
            Abrir sala <ion-icon slot="end" :icon="peopleOutline" />
        </ion-button>
        <ion-note>Até quatro jogadores podem participar.</ion-note>
    </GameLayout>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonButton, IonIcon, IonInput, IonItem, IonNote } from '@ionic/vue';
import { peopleOutline } from 'ionicons/icons';
import GameLayout from '@/components/GameLayout.vue';
import { gameStore } from '@/stores/game';

const router = useRouter();
const nome = ref('');

function criar() {
    gameStore.criarSala(nome.value);
    router.push('/sala');
}
</script>
