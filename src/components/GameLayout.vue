<template>
  <ion-page>
    <ion-header class="app-header">
      <ion-toolbar>
        <ion-title><span class="eyebrow">BARALHO · BLUETOOTH</span><br />Jogo Burro</ion-title>
        <ion-badge slot="end" color="success">offline local</ion-badge>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true"><div class="page-wrap"><slot /></div></ion-content>
    <ion-footer class="app-tabs">
      <nav aria-label="Navegação principal">
        <router-link to="/inicio"><ion-icon :icon="homeOutline" /><ion-label>Jogar</ion-label></router-link>
        <router-link to="/historico"><ion-icon :icon="timeOutline" /><ion-label>Histórico</ion-label></router-link>
        <router-link to="/regras"><ion-icon :icon="bookOutline" /><ion-label>Regras</ion-label></router-link>
        <router-link to="/estatisticas"><ion-icon :icon="barChartOutline" /><ion-label>Stats</ion-label></router-link>
        <router-link to="/configuracoes"><ion-icon :icon="settingsOutline" /><ion-label>Ajustes</ion-label></router-link>
      </nav>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBadge, IonContent, IonFooter, IonHeader, IonIcon, IonLabel, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import { barChartOutline, bookOutline, homeOutline, settingsOutline, timeOutline } from 'ionicons/icons';
</script>
