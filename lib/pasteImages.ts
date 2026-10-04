import { useEffect, useRef, type RefObject } from 'react';
import { Platform } from 'react-native';

type PasteLike = {
  clipboardData: { items: ArrayLike<{ kind: string; type: string; getAsFile: () => unknown }> } | null;
  preventDefault: () => void;
};

/**
 * Imagens de um Ctrl+V. Se houver imagem, impede o navegador de colar (o nome do arquivo ou nada) no
 * campo; texto colado passa direto.
 */
export function imagesFromPaste(event: PasteLike): File[] {
  const items = Array.from(event.clipboardData?.items ?? []);
  const files = items
    .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
    .map((it) => it.getAsFile())
    .filter((f): f is File => !!f);
  if (files.length > 0) event.preventDefault();
  return files;
}

/** Junta as coladas às fotos que já estão no post, até o limite. */
export function addPasted(current: string[], pasted: string[], max: number): { uris: string[]; overflow: boolean } {
  const all = [...current, ...pasted];
  return { uris: all.slice(0, max), overflow: all.length > max };
}

/**
 * Web: Ctrl+V com imagem no campo vira foto (devolve URLs locais `blob:` que o upload já sabe ler).
 * No app nativo não faz nada (o teclado não cola imagem num campo de texto).
 */
export function usePasteImages(target: RefObject<unknown>, onImages: (uris: string[]) => void): void {
  const latest = useRef(onImages);
  latest.current = onImages;
  useEffect(() => {
    const node = target.current as HTMLElement | null;
    if (Platform.OS !== 'web' || !node?.addEventListener) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = imagesFromPaste(event as unknown as PasteLike);
      if (files.length > 0) latest.current(files.map((f) => URL.createObjectURL(f)));
    };
    node.addEventListener('paste', onPaste);
    return () => node.removeEventListener('paste', onPaste);
  }, [target]);
}
