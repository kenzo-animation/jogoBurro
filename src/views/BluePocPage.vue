<!-- src/views/BlePocPage.vue — página temporária só para a prova de conceito (Fase 0) -->
<template>
<ion-page>
<ion-header>
<ion-toolbar><ion-title>Conexão Bluetooth</ion-title></ion-toolbar>
</ion-header>
 
    <ion-content class="ion-padding">
<ion-input v-model="nome" label="Seu nome" label-placement="floating" fill="outline" />
 
      <ion-button expand="block" :disabled="papel !== 'nenhum'" @click="virarAnfitriao">Ser anfitrião</ion-button>
<ion-button expand="block" fill="outline" :disabled="papel !== 'nenhum'" @click="buscar">Procurar celulares próximos</ion-button>
 
      <ion-list>
<ion-item v-for="(d, index) in achados" :key="d.deviceId" button @click="entrar(d.deviceId)">
<ion-label>{{ d.name ?? `Celular próximo ${index + 1}` }}</ion-label>
</ion-item>
</ion-list>
 
<ion-button v-if="papel !== 'nenhum'" expand="block" color="medium" fill="clear" @click="parar">Sair</ion-button>
 
      <p class="status" role="status">{{ status }}</p>
</ion-content>
</ion-page>
</template>
 
<script setup lang="ts">
import { ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonInput,
  IonButton, IonList, IonItem, IonLabel,
} from '@ionic/vue';
import {
  iniciarAnfitriao, anfitriaoEnviar, procurarPartidas, entrarNaPartida,
  clienteEnviar, encerrar, type Achado,
} from '@/services/bluetooth/blePoc';
import { criarMensagem, serializarMensagem } from '@/types/bluetooth';
import { JogoBluetoothHost } from '@/services/bluetooth/jogoBluetooth';
 
const nome = ref('');
const papel = ref<'nenhum' | 'anfitriao' | 'cliente'>('nenhum');
const achados = ref<Achado[]>([]);
const status = ref('Escolha criar uma sala ou procurar celulares próximos.');
let conectadoA: string | undefined;
let partidaConectada: string | undefined;
let jogadorConectado: string | undefined;
let partidaPoc: string | undefined;
let hostPoc: JogoBluetoothHost | undefined;
let buscaTimer: ReturnType<typeof setTimeout> | undefined;

interface SalaAnfitriao {
  partidaId: string;
  nome: string;
}
 
const log = (message: string) => { status.value = message; };
const tratar = (error: unknown, fallback = 'Não foi possível concluir a conexão.') => {
  const message = error instanceof Error ? error.message : '';
  status.value = message.startsWith('Permita ') || message.startsWith('Ative ')
    ? message
    : fallback;
};
 
async function virarAnfitriao() {
  if (!nome.value.trim()) { status.value = 'Informe seu nome para criar a sala.'; return; }
  try {
    partidaPoc = `poc-${Date.now()}`;
    hostPoc = new JogoBluetoothHost(nome.value.trim(), { enviar: (id, texto) => anfitriaoEnviar(texto, id) }, partidaPoc);
    await iniciarAnfitriao(nome.value.trim(), log, async (id, txt) => {
      try {
        const mensagem = JSON.parse(txt) as { tipo?: string };
        if (mensagem.tipo === 'OLÁ' && partidaPoc) {
          await anfitriaoEnviar(JSON.stringify({ tipo: 'OLÁ_ACK', partidaId: partidaPoc, nome: nome.value.trim() }), id);
        }
      } catch { /* mensagens de teste não JSON também aparecem no log */ }
      void hostPoc?.receber(id, txt);
    }, (id) => { log(`Cliente desconectou: ${id}`); void hostPoc?.marcarDesconexao(id); });
    papel.value = 'anfitriao';
  } catch (e) { tratar(e, 'Não foi possível abrir a sala. Tente novamente.'); }
}
 
async function buscar() {
  try {
    if (buscaTimer) clearTimeout(buscaTimer);
    achados.value = [];
    status.value = 'Procurando celulares próximos…';
    await procurarPartidas(log, (d) => {
      if (!achados.value.some((x) => x.deviceId === d.deviceId)) achados.value.push(d);
    });
    buscaTimer = setTimeout(() => {
      if (achados.value.length === 0) {
        status.value = 'Nenhum celular encontrado. Deixe o anfitrião com a tela aberta e aproxime os aparelhos.';
      }
    }, 12500);
  } catch (e) { tratar(e, 'Não foi possível procurar celulares próximos.'); }
}

async function entrar(deviceId: string) {
  if (!nome.value.trim()) { status.value = 'Informe seu nome antes de entrar.'; return; }
  try {
    if (buscaTimer) clearTimeout(buscaTimer);
    status.value = 'Conectando ao celular…';
    let receberSala: ((sala: SalaAnfitriao) => void) | undefined;
    const salaConfirmada = new Promise<SalaAnfitriao>((resolve) => { receberSala = resolve; });
    await entrarNaPartida(deviceId, log, (txt) => {
      try {
        const resposta: unknown = JSON.parse(txt);
        if (resposta && typeof resposta === 'object') {
          const sala = resposta as Record<string, unknown>;
          if (sala.tipo === 'OLÁ_ACK' && typeof sala.partidaId === 'string' && typeof sala.nome === 'string') {
            receberSala?.({ partidaId: sala.partidaId, nome: sala.nome });
          }
        }
      } catch { /* Outras mensagens são registradas, mas não representam a confirmação da sala. */ }
    }, () => { papel.value = 'nenhum'; });
    conectadoA = deviceId;
    papel.value = 'cliente';
    await clienteEnviar(deviceId, JSON.stringify({ tipo: 'OLÁ' }));
    let cancelarTimeout: (() => void) | undefined;
    const timeoutSala = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('O anfitrião não confirmou a sala. Verifique se ele ainda está anunciando.')), 8000);
      cancelarTimeout = () => clearTimeout(timer);
    });
    let sala: SalaAnfitriao;
    try {
      sala = await Promise.race([salaConfirmada, timeoutSala]);
    } finally {
      cancelarTimeout?.();
    }
    const { partidaId, nome: nomeSala } = sala;
    log(`Sala confirmada: ${nomeSala}.`);
    const jogadorId = jogadorConectado || `jogador-${Date.now()}`;
    const mensagem = partidaConectada === partidaId
      ? criarMensagem('RECONEXAO', partidaId, jogadorId, {})
      : criarMensagem('SOLICITAR_ENTRADA', partidaId, jogadorId, { nome: nome.value.trim() });
    await clienteEnviar(deviceId, serializarMensagem(mensagem));
    partidaConectada = partidaId;
    jogadorConectado = jogadorId;
    status.value = `Conectado à sala ${nomeSala}.`;
  } catch (e) { tratar(e, 'Não foi possível conectar. Verifique se a sala do outro celular está aberta.'); }
}

async function parar() {
  if (buscaTimer) clearTimeout(buscaTimer);
  buscaTimer = undefined;
  await encerrar(conectadoA);
  conectadoA = undefined;
  partidaPoc = undefined;
  hostPoc = undefined;
  papel.value = 'nenhum';
  status.value = 'Conexão encerrada.';
}
</script>
 
<style scoped>
.status { margin-top: 16px; text-align: center; }
</style>