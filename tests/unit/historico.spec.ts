import { beforeEach, describe, expect, it } from 'vitest';
import { criarPartida } from '@/domain/jogo';
import { historicoService, registrarPartida } from '@/services/database/historico';

describe('histórico local', () => {
  beforeEach(() => historicoService.limpar());

  it('salva, lista, busca, exclui e limpa partidas', () => {
    const partida = { ...criarPartida(['Ana', 'Bia']), status: 'cancelada' as const, fim: new Date().toISOString() };
    const registro = registrarPartida(partida);

    expect(historicoService.listar()).toHaveLength(1);
    expect(historicoService.buscar(registro.id)?.participantes).toHaveLength(2);
    historicoService.excluir(registro.id);
    expect(historicoService.listar()).toHaveLength(0);

    registrarPartida(partida);
    historicoService.limpar();
    expect(historicoService.listar()).toEqual([]);
  });

  it('não atribui vencedor a partida cancelada', () => {
    const partida = { ...criarPartida(['Ana', 'Bia']), status: 'interrompida' as const };
    expect(registrarPartida(partida).vencedor).toBeUndefined();
  });
});
