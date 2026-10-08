import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { NOW_PLAYING_MS, subscribeNowPlaying } from './nowPlayingStore';
import type { LastfmTrack } from './types';

export { NOW_PLAYING_MS };

/**
 * Música que a pessoa está ouvindo agora (ou null). Só pergunta com a tela focada. O dado é dividido com
 * todo mundo que olha o mesmo usuário (posts dele no feed, cabeçalho do perfil): `nowPlayingStore`.
 */
export function useNowPlaying(user: string | null): LastfmTrack | null {
  const [track, setTrack] = useState<LastfmTrack | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setTrack(null);
        return;
      }
      return subscribeNowPlaying(user, setTrack);
    }, [user]),
  );
  return track;
}
