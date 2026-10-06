import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getNowPlaying } from './api';
import type { LastfmTrack } from './types';

/** De quanto em quanto tempo o "ouvindo agora" pergunta de novo, com a tela à vista. */
export const NOW_PLAYING_MS = 60_000;

/** Música que a pessoa está ouvindo agora (ou null). Só pergunta com a tela focada. */
export function useNowPlaying(user: string | null): LastfmTrack | null {
  const [track, setTrack] = useState<LastfmTrack | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setTrack(null);
        return;
      }
      let alive = true;
      const check = () => {
        getNowPlaying(user)
          .then((t) => alive && setTrack(t))
          .catch(() => alive && setTrack(null));
      };
      check();
      const timer = setInterval(check, NOW_PLAYING_MS);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [user]),
  );
  return track;
}
