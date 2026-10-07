import { reactive } from 'vue';
import type { Partida } from '@/types/game';
import { registrarPartida } from '@/services/database/historico';

export interface JogadorSala {
  id: string;
  nome: string;
  ordem: number;
  conectado: boolean;
}

export interface Sala {
  id: string;
  jogadores: JogadorSala[];
}

// O store é o estado visível pela UI. Ele não deve conter regras de validação do jogo.
const estado = reactive<{ partida: Partida | null; sala: Sala | null; nomeLocal: string; jogadorLocalId?: string }>({ partida: null, sala: null, nomeLocal: 'Você' });

export const gameStore = {
  estado,
  criarSala(nome: string) {
    const nomeAnfitriao = nome.trim();
    if (!nomeAnfitriao) throw new Error('Informe o nome do anfitrião.');
    estado.nomeLocal = nomeAnfitriao;
    estado.partida = null;
    estado.sala = {
      id: `sala-${Date.now()}`,
      jogadores: [{ id: 'anfitriao', nome: nomeAnfitriao, ordem: 0, conectado: true }],
    };
  },
  setSala(sala: Sala) {
    estado.sala = sala;
  },
  setPartida(partida: Partida) {
    estado.partida = partida;
  },
  setJogadorLocal(id: string, nome: string) {
    estado.nomeLocal = nome;
    estado.jogadorLocalId = id;
    const jogador = estado.partida?.jogadores.find((item) => item.id === id);
    if (jogador) jogador.nome = nome;
  },
  clearSession() {
    estado.partida = null;
    estado.sala = null;
    estado.jogadorLocalId = undefined;
  },
  encerrar(status: Partida['status'] = 'finalizada') {
    if (!estado.partida) return;
    estado.partida = { ...estado.partida, status, fim: new Date().toISOString() };
    registrarPartida(estado.partida);
  },
};
