<!-- src/views/BlePocPage.vue — página temporária só para a prova de conceito (Fase 0) -->
<template>
<ion-page>
<ion-header>
<ion-toolbar><ion-title>PoC Bluetooth ({{ papel }})</ion-title></ion-toolbar>
</ion-header>
 
    <ion-content class="ion-padding">
<ion-input v-model="nome" label="Seu nome" label-placement="floating" fill="outline" />
 
      <ion-button expand="block" :disabled="papel !== 'nenhum'" @click="virarAnfitriao">Ser anfitrião</ion-button>
<ion-button expand="block" fill="outline" :disabled="papel !== 'nenhum'" @click="buscar">Procurar partidas</ion-button>
 
      <ion-list>
<ion-item v-for="d in achados" :key="d.deviceId" button @click="entrar(d.deviceId)">
<ion-label>{{ d.name ?? '(sem nome)' }}<p>{{ d.deviceId }} · {{ d.rssi }} dBm</p></ion-label>
</ion-item>
</ion-list>
 
      <ion-button expand="block" color="success" :disabled="papel === 'nenhum' || !conectadoA && papel !== 'anfitriao'" @click="enviar">Enviar "olá"</ion-button>
<ion-button expand="block" color="medium" fill="clear" @click="parar">Encerrar</ion-button>
 
      <pre class="log">{{ logs.join('\n') }}</pre>
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
const logs = ref<string[]>([]);
let conectadoA: string | undefined;
let partidaConectada: string | undefined;
let jogadorConectado: string | undefined;
let contador = 0;
let partidaPoc: string | undefined;
let hostPoc: JogoBluetoothHost | undefined;
 
const log = (m: string) => logs.value.unshift(`${new Date().toLocaleTimeString()}  ${m}`);
const tratar = (e: unknown) => log(`ERRO: ${e instanceof Error ? e.message : String(e)}`);
 
async function virarAnfitriao() {
  if (!nome.value.trim()) { log('Informe o nome da sala antes de anunciar.'); return; }
  try {
    partidaPoc = `poc-${Date.now()}`;
    hostPoc = new JogoBluetoothHost(nome.value.trim(), { enviar: (id, texto) => anfitriaoEnviar(texto, id) }, partidaPoc);
    await iniciarAnfitriao(`${nome.value.trim()}|${partidaPoc}`, log, async (id, txt) => {
      log(`[de ${id}] ${txt}`);
      try {
        const mensagem = JSON.parse(txt) as { tipo?: string };
        if (mensagem.tipo === 'OLÁ') await anfitriaoEnviar(JSON.stringify({ tipo: 'OLÁ_ACK', mensagem: 'olá', partidaId: nome.value.trim() }), id);
      } catch { /* mensagens de teste não JSON também aparecem no log */ }
      void hostPoc?.receber(id, txt);
    }, (id) => { log(`Cliente desconectou: ${id}`); void hostPoc?.marcarDesconexao(id); });
    papel.value = 'anfitriao';
  } catch (e) { tratar(e); }
}
 
async function buscar() {
  try {
    achados.value = [];
    await procurarPartidas(log, (d) => {
      if (!achados.value.some((x) => x.deviceId === d.deviceId)) achados.value.push(d);
    });
  } catch (e) { tratar(e); }
}
 
async function entrar(deviceId: string) {
  if (!nome.value.trim()) { log('Informe seu nome antes de entrar.'); return; }
  try {
    await entrarNaPartida(deviceId, log, (txt) => log(`[anfitrião] ${txt}`), () => { papel.value = 'nenhum'; });
    conectadoA = deviceId;
    papel.value = 'cliente';
    const achado = achados.value.find((item) => item.deviceId === deviceId);
    const nomeSala = achado?.name || 'anfitrião';
    const partidaId = nomeSala.includes('|') ? nomeSala.split('|')[1] : nomeSala;
    if (!partidaId) throw new Error('A sala não anunciou um identificador válido.');
    await clienteEnviar(deviceId, JSON.stringify({ tipo: 'OLÁ', mensagem: 'olá' }));
    log('Mensagem "olá" enviada; aguardando confirmação.');
    const jogadorId = jogadorConectado || `jogador-${Date.now()}`;
    const mensagem = partidaConectada === partidaId
      ? criarMensagem('RECONEXAO', partidaId, jogadorId, {})
      : criarMensagem('SOLICITAR_ENTRADA', partidaId, jogadorId, { nome: nome.value.trim() });
    await clienteEnviar(deviceId, serializarMensagem(mensagem));
    partidaConectada = partidaId;
    jogadorConectado = jogadorId;
    log(`Pedido de entrada enviado para ${nomeSala || 'anfitrião'}.`);
  } catch (e) { tratar(e); }
}
 
async function enviar() {
  const msg = papel.value === 'anfitriao'
    ? JSON.stringify({ tipo: 'OLÁ', mensagem: 'olá', n: ++contador })
    : JSON.stringify({ tipo: 'OLÁ', mensagem: 'olá', n: ++contador });
  try {
    if (papel.value === 'anfitriao') await anfitriaoEnviar(msg);
    else if (conectadoA) await clienteEnviar(conectadoA, msg);
    log(`enviado: ${msg}`);
  } catch (e) { tratar(e); }
}
 
async function parar() {
  await encerrar(conectadoA);
  conectadoA = undefined;
  partidaPoc = undefined;
  hostPoc = undefined;
  papel.value = 'nenhum';
  log('Encerrado');
}
</script>
 
<style scoped>
.log { font-size: 12px; white-space: pre-wrap; margin-top: 16px; }
</style>