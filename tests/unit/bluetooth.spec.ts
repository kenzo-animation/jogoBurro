import { describe, expect, it } from 'vitest';
import { chunkBytesForMtu, joinMessage, splitMessage } from '../../src/services/bluetooth/protocol';
import { desserializarMensagem, serializarMensagem, validarMensagem } from '../../src/types/bluetooth';

describe('contrato Bluetooth', () => {
  it('aceita mensagens completas e rejeita pacotes sem identidade', () => {
    const mensagem = { tipo: 'JOGADA' as const, partidaId: 'partida-1', jogadorId: 'jogador-1', payload: { cartaId: '1-copas' }, enviadoEm: new Date().toISOString() };
    const consultaSala = { tipo: 'CONSULTAR_SALA' as const, partidaId: 'partida-1', jogadorId: 'jogador-1', payload: { chunkBytes: 120 }, enviadoEm: new Date().toISOString() };
    expect(desserializarMensagem(serializarMensagem(mensagem))).toEqual(mensagem);
    expect(validarMensagem(consultaSala)).toBe(true);
    expect(validarMensagem({ ...consultaSala, payload: { chunkBytes: 4 } })).toBe(false);
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

  it('codifica os fragmentos sem usar o separador do protocolo dentro do Base64', () => {
    const texto = JSON.stringify({
      tipo: 'TROCA_REALIZADA',
      valores: Array.from({ length: 80 }, (_, indice) => `carta-${indice}-♠`),
    });
    const pending = new Map<string, { total: number; chunks: Map<number, string> }>();
    const fragmentos = splitMessage(texto, 120);
    let reconstructed: string | null = null;

    expect(fragmentos.every((fragmento) => fragmento.split('/').length === 4)).toBe(true);
    for (const fragmento of fragmentos) {
      reconstructed = joinMessage(fragmento, 'device-1', pending) ?? reconstructed;
    }
    expect(reconstructed).toBe(texto);
  });

  it('continua aceitando fragmentos do protocolo anterior cujo Base64 continha barra', () => {
    const texto = '࠿';
    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(texto)));
    const pending = new Map<string, { total: number; chunks: Map<number, string> }>();

    expect(encoded).toContain('/');
    expect(joinMessage(`BURRO1/0/1/${encoded}`, 'device-1', pending)).toBe(texto);
  });

  it('mantém os pacotes dentro do MTU padrão e usa fragmentos maiores quando negociado', () => {
    const texto = JSON.stringify({ tipo: 'CONSULTAR_SALA', payload: { chunkBytes: 3 } });
    const pacotesPadrao = splitMessage(texto);
    const mtuNegociado = chunkBytesForMtu(185);
    const pacotesNegociados = splitMessage(texto, mtuNegociado);

    expect(chunkBytesForMtu(23)).toBe(3);
    expect(mtuNegociado).toBeGreaterThan(3);
    expect(Math.max(...pacotesPadrao.map((pacote) => new TextEncoder().encode(pacote).length))).toBeLessThanOrEqual(20);
    expect(pacotesNegociados.length).toBeLessThan(pacotesPadrao.length);
    expect(Math.max(...pacotesNegociados.map((pacote) => new TextEncoder().encode(pacote).length))).toBeLessThanOrEqual(182);
  });
});
