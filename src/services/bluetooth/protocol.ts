const CHUNK_PREFIX = 'BURRO1/';
export const DEFAULT_CHUNK_BYTES = 3;
export const MAX_CHUNK_BYTES = 120;
const MAX_CHUNKS = 999;

export function chunkBytesForMtu(mtu: number): number {
  const maxValueBytes = Math.max(20, mtu - 3);
  const maxHeaderBytes = CHUNK_PREFIX.length + 3 + 1 + 3 + 1;
  const base64Bytes = Math.max(4, maxValueBytes - maxHeaderBytes);
  const chunkBytes = Math.floor((base64Bytes * 3) / 4);
  return Math.max(
    DEFAULT_CHUNK_BYTES,
    Math.min(MAX_CHUNK_BYTES, Math.floor(chunkBytes / 3) * 3),
  );
}

export function splitMessage(texto: string, chunkBytes = DEFAULT_CHUNK_BYTES): string[] {
  const safeChunkBytes = Math.max(
    DEFAULT_CHUNK_BYTES,
    Math.min(MAX_CHUNK_BYTES, Math.floor(chunkBytes / 3) * 3),
  );
  const bytes = new TextEncoder().encode(texto);
  const total = Math.max(1, Math.ceil(bytes.length / safeChunkBytes));
  if (total > MAX_CHUNKS) throw new Error('A mensagem Bluetooth excede o limite permitido.');
  return Array.from({ length: total }, (_, indice) => {
    const inicio = indice * safeChunkBytes;
    const fim = Math.min(inicio + safeChunkBytes, bytes.length);
    const chunk = bytes.slice(inicio, fim);
    const encoded = btoa(String.fromCharCode(...chunk))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    return `${CHUNK_PREFIX}${indice}/${total}/${encoded}`;
  });
}

export function joinMessage(
  texto: string,
  deviceId: string,
  pending: Map<string, { total: number; chunks: Map<number, string> }>,
): string | null {
  const match = /^BURRO1\/(\d+)\/(\d+)\/(.*)$/.exec(texto);
  if (!match) return texto;

  const indice = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(indice) || !Number.isInteger(total) || indice < 0 || indice >= total || total > MAX_CHUNKS) return null;

  const current = pending.get(deviceId) ?? { total, chunks: new Map<number, string>() };
  if (current.total !== total) {
    pending.delete(deviceId);
    return null;
  }
  current.chunks.set(indice, match[3]);
  pending.set(deviceId, current);
  if (current.chunks.size !== total) return null;

  const encoded = Array.from({ length: total }, (_, partIndex) => current.chunks.get(partIndex) ?? '').join('');
  pending.delete(deviceId);
  try {
    return new TextDecoder().decode(
      Uint8Array.from(
        atob(encoded.replace(/-/g, '+').replace(/_/g, '/')),
        (caractere) => caractere.charCodeAt(0),
      ),
    );
  } catch {
    return null;
  }
}
