/**
 * Matemática do "Ajustar foto" (foto de perfil). A foto começa cobrindo o círculo (lado menor = diâmetro)
 * e o zoom multiplica isso. `offset` é o deslocamento do centro da foto em relação ao centro do círculo,
 * em pixels de tela; ele é sempre limitado para a foto não deixar buraco dentro do círculo.
 */
export const AVATAR_CROP = { minZoom: 1, maxZoom: 4, zoomStep: 0.5, output: 512, quality: 0.8 } as const;

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };
export type CropRect = { originX: number; originY: number; width: number; height: number };

export function clampZoom(zoom: number): number {
  return Math.min(AVATAR_CROP.maxZoom, Math.max(AVATAR_CROP.minZoom, zoom));
}

/** Botões − / +: `direction` 1 aproxima, -1 afasta. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(zoom + direction * AVATAR_CROP.zoomStep);
}

/** Pinça: o zoom acompanha a razão entre a distância atual dos dedos e a do começo do gesto. */
export function pinchZoom(startZoom: number, startDistance: number, distance: number): number {
  if (startDistance <= 0) return startZoom;
  return clampZoom((startZoom * distance) / startDistance);
}

/** Escala de pixels da foto para pixels de tela. */
export function scaleFor(image: Size, viewport: number, zoom: number): number {
  return (viewport / Math.min(image.width, image.height)) * clampZoom(zoom);
}

function clamp(value: number, limit: number): number {
  // `+ 0` evita -0 quando o limite é zero
  return Math.min(limit, Math.max(-limit, value)) + 0;
}

export function clampOffset(image: Size, viewport: number, zoom: number, offset: Offset): Offset {
  const s = scaleFor(image, viewport, zoom);
  return {
    x: clamp(offset.x, (image.width * s - viewport) / 2),
    y: clamp(offset.y, (image.height * s - viewport) / 2),
  };
}

/** Quadrado da foto original (em pixels dela) que aparece dentro do círculo. */
export function cropRect(image: Size, viewport: number, zoom: number, offset: Offset): CropRect {
  const s = scaleFor(image, viewport, zoom);
  const { x, y } = clampOffset(image, viewport, zoom, offset);
  const size = Math.min(Math.round(viewport / s), image.width, image.height);
  const origin = (length: number, shift: number) =>
    Math.min(length - size, Math.max(0, Math.round(length / 2 - (shift + viewport / 2) / s)));
  return { originX: origin(image.width, x), originY: origin(image.height, y), width: size, height: size };
}
