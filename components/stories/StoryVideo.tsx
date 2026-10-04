import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Quanto esperar depois de mandar tocar para concluir que o navegador bloqueou o som. */
const AUTOPLAY_CHECK_MS = 700;

type Props = {
  uri: string;
  paused: boolean;
  muted: boolean;
  /** O vídeo carregou (ou falhou): o relógio do story pode andar. */
  onReady: () => void;
  /** Navegador não deixou tocar com som: o story passa para mudo. */
  onBlocked: () => void;
};

/** Vídeo do story: toca uma vez, sem controles, dentro da tela (playsInline); pausa junto com o story. */
export function StoryVideo({ uri, paused, muted, onReady, onBlocked }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  const ready = useRef(onReady);
  ready.current = onReady;
  const blocked = useRef(onBlocked);
  blocked.current = onBlocked;

  useEffect(() => {
    if (player.status === 'readyToPlay' || player.status === 'error') ready.current();
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' || status === 'error') ready.current();
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (paused) {
      player.pause();
      return;
    }
    player.play();
    // web: tocar com som sem toque da pessoa costuma ser bloqueado (iPhone/Safari); aí começa mudo
    if (Platform.OS !== 'web' || muted) return;
    const timer = setTimeout(() => {
      if (!player.playing) blocked.current();
    }, AUTOPLAY_CHECK_MS);
    return () => clearTimeout(timer);
  }, [player, paused, muted]);

  return (
    <VideoView player={player} nativeControls={false} playsInline contentFit="contain" style={{ width: '100%', height: '100%' }} />
  );
}
