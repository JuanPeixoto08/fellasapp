import { safeLastfmUrl } from './lastfm/map';
import type { LastfmTrack } from './lastfm/types';

/**
 * Ingresso anexado ao post (`posts.media`, 0026): a música do Last.fm ou a sua review do Letterboxd, congelada
 * na hora de postar. O banco valida com as mesmas regras (`post_media_ok`); aqui elas valem de novo antes de
 * desenhar, para nunca mostrar link ou imagem de outro lugar.
 */
export type TrackMedia = {
  kind: 'track';
  title: string;
  artist: string;
  album: string | null;
  /** Capa (CDN do Last.fm) ou null. */
  image: string | null;
  url: string;
  /** Estava tocando quando anexou ("Tocando agora"); senão "Ouvi". */
  live: boolean;
};

export type ReviewMedia = {
  kind: 'review';
  title: string;
  year: number | null;
  /** 0.5–5 em meios, ou null (sem nota). */
  rating: number | null;
  liked: boolean;
  rewatch: boolean;
  /** Dia em que viu, `AAAA-MM-DD`, ou null. */
  watched: string | null;
  /** Pôster (CDN do Letterboxd) ou null. */
  poster: string | null;
  url: string;
  /** Parágrafos separados por linha em branco. */
  text: string;
  /** Marcada com spoiler no Letterboxd: o texto fica escondido até tocar. */
  spoiler: boolean;
};

export type PostMedia = TrackMedia | ReviewMedia;

export const MAX_MEDIA_TEXT = 200;
export const MAX_REVIEW_TEXT = 6000;

const LASTFM_IMAGE = /^https:\/\/lastfm-img\.freetls\.fastly\.net\//i;
const LETTERBOXD_POSTER = /^https:\/\/a\.ltrbxd\.com\//i;
const LETTERBOXD_REVIEW = /^https:\/\/letterboxd\.com\/[A-Za-z0-9_]+\/film\//i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v : null;
const optStr = (v: unknown, max: number): string | null | undefined =>
  v === null || v === undefined ? null : (str(v, max) ?? undefined);
const host = (v: unknown, re: RegExp): string | null | undefined =>
  v === null || v === undefined ? null : typeof v === 'string' && re.test(v) ? v : undefined;

/** A música tocando (ou uma das últimas) vira anexo; capa de outro host some, link de outro lugar não vira anexo. */
export function trackMedia(track: LastfmTrack): TrackMedia | null {
  const url = safeLastfmUrl(track.url);
  const title = str(track.name?.trim(), MAX_MEDIA_TEXT);
  const artist = str(track.artist?.trim(), MAX_MEDIA_TEXT);
  if (!url || !title || !artist) return null;
  return {
    kind: 'track',
    title,
    artist,
    album: str(track.album?.trim(), MAX_MEDIA_TEXT),
    image: track.image && LASTFM_IMAGE.test(track.image) ? track.image : null,
    url,
    live: track.nowPlaying,
  };
}

/** O anexo como veio do banco (ou da função), conferido; qualquer coisa fora das regras vira null. */
export function toPostMedia(value: unknown): PostMedia | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.kind === 'track') {
    const title = str(v.title, MAX_MEDIA_TEXT);
    const artist = str(v.artist, MAX_MEDIA_TEXT);
    const album = optStr(v.album, MAX_MEDIA_TEXT);
    const image = host(v.image, LASTFM_IMAGE);
    const url = typeof v.url === 'string' ? safeLastfmUrl(v.url) : '';
    if (!title || !artist || album === undefined || image === undefined || !url) return null;
    return { kind: 'track', title, artist, album, image, url, live: v.live === true };
  }
  if (v.kind === 'review') {
    const title = str(v.title, MAX_MEDIA_TEXT);
    const poster = host(v.poster, LETTERBOXD_POSTER);
    const url = typeof v.url === 'string' && LETTERBOXD_REVIEW.test(v.url) ? v.url : null;
    const year = v.year === null || v.year === undefined ? null : Number.isInteger(v.year) ? (v.year as number) : NaN;
    const rating = v.rating === null || v.rating === undefined ? null : typeof v.rating === 'number' ? v.rating : NaN;
    const watched = v.watched === null || v.watched === undefined ? null : typeof v.watched === 'string' && DAY.test(v.watched) ? v.watched : undefined;
    const text = typeof v.text === 'string' && v.text.length <= MAX_REVIEW_TEXT ? v.text : null;
    const ratingOk = rating === null || (rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2));
    const yearOk = year === null || (year >= 1870 && year <= 2100);
    if (!title || poster === undefined || !url || !ratingOk || !yearOk || watched === undefined || text === null) return null;
    return {
      kind: 'review',
      title,
      year,
      rating,
      liked: v.liked === true,
      rewatch: v.rewatch === true,
      watched,
      poster,
      url,
      text,
      spoiler: v.spoiler === true,
    };
  }
  return null;
}

/** Estrelas da nota: quantas cheias e se tem meia. */
export function ratingStars(rating: number | null): { full: number; half: boolean } {
  if (!rating) return { full: 0, half: false };
  return { full: Math.floor(rating), half: rating % 1 !== 0 };
}

export type ReviewLinkMatch = { url: string } | { error: 'not_yours' | 'short_link' | 'not_review' };

/**
 * Link colado → endereço da review como aparece no feed do Letterboxd (`https://letterboxd.com/<usuário>/film/<filme>/`,
 * e `<n>/` quando é a 2ª review do mesmo filme). Só reviews de quem posta.
 */
export function matchReviewLink(input: string, username: string): ReviewLinkMatch {
  const raw = input.trim();
  if (/^(https?:\/\/)?boxd\.it\//i.test(raw)) return { error: 'short_link' };
  const m = /^(?:https?:\/\/)?(?:www\.)?letterboxd\.com\/([A-Za-z0-9_]+)\/film\/([a-z0-9-]+)\/?(?:(\d+)\/?)?(?:[?#].*)?$/i.exec(raw);
  if (!m || m[1].toLowerCase() === 'film') return { error: 'not_review' };
  if (m[1].toLowerCase() !== username.toLowerCase()) return { error: 'not_yours' };
  return { url: `https://letterboxd.com/${m[1].toLowerCase()}/film/${m[2].toLowerCase()}/${m[3] ? `${m[3]}/` : ''}` };
}

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2025-12-30" → "30 dez 2025" (a sessão do ingresso). */
export function dayLabel(day: string | null): string | null {
  const m = day ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(day) : null;
  const month = m ? MONTHS_SHORT[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])} ${month} ${m[1]}` : null;
}
