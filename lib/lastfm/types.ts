/** Tipos da aba Música (dados do Last.fm já convertidos para o app). */
export type LastfmPeriod = '7day' | '1month' | '3month' | '12month' | 'overall';
export type LastfmTopKind = 'artists' | 'albums' | 'tracks';

export type LastfmTrack = {
  name: string;
  artist: string;
  album: string | null;
  image: string | null;
  url: string;
  /** ISO; null na música que está tocando agora. */
  playedAt: string | null;
  nowPlaying: boolean;
};

export type LastfmTopItem = {
  rank: number;
  name: string;
  /** Em álbuns e músicas; null em artistas. */
  artist: string | null;
  image: string | null;
  url: string;
  plays: number;
};

export type LastfmUser = { name: string; playcount: number; registeredAt: string | null };

export type LastfmPage<T> = { items: T[]; page: number; totalPages: number };

export type LastfmErrorKind = 'not_found' | 'private' | 'rate_limit' | 'network' | 'no_key' | 'other';
