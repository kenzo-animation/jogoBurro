export type StatusPartida = 'em-andamento' | 'finalizada' | 'cancelada' | 'interrompida';

export interface Carta {
  id: string;
  valor: string;
  naipe: string;
}

export interface Jogador {
  id: string;
  nome: string;
  ordem: number;
  mao: Carta[];
  letrasBurro: number;
  conectado: boolean;
}

export interface Partida {
  id: string;
  inicio: string;
  fim?: string;
  status: StatusPartida;
  motivoEncerramento?: string;
  jogadores: Jogador[];
  jogadorAtual: number;
  descarte: Carta[];
  rodada: number;
}

export interface RegistroHistorico {
  id: string;
  inicio: string;
  fim?: string;
  status: StatusPartida;
  motivoEncerramento?: string;
  vencedor?: string;
  penalizado?: string;
  rodadas: number;
  participantes: Array<{ nome: string; ordem: number; resultado: string }>;
}
