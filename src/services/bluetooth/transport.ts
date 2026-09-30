import { criarMensagem as criarMensagemTipada, type MensagemBluetooth, type TipoMensagem, type PayloadsMensagem } from '@/types/bluetooth';

export interface BluetoothTransport {
  papel: 'host' | 'cliente';
  conectar(): Promise<void>;
  desconectar(): Promise<void>;
  enviar<Tipo extends TipoMensagem>(mensagem: MensagemBluetooth<Tipo>): Promise<void>;
  aoReceber(callback: (mensagem: MensagemBluetooth) => void): void;
}

export function criarMensagem<Tipo extends TipoMensagem>(tipo: Tipo, partidaId: string, jogadorId: string, payload: PayloadsMensagem[Tipo]): MensagemBluetooth<Tipo> {
  return criarMensagemTipada(tipo, partidaId, jogadorId, payload);
}
