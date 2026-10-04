import { supabase } from '../supabase';

export const BUCKET = 'post-images';
const SIGNED_URL_TTL = 60 * 60;
/** Assina de novo quando faltar menos que isso para o link vencer. */
const RENEW_BEFORE_MS = 10 * 60 * 1000;

/**
 * Links já assinados, por caminho. Cada assinatura nova gera outra URL, e trocar a URL faz a foto piscar e
 * baixar de novo; com o tempo real as listas recarregam muito, então o mesmo arquivo reaproveita o link.
 */
const cache = new Map<string, { url: string; expiresAt: number }>();

/** Só para testes. */
export function clearSignedUrlCache(): void {
  cache.clear();
}

const isUrl = (path: string) => /^https?:\/\//.test(path);

/**
 * Bucket privado: assina vários caminhos (fotos de post, avatares) em uma chamada só.
 * Devolve caminho -> URL assinada; caminhos que já são URL ou que falharem ficam de fora.
 */
export async function signPaths(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p && !isUrl(p)))];
  const signed = new Map<string, string>();
  const now = Date.now();
  const pending: string[] = [];
  for (const path of wanted) {
    const hit = cache.get(path);
    if (hit && hit.expiresAt - now > RENEW_BEFORE_MS) signed.set(path, hit.url);
    else pending.push(path);
  }
  if (pending.length === 0) return signed;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(pending, SIGNED_URL_TTL);
  const expiresAt = now + SIGNED_URL_TTL * 1000;
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      signed.set(item.path, item.signedUrl);
      cache.set(item.path, { url: item.signedUrl, expiresAt });
    }
  }
  return signed;
}

/** URL pronta para exibir: a assinada, a própria URL externa, ou null. */
export function resolveUrl(path: string | null | undefined, signed: Map<string, string>): string | null {
  if (!path) return null;
  if (isUrl(path)) return path;
  return signed.get(path) ?? null;
}
