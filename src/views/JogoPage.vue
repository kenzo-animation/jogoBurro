<template>
  <GameLayout
    ><div v-if="partida" class="game-view">
      <div class="turn-banner">
        <span>RODADA {{ partida.rodada }}</span
        ><strong>{{ jogadorAtual.nome }} joga agora</strong>
      </div>
      <div class="table-center">
        <ion-note v-if="erroAcao" color="danger">{{ erroAcao }}</ion-note>
        <p class="kicker">SUA MÃO · {{ jogadorLocal.nome.toUpperCase() }}</p>
        <div class="cards">
          <button
            v-for="carta in jogadorLocal.mao"
            :key="carta.id"
            class="card"
            :disabled="!minhaVez"
            @click="passar(carta.id)"
          >
            <small>{{ carta.naipe }}</small
            ><strong>{{ carta.valor }}</strong
            ><span>passar →</span>
          </button>
        </div>
        <p class="hint">
          {{ minhaVez
            ? 'Escolha uma carta para trocar com o próximo jogador.'
            : `Aguarde sua vez. ${jogadorAtual.nome} está jogando.` }}
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
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonButton, IonNote } from '@ionic/vue';
import GameLayout from '@/components/GameLayout.vue';
import { gameStore } from '@/stores/game';
import { clienteAtivoAtual } from '@/services/bluetooth/jogoBluetoothClient';
import { hostBluetoothAtual } from '@/services/bluetooth/jogoBluetooth';

const router = useRouter();
const partida = computed(() => gameStore.estado.partida);
const erroAcao = ref('');
const jogadorAtual = computed(
  () => partida.value?.jogadores[partida.value?.jogadorAtual] || {
    id: '',
    nome: '',
    mao: [],
    letrasBurro: 0,
    ordem: 0,
    conectado: true,
  },
);
const idJogadorLocal = computed(() => gameStore.estado.jogadorLocalId || hostBluetoothAtual()?.hostId);
const jogadorLocal = computed(
  () => partida.value?.jogadores.find((jogador) => jogador.id === idJogadorLocal.value) || {
    id: '',
    nome: gameStore.estado.nomeLocal,
    mao: [],
    letrasBurro: 0,
    ordem: 0,
    conectado: true,
  },
);
const minhaVez = computed(() => !!idJogadorLocal.value && jogadorAtual.value.id === idJogadorLocal.value);
const podeBater = computed(
  () => minhaVez.value
    && jogadorLocal.value.mao.length === 4
    && new Set(jogadorLocal.value.mao.map((carta) => carta.valor)).size === 1,
);

async function passar(id: string) {
  if (!partida.value) return;
  const anfitriao = hostBluetoothAtual();
  const cliente = clienteAtivoAtual();
  const hostJogando = anfitriao && jogadorAtual.value.id === anfitriao.hostId;
  const clienteJogando = cliente && minhaVez.value;
  if (!hostJogando && !clienteJogando) return;
  erroAcao.value = '';
  try {
    if (hostJogando) {
      await anfitriao.jogarComoAnfitriao(id);
      if (anfitriao.estado) gameStore.setPartida(anfitriao.estado);
    } else {
      await cliente?.jogar(id);
    }
  } catch (error) {
    erroAcao.value = error instanceof Error ? error.message : 'Não foi possível realizar a jogada.';
  }
}

async function bater() {
  if (!partida.value) return;
  const anfitriao = hostBluetoothAtual();
  const cliente = clienteAtivoAtual();
  const hostJogando = anfitriao && jogadorAtual.value.id === anfitriao.hostId;
  const clienteJogando = cliente && minhaVez.value;
  if (!hostJogando && !clienteJogando) return;
  erroAcao.value = '';
  try {
    if (hostJogando) {
      await anfitriao.completarComoAnfitriao();
      if (anfitriao.estado) gameStore.setPartida(anfitriao.estado);
    } else {
      await cliente?.completar();
    }
  } catch (error) {
    erroAcao.value = error instanceof Error ? error.message : 'Não foi possível concluir a jogada.';
  }
}

async function encerrar() {
  const cliente = clienteAtivoAtual();
  await cliente?.desconectar();
  gameStore.clearSession();
  await router.push('/resultado');
}
</script>
