import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';
import type { PluginListenerHandle } from '@capacitor/core';
import { DEFAULT_CHUNK_BYTES, joinMessage, splitMessage } from './protocol';
export { joinMessage, splitMessage } from './protocol';

export const SERVICE_UUID = '7c1a0001-5b1e-4f7a-9d3c-0a1b2c3d4e5f';
export const RX_UUID = '7c1a0002-5b1e-4f7a-9d3c-0a1b2c3d4e5f';
export const TX_UUID = '7c1a0003-5b1e-4f7a-9d3c-0a1b2c3d4e5f';
export const HEART_RATE_SERVICE_UUID = '180d';
export const HEART_RATE_MEASUREMENT_UUID = '2a37';

type Log = (message: string) => void;
export interface Achado {
  deviceId: string;
  name: string | null;
  rssi: number;
}

const decoder = new TextDecoder();
const fromBytes = (bytes: number[]): string => decoder.decode(new Uint8Array(bytes));
const listeners: PluginListenerHandle[] = [];
let initializedMode: 'central' | 'peripheral' | undefined;
let serviceRegistered = false;
let heartRateServiceRegistered = false;
const peerChunkBytes = new Map<string, number>();
const receivedChunks = new Map<string, { total: number; chunks: Map<number, string> }>();
const clientReceivedChunks = new Map<string, { total: number; chunks: Map<number, string> }>();

async function sendText(
  send: (bytes: number[]) => Promise<void>,
  text: string,
  chunkBytes = DEFAULT_CHUNK_BYTES,
  pacingMs = 0,
) {
  const chunks = splitMessage(text, chunkBytes);
  for (const [index, chunk] of chunks.entries()) {
    await send(Array.from(new TextEncoder().encode(chunk)));
    if (pacingMs > 0 && index < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, pacingMs));
    }
  }
}

function characteristicProperties(properties: Partial<Record<string, boolean>>) {
  return {
    broadcast: false,
    read: false,
    writeWithoutResponse: false,
    write: false,
    notify: false,
    indicate: false,
    authenticatedSignedWrites: false,
    extendedProperties: false,
    ...properties,
  };
}

async function saveListener(listener: Promise<PluginListenerHandle>) {
  listeners.push(await listener);
}

async function clearListeners() {
  for (const listener of listeners.splice(0)) await listener.remove();
}

async function preparePermissions(log: Log, mode: 'central' | 'peripheral') {
  if (initializedMode !== mode) {
    await BluetoothLowEnergy.initialize({ mode });
    initializedMode = mode;
  }
  const permissions = await BluetoothLowEnergy.requestPermissions();
  if (permissions.bluetooth === 'denied') {
    await BluetoothLowEnergy.openAppSettings();
    throw new Error('Permita o acesso ao Bluetooth nas configurações do celular.');
  }
  if (permissions.bluetooth !== 'granted') {
    throw new Error('Permita o acesso ao Bluetooth para continuar.');
  }
  const { enabled } = await BluetoothLowEnergy.isEnabled();
  if (!enabled) {
    await BluetoothLowEnergy.openBluetoothSettings();
    throw new Error('Ative o Bluetooth do celular e tente novamente.');
  }
  if (mode === 'peripheral') log('Preparando a sala Bluetooth.');
}

export async function iniciarAnfitriao(
  nome: string,
  log: Log,
  onMessage: (deviceId: string, text: string) => void,
  onDisconnect?: (deviceId: string) => void,
) {
  await clearListeners();
  await preparePermissions(log, 'peripheral');
  peerChunkBytes.clear();
  receivedChunks.clear();
  clientReceivedChunks.clear();
  try {
    await BluetoothLowEnergy.removeGattService({ service: SERVICE_UUID });
  } catch {
    // O serviço pode não existir ao iniciar o aplicativo.
  }
  serviceRegistered = false;
  await BluetoothLowEnergy.addGattService({
    service: SERVICE_UUID,
    characteristics: [
      {
        uuid: RX_UUID,
        properties: characteristicProperties({ write: true, writeWithoutResponse: true }),
        value: [],
      },
      {
        uuid: TX_UUID,
        properties: characteristicProperties({ read: true, notify: true }),
        value: [],
      },
    ],
  });
  serviceRegistered = true;
  await BluetoothLowEnergy.addGattService({
    service: HEART_RATE_SERVICE_UUID,
    characteristics: [
      {
        uuid: HEART_RATE_MEASUREMENT_UUID,
        properties: characteristicProperties({ notify: true }),
        value: [0, 0],
      },
    ],
  });
  heartRateServiceRegistered = true;
  await saveListener(BluetoothLowEnergy.addListener('centralConnected', () => {
    log('Um celular entrou na sala.');
  }));
  await saveListener(BluetoothLowEnergy.addListener('centralDisconnected', (event) => {
    onDisconnect?.(event.deviceId);
    log('Um celular saiu da sala.');
  }));
  await saveListener(BluetoothLowEnergy.addListener('gattCharacteristicWriteRequest', (event) => {
    if (event.characteristic.toLowerCase() !== RX_UUID) return;
    const messageText = joinMessage(fromBytes(event.value), event.deviceId, receivedChunks);
    if (!messageText) return;
    try {
      const message: unknown = JSON.parse(messageText);
      if (message && typeof message === 'object') {
        const data = message as { tipo?: unknown; payload?: { chunkBytes?: unknown } };
        if (data.tipo === 'CONSULTAR_SALA' && typeof data.payload?.chunkBytes === 'number') {
          const requested = data.payload.chunkBytes;
          if (Number.isInteger(requested) && requested >= DEFAULT_CHUNK_BYTES && requested <= 120 && requested % 3 === 0) {
            peerChunkBytes.set(event.deviceId, requested);
          }
        }
      }
    } catch {
      // O host de jogo valida o conteúdo tipado e ignora JSON inválido.
    }
    onMessage(event.deviceId, messageText);
  }));
  await BluetoothLowEnergy.startAdvertising({
    name: nome,
    services: [SERVICE_UUID],
    includeName: false,
  });
  log('Sala aberta. Aguardando outros celulares.');
}

