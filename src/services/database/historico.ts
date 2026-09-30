import type { Partida, RegistroHistorico } from '@/types/game';

const CHAVE = 'jogo-burro-historico';

function ler(): RegistroHistorico[] {
  if (typeof localStorage === 'undefined') return [];
  return JSON.parse(localStorage.getItem(CHAVE) || '[]') as RegistroHistorico[];
}

export function registrarPartida(partida: Partida): RegistroHistorico {
  const vencedor = partida.jogadores.find((jogador) => jogador.letrasBurro === 0)?.nome;
  const registro: RegistroHistorico = {
    id: partida.id,
    inicio: partida.inicio,
    fim: partida.fim || new Date().toISOString(),
    status: partida.status,
    motivoEncerramento: partida.motivoEncerramento,
    vencedor,
    penalizado: partida.jogadores.find((jogador) => jogador.letrasBurro >= 5)?.nome,
    rodadas: partida.rodada,
    participantes: partida.jogadores.map((jogador) => ({ nome: jogador.nome, ordem: jogador.ordem, resultado: jogador.letrasBurro ? `${jogador.letrasBurro} letra(s)` : 'vencedor' })),
  };
  const registros = [registro, ...ler().filter((item) => item.id !== registro.id)];
  localStorage?.setItem(CHAVE, JSON.stringify(registros));
  return registro;
}

export const historicoService = {
  listar: ler,
  buscar: (id: string) => ler().find((item) => item.id === id),
  excluir: (id: string) => localStorage?.setItem(CHAVE, JSON.stringify(ler().filter((item) => item.id !== id))),
  limpar: () => localStorage?.removeItem(CHAVE),
};
