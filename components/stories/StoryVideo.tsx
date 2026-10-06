import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Quanto esperar depois de mandar tocar para concluir que o navegador bloqueou o som. */
const AUTOPLAY_CHECK_MS = 700;

/** Quanto esperar a versão reduzida ficar pronta antes de trocar para o original. */
const FALLBACK_AFTER_MS = 4000;

type Props = {
  uri: string;
  /** Toca este se o `uri` falhar (versão reduzida do Cloudinary ainda processando). */
  fallbackUri?: string;
  paused: boolean;
  muted: boolean;
  /** De 0 a 1 (barra de volume do computador); o mudo é à parte. */
  volume?: number;
  /** O vídeo carregou (ou falhou): o relógio do story pode andar. */
  onReady: () => void;
  /** Navegador não deixou tocar com som: o story passa para mudo. */
  onBlocked: () => void;
};

/** Vídeo do story: toca uma vez, sem controles, dentro da tela (playsInline); pausa junto com o story. */
export function StoryVideo({ uri, fallbackUri, paused, muted, volume = 1, onReady, onBlocked }: Props) {
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const swap = () => {
      if (!fallbackUri || fellBack.current) return false;
      fellBack.current = true;
      clear();
      player
        .replaceAsync(fallbackUri)
        .then(() => {
          if (!pausedRef.current) player.play();
        })
        .catch(() => ready.current());
      return true;
    };
    const onStatus = (status: string) => {
      if (status === 'error' && swap()) return;
      if (status === 'readyToPlay' || status === 'error') {
        clear();
        ready.current();
      }
    };
    onStatus(player.status);
    // a reduzida pode travar sem dar erro: passou o prazo sem ficar pronta, vai para o original
    if (fallbackUri && !fellBack.current && player.status !== 'readyToPlay') timer = setTimeout(swap, FALLBACK_AFTER_MS);
    const sub = player.addListener('statusChange', ({ status }) => onStatus(status));
    return () => {
      clear();
      sub.remove();
    };
  }, [player, fallbackUri]);

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

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
