<template>
  <GameLayout
    ><div class="section-heading">
      <p class="kicker">SALA DE ESPERA · HOST</p>
      <h2>Mesa aberta</h2>
      <p>
        Aguarde os outros jogadores entrarem pelo Bluetooth.
      </p>
    </div>
    <div class="room-code">
      BURRO-{{
        gameStore.estado.sala?.id.slice(-4).toUpperCase() || "LOCAL"
      }}
    </div>
    <div class="ble-status" :class="anuncioErro ? 'error' : 'success'">
      <span class="status-dot" />{{ anuncio }}
    </div>
    <ion-list v-if="!cliente" class="player-list"
      ><ion-item v-for="jogador in jogadores" :key="jogador.id"
        ><ion-avatar slot="start"
          ><span>{{ jogador.nome[0] }}</span></ion-avatar
        ><ion-label
          ><strong>{{ jogador.nome }}</strong>
          <p>
            {{ jogador.ordem === 0 ? "anfitrião" : "conectado via Bluetooth" }}
          </p></ion-label
        ><ion-icon
          slot="end"
          color="success"
          :icon="checkmarkCircleOutline" /></ion-item></ion-list
    ><ion-button v-if="!cliente"
      expand="block"
      size="large"
      @click="iniciarPartida"
      :disabled="jogadores.length < 2"
      >Começar partida</ion-button
    ><ion-button expand="block" fill="clear" router-link="/inicio"
      >Cancelar sala</ion-button
    ></GameLayout
  >
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonAvatar,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
} from "@ionic/vue";
import { checkmarkCircleOutline } from "ionicons/icons";
import GameLayout from "@/components/GameLayout.vue";
import { gameStore } from "@/stores/game";
import { iniciarAnfitriao } from "@/services/bluetooth/blePoc";
import { anfitriaoEnviar } from "@/services/bluetooth/blePoc";
import { JogoBluetoothHost } from "@/services/bluetooth/jogoBluetooth";
import { registrarPartida } from "@/services/database/historico";
const jogadores = computed(() => gameStore.estado.partida?.jogadores || gameStore.estado.sala?.jogadores || []);
const route = useRoute();
const router = useRouter();
const cliente = computed(() => route.query.modo === "cliente");
const anuncio = ref("Iniciando anúncio Bluetooth...");
const anuncioErro = ref(false);
let hostBluetooth: JogoBluetoothHost | undefined;
onMounted(async () => {
  if (cliente.value) {
    anuncio.value = `Pedido enviado como ${String(route.query.nome || "jogador")}. Aguarde o anfitrião.`;
    return;
  }
  try {
    const salaId = gameStore.estado.sala?.id || `partida-${Date.now()}`;
    hostBluetooth = new JogoBluetoothHost(
      gameStore.estado.nomeLocal,
      { enviar: (deviceId, texto) => anfitriaoEnviar(texto, deviceId) },
      salaId,
      (partida) => { registrarPartida(partida); },
    );
    await iniciarAnfitriao(
      `${gameStore.estado.nomeLocal}|${salaId}`,
      (mensagem) => { anuncio.value = mensagem; },
      (deviceId, mensagem) => {
        try {
          const teste = JSON.parse(mensagem) as { tipo?: string };
          if (teste.tipo === 'OLÁ') {
            void anfitriaoEnviar(JSON.stringify({ tipo: 'OLÁ_ACK', mensagem: 'olá' }), deviceId);
            anuncio.value = 'Cliente conectado e recebeu o handshake.';
            return;
          }
        } catch { /* o orquestrador valida mensagens de jogo abaixo */ }
        void hostBluetooth?.receber(deviceId, mensagem);
        try { const pedido = JSON.parse(mensagem) as { tipo?: string; nome?: string }; if (pedido.tipo === 'SOLICITAR_ENTRADA' && pedido.nome) gameStore.adicionarJogador(pedido.nome, deviceId); } catch { anuncio.value = 'Pedido Bluetooth inválido ignorado.'; }
      },
      (deviceId) => {
        void hostBluetooth?.marcarDesconexao(deviceId);
        anuncio.value = 'Um jogador foi desconectado. Ele pode tentar reconectar.';
      },
    );
    anuncio.value = "Anfitrião visível para celulares próximos.";
  } catch (erro) {
    anuncioErro.value = true;
    anuncio.value =
      erro instanceof Error
        ? erro.message
        : "Não foi possível anunciar a sala.";
  }
});
async function iniciarPartida() {
  await hostBluetooth?.iniciar();
  gameStore.iniciarPartida();
  router.push('/jogo');
}
</script>
