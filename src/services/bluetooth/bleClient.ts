import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';
import type { PluginListenerHandle } from '@capacitor/core';
import { chunkBytesForMtu, DEFAULT_CHUNK_BYTES, joinMessage, splitMessage } from './protocol';
import { RX_UUID, SERVICE_UUID, TX_UUID } from './blePoc';
export { joinMessage, splitMessage } from './protocol';

export interface BluetoothClientDiscovery {
  deviceId: string;
  name: string | null;
  rssi: number;
}

async function withTimeout<T>(operation: Promise<T>, message: string, timeoutMs = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class BluetoothClientTransport {
  private initialized = false;
  private scanning = false;
  private connected = false;
  private deviceId?: string;
  private chunkBytes = DEFAULT_CHUNK_BYTES;
  private onMessage?: (deviceId: string, texto: string) => void;
  private onDisconnect?: (deviceId: string) => void;
  private scanTimer?: ReturnType<typeof setTimeout>;
  private finishScan?: () => void;
  private scanListener?: PluginListenerHandle;
  private readonly listeners: PluginListenerHandle[] = [];
  private readonly pending = new Map<string, { total: number; chunks: Map<number, string> }>();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await BluetoothLowEnergy.initialize({ mode: 'central' });
    const permissions = await BluetoothLowEnergy.requestPermissions();
    if (permissions.bluetooth !== 'granted') {
      throw new Error('Permita o acesso ao Bluetooth para procurar uma sala.');
    }
    const { enabled } = await BluetoothLowEnergy.isEnabled();
    if (!enabled) throw new Error('Ative o Bluetooth do celular e tente novamente.');
    this.initialized = true;
  }

  async isEnabled(): Promise<boolean> {
    await this.initialize();
    const result = await BluetoothLowEnergy.isEnabled();
    return result.enabled;
  }

  async scan(onDiscovery: (device: BluetoothClientDiscovery) => void): Promise<void> {
    await this.initialize();
    if (this.scanning) return;
    this.scanning = true;
    this.scanListener = await BluetoothLowEnergy.addListener('deviceScanned', (result) => {
      if (!this.scanning) return;
      onDiscovery({
        deviceId: result.device.deviceId,
        name: result.device.name,
        rssi: result.device.rssi ?? -999,
      });
    });
    try {
      await BluetoothLowEnergy.startScan({ services: [SERVICE_UUID], timeout: 12000 });
      await new Promise<void>((resolve) => {
        this.finishScan = resolve;
        this.scanTimer = setTimeout(resolve, 12500);
      });
    } finally {
      await this.stopScan();
    }
  }

  async stopScan(): Promise<void> {
    this.scanning = false;
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = undefined;
    this.finishScan?.();
    this.finishScan = undefined;
    await this.scanListener?.remove();
    this.scanListener = undefined;
    try {
      await BluetoothLowEnergy.stopScan();
    } catch {
      // O scan pode já ter terminado pelo timeout nativo.
    }
  }

  async connect(
    deviceId: string,
    onMessage: (deviceId: string, texto: string) => void,
    onDisconnect: (deviceId: string) => void,
  ): Promise<number> {
    await this.initialize();
    await this.stopScan();
    this.deviceId = deviceId;
    this.onMessage = onMessage;
    this.onDisconnect = onDisconnect;
    this.listeners.push(await BluetoothLowEnergy.addListener('characteristicChanged', (event) => {
      if (event.deviceId !== this.deviceId || event.characteristic.toLowerCase() !== TX_UUID) return;
      const text = joinMessage(new TextDecoder().decode(new Uint8Array(event.value)), deviceId, this.pending);
      if (text) this.onMessage?.(deviceId, text);
    }));
    this.listeners.push(await BluetoothLowEnergy.addListener('deviceDisconnected', (event) => {
      if (event.deviceId !== this.deviceId) return;
      this.connected = false;
      this.deviceId = undefined;
      this.pending.delete(deviceId);
      onDisconnect(deviceId);
    }));
    try {
      await withTimeout(
        BluetoothLowEnergy.connect({ deviceId }),
        'O celular não respondeu à conexão. Tente novamente.',
      );
      try {
        const mtuResult = await withTimeout(
          BluetoothLowEnergy.requestMtu({ deviceId, mtu: 185 }),
          'A negociação de velocidade expirou.',
          3000,
        );
        this.chunkBytes = chunkBytesForMtu(mtuResult.mtu);
      } catch {
        this.chunkBytes = DEFAULT_CHUNK_BYTES;
      }
      await withTimeout(
        BluetoothLowEnergy.discoverServices({ deviceId }),
        'Não foi possível encontrar a sala neste celular.',
      );
      await withTimeout(
        BluetoothLowEnergy.startCharacteristicNotifications({
          deviceId,
          service: SERVICE_UUID,
          characteristic: TX_UUID,
        }),
        'Não foi possível ativar a comunicação com a sala.',
      );
      this.connected = true;
      return this.chunkBytes;
    } catch (error) {
      this.connected = false;
      this.deviceId = undefined;
      this.onMessage = undefined;
      this.onDisconnect = undefined;
      for (const listener of this.listeners.splice(0)) await listener.remove();
      try {
        await BluetoothLowEnergy.disconnect({ deviceId });
      } catch {
        // A tentativa pode ter falhado antes de conectar.
      }
      throw error;
    }
  }

  async enviar(texto: string): Promise<void> {
    if (!this.deviceId || !this.connected) {
      throw new Error('O dispositivo Bluetooth não está conectado.');
    }
    for (const chunk of splitMessage(texto, this.chunkBytes)) {
      const bytes = new TextEncoder().encode(chunk);
      await BluetoothLowEnergy.writeCharacteristic({
        deviceId: this.deviceId,
        service: SERVICE_UUID,
        characteristic: RX_UUID,
        value: Array.from(bytes),
        type: 'withResponse',
      });
    }
  }

  async desconectar(): Promise<void> {
    if (this.deviceId) {
      try {
        await BluetoothLowEnergy.disconnect({ deviceId: this.deviceId });
      } finally {
        this.connected = false;
        this.deviceId = undefined;
      }
    }
    this.onMessage = undefined;
    this.onDisconnect = undefined;
    this.chunkBytes = DEFAULT_CHUNK_BYTES;
    this.pending.clear();
    for (const listener of this.listeners.splice(0)) await listener.remove();
  }
}
