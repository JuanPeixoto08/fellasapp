import { describe, expect, it } from 'vitest';

import { aoVivo, instante, pendentes, semente, tipo } from './oportunidades';

const U = '00000000-0000-0000-0000-00000000000a';
const V = '1234abcd-0000-0000-0000-000000000000';

describe('oportunidades', () => {
  it('semente = 7 primeiros hex do uuid', () => {
    expect(semente(U)).toBe(0);
    expect(semente(V)).toBe(0x1234abc);
  });
  it('cada janela de 10 min tem uma, num segundo entre 0 e 589', () => {
    for (let w = 2_980_000; w < 2_980_050; w++) {
      const t = instante(V, w);
      expect(t).toBeGreaterThanOrEqual(w * 600_000);
      expect(t).toBeLessThan(w * 600_000 + 590_000);
      expect([0, 1, 2]).toContain(tipo(V, w));
    }
  });
  it('pendentes: até 3, já passaram, menos de 4h, sem as pegas', () => {
    const agora = 2_980_100 * 600_000 + 300_000;
    const p = pendentes(V, agora, []);
    expect(p).toHaveLength(3);
    for (const w of p) {
      expect(instante(V, w)).toBeLessThanOrEqual(agora);
      expect(instante(V, w)).toBeGreaterThanOrEqual(agora - 4 * 3600_000);
    }
    expect(pendentes(V, agora, [p[0]])).not.toContain(p[0]);
  });
  it('ao vivo só durante os segundos em que ela está na tela', () => {
    const w = 2_980_100;
    const t = instante(V, w);
    expect(aoVivo(V, t + 5000, 10)).toBe(w);
    expect(aoVivo(V, t + 11_000, 10)).toBeNull();
    expect(aoVivo(V, t + 25_000, 30)).toBe(w);
  });
});
