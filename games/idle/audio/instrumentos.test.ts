import { describe, expect, it } from 'vitest';

import { comoContexto, ContextoFalso, destinoFalso } from './falso';
import { hz, INSTRUMENTOS } from './instrumentos';

describe('instrumentos', () => {
  it('todo instrumento agenda no instante pedido e se desliga sozinho', () => {
    for (const [nome, toque] of Object.entries(INSTRUMENTOS)) {
      const c = new ContextoFalso();
      toque(comoContexto(c), destinoFalso(c), 1, 60, 0.5, 1);
      const os = c.osciladores();
      expect(os.length, nome).toBeGreaterThan(0);
      for (const o of os) {
        expect(o.inicio, nome).toBe(1);
        expect(o.fim!, nome).toBeGreaterThan(1);
        expect(o.fim!, nome).toBeLessThan(4);
      }
    }
  });
  it('volume de cada nota com folga (o limitador é a última defesa, não a primeira)', () => {
    for (const [nome, toque] of Object.entries(INSTRUMENTOS)) {
      const c = new ContextoFalso();
      toque(comoContexto(c), destinoFalso(c), 0, 60, 0.5, 1);
      for (const g of c.ganhos()) for (const [tipo, v] of g.gain.eventos) if (tipo === 'lin') expect(v, nome).toBeLessThanOrEqual(0.5);
    }
  });
  it('hz: Lá 440 e as oitavas', () => {
    expect(hz(69)).toBe(440);
    expect(hz(81)).toBe(880);
    expect(hz(57)).toBe(220);
  });
});
