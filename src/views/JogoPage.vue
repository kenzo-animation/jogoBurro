<template>
  <GameLayout
    ><div v-if="partida" class="game-view">
      <div class="turn-banner">
        <span>RODADA {{ partida.rodada }}</span
        ><strong>{{ jogadorAtual.nome }} joga agora</strong>
      </div>
      <div class="table-center">
        <p class="kicker">MÃO DE {{ jogadorAtual.nome.toUpperCase() }}</p>
        <div class="cards">
          <button
            v-for="carta in jogadorAtual.mao"
            :key="carta.id"
            class="card"
            @click="passar(carta.id)"
          >
            <small>{{ carta.naipe }}</small
            ><strong>{{ carta.valor }}</strong
            ><span>passar →</span>
          </button>
        </div>
        <p class="hint">
          Escolha uma carta. Ela será trocada pela primeira carta do próximo
          jogador.
        </p>
        <ion-button
          v-if="podeBater"
          expand="block"
          fill="outline"
          @click="bater"
          >Bater com quatro iguais</ion-button
        >
      </div>
      <div class="players-row">
        <div
          v-for="jogador in partida.jogadores"
          :key="jogador.id"
          class="player-chip"
          :class="{ active: jogador.ordem === partida.jogadorAtual }"
        >
          <span>{{ jogador.nome[0] }}</span
          ><strong>{{ jogador.nome }}</strong
          ><small
            >{{ jogador.mao.length }} cartas ·
            {{ "B".repeat(jogador.letrasBurro) || "sem letras" }}</small
          >
        </div>
      </div>
      <ion-button fill="clear" color="danger" @click="encerrar"
        >Sair da partida</ion-button
      >
    </div>
    <p v-else>Crie uma partida para começar.</p></GameLayout
  >
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { IonButton } from "@ionic/vue";
import GameLayout from "@/components/GameLayout.vue";
import { gameStore } from "@/stores/game";
const router = useRouter();
const partida = computed(() => gameStore.estado.partida);
const jogadorAtual = computed(
  () =>
    partida.value?.jogadores[partida.value.jogadorAtual] || {
      id: "",
      nome: "",
      mao: [],
      letrasBurro: 0,
      ordem: 0,
      conectado: true,
    },
);
const podeBater = computed(
  () =>
    jogadorAtual.value.mao.length === 4 &&
    new Set(jogadorAtual.value.mao.map((carta) => carta.valor)).size === 1,
);
function passar(id: string) {
  if (partida.value) gameStore.jogar(jogadorAtual.value.id, id);
}
function bater() {
  if (partida.value) gameStore.completar(jogadorAtual.value.id);
}
function encerrar() {
  gameStore.encerrar("cancelada");
  router.push("/resultado");
}
</script>
