/**
 * Matemática do "Ajustar foto" (foto de perfil e banner). O quadro é o círculo (lado = diâmetro) ou o
 * retângulo do banner; a foto começa cobrindo o quadro inteiro e o zoom multiplica isso. `offset` é o
 * deslocamento do centro da foto em relação ao centro do quadro, em pixels de tela; ele é sempre limitado
 * para a foto não deixar buraco dentro do quadro. `viewport` aceita um número (quadro quadrado) ou largura × altura.
 */
export const AVATAR_CROP = { minZoom: 1, maxZoom: 4, zoomStep: 0.5, output: 512, quality: 0.8 } as const;
/** Banner do perfil: 3:1, como no Twitter. */
export const BANNER_CROP = { output: { width: 1500, height: 500 }, quality: 0.8 } as const;

export type Size = { width: number; height: number };
type Viewport = number | Size;

const frameOf = (viewport: Viewport): Size =>
  typeof viewport === 'number' ? { width: viewport, height: viewport } : viewport;
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

/** Escala de pixels da foto para pixels de tela (em 1x a foto cobre o quadro). */
export function scaleFor(image: Size, viewport: Viewport, zoom: number): number {
  const frame = frameOf(viewport);
  return Math.max(frame.width / image.width, frame.height / image.height) * clampZoom(zoom);
}

function clamp(value: number, limit: number): number {
  // `+ 0` evita -0 quando o limite é zero
  return Math.min(limit, Math.max(-limit, value)) + 0;
}

export function clampOffset(image: Size, viewport: Viewport, zoom: number, offset: Offset): Offset {
  const frame = frameOf(viewport);
  const s = scaleFor(image, frame, zoom);
  return {
    x: clamp(offset.x, (image.width * s - frame.width) / 2),
    y: clamp(offset.y, (image.height * s - frame.height) / 2),
  };
}

/** Pedaço da foto original (em pixels dela) que aparece dentro do quadro. */
export function cropRect(image: Size, viewport: Viewport, zoom: number, offset: Offset): CropRect {
  const frame = frameOf(viewport);
  const s = scaleFor(image, frame, zoom);
  const { x, y } = clampOffset(image, frame, zoom, offset);
  const width = Math.min(Math.round(frame.width / s), image.width);
  const height = Math.min(Math.round(frame.height / s), image.height);
  const origin = (length: number, size: number, shift: number, view: number) =>
    Math.min(length - size, Math.max(0, Math.round(length / 2 - (shift + view / 2) / s)));
  return {
    originX: origin(image.width, width, x, frame.width),
    originY: origin(image.height, height, y, frame.height),
    width,
    height,
  };
}
