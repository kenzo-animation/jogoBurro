<template>
  <GameLayout>
    <div class="section-heading">
      <p class="kicker">SALA DE ESPERA</p>
      <h2>{{ cliente ? 'Conecte-se à mesa' : 'Mesa aberta' }}</h2>
      <p>{{ anuncio }}</p>
    </div>

    <div class="room-code">
      BURRO-{{ salaId }}
    </div>

    <div class="ble-status" :class="anuncioErro ? 'error' : 'success'">
      <span class="status-dot" />{{ status }}
    </div>

    <ion-list class="player-list">
      <ion-item v-for="jogador in jogadores" :key="jogador.id">
        <ion-avatar slot="start"><span>{{ jogador.nome[0] }}</span></ion-avatar>
        <ion-label>
          <strong>{{ jogador.nome }}</strong>
          <p>{{ jogador.id === 'anfitriao' ? 'anfitrião' : jogador.conectado ? 'conectado via Bluetooth' : 'desconectado' }}</p>
        </ion-label>
        <ion-icon slot="end" :color="jogador.conectado ? 'success' : 'medium'" :icon="jogador.conectado ? checkmarkCircleOutline : warningOutline" />
      </ion-item>
    </ion-list>

    <ion-button
      v-if="!cliente"
      expand="block"
      size="large"
      @click="iniciarPartida"
      :disabled="jogadores.length < 2"
    >Começar partida</ion-button>
    <ion-list v-if="cliente && !conectado" class="device-list">
      <ion-item v-for="(dispositivo, index) in dispositivos" :key="dispositivo.deviceId" button @click="selecionarDispositivo(dispositivo)">
        <ion-label>
          <strong>{{ dispositivo.name || `Celular próximo ${index + 1}` }}</strong>
        </ion-label>
      </ion-item>
    </ion-list>
    <ion-button v-if="cliente && !conectado && dispositivos.length === 0" expand="block" size="large" @click="procurarPartidas">Procurar mesas</ion-button>
    <ion-button v-if="cliente && conectado" expand="block" size="large" @click="solicitarEntrada">Entrar na mesa</ion-button>
    <ion-button v-if="cliente && !solicitado" expand="block" fill="clear" @click="cancelar">Cancelar</ion-button>
    <ion-button v-else expand="block" fill="clear" @click="cancelar">Cancelar sala</ion-button>
  </GameLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonAvatar, IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/vue';
import { checkmarkCircleOutline, warningOutline } from 'ionicons/icons';
import GameLayout from '@/components/GameLayout.vue';
import { gameStore } from '@/stores/game';
import { JogoBluetoothHost } from '@/services/bluetooth/jogoBluetooth';
import { JogoBluetoothClient, registrarCliente } from '@/services/bluetooth/jogoBluetoothClient';
import { anfitriaoEnviar, iniciarAnfitriao } from '@/services/bluetooth/blePoc';
import { registrarPartida } from '@/services/database/historico';
import type { MensagemBluetooth } from '@/types/bluetooth';
import type { BluetoothClientDiscovery } from '@/services/bluetooth/bleClient';

const route = useRoute();
const router = useRouter();
const cliente = computed(() => route.query.modo === 'cliente');
const nome = computed(() => String(route.query.nome || gameStore.estado.nomeLocal || 'Jogador'));
const salaId = computed(() => String(route.query.sala || gameStore.estado.sala?.id || 'LOCAL').replace(/^sala-/, ''));
const jogadores = computed(() => gameStore.estado.sala?.jogadores || []);
const anuncio = ref('Iniciando sessão Bluetooth...');
const status = ref('Aguardando dispositivos próximos.');
const anuncioErro = ref(false);
const conectado = ref(false);
const solicitado = ref(false);
const dispositivos = ref<BluetoothClientDiscovery[]>([]);
let hostBluetooth: JogoBluetoothHost | undefined;
let clientBluetooth: JogoBluetoothClient | undefined;
const playerId = `jogador-${crypto.randomUUID()}`;

function erro(message: string) {
  anuncioErro.value = true;
  const texto = /^(Permita |Ative |A |O |Não |Sala |Jogada |Grupo |Um jogador |Bluetooth está )/.test(message)
    ? message
    : 'Não foi possível conectar. Tente novamente e mantenha os celulares próximos.';
  status.value = texto;
  anuncio.value = texto;
}

function atualizarSala(sala: readonly JogoBluetoothHost['sala'][number][]) {
  gameStore.setSala({ id: `sala-${salaId.value}`, jogadores: [...sala] });
}

async function iniciarPartida() {
  if (!hostBluetooth) return;
  try {
    await hostBluetooth.iniciar();
    const partida = hostBluetooth.estado;
    if (!partida) throw new Error('O host não criou a partida.');
    gameStore.setPartida(partida);
    atualizarSala(hostBluetooth.sala);
    registrarPartida(partida);
    await router.push('/jogo');
  } catch (error) {
    erro('Não foi possível iniciar a partida.');
  }
}

