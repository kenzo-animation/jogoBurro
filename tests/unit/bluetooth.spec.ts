import { describe, expect, it } from 'vitest';
import { desserializarMensagem, serializarMensagem, validarMensagem } from '@/types/bluetooth';

describe('contrato Bluetooth', () => {
  it('aceita mensagens completas e rejeita pacotes sem identidade', () => {
    const mensagem = { tipo: 'JOGADA' as const, partidaId: 'partida-1', jogadorId: 'jogador-1', payload: { cartaId: '1-copas' }, enviadoEm: new Date().toISOString() };
    expect(desserializarMensagem(serializarMensagem(mensagem))).toEqual(mensagem);
    expect(validarMensagem({ tipo: 'JOGADA', payload: {} })).toBe(false);
    expect(validarMensagem({ ...mensagem, payload: {} })).toBe(false);
    expect(validarMensagem({ ...mensagem, enviadoEm: 'agora' })).toBe(false);
    expect(desserializarMensagem('{invalido')).toBeNull();
  });
});
