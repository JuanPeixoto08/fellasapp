import { getNowPlaying } from './api';
import type { LastfmTrack } from './types';

/** De quanto em quanto tempo o "ouvindo agora" pergunta de novo, com alguém olhando. */
export const NOW_PLAYING_MS = 60_000;

type Listener = (track: LastfmTrack | null) => void;
type Entry = {
  track: LastfmTrack | null;
  /** Quando chegou a última resposta (0 = nunca). */
  fetchedAt: number;
  listeners: Set<Listener>;
  timer: ReturnType<typeof setInterval> | null;
  inflight: boolean;
};

// um por usuário do Last.fm: dez posts do mesmo fella na tela = uma pergunta por minuto
const entries = new Map<string, Entry>();

function refresh(user: string, entry: Entry) {
  if (entry.inflight) return;
  entry.inflight = true;
  const done = (track: LastfmTrack | null) => {
    entry.inflight = false;
    entry.track = track;
    entry.fetchedAt = Date.now();
    entry.listeners.forEach((l) => l(track));
  };
  getNowPlaying(user).then(done, () => done(null));
}

/**
 * Assina o "ouvindo agora" de um usuário do Last.fm. Entrega na hora o último valor guardado e só pergunta
 * de novo se ele tem mais de `NOW_PLAYING_MS` (rolar o feed monta e desmonta posts toda hora). Enquanto
 * houver alguém assinando, pergunta a cada `NOW_PLAYING_MS`. Devolve a função que cancela.
 */
export function subscribeNowPlaying(user: string, listener: Listener): () => void {
  let entry = entries.get(user);
  if (!entry) {
    entry = { track: null, fetchedAt: 0, listeners: new Set(), timer: null, inflight: false };
    entries.set(user, entry);
  }
  const e = entry;
  e.listeners.add(listener);
  if (e.fetchedAt) listener(e.track);
  if (Date.now() - e.fetchedAt >= NOW_PLAYING_MS) refresh(user, e);
  if (!e.timer) e.timer = setInterval(() => refresh(user, e), NOW_PLAYING_MS);
  return () => {
    e.listeners.delete(listener);
    if (e.listeners.size === 0 && e.timer) {
      clearInterval(e.timer);
      e.timer = null;
    }
  };
}

/** Esquece tudo (testes). */
export function resetNowPlayingStore(): void {
  entries.forEach((e) => e.timer && clearInterval(e.timer));
  entries.clear();
}
