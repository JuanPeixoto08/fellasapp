import { describe, expect, it } from 'vitest';

import { CARD_W, cardSlot, FAN_STEP, orientationOf } from './layout';

describe('orientationOf', () => {
  it('celular em pé é retrato; deitado largo, tablet deitado e PC são paisagem', () => {
    expect(orientationOf(390, 844)).toBe('portrait');
    expect(orientationOf(1280, 720)).toBe('landscape');
    expect(orientationOf(844, 390)).toBe('landscape');
    expect(orientationOf(800, 1000)).toBe('portrait');
    expect(orientationOf(640, 360)).toBe('portrait'); // estreito demais pro layout do PC
  });
});

describe('cardSlot', () => {
  for (const o of ['portrait', 'landscape'] as const) {
    it(`${o}: jogador mais perto da câmera que a banca`, () => {
      expect(cardSlot(o, 'player', 0, 1, 0).z).toBeGreaterThan(cardSlot(o, 'dealer', 0, 1, 0).z);
    });
  }

  it('leque: cada carta anda um passo e deixa o índice da anterior à mostra', () => {
    const a = cardSlot('portrait', 'player', 0, 1, 0);
    const b = cardSlot('portrait', 'player', 0, 1, 1);
    expect(b.x - a.x).toBeCloseTo(FAN_STEP);
    expect(FAN_STEP).toBeLessThan(CARD_W);
    expect(FAN_STEP).toBeGreaterThan(CARD_W / 2);
    expect(b.y).toBeGreaterThan(a.y); // a de cima fica por cima
  });

  it('celular em pé com duas mãos: cabem na largura (leque mais apertado, índice ainda à mostra)', () => {
    const leftEdge = cardSlot('portrait', 'player', 0, 2, 0).x - CARD_W / 2;
    expect(leftEdge).toBeGreaterThan(-2);
    const step = cardSlot('portrait', 'player', 0, 2, 1).x - cardSlot('portrait', 'player', 0, 2, 0).x;
    expect(step).toBeGreaterThanOrEqual(0.4);
  });

  it('duas mãos (dividiu): uma de cada lado, sem se encostar mesmo com 4 cartas', () => {
    for (const o of ['portrait', 'landscape'] as const) {
      const leftEnd = cardSlot(o, 'player', 0, 2, 3).x + CARD_W / 2;
      const rightStart = cardSlot(o, 'player', 1, 2, 0).x - CARD_W / 2;
      expect(leftEnd).toBeLessThan(rightStart);
      expect(cardSlot(o, 'player', 0, 2, 0).x).toBeLessThan(0);
    }
  });
});