async function iniciarHost() {
  const sala = gameStore.estado.sala;
  if (!sala) return;
  hostBluetooth = new JogoBluetoothHost(gameStore.estado.nomeLocal, {
    enviar: (deviceId, texto) => anfitriaoEnviar(texto, deviceId),
  }, sala.id, (partida) => {
    registrarPartida(partida);
  });
  await iniciarAnfitriao(gameStore.estado.nomeLocal, (message) => {
    status.value = message;
  }, async (deviceId, texto) => {
    await hostBluetooth?.receber(deviceId, texto);
    atualizarSala(hostBluetooth?.sala ?? []);
  }, async (deviceId) => {
    await hostBluetooth?.marcarDesconexao(deviceId);
    atualizarSala(hostBluetooth?.sala ?? []);
    status.value = 'Um jogador foi desconectado.';
  });
  anuncio.value = 'Anfitrião visível para celulares próximos.';
  status.value = 'Aguardando jogadores entrarem pelo Bluetooth.';
}

async function procurarPartidas() {
  if (clientBluetooth) await clientBluetooth.desconectar();
  dispositivos.value = [];
  clientBluetooth = new JogoBluetoothClient({
    onMessage: tratarMensagem,
    onDisconnect: () => {
      conectado.value = false;
      erro('A conexão com o anfitrião foi interrompida.');
    },
    onError: (message) => erro(message),
  });
  try {
    await clientBluetooth.scan((device) => {
      if (!dispositivos.value.some((item) => item.deviceId === device.deviceId)) {
        dispositivos.value.push(device);
      }
    });
    if (dispositivos.value.length === 0) {
      erro('Nenhuma mesa foi encontrada. Aguarde o anfitrião anunciar a sala.');
      return;
    }
    status.value = `${dispositivos.value.length} mesa encontrada. Selecione o anfitrião.`;
    registrarCliente(clientBluetooth);
  } catch (error) {
    erro('Não foi possível procurar mesas.');
  }
}

async function selecionarDispositivo(dispositivo: BluetoothClientDiscovery) {
  if (!clientBluetooth) return;
  try {
    await clientBluetooth.connect(dispositivo.deviceId, salaId.value, playerId);
    conectado.value = true;
    status.value = 'Conectado. Aguarde a confirmação do anfitrião.';
  } catch (error) {
    erro('Não foi possível conectar à mesa. Confira se o anfitrião está com a sala aberta.');
  }
}

async function tratarMensagem(mensagem: MensagemBluetooth) {
  if (mensagem.tipo === 'RESPOSTA_ENTRADA') {
    if (!mensagem.payload.aceita) {
      erro(mensagem.payload.motivo || 'O anfitrião recusou a entrada.');
      return;
    }
    solicitado.value = true;
    gameStore.setJogadorLocal(playerId, nome.value);
    gameStore.setSala({
      id: `sala-${salaId.value}`,
      jogadores: jogadores.value.map((jogador) => jogador.id === playerId
        ? { ...jogador, nome: nome.value, conectado: true }
        : jogador),
    });
    status.value = 'Você entrou na mesa. Aguarde o início da partida.';
    return;
  }
  if (mensagem.tipo === 'SALA_ATUALIZADA') {
    gameStore.setSala({ id: `sala-${salaId.value}`, jogadores: mensagem.payload.jogadores });
    return;
  }
  if (mensagem.tipo === 'INICIAR_PARTIDA') {
    status.value = 'A partida começou. Recebendo seu estado.';
    return;
  }
  if (mensagem.tipo === 'TROCA_REALIZADA') {
    const jogadoresAtivos = jogadores.value.map((jogador) => {
      const atualizado = mensagem.payload.jogadores.find((item) => item.id === jogador.id);
      return {
        id: jogador.id,
        nome: jogador.nome,
        ordem: jogador.ordem,
        mao: [],
        letrasBurro: atualizado?.letrasBurro ?? 0,
        conectado: jogador.conectado,
      };
    });
    const jogadorLocal = jogadoresAtivos.find((jogador) => jogador.id === playerId);
    if (!jogadorLocal) return;
    const partidaJogadores = jogadoresAtivos.map((jogador) => {
      if (jogador.id !== playerId) return jogador;
      return { ...jogador, mao: mensagem.payload.mao };
    });
    gameStore.setPartida({
      id: `partida-${salaId.value}`,
      inicio: new Date().toISOString(),
      status: 'em-andamento',
      jogadores: partidaJogadores,
      jogadorAtual: jogadoresAtivos.findIndex((jogador) => jogador.id === mensagem.payload.jogadorAtual),
      descarte: [],
      rodada: mensagem.payload.rodada,
    });
    await router.push('/jogo');
  }
}

async function solicitarEntrada() {
  if (!clientBluetooth || !conectado.value) return;
  try {
    await clientBluetooth.solicitarEntrada(nome.value);
    solicitado.value = true;
    status.value = 'Entrada enviada. Aguarde a resposta do anfitrião.';
  } catch (error) {
    erro(error instanceof Error ? error.message : 'Não foi possível enviar a entrada.');
  }
}

async function cancelar() {
  await clientBluetooth?.desconectar();
  gameStore.clearSession();
  await router.push('/inicio');
}

onMounted(async () => {
  if (!gameStore.estado.sala) {
    erro('Crie ou acesse uma sala antes de abrir esta página.');
    return;
  }
  if (cliente.value) {
    status.value = 'Procure a mesa do anfitrião.';
    return;
  }
  try {
    await iniciarHost();
  } catch {
    erro('Não foi possível abrir a sala Bluetooth. Verifique as permissões e tente novamente.');
  }
});

onBeforeUnmount(() => {
  void clientBluetooth?.desconectar();
});
</script>
