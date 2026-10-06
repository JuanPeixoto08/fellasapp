/** Limite de tamanho do armazenamento das fotos (bucket post-images, 0001_init.sql). */
export const GIF_MAX_BYTES = 5 * 1024 * 1024;

/** O que a galeria devolve e a regra usa. */
type Picked = { uri: string; mimeType?: string | null; fileName?: string | null; fileSize?: number | null };

/** GIF pelo tipo ou pelo nome (o "Ajustar foto" salva em JPEG e mataria a animação). */
export function isGif(asset: Picked): boolean {
  return asset.mimeType === 'image/gif' || /\.gif$/i.test(asset.fileName ?? '') || /\.gif$/i.test(asset.uri);
}

/** Motivo para recusar o GIF (texto da tela), ou null. Tamanho desconhecido passa: o envio confere de novo. */
export function gifProblem(asset: Picked): string | null {
  return asset.fileSize && asset.fileSize > GIF_MAX_BYTES ? 'Esse GIF passa de 5 MB. Escolhe um menor.' : null;
}
