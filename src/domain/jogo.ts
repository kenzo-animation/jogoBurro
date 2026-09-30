import type { Carta, Jogador, Partida } from '@/types/game';

const NAIPES = ['copas', 'ouros', 'espadas', 'paus'];
const LETRAS_BURRO = 5;

export function criarBaralho(numeroJogadores: number): Carta[] {
  if (numeroJogadores < 2 || numeroJogadores > 4) throw new Error('A partida precisa ter de 2 a 4 jogadores.');
  return Array.from({ length: numeroJogadores }, (_, valor) => valor + 1)
    .flatMap((valor) => NAIPES.map((naipe) => ({ id: `${valor}-${naipe}`, valor: String(valor), naipe })));
}

export function embaralhar<T>(itens: T[], aleatorio: () => number = Math.random): T[] {
  const resultado = [...itens];
  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const destino = Math.floor(aleatorio() * (indice + 1));
    [resultado[indice], resultado[destino]] = [resultado[destino], resultado[indice]];
  }
  return resultado;
}

export function criarPartida(nomes: string[], aleatorio?: () => number, ids?: string[]): Partida {
  if (nomes.length < 2 || nomes.length > 4) throw new Error('Informe de 2 a 4 jogadores.');
  const cartas = embaralhar(criarBaralho(nomes.length), aleatorio);
  const jogadores: Jogador[] = nomes.map((nome, ordem) => ({
    id: ids?.[ordem] || `jogador-${ordem + 1}`,
    nome,
    ordem,
    mao: cartas.slice(ordem * 4, ordem * 4 + 4),
    letrasBurro: 0,
    conectado: true,
  }));
  return {
    id: `partida-${Date.now()}`,
    inicio: new Date().toISOString(),
    status: 'em-andamento',
    jogadores,
    jogadorAtual: 0,
    descarte: [],
    rodada: 1,
  };
}

export function proximoJogador(partida: Partida, ordem: number): number {
  for (let passo = 1; passo <= partida.jogadores.length; passo += 1) {
    const candidato = partida.jogadores[(ordem + passo) % partida.jogadores.length];
    if (candidato.letrasBurro < LETRAS_BURRO) return candidato.ordem;
  }
  return (ordem + 1) % partida.jogadores.length;
}

export function trocarCarta(partida: Partida, jogadorId: string, cartaId: string): Partida {
  if (partida.status !== 'em-andamento') throw new Error('A partida já terminou.');
  const jogador = partida.jogadores.find((item) => item.id === jogadorId);
  if (!jogador) throw new Error('Jogador não encontrado.');
  if (jogador.ordem !== partida.jogadorAtual) throw new Error('Não é a vez deste jogador.');
  const carta = jogador.mao.find((item) => item.id === cartaId);
  if (!carta) throw new Error('A carta não pertence à mão do jogador.');
  const destino = proximoJogador(partida, jogador.ordem);
  const cartaRecebida = partida.jogadores[destino].mao[0];
  const maoOrigem = [...jogador.mao.filter((item) => item.id !== cartaId), cartaRecebida];
  const maoDestino = [...partida.jogadores[destino].mao.filter((item) => item.id !== cartaRecebida.id), carta];
  const jogadores = partida.jogadores.map((item) => item.id === jogador.id
    ? { ...item, mao: maoOrigem }
    : item.id === partida.jogadores[destino].id
      ? { ...item, mao: maoDestino }
      : item);
  return { ...partida, jogadores, jogadorAtual: destino, rodada: partida.rodada + 1 };
}

export function completarJogador(partida: Partida, jogadorId: string): Partida {
  const jogador = partida.jogadores.find((item) => item.id === jogadorId);
  if (partida.status !== 'em-andamento') throw new Error('A partida já terminou.');
  if (!jogador || jogador.mao.length !== 4 || new Set(jogador.mao.map((carta) => carta.valor)).size !== 1) {
    throw new Error('O jogador precisa ter quatro cartas do mesmo valor.');
  }
  if (jogador.ordem !== partida.jogadorAtual) throw new Error('Não é a vez deste jogador.');
  const penalizados = partida.jogadores.filter((item) => item.id !== jogadorId && item.mao.some((carta) => carta.valor === jogador.mao[0].valor));
  const jogadores = partida.jogadores.map((item) => penalizados.some((penalizado) => penalizado.id === item.id)
    ? { ...item, letrasBurro: Math.min(LETRAS_BURRO, item.letrasBurro + 1) }
    : item);
  const restantes = jogadores.filter((item) => item.letrasBurro < LETRAS_BURRO);
  return restantes.length <= 1
    ? { ...partida, jogadores, status: 'finalizada', fim: new Date().toISOString(), motivoEncerramento: 'Um jogador permaneceu sem formar BURRO.' }
    : { ...partida, jogadores };
}