export async function anfitriaoEnviar(text: string, deviceId?: string) {
  if (!deviceId) {
    await sendText((bytes) => BluetoothLowEnergy.notifyGattCharacteristicChanged({
      service: SERVICE_UUID,
      characteristic: TX_UUID,
      value: bytes,
    }), text, DEFAULT_CHUNK_BYTES, 20);
    return;
  }
  await sendText((bytes) => BluetoothLowEnergy.notifyGattCharacteristicChanged({
    service: SERVICE_UUID,
    characteristic: TX_UUID,
    value: bytes,
    deviceId,
  }), text, peerChunkBytes.get(deviceId) ?? DEFAULT_CHUNK_BYTES, 20);
}

export async function procurarPartidas(
  log: Log,
  onFound: (device: Achado) => void,
  timeoutMs = 12000,
) {
  await clearListeners();
  await preparePermissions(log, 'central');
  await saveListener(BluetoothLowEnergy.addListener('deviceScanned', (event) => {
    onFound({
      deviceId: event.device.deviceId,
      name: event.device.name,
      rssi: event.device.rssi ?? -999,
    });
  }));
  try {
    await BluetoothLowEnergy.startScan({ services: [SERVICE_UUID], timeout: timeoutMs });
  } catch {
    throw new Error('Não foi possível procurar celulares próximos. Verifique o Bluetooth e tente novamente.');
  }
  log('Procurando celulares próximos.');
}

export async function entrarNaPartida(
  deviceId: string,
  log: Log,
  onMessage: (text: string) => void,
  onDisconnect: () => void,
) {
  await BluetoothLowEnergy.stopScan();
  await clearListeners();
  try {
    await BluetoothLowEnergy.connect({ deviceId });
  } catch {
    throw new Error('Não foi possível conectar ao anfitrião. Confirme que a sala ainda está aberta.');
  }
  try {
    await BluetoothLowEnergy.discoverServices({ deviceId });
  } catch {
    throw new Error('O anfitrião foi encontrado, mas não respondeu à descoberta da sala.');
  }
  await saveListener(BluetoothLowEnergy.addListener('characteristicChanged', (event) => {
    if (event.characteristic.toLowerCase() !== TX_UUID) return;
    const message = joinMessage(fromBytes(event.value), deviceId, clientReceivedChunks);
    if (message) onMessage(message);
  }));
  await saveListener(BluetoothLowEnergy.addListener('deviceDisconnected', (event) => {
    if (event.deviceId !== deviceId) return;
    log('A conexão com a sala foi encerrada.');
    onDisconnect();
  }));
  try {
    await BluetoothLowEnergy.startCharacteristicNotifications({
      deviceId,
      service: SERVICE_UUID,
      characteristic: TX_UUID,
    });
  } catch {
    throw new Error('O anfitrião foi encontrado, mas não foi possível ativar a resposta da sala.');
  }
  log('Conectado à sala.');
}

export async function clienteEnviar(deviceId: string, text: string) {
  await sendText((bytes) => BluetoothLowEnergy.writeCharacteristic({
    deviceId,
    service: SERVICE_UUID,
    characteristic: RX_UUID,
    value: bytes,
    type: 'withResponse',
  }), text, peerChunkBytes.get(deviceId) ?? DEFAULT_CHUNK_BYTES);
}

export async function encerrar(deviceId?: string) {
  await clearListeners();
  initializedMode = undefined;
  try { await BluetoothLowEnergy.stopScan(); } catch { /* A busca pode já ter terminado. */ }
  try { await BluetoothLowEnergy.stopAdvertising(); } catch { /* O anúncio pode não estar ativo. */ }
  if (serviceRegistered) {
    try { await BluetoothLowEnergy.removeGattService({ service: SERVICE_UUID }); } catch { /* O serviço pode já ter sido removido. */ }
    serviceRegistered = false;
  }
  if (heartRateServiceRegistered) {
    try { await BluetoothLowEnergy.removeGattService({ service: HEART_RATE_SERVICE_UUID }); } catch { /* O serviço pode já ter sido removido. */ }
    heartRateServiceRegistered = false;
  }
  if (deviceId) {
    try { await BluetoothLowEnergy.disconnect({ deviceId }); } catch { /* A conexão pode já estar encerrada. */ }
    peerChunkBytes.delete(deviceId);
    receivedChunks.delete(deviceId);
    clientReceivedChunks.delete(deviceId);
  } else {
    peerChunkBytes.clear();
    receivedChunks.clear();
    clientReceivedChunks.clear();
  }
}
