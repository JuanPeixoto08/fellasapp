import { Platform } from 'react-native';

const KEY = 'fellas.storyVolume';

const clamp = (v: number) => Math.min(1, Math.max(0, v));

function stored(): number | null {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const v = raw == null ? NaN : Number(raw);
    return Number.isFinite(v) ? clamp(v) : null;
  } catch {
    return null;
  }
}

// vale enquanto o app está aberto; no site também fica guardado no aparelho
let current: number | null = null;

/** Volume dos vídeos dos stories (0 a 1); começa no máximo. */
export function loadVolume(): number {
  if (current === null) current = stored() ?? 1;
  return current;
}

export function saveVolume(volume: number): void {
  current = clamp(volume);
  if (Platform.OS !== 'web') return;
  try {
    globalThis.localStorage?.setItem(KEY, String(current));
  } catch {
    // aba anônima ou armazenamento bloqueado: fica só na memória
  }
}
