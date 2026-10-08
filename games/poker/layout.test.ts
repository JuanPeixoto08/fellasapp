import { describe, expect, it } from 'vitest';

import { betSpot, boardSlot, FELT, holeSlot, myCardSlot, SEATS } from './layout';

describe('layout do poker', () => {
  for (const o of ['portrait', 'landscape'] as const) {
    it(`${o}: 6 lugares distintos em volta do feltro`, () => {
      expect(SEATS[o]).toHaveLength(6);
      const keys = new Set(SEATS[o].map((p) => `${p.x},${p.z}`));
      expect(keys.size).toBe(6);
      for (const p of SEATS[o]) {
        // na borda: fora do miolo do feltro, mas perto dele
        const r = Math.hypot(p.x / FELT[o].rx, p.z / FELT[o].rz);
        expect(r).toBeGreaterThan(0.85);
        expect(r).toBeLessThan(1.35);
      }
    });

    it(`${o}: aposta e cartas de cada lugar ficam entre ele e o meio`, () => {
      SEATS[o].forEach((p, v) => {
        expect(Math.hypot(betSpot(o, v).x, betSpot(o, v).z)).toBeLessThan(Math.hypot(p.x, p.z));
        expect(Math.hypot(holeSlot(o, v, 0).x, holeSlot(o, v, 0).z)).toBeLessThan(Math.hypot(p.x, p.z));
      });
    });

    it(`${o}: minhas cartas embaixo, no meio; mesa centrada`, () => {
      expect(myCardSlot(o, 0).x).toBeCloseTo(-myCardSlot(o, 1).x);
      expect(myCardSlot(o, 0).z).toBeGreaterThan(0.5);
      expect(boardSlot(o, 0).x).toBeCloseTo(-boardSlot(o, 4).x);
      expect(boardSlot(o, 2).x).toBeCloseTo(0);
    });
  }

  it('deitado: lugares fixos com a esquerda no 0 e sentido horário', () => {
    const [left, topLeft, topRight, right, bottomRight, bottomLeft] = SEATS.landscape;
    expect(left.x).toBeLessThan(topLeft.x);
    expect(topLeft.z).toBeLessThan(0);
    expect(topRight.x).toBeGreaterThan(0);
    expect(right.x).toBeGreaterThan(topRight.x);
    expect(bottomRight.z).toBeGreaterThan(0);
    expect(bottomLeft.x).toBeLessThan(0);
  });
});
