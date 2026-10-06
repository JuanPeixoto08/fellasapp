import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Quanto esperar depois de mandar tocar para concluir que o navegador bloqueou o som. */
const AUTOPLAY_CHECK_MS = 700;

type Props = {
  uri: string;
  /** Toca este se o `uri` falhar (versão reduzida do Cloudinary ainda processando). */
  fallbackUri?: string;
  paused: boolean;
  muted: boolean;
  /** O vídeo carregou (ou falhou): o relógio do story pode andar. */
  onReady: () => void;
  /** Navegador não deixou tocar com som: o story passa para mudo. */
  onBlocked: () => void;
};

/** Vídeo do story: toca uma vez, sem controles, dentro da tela (playsInline); pausa junto com o story. */
export function StoryVideo({ uri, fallbackUri, paused, muted, onReady, onBlocked }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  const ready = useRef(onReady);
  ready.current = onReady;
  const blocked = useRef(onBlocked);
  blocked.current = onBlocked;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // a versão reduzida pode ainda não estar pronta: tenta o original uma vez antes de desistir
  const fellBack = useRef(false);
  useEffect(() => {
    const onStatus = (status: string) => {
      if (status === 'error' && fallbackUri && !fellBack.current) {
        fellBack.current = true;
        player
          .replaceAsync(fallbackUri)
          .then(() => {
            if (!pausedRef.current) player.play();
          })
          .catch(() => ready.current());
        return;
      }
      if (status === 'readyToPlay' || status === 'error') ready.current();
    };
    onStatus(player.status);
    const sub = player.addListener('statusChange', ({ status }) => onStatus(status));
    return () => sub.remove();
  }, [player, fallbackUri]);

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
