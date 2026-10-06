import type { LastfmPage, LastfmPeriod, LastfmTopItem, LastfmTopKind, LastfmTrack, LastfmUser } from './types';

/** Respostas do Last.fm chegam sem tipo (`any`); aqui viram os tipos do app. */

/** O Last.fm não fornece mais foto de artista: devolve sempre esta estrela. */
const GENERIC_STAR = '2a96cbd8b46e442fc41c2b86b821562f';

type Img = { '#text'?: string; size?: string };

/** Maior imagem não vazia (o Last.fm manda da menor para a maior); a estrela genérica conta como nada. */
export function pickImage(images: Img[] | undefined): string | null {
  const urls = (images ?? []).map((i) => i?.['#text'] ?? '').filter(Boolean);
  const url = urls[urls.length - 1] ?? null;
  return url && !url.includes(GENERIC_STAR) ? url : null;
}

/** Com um item só, o Last.fm manda objeto em vez de lista. */
const list = <T>(value: T | T[] | undefined | null): T[] => (value == null ? [] : Array.isArray(value) ? value : [value]);
const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const isoFromUnix = (value: unknown): string | null => {
  const n = num(value);
  return n > 0 ? new Date(n * 1000).toISOString() : null;
};
const pageOf = (attr: any) => ({ page: num(attr?.page) || 1, totalPages: num(attr?.totalPages) });

export function mapRecentTracks(json: any): LastfmPage<LastfmTrack> {
  const root = json?.recenttracks ?? {};
  const items = list<any>(root.track).map((t) => ({
    name: String(t?.name ?? ''),
    artist: String(t?.artist?.['#text'] ?? t?.artist?.name ?? ''),
    album: t?.album?.['#text'] ? String(t.album['#text']) : null,
    image: pickImage(t?.image),
    url: String(t?.url ?? ''),
    playedAt: isoFromUnix(t?.date?.uts),
    nowPlaying: t?.['@attr']?.nowplaying === 'true',
  }));
  return { items, ...pageOf(root['@attr']) };
}

const TOP_KEYS: Record<LastfmTopKind, { root: string; item: string }> = {
  artists: { root: 'topartists', item: 'artist' },
  albums: { root: 'topalbums', item: 'album' },
  tracks: { root: 'toptracks', item: 'track' },
};

export function mapTop(kind: LastfmTopKind, json: any): LastfmPage<LastfmTopItem> {
  const keys = TOP_KEYS[kind];
  const root = json?.[keys.root] ?? {};
  const items = list<any>(root[keys.item]).map((x) => ({
    rank: num(x?.['@attr']?.rank),
    name: String(x?.name ?? ''),
    artist: kind === 'artists' ? null : String(x?.artist?.name ?? x?.artist?.['#text'] ?? '') || null,
    image: pickImage(x?.image),
    url: String(x?.url ?? ''),
    plays: num(x?.playcount),
  }));
  return { items, ...pageOf(root['@attr']) };
}

export function mapUserInfo(json: any): LastfmUser {
  const u = json?.user ?? {};
  return { name: String(u.name ?? ''), playcount: num(u.playcount), registeredAt: isoFromUnix(u.registered?.unixtime) };
}

/** Regra de usuário do Last.fm (igual à checagem do banco, 0019). */
export function isValidLastfmUser(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{1,14}$/.test(name);
}

export const PERIODS: { value: LastfmPeriod; label: string }[] = [
  { value: '7day', label: '7 dias' },
  { value: '1month', label: '1 mês' },
  { value: '3month', label: '3 meses' },
  { value: '12month', label: '1 ano' },
  { value: 'overall', label: 'sempre' },
];
export const DEFAULT_PERIOD: LastfmPeriod = '1month';

/** 12430 → "12.430" (sem depender de Intl no aparelho). */
export function formatThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function sinceYear(iso: string | null): string | null {
  return iso ? String(new Date(iso).getUTCFullYear()) : null;
}
