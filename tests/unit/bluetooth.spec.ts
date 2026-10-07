import { describe, expect, it } from 'vitest';
import { joinMessage, splitMessage } from '../../src/services/bluetooth/protocol';
import { desserializarMensagem, serializarMensagem, validarMensagem } from '../../src/types/bluetooth';

describe('contrato Bluetooth', () => {
  it('aceita mensagens completas e rejeita pacotes sem identidade', () => {
    const mensagem = { tipo: 'JOGADA' as const, partidaId: 'partida-1', jogadorId: 'jogador-1', payload: { cartaId: '1-copas' }, enviadoEm: new Date().toISOString() };
    expect(desserializarMensagem(serializarMensagem(mensagem))).toEqual(mensagem);
    expect(validarMensagem({ tipo: 'JOGADA', payload: {} })).toBe(false);
    expect(validarMensagem({ ...mensagem, payload: {} })).toBe(false);
    expect(validarMensagem({ ...mensagem, enviadoEm: 'agora' })).toBe(false);
    expect(desserializarMensagem('{invalido')).toBeNull();
  });

  it('reconstrói uma mensagem grande em qualquer ordem de fragmentos', () => {
    const texto = JSON.stringify({
      tipo: 'SALA_ATUALIZADA',
      partidaId: 'partida-1',
      jogadorId: 'jogador-1',
      payload: {
        jogadores: Array.from({ length: 20 }, (_, indice) => ({
          id: `jogador-${indice}`,
          nome: `Jogador ${indice}`,
          ordem: indice,
          conectado: true,
        })),
        aceita: true,
      },
      enviadoEm: new Date().toISOString(),
    });
    const pending = new Map<string, { total: number; chunks: Map<number, string> }>();
    const fragmentos = splitMessage(texto);

    expect(fragmentos.length).toBeGreaterThan(1);
    let reconstructed: string | null = null;
    for (const fragmento of [...fragmentos].reverse()) {
      reconstructed = joinMessage(fragmento, 'device-1', pending);
    }

    expect(reconstructed).toBe(texto);
    expect(desserializarMensagem(reconstructed!)).toMatchObject({
      tipo: 'SALA_ATUALIZADA',
      partidaId: 'partida-1',
    });
  });
});
