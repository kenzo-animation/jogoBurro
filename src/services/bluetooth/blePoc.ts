import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';
import type { PluginListenerHandle } from '@capacitor/core';

export const SERVICE_UUID = '7c1a0001-5b1e-4f7a-9d3c-0a1b2c3d4e5f';
export const RX_UUID = '7c1a0002-5b1e-4f7a-9d3c-0a1b2c3d4e5f';
export const TX_UUID = '7c1a0003-5b1e-4f7a-9d3c-0a1b2c3d4e5f';

type Log = (message: string) => void;
export interface Achado {
  deviceId: string;
  name: string | null;
  rssi: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBytes = (text: string): number[] => Array.from(encoder.encode(text));
const fromBytes = (bytes: number[]): string => decoder.decode(new Uint8Array(bytes));
const CHUNK_BYTES = 120;
const receivedChunks = new Map<string, { total: number; chunks: string[] }>();
const listeners: PluginListenerHandle[] = [];
let initializedMode: 'central' | 'peripheral' | undefined;
let serviceRegistered = false;

function toBase64(bytes: number[]): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function fromBase64(value: string): number[] {
  return Array.from(atob(value), (character) => character.charCodeAt(0));
}

function splitMessage(text: string): string[] {
  const bytes = toBytes(text);
  const total = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
  return Array.from({ length: total }, (_, index) => {
    const chunk = bytes.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES);
    return `BURRO1/${index}/${total}/${toBase64(chunk)}`;
  });
}

function joinMessage(deviceId: string, text: string): string | null {
  const parts = text.split('/');
  if (parts.length !== 4 || parts[0] !== 'BURRO1') return text;
  const index = Number(parts[1]);
  const total = Number(parts[2]);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total || total > 256) return null;

  const current = receivedChunks.get(deviceId) ?? { total, chunks: [] };
  if (current.total !== total) receivedChunks.delete(deviceId);
  const chunks = receivedChunks.get(deviceId) ?? { total, chunks: [] };
  chunks.chunks[index] = parts[3];
  receivedChunks.set(deviceId, chunks);
  if (chunks.chunks.filter(Boolean).length !== total) return null;
  receivedChunks.delete(deviceId);
  return decoder.decode(new Uint8Array(chunks.chunks.flatMap(fromBase64)));
}

async function sendText(send: (bytes: number[]) => Promise<void>, text: string) {
  for (const chunk of splitMessage(text)) await send(toBytes(chunk));
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
  await saveListener(BluetoothLowEnergy.addListener('centralConnected', () => {
    log('Um celular entrou na sala.');
  }));
  await saveListener(BluetoothLowEnergy.addListener('centralDisconnected', (event) => {
    onDisconnect?.(event.deviceId);
    log('Um celular saiu da sala.');
  }));
  await saveListener(BluetoothLowEnergy.addListener('gattCharacteristicWriteRequest', (event) => {
    if (event.characteristic.toLowerCase() !== RX_UUID) return;
    const message = joinMessage(event.deviceId, fromBytes(event.value));
    if (message) onMessage(event.deviceId, message);
  }));
  await BluetoothLowEnergy.startAdvertising({
    name: nome,
    services: [SERVICE_UUID],
    includeName: false,
  });
  log('Sala aberta. Aguardando outros celulares.');
}

export async function anfitriaoEnviar(text: string, deviceId?: string) {
  await sendText((bytes) => BluetoothLowEnergy.notifyGattCharacteristicChanged({
    service: SERVICE_UUID,
    characteristic: TX_UUID,
    value: bytes,
    deviceId,
  }), text);
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
  await BluetoothLowEnergy.connect({ deviceId });
  await BluetoothLowEnergy.discoverServices({ deviceId });
  await saveListener(BluetoothLowEnergy.addListener('characteristicChanged', (event) => {
    if (event.characteristic.toLowerCase() !== TX_UUID) return;
    const message = joinMessage(deviceId, fromBytes(event.value));
    if (message) onMessage(message);
  }));
  await saveListener(BluetoothLowEnergy.addListener('deviceDisconnected', (event) => {
    if (event.deviceId !== deviceId) return;
    log('A conexão com a sala foi encerrada.');
    onDisconnect();
  }));
  await BluetoothLowEnergy.startCharacteristicNotifications({
    deviceId,
    service: SERVICE_UUID,
    characteristic: TX_UUID,
  });
  log('Conectado à sala.');
}

export async function clienteEnviar(deviceId: string, text: string) {
  await sendText((bytes) => BluetoothLowEnergy.writeCharacteristic({
    deviceId,
    service: SERVICE_UUID,
    characteristic: RX_UUID,
    value: bytes,
    type: 'withResponse',
  }), text);
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
  if (deviceId) {
    try { await BluetoothLowEnergy.disconnect({ deviceId }); } catch { /* A conexão pode já estar encerrada. */ }
  }
  receivedChunks.clear();
}
