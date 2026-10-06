import { Platform } from 'react-native';

/** Duração (ms) lida dos metadados do vídeo no navegador; null quando não dá para saber. */
export function videoDurationMs(uri: string): Promise<number | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null);
    video.onerror = () => resolve(null);
    video.src = uri;
  });
}
