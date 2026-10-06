/**
 * Regras puras da função dos stories (Cloudinary). Sem Deno nem rede: o handler (Deno) e o Jest do app
 * usam o mesmo arquivo.
 */
export type Kind = 'photo' | 'video';
export type ResourceType = 'image' | 'video';

/** Nome do arquivo no Cloudinary: pasta stories/ + 64 hex aleatórios (o endereço não se adivinha). */
export const MEDIA_ID_RE = /^stories\/[0-9a-f]{64}$/;
export const TTL_MS = 24 * 60 * 60 * 1000;

/** Versão reduzida pedida no envio (eager) e usada na entrega (lib/cloudinary.ts tem a mesma). */
export const TRANSFORMATIONS: Record<Kind, string> = {
  video: 'c_limit,w_1280,h_1280,q_auto,f_mp4',
  photo: 'c_limit,w_1920,h_1920,q_auto,f_jpg',
};

const API = 'https://api.cloudinary.com/v1_1';
/** Parâmetros que o Cloudinary não inclui na assinatura. */
const UNSIGNED = new Set(['file', 'cloud_name', 'resource_type', 'api_key']);

export const resourceType = (kind: Kind): ResourceType => (kind === 'video' ? 'video' : 'image');

export function randomMediaId(uuid: () => string): string {
  return `stories/${(uuid() + uuid()).replace(/-/g, '')}`;
}

/** O que vai para o SHA-1 (antes da secret): parâmetros em ordem alfabética, "a=1&b=2". */
export function stringToSign(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => !UNSIGNED.has(k) && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

export function isExpired(createdAt: string, now: Date): boolean {
  return now.getTime() - new Date(createdAt).getTime() > TTL_MS;
}

export const uploadUrl = (cloud: string, kind: Kind) => `${API}/${cloud}/${resourceType(kind)}/upload`;

export function listUrl(cloud: string, type: ResourceType, cursor?: string): string {
  const next = cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : '';
  return `${API}/${cloud}/resources/${type}/upload?prefix=stories%2F&max_results=500${next}`;
}

export function deleteUrl(cloud: string, type: ResourceType, ids: string[]): string {
  const query = ids.map((id) => `public_ids%5B%5D=${encodeURIComponent(id)}`).join('&');
  return `${API}/${cloud}/resources/${type}/upload?${query}`;
}

export const basicAuth = (key: string, secret: string) => `Basic ${btoa(`${key}:${secret}`)}`;

export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (origin === 'https://fellasapp.pages.dev') return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null;
}
