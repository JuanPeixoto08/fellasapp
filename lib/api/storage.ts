import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../supabase';

export const BUCKET = 'post-images';
/** Cache do arquivo no navegador: 1 ano. Cada foto sobe num caminho novo e nunca muda. */
export const UPLOAD_CACHE_CONTROL = '31536000';
/** 7 dias: o mesmo link a semana toda deixa o navegador reaproveitar a foto já baixada (cada link novo baixa de novo,
 *  e foi isso que estourou o tráfego do plano grátis em out/2026). */
const SIGNED_URL_TTL = 7 * 24 * 60 * 60;
/** Assina de novo quando faltar menos que isso para o link vencer. */
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;
/** Onde os links ficam guardados no aparelho (o Fellas Games, no mesmo site, lê a mesma chave: games/shared/fotos.ts). */
export const SIGNED_URL_KEY = 'fellas:fotos-assinadas:v1';

type Signed = { url: string; expiresAt: number };

/**
 * Links já assinados, por caminho, guardados também no aparelho. Cada assinatura nova gera outra URL, e trocar a URL
 * faz a foto piscar e baixar de novo; com o tempo real as listas recarregam muito, e reabrir o app não pode assinar tudo
 * de novo.
 */
let cache = new Map<string, Signed>();
let loaded: Promise<void> | null = null;

const valid = (v: unknown, now: number): v is Signed =>
  !!v && typeof (v as Signed).url === 'string' && typeof (v as Signed).expiresAt === 'number' && (v as Signed).expiresAt > now;

function load(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      try {
        const raw = await AsyncStorage.getItem(SIGNED_URL_KEY);
        if (!raw) return;
        const now = Date.now();
        for (const [path, v] of Object.entries(JSON.parse(raw) as Record<string, unknown>)) {
          if (valid(v, now) && !cache.has(path)) cache.set(path, v);
        }
      } catch {
        // guardado estragado: começa do zero
      }
    })();
  }
  return loaded;
}

function save(): void {
  const now = Date.now();
  const kept = Object.fromEntries([...cache].filter(([, v]) => v.expiresAt > now));
  AsyncStorage.setItem(SIGNED_URL_KEY, JSON.stringify(kept)).catch(() => undefined);
}

/** Esquece tudo, também no aparelho (ao sair da conta e nos testes). */
export async function clearSignedUrlCache(): Promise<void> {
  cache = new Map();
  loaded = null;
  await AsyncStorage.removeItem(SIGNED_URL_KEY).catch(() => undefined);
}

/** Só para testes: esquece a memória, como fechar e abrir o app (o guardado no aparelho fica). */
export function forgetSignedUrlMemory(): void {
  cache = new Map();
  loaded = null;
}

const isUrl = (path: string) => /^https?:\/\//.test(path);

/**
 * Bucket privado: assina vários caminhos (fotos de post, avatares) em uma chamada só.
 * Devolve caminho -> URL assinada; caminhos que já são URL ou que falharem ficam de fora.
 */
export async function signPaths(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p && !isUrl(p)))];
  const signed = new Map<string, string>();
  if (wanted.length === 0) return signed;
  await load();
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
  save();
  return signed;
}

/** URL pronta para exibir: a assinada, a própria URL externa, ou null. */
export function resolveUrl(path: string | null | undefined, signed: Map<string, string>): string | null {
  if (!path) return null;
  if (isUrl(path)) return path;
  return signed.get(path) ?? null;
}
