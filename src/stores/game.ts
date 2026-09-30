import { reactive } from 'vue';
import { completarJogador, criarPartida, trocarCarta } from '@/domain/jogo';
import type { Partida } from '@/types/game';
import { registrarPartida } from '@/services/database/historico';

const estado = reactive<{ partida: Partida | null; nomeLocal: string }>({ partida: null, nomeLocal: 'Você' });

export const gameStore = {
  estado,
  criar(nomes: string[]) { estado.partida = criarPartida(nomes); },
  jogar(cartaId: string) {
    if (!estado.partida) return;
    estado.partida = trocarCarta(estado.partida, estado.partida.jogadores[estado.partida.jogadorAtual].id, cartaId);
  },
  completar(jogadorId: string) {
    if (!estado.partida) return;
    estado.partida = completarJogador(estado.partida, jogadorId);
  },
  encerrar(status: Partida['status'] = 'finalizada') {
    if (!estado.partida) return;
    estado.partida = { ...estado.partida, status, fim: new Date().toISOString() };
    registrarPartida(estado.partida);
  },
};
