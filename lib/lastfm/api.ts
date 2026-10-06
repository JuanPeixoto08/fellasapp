import { mapRecentTracks, mapTop, mapUserInfo } from './map';
import type {
  LastfmErrorKind,
  LastfmPage,
  LastfmPeriod,
  LastfmTopItem,
  LastfmTopKind,
  LastfmTrack,
  LastfmUser,
} from './types';

/**
 * Chamadas ao Last.fm direto do app (a API libera CORS). Só leitura de dados públicos com a API key;
 * o shared secret nunca entra no projeto.
 */
const BASE = 'https://ws.audioscrobbler.com/2.0/';
export const LASTFM_PAGE = 50;

const ERROR_KINDS: Record<number, LastfmErrorKind> = { 6: 'not_found', 17: 'private', 29: 'rate_limit' };

export class LastfmError extends Error {
  constructor(
    readonly kind: LastfmErrorKind,
    message: string = kind,
  ) {
    super(message);
  }
}

/** Lida na hora (não no carregamento do módulo): sem chave, a aba avisa em vez de quebrar. */
const apiKey = () => process.env.EXPO_PUBLIC_LASTFM_API_KEY ?? '';

export function hasLastfmKey(): boolean {
  return apiKey().length > 0;
}

async function lastfmGet(method: string, params: Record<string, string | number>): Promise<unknown> {
  const key = apiKey();
  if (!key) throw new LastfmError('no_key');
  const query = Object.entries({ method, ...params, api_key: key, format: 'json' })
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  let res: Response;
  try {
    res = await fetch(`${BASE}?${query}`);
  } catch {
    throw new LastfmError('network');
  }
  let json: { error?: number; message?: string } | null = null;
  try {
    json = await res.json();
  } catch {
    throw new LastfmError('other');
  }
  if (json?.error) throw new LastfmError(ERROR_KINDS[json.error] ?? 'other', json.message);
  if (!res.ok) throw new LastfmError('other');
  return json;
}

export async function getUserInfo(user: string): Promise<LastfmUser> {
  return mapUserInfo(await lastfmGet('user.getinfo', { user }));
}

export async function getRecentTracks(user: string, page: number): Promise<LastfmPage<LastfmTrack>> {
  return mapRecentTracks(await lastfmGet('user.getrecenttracks', { user, page, limit: LASTFM_PAGE }));
}

export async function getTop(
  kind: LastfmTopKind,
  user: string,
  period: LastfmPeriod,
  page: number,
): Promise<LastfmPage<LastfmTopItem>> {
  return mapTop(kind, await lastfmGet(`user.gettop${kind}`, { user, period, page, limit: LASTFM_PAGE }));
}

/** A música tocando agora (vem marcada no topo das recentes), ou null. */
export async function getNowPlaying(user: string): Promise<LastfmTrack | null> {
  const page = mapRecentTracks(await lastfmGet('user.getrecenttracks', { user, limit: 1 }));
  return page.items.find((t) => t.nowPlaying) ?? null;
}
