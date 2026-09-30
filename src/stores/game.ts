import { reactive } from 'vue';
import { completarJogador, criarPartida, trocarCarta } from '@/domain/jogo';
import type { Partida } from '@/types/game';
import { registrarPartida } from '@/services/database/historico';

export interface JogadorSala {
  id: string;
  nome: string;
  ordem: number;
}

export interface Sala {
  id: string;
  jogadores: JogadorSala[];
}

const estado = reactive<{ partida: Partida | null; sala: Sala | null; nomeLocal: string }>({ partida: null, sala: null, nomeLocal: 'Você' });

export const gameStore = {
  estado,
  criarSala(nome: string) {
    const nomeAnfitriao = nome.trim();
    if (!nomeAnfitriao) throw new Error('Informe o nome do anfitrião.');
    estado.nomeLocal = nomeAnfitriao;
    estado.partida = null;
    estado.sala = {
      id: `sala-${Date.now()}`,
      jogadores: [{ id: 'anfitriao', nome: nomeAnfitriao, ordem: 0 }],
    };
  },
  adicionarJogador(nome: string, id: string) {
    const sala = estado.sala;
    const nomeJogador = nome.trim();
    if (!sala || estado.partida || !nomeJogador || sala.jogadores.length >= 4) return false;
    if (sala.jogadores.some((jogador) => jogador.id === id)) return false;
    sala.jogadores.push({ id, nome: nomeJogador, ordem: sala.jogadores.length });
    return true;
  },
  iniciarPartida() {
    const sala = estado.sala;
    if (!sala || sala.jogadores.length < 2) throw new Error('A sala precisa de pelo menos dois jogadores.');
    if (estado.partida) return;
    estado.partida = criarPartida(sala.jogadores.map((jogador) => jogador.nome));
  },
  jogar(jogadorId: string, cartaId: string) {
    if (!estado.partida) return;
    estado.partida = trocarCarta(estado.partida, jogadorId, cartaId);
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
