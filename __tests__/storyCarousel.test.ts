import { carouselLayout } from '../lib/storyCarousel';

const base = { width: 1600, height: 900, aspect: 9 / 16, sideScale: 0.5, margin: 24, gap: 16, arrowZone: 64 };

describe('carouselLayout', () => {
  it('story aberto ocupa a altura menos a margem, em 9:16', () => {
    const { frame } = carouselLayout({ ...base, count: 3, current: 1 });
    expect(frame.height).toBe(852);
    expect(frame.width).toBe(Math.round(852 * (9 / 16)));
    expect(frame.y).toBe(24);
  });

  it('no meio quando há alguém antes', () => {
    const { frame } = carouselLayout({ ...base, count: 3, current: 1 });
    expect(frame.x).toBe(Math.round((1600 - frame.width) / 2));
  });

  it('primeiro da fila também fica no meio; o lado esquerdo fica vazio', () => {
    const { frame, cards } = carouselLayout({ ...base, count: 5, current: 0 });
    expect(frame.x).toBe(Math.round((1600 - frame.width) / 2));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.x > frame.x)).toBe(true);
  });

  it('cartões menores, centrados na altura, os de antes à esquerda e os de depois à direita', () => {
    const { frame, cards } = carouselLayout({ ...base, width: 2000, count: 5, current: 2 });
    const cardHeight = Math.round(852 * 0.5);
    expect(cards.every((c) => c.height === cardHeight && c.y === Math.round((900 - cardHeight) / 2))).toBe(true);
    const left = cards.filter((c) => c.x < frame.x).map((c) => c.group);
    const right = cards.filter((c) => c.x > frame.x).map((c) => c.group);
    expect(left).toEqual([1, 0]);
    expect(right).toEqual([3, 4]);
    expect(cards.find((c) => c.group === 1)!.x + cards[0].width).toBe(frame.x - 64);
    expect(cards.find((c) => c.group === 3)!.x).toBe(frame.x + frame.width + 64);
  });

  it('só entram os cartões que cabem inteiros na janela', () => {
    const { cards } = carouselLayout({ ...base, width: 1400, count: 9, current: 4 });
    // 1400 px: cabe um de cada lado
    expect(cards.map((c) => c.group)).toEqual([3, 5]);
    expect(cards.every((c) => c.x >= 24 && c.x + c.width <= 1400 - 24)).toBe(true);
  });

  it('janela estreita: o story encolhe para caber com as setas', () => {
    const { frame } = carouselLayout({ ...base, width: 500, height: 1000, count: 1, current: 0 });
    expect(frame.width).toBe(500 - 2 * 24 - 2 * 64);
    expect(frame.height).toBe(Math.round(frame.width / (9 / 16)));
  });

  it('setas centradas na faixa ao lado do story', () => {
    const { frame, prevArrow, nextArrow } = carouselLayout({ ...base, count: 3, current: 1 });
    expect(prevArrow).toEqual({ x: frame.x - 32, y: 450 });
    expect(nextArrow).toEqual({ x: frame.x + frame.width + 32, y: 450 });
  });
});
