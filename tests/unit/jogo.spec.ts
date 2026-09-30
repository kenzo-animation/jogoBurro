import { describe, expect, it } from 'vitest';
import { completarJogador, criarBaralho, criarPartida, trocarCarta } from '@/domain/jogo';
import { gameStore } from '@/stores/game';

describe('motor do jogo Burro', () => {
  it('mantém o anfitrião na sala e adiciona vários dispositivos sem recriar a partida', () => {
    gameStore.criarSala('Ana');
    const idSala = gameStore.estado.sala?.id;

    expect(gameStore.estado.sala?.jogadores.map((jogador) => jogador.nome)).toEqual(['Ana']);
    expect(gameStore.adicionarJogador('Bia', 'device-bia')).toBe(true);
    expect(gameStore.adicionarJogador('Caio', 'device-caio')).toBe(true);
    expect(gameStore.adicionarJogador('Duda', 'device-duda')).toBe(true);
    expect(gameStore.adicionarJogador('Eli', 'device-eli')).toBe(false);
    expect(gameStore.adicionarJogador('Bia', 'device-bia')).toBe(false);
    expect(gameStore.estado.sala?.id).toBe(idSala);
    expect(gameStore.estado.sala?.jogadores.map((jogador) => jogador.nome)).toEqual(['Ana', 'Bia', 'Caio', 'Duda']);
    expect(gameStore.estado.partida).toBeNull();

    gameStore.iniciarPartida();
    expect(gameStore.estado.partida?.jogadores.map((jogador) => jogador.nome)).toEqual(['Ana', 'Bia', 'Caio', 'Duda']);
    expect(gameStore.adicionarJogador('Fê', 'device-fe')).toBe(false);
  });

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
    expect(atualizada.jogadores[0].mao).toHaveLength(4);
    expect(atualizada.jogadores[1].mao).toHaveLength(4);
    expect(() => trocarCarta(partida, 'jogador-2', carta.id)).toThrow('Não é a vez');
  });

  it('rejeita partida fora do limite e cartas que não pertencem à mão', () => {
    expect(() => criarPartida(['Ana'])).toThrow('2 a 4');
    const partida = criarPartida(['Ana', 'Bia']);
    expect(() => trocarCarta(partida, 'jogador-1', 'inexistente')).toThrow('não pertence');
  });

  it('aplica uma letra ao jogador que compartilha o valor do grupo completo', () => {
    const partida = criarPartida(['Ana', 'Bia']);
    const grupo = partida.jogadores[0].mao.map((carta, indice) => ({ ...carta, valor: '1', id: `grupo-${indice}` }));
    const ajustada = { ...partida, jogadores: [{ ...partida.jogadores[0], mao: grupo }, partida.jogadores[1]] };
    expect(completarJogador(ajustada, 'jogador-1').jogadores[1].letrasBurro).toBe(1);
  });

  it('não permite bater fora do turno e não coloca carta trocada no descarte', () => {
    const partida = criarPartida(['Ana', 'Bia']);
    const grupo = partida.jogadores[1].mao.map((carta, indice) => ({ ...carta, valor: '1', id: `grupo-${indice}` }));
    const ajustada = { ...partida, jogadores: [{ ...partida.jogadores[0] }, { ...partida.jogadores[1], mao: grupo }] };
    expect(() => completarJogador(ajustada, 'jogador-2')).toThrow('Não é a vez');
    const carta = partida.jogadores[0].mao[0];
    expect(trocarCarta(partida, 'jogador-1', carta.id).descarte).toEqual([]);
  });
});
