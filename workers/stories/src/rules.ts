/** Regras puras do Worker de stories (testadas no Jest do app). Sem tipos da Cloudflare aqui. */
export type MediaKind = 'photo' | 'video';

export const MEDIA_TYPES: Record<string, { kind: MediaKind; ext: string }> = {
  'image/jpeg': { kind: 'photo', ext: 'jpg' },
  'image/png': { kind: 'photo', ext: 'png' },
  'image/webp': { kind: 'photo', ext: 'webp' },
  'image/gif': { kind: 'photo', ext: 'gif' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/quicktime': { kind: 'video', ext: 'mov' },
  'video/webm': { kind: 'video', ext: 'webm' },
};

export const MAX_BYTES: Record<MediaKind, number> = { photo: 5 * 1024 * 1024, video: 50 * 1024 * 1024 };

export function mediaType(contentType: string | null): { kind: MediaKind; ext: string } | null {
  if (!contentType) return null;
  return MEDIA_TYPES[contentType.split(';')[0].trim().toLowerCase()] ?? null;
}

export function tooBig(kind: MediaKind, bytes: number): boolean {
  return bytes > MAX_BYTES[kind];
}

/** Dois UUIDs sem traço (64 hexas): impossível de adivinhar. */
export function randomKey(ext: string, uuid: () => string = () => crypto.randomUUID()): string {
  return `${uuid().replace(/-/g, '')}${uuid().replace(/-/g, '')}.${ext}`;
}

export const KEY_RE = /^[0-9a-f]{64}\.(jpg|png|webp|gif|mp4|mov|webm)$/;

/** "bytes=a-b" | "bytes=a-" | "bytes=-n" → formato do R2; inválido → null (entrega o arquivo inteiro). */
export function parseRange(header: string | null): { offset: number; length?: number } | { suffix: number } | null {
  const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') return { suffix: Number(m[2]) };
  const start = Number(m[1]);
  if (m[2] === '') return { offset: start };
  const end = Number(m[2]);
  return end < start ? null : { offset: start, length: end - start + 1 };
}

export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (origin === 'https://fellasapp.pages.dev') return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null;
}
