import type { Partida, RegistroHistorico } from '@/types/game';

const CHAVE = 'jogo-burro-historico';

function armazenamento(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

function ler(): RegistroHistorico[] {
  const storage = armazenamento();
  if (!storage) return [];
  try {
    const valor: unknown = JSON.parse(storage.getItem(CHAVE) || '[]');
    return Array.isArray(valor) ? valor as RegistroHistorico[] : [];
  } catch {
    return [];
  }
}

export function registrarPartida(partida: Partida): RegistroHistorico {
  const vencedor = partida.status === 'finalizada' ? partida.jogadores.find((jogador) => jogador.letrasBurro < 5)?.nome : undefined;
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
  armazenamento()?.setItem(CHAVE, JSON.stringify(registros));
  return registro;
}

export const historicoService = {
  listar: ler,
  buscar: (id: string) => ler().find((item) => item.id === id),
  excluir: (id: string) => armazenamento()?.setItem(CHAVE, JSON.stringify(ler().filter((item) => item.id !== id))),
  limpar: () => armazenamento()?.removeItem(CHAVE),
};

export function calcularEstatisticas(registros = ler()) {
  const concluidas = registros.filter((registro) => registro.status === 'finalizada');
  const nomes = [...new Set(registros.flatMap((registro) => registro.participantes.map((participante) => participante.nome)))];
  return {
    partidas: registros.length,
    concluidas: concluidas.length,
    canceladas: registros.filter((registro) => registro.status === 'cancelada').length,
    rodadas: registros.reduce((total, registro) => total + registro.rodadas, 0),
    jogadores: nomes.length,
    vencedorMaisFrequente: nomes.map((nome) => ({ nome, vitorias: concluidas.filter((registro) => registro.vencedor === nome).length })).sort((a, b) => b.vitorias - a.vitorias)[0],
  };
}
