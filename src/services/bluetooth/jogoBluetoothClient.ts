import {
  desserializarMensagem,
  serializarMensagem,
  type MensagemBluetooth,
} from '@/types/bluetooth';
import {
  BluetoothClientTransport,
  type BluetoothClientDiscovery,
} from './bleClient';

export interface JogoBluetoothClientCallbacks {
  onMessage: (mensagem: MensagemBluetooth) => void;
  onDisconnect: () => void;
  onError: (mensagem: string) => void;
}

let clienteAtivo: JogoBluetoothClient | undefined;

export function registrarCliente(cliente: JogoBluetoothClient): void {
  clienteAtivo = cliente;
}

export function clienteAtivoAtual(): JogoBluetoothClient | undefined {
  return clienteAtivo;
}

export class JogoBluetoothClient {
  private readonly transport = new BluetoothClientTransport();
  private readonly callbacks: JogoBluetoothClientCallbacks;
  private deviceId?: string;
  private connected = false;

  constructor(callbacks: JogoBluetoothClientCallbacks) {
    this.callbacks = callbacks;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async isEnabled(): Promise<boolean> {
    return this.transport.isEnabled();
  }

  async scan(
    onDiscovery: (device: BluetoothClientDiscovery) => void,
  ): Promise<void> {
    await this.transport.scan(onDiscovery);
  }

  async stopScan(): Promise<void> {
    await this.transport.stopScan();
  }

  async connect(deviceId: string, partidaId: string, jogadorId: string): Promise<void> {
    this.deviceId = deviceId;
    this.partidaId = partidaId;
    this.jogadorId = jogadorId;
    this.connected = false;
    await this.transport.connect(
      deviceId,
      (remoteDeviceId, texto) => this.receber(remoteDeviceId, texto),
      () => {
        this.connected = false;
        this.deviceId = undefined;
        this.callbacks.onDisconnect();
      },
    );
    this.connected = true;
  }

  private partidaId?: string;
  private jogadorId?: string;

  async enviar(mensagem: MensagemBluetooth): Promise<void> {
    if (!this.connected || !this.deviceId) {
      throw new Error('O cliente Bluetooth não está conectado.');
    }
    await this.transport.enviar(serializarMensagem(mensagem));
  }

  async solicitarEntrada(nome: string): Promise<void> {
    if (!this.partidaId || !this.jogadorId) {
      throw new Error('A sessão da partida não está inicializada.');
    }
    await this.enviar({
      tipo: 'SOLICITAR_ENTRADA',
      partidaId: this.partidaId,
      jogadorId: this.jogadorId,
      payload: { nome },
      enviadoEm: new Date().toISOString(),
    });
  }

  async reconectar(): Promise<void> {
    if (!this.deviceId || !this.partidaId || !this.jogadorId) {
      throw new Error('Não há uma sessão Bluetooth para reconectar.');
    }
    await this.enviar({
      tipo: 'RECONEXAO',
      partidaId: this.partidaId,
      jogadorId: this.jogadorId,
      payload: {},
      enviadoEm: new Date().toISOString(),
    });
  }

  async jogar(cartaId: string): Promise<void> {
    if (!this.partidaId || !this.jogadorId) {
      throw new Error('A sessão da partida não está inicializada.');
    }
    await this.enviar({
      tipo: 'JOGADA',
      partidaId: this.partidaId,
      jogadorId: this.jogadorId,
      payload: { cartaId },
      enviadoEm: new Date().toISOString(),
    });
  }

  async completar(): Promise<void> {
    if (!this.partidaId || !this.jogadorId) {
      throw new Error('A sessão da partida não está inicializada.');
    }
    await this.enviar({
      tipo: 'JOGADOR_COMPLETOU',
      partidaId: this.partidaId,
      jogadorId: this.jogadorId,
      payload: { jogadorId: this.jogadorId },
      enviadoEm: new Date().toISOString(),
    });
  }

  async desconectar(): Promise<void> {
    this.connected = false;
    await this.transport.desconectar();
  }

  private receber(deviceId: string, texto: string): void {
    if (deviceId !== this.deviceId) return;
    const mensagem = desserializarMensagem(texto);
    if (!mensagem) {
      this.callbacks.onError('Mensagem Bluetooth inválida.');
      return;
    }
    if (mensagem.partidaId !== this.partidaId) return;
    this.callbacks.onMessage(mensagem);
  }
}
