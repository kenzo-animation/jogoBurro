const CHUNK_BYTES = 120;
const CHUNK_PREFIX = 'BURRO1/';

export function splitMessage(texto: string): string[] {
  const bytes = new TextEncoder().encode(texto);
  const total = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
  return Array.from({ length: total }, (_, indice) => {
    const inicio = indice * CHUNK_BYTES;
    const fim = Math.min(inicio + CHUNK_BYTES, bytes.length);
    const chunk = bytes.slice(inicio, fim);
    return `${CHUNK_PREFIX}${indice}/${total}/${btoa(String.fromCharCode(...chunk))}`;
  });
}

export function joinMessage(
  texto: string,
  deviceId: string,
  pending: Map<string, { total: number; chunks: Map<number, string> }>,
): string | null {
  const parts = texto.split('/');
  if (parts.length !== 4 || parts[0] !== 'BURRO1') return texto;

  const indice = Number(parts[1]);
  const total = Number(parts[2]);
  if (!Number.isInteger(indice) || !Number.isInteger(total) || indice < 0 || indice >= total || total > 256) return null;

  const current = pending.get(deviceId) ?? { total, chunks: new Map<number, string>() };
  if (current.total !== total) {
    pending.delete(deviceId);
    return null;
  }
  current.chunks.set(indice, parts[3]);
  pending.set(deviceId, current);
  if (current.chunks.size !== total) return null;

  const encoded = Array.from({ length: total }, (_, partIndex) => current.chunks.get(partIndex) ?? '').join('');
  pending.delete(deviceId);
  return new TextDecoder().decode(
    Uint8Array.from(atob(encoded), (caractere) => caractere.charCodeAt(0)),
  );
}
