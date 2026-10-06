export type Rect = { x: number; y: number; width: number; height: number };
export type CarouselCard = Rect & { group: number };
export type CarouselLayout = {
  /** O story aberto. */
  frame: Rect;
  /** As outras pessoas: antes à esquerda (a mais próxima primeiro), depois à direita. Só as que cabem. */
  cards: CarouselCard[];
  /** Centro das setas ‹ › na faixa ao lado do story aberto. */
  prevArrow: { x: number; y: number };
  nextArrow: { x: number; y: number };
};

type Input = {
  width: number;
  height: number;
  /** Quantas pessoas têm story e qual está aberta. */
  count: number;
  current: number;
  /** Largura/altura do story (9:16). */
  aspect: number;
  /** Altura dos cartões ao lado, como fração da altura do story aberto. */
  sideScale: number;
  /** Margem da janela, espaço entre cartões e faixa das setas (de cada lado do story aberto). */
  margin: number;
  gap: number;
  arrowZone: number;
};

/**
 * Carrossel de stories no computador: o story aberto sempre no meio (no primeiro da fila, a esquerda fica
 * vazia) e as outras pessoas em cartões menores dos lados, quantos couberem.
 */
export function carouselLayout(input: Input): CarouselLayout {
  const { width, height, count, current, aspect, sideScale, margin, gap, arrowZone } = input;
  let frameHeight = Math.max(0, height - 2 * margin);
  let frameWidth = Math.round(frameHeight * aspect);
  const room = width - 2 * margin - 2 * arrowZone;
  if (frameWidth > room) {
    frameWidth = Math.max(0, room);
    frameHeight = Math.round(frameWidth / aspect);
  }
  const frame: Rect = {
    x: Math.round((width - frameWidth) / 2),
    y: Math.round((height - frameHeight) / 2),
    width: frameWidth,
    height: frameHeight,
  };

  const cardHeight = Math.round(frameHeight * sideScale);
  const cardWidth = Math.round(cardHeight * aspect);
  const cardY = Math.round((height - cardHeight) / 2);
  const cards: CarouselCard[] = [];
  let x = frame.x - arrowZone - cardWidth;
  for (let g = current - 1; g >= 0 && x >= margin; g--, x -= cardWidth + gap) {
    cards.push({ group: g, x, y: cardY, width: cardWidth, height: cardHeight });
  }
  x = frame.x + frame.width + arrowZone;
  for (let g = current + 1; g < count && x + cardWidth <= width - margin; g++, x += cardWidth + gap) {
    cards.push({ group: g, x, y: cardY, width: cardWidth, height: cardHeight });
  }

  const middle = Math.round(height / 2);
  return {
    frame,
    cards,
    prevArrow: { x: frame.x - arrowZone / 2, y: middle },
    nextArrow: { x: frame.x + frame.width + arrowZone / 2, y: middle },
  };
}
