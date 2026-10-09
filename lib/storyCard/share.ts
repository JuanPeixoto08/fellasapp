export const STORY_FILE_NAME = 'fellas-story.jpg';

export type ShareResult = 'shared' | 'cancelled' | 'downloaded';

function file(blob: Blob): File {
  return new File([blob], STORY_FILE_NAME, { type: 'image/jpeg' });
}

/** O aparelho abre a planilha de compartilhar com arquivo (celular)? No computador, em geral não. */
export function canShareFiles(): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file(new Blob())] });
  } catch {
    return false;
  }
}

function download(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = STORY_FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Planilha de compartilhar do celular (Instagram → Story) ou, sem ela, baixa o arquivo. Chame direto do
 * toque com o Blob já pronto: o Safari só abre a planilha dentro do gesto.
 */
export async function shareOrDownload(blob: Blob): Promise<ShareResult> {
  const f = file(blob);
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [f] })) {
    try {
      await navigator.share({ files: [f] });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
    }
  }
  download(blob);
  return 'downloaded';
}
