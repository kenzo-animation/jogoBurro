<template>
  <GameLayout
    ><section class="hero">
      <p class="kicker">PASSAR. OBSERVAR. BATER.</p>
      <h1>Um jogo de cartas<br /><em>sem internet.</em></h1>
      <p class="lead">
        Monte uma mesa local e descubra quem vai carregar o BURRO.
      </p>
      <div class="action-stack">
        <ion-button router-link="/nova-partida" expand="block" size="large"
          >Criar partida
          <ion-icon slot="end" :icon="arrowForwardOutline" /></ion-button
        ><ion-button router-link="/bluetooth" fill="outline" expand="block"
          >Entrar em uma sala</ion-button
        >
      </div>
    </section>
    <section class="status-strip">
      <span class="status-dot" /> Bluetooth pronto para conectar
      <strong>2–4 jogadores</strong>
    </section></GameLayout
  >
</template>
<script setup lang="ts">
import { IonButton, IonIcon } from "@ionic/vue";
import { arrowForwardOutline } from "ionicons/icons";
import GameLayout from "@/components/GameLayout.vue";
</script>
