import { describe, expect, it } from 'vitest';
import { completarJogador, criarBaralho, criarPartida, trocarCarta } from '@/domain/jogo';

describe('motor do jogo Burro', () => {
  it('cria quatro naipes por valor e distribui quatro cartas', () => {
    const partida = criarPartida(['Ana', 'Bia', 'Caio'], () => 0.2);
    expect(criarBaralho(3)).toHaveLength(12);
    expect(partida.jogadores.every((jogador) => jogador.mao)).toBe(true);
    expect(partida.jogadores.map((jogador) => jogador.mao.length)).toEqual([4, 4, 4]);
  });

  it('valida turno e move a carta para o próximo jogador', () => {
    const partida = criarPartida(['Ana', 'Bia']);
    const carta = partida.jogadores[0].mao[0];
    const atualizada = trocarCarta(partida, 'jogador-1', carta.id);
    expect(atualizada.jogadorAtual).toBe(1);
    expect(atualizada.jogadores[1].mao).toContainEqual(carta);
    expect(() => trocarCarta(partida, 'jogador-2', carta.id)).toThrow('Não é a vez');
  });

  it('aplica uma letra ao jogador que compartilha o valor do grupo completo', () => {
    const partida = criarPartida(['Ana', 'Bia']);
    const grupo = partida.jogadores[0].mao.map((carta, indice) => ({ ...carta, valor: '1', id: `grupo-${indice}` }));
    const ajustada = { ...partida, jogadores: [{ ...partida.jogadores[0], mao: grupo }, partida.jogadores[1]] };
    expect(completarJogador(ajustada, 'jogador-1').jogadores[1].letrasBurro).toBe(1);
  });
});
