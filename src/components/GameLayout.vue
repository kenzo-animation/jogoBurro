<template>
  <ion-page>
    <ion-header class="app-header">
      <ion-toolbar>
        <ion-title><span class="eyebrow">BARALHO · BLUETOOTH</span><br />Jogo Burro</ion-title>
        <ion-badge slot="end" color="success">offline local</ion-badge>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true"><div class="page-wrap"><slot /></div></ion-content>
    <ion-tab-bar slot="bottom">
      <ion-tab-button href="/inicio"><ion-icon :icon="homeOutline" /><ion-label>Jogar</ion-label></ion-tab-button>
      <ion-tab-button href="/historico"><ion-icon :icon="timeOutline" /><ion-label>Histórico</ion-label></ion-tab-button>
      <ion-tab-button href="/regras"><ion-icon :icon="bookOutline" /><ion-label>Regras</ion-label></ion-tab-button>
      <ion-tab-button href="/configuracoes"><ion-icon :icon="settingsOutline" /><ion-label>Ajustes</ion-label></ion-tab-button>
    </ion-tab-bar>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBadge, IonContent, IonHeader, IonIcon, IonLabel, IonPage, IonTabBar, IonTabButton, IonTitle, IonToolbar } from '@ionic/vue';
import { bookOutline, homeOutline, settingsOutline, timeOutline } from 'ionicons/icons';
</script>
