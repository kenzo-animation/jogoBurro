import type { MensagemBluetooth, TipoMensagem } from '@/types/bluetooth';

export interface BluetoothTransport {
  papel: 'host' | 'cliente';
  conectar(): Promise<void>;
  desconectar(): Promise<void>;
  enviar<T>(mensagem: MensagemBluetooth<T>): Promise<void>;
  aoReceber(callback: (mensagem: MensagemBluetooth) => void): void;
}

export function criarMensagem<T>(tipo: TipoMensagem, partidaId: string, jogadorId: string, payload: T): MensagemBluetooth<T> {
  return { tipo, partidaId, jogadorId, payload, enviadoEm: new Date().toISOString() };
}
