import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Fotos dos posts sobem com no máximo 2048 px no lado maior, em JPEG 0.8: na tela não dá pra notar
 * diferença (nem em tela cheia num monitor Full HD) e o arquivo cai de ~2 MB para ~300 KB, o que
 * rende bem mais armazenamento e download no Supabase. GIF não passa por aqui (perderia a animação).
 */
export const UPLOAD_IMAGE = { maxSide: 2048, quality: 0.8 } as const;

/** Tamanho para o `resize` (só um lado, a proporção se mantém); null quando a foto já cabe. */
export function resizeTarget(
  width: number,
  height: number,
  maxSide: number = UPLOAD_IMAGE.maxSide,
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= maxSide) return null;
  return width >= height ? { width: maxSide } : { height: maxSide };
}

/** Devolve o uri da versão reduzida; se não der pra processar a imagem, devolve a original. */
export async function shrinkForUpload(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri);
    const original = await context.renderAsync();
    const target = resizeTarget(original.width, original.height);
    const image = target ? await context.resize(target).renderAsync() : original;
    const saved = await image.saveAsync({ compress: UPLOAD_IMAGE.quality, format: SaveFormat.JPEG });
    return saved.uri;
  } catch {
    return uri;
  }
}
