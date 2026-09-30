// src/services/bluetooth/blePoc.ts
// Prova de conceito (Fase 0): anfitrião (periférico) e cliente (central) trocando texto via BLE.
// Plugin: @capgo/capacitor-bluetooth-low-energy (versão maior = versão maior do Capacitor; modo periférico exige 8.2.0+)
 
import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';
import type { PluginListenerHandle } from '@capacitor/core';
 
// TROQUE estes UUIDs pelos seus (gere com crypto.randomUUID() e guarde no DECISOES.md)
export const SERVICE_UUID = '7c1a0001-5b1e-4f7a-9d3c-0a1b2c3d4e5f';
export const RX_UUID = '7c1a0002-5b1e-4f7a-9d3c-0a1b2c3d4e5f'; // cliente -> anfitrião (write)
export const TX_UUID = '7c1a0003-5b1e-4f7a-9d3c-0a1b2c3d4e5f'; // anfitrião -> cliente (notify)
 
type Log = (msg: string) => void;
export interface Achado { deviceId: string; name: string | null; rssi: number }
 
const enc = new TextEncoder();
const dec = new TextDecoder();
const toBytes = (s: string): number[] => Array.from(enc.encode(s));
const fromBytes = (b: number[]): string => dec.decode(new Uint8Array(b));
const CHUNK_BYTES = 120;
const partesRecebidas = new Map<string, { total: number; partes: string[] }>();

function base64(bytes: number[]): string {
  let texto = '';
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto);
}

function bytesBase64(texto: string): number[] {
  return Array.from(atob(texto), (caractere) => caractere.charCodeAt(0));
}

function dividirMensagem(texto: string): string[] {
  const bytes = toBytes(texto);
  const total = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
  return Array.from({ length: total }, (_, indice) => {
    const parte = bytes.slice(indice * CHUNK_BYTES, (indice + 1) * CHUNK_BYTES);
    return `BURRO1/${indice}/${total}/${base64(parte)}`;
  });
}

function juntarMensagem(deviceId: string, texto: string): string | null {
  const partes = texto.split('/');
  if (partes.length !== 4 || partes[0] !== 'BURRO1') return texto;
  const indice = Number(partes[1]);
  const total = Number(partes[2]);
  if (!Number.isInteger(indice) || !Number.isInteger(total) || indice < 0 || indice >= total || total > 256) return null;
  const atual = partesRecebidas.get(deviceId) || { total, partes: [] };
  if (atual.total !== total) partesRecebidas.delete(deviceId);
  const acumulado = partesRecebidas.get(deviceId) || { total, partes: [] };
  acumulado.total = total;
  acumulado.partes[indice] = partes[3];
  partesRecebidas.set(deviceId, acumulado);
  if (acumulado.partes.filter(Boolean).length !== total) return null;
  partesRecebidas.delete(deviceId);
  return fromBytes(acumulado.partes.flatMap(bytesBase64));
}

async function enviarTexto(enviar: (bytes: number[]) => Promise<void>, texto: string) {
  for (const parte of dividirMensagem(texto)) await enviar(toBytes(parte));
}
 
// O plugin espera todas as propriedades; este helper preenche o que não for informado.
const props = (p: Partial<Record<string, boolean>>) => ({
  broadcast: false, read: false, writeWithoutResponse: false, write: false,
  notify: false, indicate: false, authenticatedSignedWrites: false, extendedProperties: false,
  ...p,
});
 
const handles: PluginListenerHandle[] = [];
let modoInicializado: 'central' | 'peripheral' | undefined;
let servicoRegistrado = false;
const guardar = async (p: Promise<PluginListenerHandle>) => { handles.push(await p); };
 
async function limparListeners() {
  for (const handle of handles.splice(0)) {
    try { await handle.remove(); } catch { /* listener já removido pelo sistema */ }
  }
}

async function prepararPermissoes(log: Log, modo: 'central' | 'peripheral') {
  if (modoInicializado !== modo) {
    await BluetoothLowEnergy.initialize({ mode: modo });
    modoInicializado = modo;
  }
  const st = await BluetoothLowEnergy.requestPermissions();
  log(`Permissões: bluetooth=${st.bluetooth} location=${st.location}`);
  if (st.bluetooth === 'denied') {
    await BluetoothLowEnergy.openAppSettings();
    throw new Error('Permissão Bluetooth negada. Ative Bluetooth próximo/dispositivos nas configurações do app.');
  }
  if (st.bluetooth !== 'granted') throw new Error('Aceite a permissão de Bluetooth para continuar.');
  if (st.location === 'prompt') log('Localização ainda não foi concedida. No Android 12+ isso não impede BLE; em Android antigo, permita localização para procurar dispositivos.');
  if (st.location === 'denied') log('Localização negada. Ela só é necessária para scan em versões antigas do Android.');
  const { enabled } = await BluetoothLowEnergy.isEnabled();
  if (!enabled) {
    log('Bluetooth desligado: peça ao usuário para ligar.');
    await BluetoothLowEnergy.openBluetoothSettings();
    throw new Error('Bluetooth está desligado. Ative-o e toque novamente em procurar.');
  }
}
 
// ---------------- ANFITRIÃO ----------------
 
