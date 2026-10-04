import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';

type Props = { uri: string; paused: boolean; muted: boolean };

/** Vídeo do story: toca uma vez, sem controles; pausa junto com o story. */
export function StoryVideo({ uri, paused, muted }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [player, paused]);
  return <VideoView player={player} nativeControls={false} contentFit="contain" style={{ width: '100%', height: '100%' }} />;
}
