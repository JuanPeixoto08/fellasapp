import { useEffect, useState } from 'react';

import { subscribeNowPlaying } from './nowPlayingStore';
import type { LastfmTrack } from './types';

/**
 * O que cada um desses usuários do Last.fm ouve agora (só quem está ouvindo entra no mapa). Para listas
 * fora das telas (a coluna da direita), por isso pergunta enquanto estiver montado, sem esperar foco.
 * Divide o dado com os posts e o perfil (`nowPlayingStore`).
 */
export function useNowPlayingMany(users: string[]): Map<string, LastfmTrack> {
  const [tracks, setTracks] = useState<Map<string, LastfmTrack>>(new Map());
  // a lista chega nova a cada render: a chave estável evita reassinar à toa
  const key = [...new Set(users)].sort().join('\n');

  useEffect(() => {
    const list = key ? key.split('\n') : [];
    setTracks((prev) => {
      const kept = new Map([...prev].filter(([user]) => list.includes(user)));
      return kept.size === prev.size ? prev : kept;
    });
    const stops = list.map((user) =>
      subscribeNowPlaying(user, (track) =>
        setTracks((prev) => {
          if (!track && !prev.has(user)) return prev;
          const next = new Map(prev);
          if (track) next.set(user, track);
          else next.delete(user);
          return next;
        }),
      ),
    );
    return () => stops.forEach((stop) => stop());
  }, [key]);

  return tracks;
}
