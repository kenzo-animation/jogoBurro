export type TipoMensagem =
  | 'SALA_ATUALIZADA'
  | 'SOLICITAR_ENTRADA'
  | 'RESPOSTA_ENTRADA'
  | 'INICIAR_PARTIDA'
  | 'JOGADA'
  | 'TROCA_REALIZADA'
  | 'JOGADOR_COMPLETOU'
  | 'PARTIDA_FINALIZADA'
  | 'RECONEXAO';

export interface MensagemBluetooth<T = unknown> {
  tipo: TipoMensagem;
  partidaId: string;
  jogadorId: string;
  payload: T;
  enviadoEm: string;
}

export function serializarMensagem<T>(mensagem: MensagemBluetooth<T>): string {
  return JSON.stringify(mensagem);
}

export function validarMensagem(valor: unknown): valor is MensagemBluetooth {
  if (!valor || typeof valor !== 'object') return false;
  const mensagem = valor as Partial<MensagemBluetooth>;
  const tipos: TipoMensagem[] = ['SALA_ATUALIZADA', 'SOLICITAR_ENTRADA', 'RESPOSTA_ENTRADA', 'INICIAR_PARTIDA', 'JOGADA', 'TROCA_REALIZADA', 'JOGADOR_COMPLETOU', 'PARTIDA_FINALIZADA', 'RECONEXAO'];
  return tipos.includes(mensagem.tipo as TipoMensagem)
    && typeof mensagem.partidaId === 'string'
    && typeof mensagem.jogadorId === 'string'
    && typeof mensagem.enviadoEm === 'string'
    && 'payload' in mensagem;
}

export function desserializarMensagem(texto: string): MensagemBluetooth | null {
  try {
    const valor: unknown = JSON.parse(texto);
    return validarMensagem(valor) ? valor : null;
  } catch {
    return null;
  }
}
