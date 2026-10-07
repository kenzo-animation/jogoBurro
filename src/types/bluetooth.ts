export type TipoMensagem = 'SALA_ATUALIZADA' | 'SOLICITAR_ENTRADA' | 'RESPOSTA_ENTRADA' | 'INICIAR_PARTIDA' | 'JOGADA' | 'TROCA_REALIZADA' | 'JOGADOR_COMPLETOU' | 'PARTIDA_FINALIZADA' | 'RECONEXAO';

export interface PayloadsMensagem {
  SALA_ATUALIZADA: { jogadores: Array<{ id: string; nome: string; ordem: number; conectado: boolean }>; aceita: boolean };
  SOLICITAR_ENTRADA: { nome: string };
  RESPOSTA_ENTRADA: { aceita: boolean; motivo?: string; jogadorId?: string };
  INICIAR_PARTIDA: { jogadores: string[] };
  JOGADA: { cartaId: string };
  TROCA_REALIZADA: {
    jogadorAtual: string;
    mao: import('@/types/game').Carta[];
    rodada: number;
    jogadores: Array<{ id: string; nome: string; ordem: number; letrasBurro: number; conectado: boolean }>;
  };
  JOGADOR_COMPLETOU: { jogadorId: string };
  PARTIDA_FINALIZADA: { vencedor?: string; penalizado?: string; motivo: string };
  RECONEXAO: { ultimoEstado?: number };
}

export type MensagemBluetooth<Tipo extends TipoMensagem = TipoMensagem> = {
  [Chave in Tipo]: { tipo: Chave; partidaId: string; jogadorId: string; payload: PayloadsMensagem[Chave]; enviadoEm: string }
}[Tipo];

export function criarMensagem<Tipo extends TipoMensagem>(tipo: Tipo, partidaId: string, jogadorId: string, payload: PayloadsMensagem[Tipo]): MensagemBluetooth<Tipo> {
  return { tipo, partidaId, jogadorId, payload, enviadoEm: new Date().toISOString() } as MensagemBluetooth<Tipo>;
}

export function serializarMensagem<Tipo extends TipoMensagem>(mensagem: MensagemBluetooth<Tipo>): string {
  return JSON.stringify(mensagem);
}

const TIPOS: TipoMensagem[] = ['SALA_ATUALIZADA', 'SOLICITAR_ENTRADA', 'RESPOSTA_ENTRADA', 'INICIAR_PARTIDA', 'JOGADA', 'TROCA_REALIZADA', 'JOGADOR_COMPLETOU', 'PARTIDA_FINALIZADA', 'RECONEXAO'];

function registro(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === 'object';
}

function payloadValido(tipo: TipoMensagem, payload: unknown): boolean {
  if (!registro(payload)) return false;
  if (tipo === 'SOLICITAR_ENTRADA') return typeof payload.nome === 'string' && payload.nome.trim().length > 0;
  if (tipo === 'JOGADA') return typeof payload.cartaId === 'string' && payload.cartaId.length > 0;
  if (tipo === 'JOGADOR_COMPLETOU') return typeof payload.jogadorId === 'string' && payload.jogadorId.length > 0;
  if (tipo === 'RECONEXAO') return payload.ultimoEstado === undefined || typeof payload.ultimoEstado === 'number';
  if (tipo === 'INICIAR_PARTIDA') return Array.isArray(payload.jogadores) && payload.jogadores.every((id) => typeof id === 'string');
  if (tipo === 'RESPOSTA_ENTRADA') return typeof payload.aceita === 'boolean' && (payload.motivo === undefined || typeof payload.motivo === 'string');
  if (tipo === 'PARTIDA_FINALIZADA') return typeof payload.motivo === 'string';
  if (tipo === 'SALA_ATUALIZADA') return Array.isArray(payload.jogadores) && typeof payload.aceita === 'boolean';
  if (tipo === 'TROCA_REALIZADA') {
    return typeof payload.jogadorAtual === 'string'
      && Array.isArray(payload.mao)
      && typeof payload.rodada === 'number'
      && Array.isArray(payload.jogadores)
      && payload.jogadores.every((jogador) => typeof jogador.id === 'string' && typeof jogador.nome === 'string' && typeof jogador.ordem === 'number' && typeof jogador.letrasBurro === 'number' && typeof jogador.conectado === 'boolean');
  }
  return false;
}

export function validarMensagem(valor: unknown): valor is MensagemBluetooth {
  if (!valor || typeof valor !== 'object') return false;
  const mensagem = valor as Partial<MensagemBluetooth>;
  return TIPOS.includes(mensagem.tipo as TipoMensagem)
    && typeof mensagem.partidaId === 'string' && mensagem.partidaId.length > 0
    && typeof mensagem.jogadorId === 'string' && mensagem.jogadorId.length > 0
    && typeof mensagem.enviadoEm === 'string'
    && !Number.isNaN(Date.parse(mensagem.enviadoEm))
    && 'payload' in mensagem
    && payloadValido(mensagem.tipo as TipoMensagem, mensagem.payload);
}

export function desserializarMensagem(texto: string): MensagemBluetooth | null {
  try {
    const valor: unknown = JSON.parse(texto);
    return validarMensagem(valor) ? valor : null;
  } catch {
    return null;
  }
}
