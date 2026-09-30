<template>
  <GameLayout
    ><div class="section-heading">
      <p class="kicker">MEMÓRIA DA MESA</p>
      <h2>Histórico</h2>
      <p>Partidas ficam salvas localmente, sem conta e sem internet.</p>
    </div>
    <div v-if="registros.length" class="history-list">
      <ion-item v-for="registro in registros" :key="registro.id"
        ><ion-label button :router-link="`/detalhes/${registro.id}`"
          ><strong>{{
            registro.status === "finalizada"
              ? "Partida concluída"
              : "Partida cancelada"
          }}</strong>
          <p>
            {{ new Date(registro.inicio).toLocaleDateString("pt-BR") }} ·
            {{ registro.rodadas }} rodadas
          </p></ion-label
        ><ion-note slot="end">{{
          registro.vencedor || "sem vencedor"
        }}</ion-note
        ><ion-button
          slot="end"
          fill="clear"
          color="danger"
          aria-label="Excluir partida"
          @click="excluir(registro.id)"
          >Excluir</ion-button
        ></ion-item
      ><ion-button fill="outline" color="danger" expand="block" @click="limpar"
        >Apagar todo histórico</ion-button
      >
    </div>
    <div v-else class="empty-state">
      <strong>Nenhuma partida ainda.</strong>
      <p>Quando uma mesa terminar, ela aparecerá aqui.</p>
    </div></GameLayout
  >
</template>
<script setup lang="ts">
import { onIonViewWillEnter, alertController } from "@ionic/vue";
import { ref } from "vue";
import { IonButton, IonItem, IonLabel, IonNote } from "@ionic/vue";
import GameLayout from "@/components/GameLayout.vue";
import { historicoService } from "@/services/database/historico";
import type { RegistroHistorico } from "@/types/game";
const registros = ref<RegistroHistorico[]>([]);
function carregar() {
  registros.value = historicoService.listar();
}
async function confirmar(mensagem: string) {
  const alerta = await alertController.create({
    header: "Confirmar exclusão",
    message: mensagem,
    buttons: [
      { text: "Cancelar", role: "cancel" },
      { text: "Apagar", role: "destructive", handler: () => true },
    ],
  });
  await alerta.present();
  const resultado = await alerta.onDidDismiss();
  return resultado.role === "destructive";
}
async function excluir(id: string) {
  if (await confirmar("Esta partida será removida do histórico.")) {
    historicoService.excluir(id);
    carregar();
  }
}
async function limpar() {
  if (await confirmar("Todas as partidas serão removidas.")) {
    historicoService.limpar();
    carregar();
  }
}
onIonViewWillEnter(carregar);
</script>