export async function iniciarAnfitriao(
  nome: string,
  log: Log,
  onMensagem: (deviceId: string, texto: string) => void,
  onDesconectou?: (deviceId: string) => void,
) {
  await limparListeners();
  await prepararPermissoes(log, 'peripheral');
 
  try { await BluetoothLowEnergy.removeGattService({ service: SERVICE_UUID }); } catch { /* serviço pode não existir após reinício do app */ }
  servicoRegistrado = false;
  await BluetoothLowEnergy.addGattService({
    service: SERVICE_UUID,
    characteristics: [
      { uuid: RX_UUID, properties: props({ write: true, writeWithoutResponse: true }), value: [] },
      { uuid: TX_UUID, properties: props({ read: true, notify: true }), value: [] },
    ],
  });
  servicoRegistrado = true;
 
  await guardar(BluetoothLowEnergy.addListener('centralConnected', (e) => log(`Cliente conectou: ${e.deviceId}`)));
  await guardar(BluetoothLowEnergy.addListener('centralDisconnected', (e) => {
    log(`Cliente desconectou: ${e.deviceId}`);
    onDesconectou?.(e.deviceId);
  }));
  await guardar(BluetoothLowEnergy.addListener('gattCharacteristicWriteRequest', (e) => {
    if (e.characteristic.toLowerCase() !== RX_UUID) return;
    const mensagem = juntarMensagem(e.deviceId, fromBytes(e.value));
    if (mensagem) onMensagem(e.deviceId, mensagem);
  }));
 
  await BluetoothLowEnergy.startAdvertising({ name: nome, services: [SERVICE_UUID], includeName: true });
  log(`Anunciando partida "${nome}"`);
}
 
/** Envia para um cliente específico (deviceId) ou, sem deviceId, para todos os inscritos. */
export async function anfitriaoEnviar(texto: string, deviceId?: string) {
  await enviarTexto((bytes) => BluetoothLowEnergy.notifyGattCharacteristicChanged({
    service: SERVICE_UUID, characteristic: TX_UUID, value: bytes, deviceId,
  }), texto);
}
 
// ---------------- CLIENTE ----------------
 
export async function procurarPartidas(log: Log, onAchado: (d: Achado) => void, timeoutMs = 8000) {
  await limparListeners();
  await prepararPermissoes(log, 'central');
  await guardar(BluetoothLowEnergy.addListener('deviceScanned', (e) => onAchado({
    deviceId: e.device.deviceId,
    name: e.device.name,
    rssi: e.device.rssi ?? -999,
  })));
  try {
    await BluetoothLowEnergy.startScan({ services: [SERVICE_UUID], timeout: timeoutMs });
  } catch (erro) {
    throw new Error(`Não foi possível procurar partidas. Verifique Bluetooth e, em Android antigo, a localização. Detalhe: ${String(erro)}`);
  }
  log('Procurando partidas...');
}
 
export async function entrarNaPartida(
  deviceId: string,
  log: Log,
  onMensagem: (texto: string) => void,
  onDesconectou: () => void,
) {
  await BluetoothLowEnergy.stopScan();
  await limparListeners();
  await BluetoothLowEnergy.connect({ deviceId });
  await BluetoothLowEnergy.discoverServices({ deviceId });
 
  try {
    const r = await BluetoothLowEnergy.requestMtu({ deviceId, mtu: 185 });
    log(`MTU negociado: ${r.mtu}`);
  } catch (e) {
    log(`MTU não negociado (segue com o padrão): ${String(e)}`);
  }
 
  await guardar(BluetoothLowEnergy.addListener('characteristicChanged', (e) => {
    if (e.characteristic.toLowerCase() !== TX_UUID) return;
    const mensagem = juntarMensagem(deviceId, fromBytes(e.value));
    if (mensagem) onMensagem(mensagem);
  }));
  await guardar(BluetoothLowEnergy.addListener('deviceDisconnected', (e) => {
    if (e.deviceId === deviceId) { log('Desconectado do anfitrião'); onDesconectou(); }
  }));
 
  await BluetoothLowEnergy.startCharacteristicNotifications({
    deviceId, service: SERVICE_UUID, characteristic: TX_UUID,
  });
  log('Conectado e inscrito nas notificações');
}
 
export async function clienteEnviar(deviceId: string, texto: string) {
  await enviarTexto((bytes) => BluetoothLowEnergy.writeCharacteristic({
    deviceId, service: SERVICE_UUID, characteristic: RX_UUID, value: bytes, type: 'withResponse',
  }), texto);
}
 
// ---------------- ENCERRAR ----------------
 
export async function encerrar(deviceId?: string) {
  await limparListeners();
  modoInicializado = undefined;
  try { await BluetoothLowEnergy.stopScan(); } catch { /* ignora */ }
  try { await BluetoothLowEnergy.stopAdvertising(); } catch { /* ignora */ }
  if (servicoRegistrado) {
    try { await BluetoothLowEnergy.removeGattService({ service: SERVICE_UUID }); } catch { /* ignora */ }
    servicoRegistrado = false;
  }
  if (deviceId) { try { await BluetoothLowEnergy.disconnect({ deviceId }); } catch { /* ignora */ } }
  partesRecebidas.clear();
}