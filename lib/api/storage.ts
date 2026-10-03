import { supabase } from '../supabase';

export const BUCKET = 'post-images';
const SIGNED_URL_TTL = 60 * 60;

const isUrl = (path: string) => /^https?:\/\//.test(path);

/**
 * Bucket privado: assina vários caminhos (fotos de post, avatares) em uma chamada só.
 * Devolve caminho -> URL assinada; caminhos que já são URL ou que falharem ficam de fora.
 */
export async function signPaths(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const pending = [...new Set(paths.filter((p): p is string => !!p && !isUrl(p)))];
  if (pending.length === 0) return new Map();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(pending, SIGNED_URL_TTL);
  const signed = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }
  return signed;
}

/** URL pronta para exibir: a assinada, a própria URL externa, ou null. */
export function resolveUrl(path: string | null | undefined, signed: Map<string, string>): string | null {
  if (!path) return null;
  if (isUrl(path)) return path;
  return signed.get(path) ?? null;
}
