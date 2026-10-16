import { describe, expect, it } from 'vitest';

import { comoContexto, ContextoFalso, destinoFalso, ParamFalso } from './falso';
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
      // fora o ganho que só dá a profundidade de uma modulação (o vibrato do órgão sobe até 4 cents, não é volume)
      for (const g of c.ganhos().filter((x) => !x.ligados.some((l) => l instanceof ParamFalso))) {
        for (const [tipo, v] of g.gain.eventos) if (tipo === 'lin') expect(v, nome).toBeLessThanOrEqual(0.5);
      }
    }
  });
  it('hz: Lá 440 e as oitavas', () => {
    expect(hz(69)).toBe(440);
    expect(hz(81)).toBe(880);
    expect(hz(57)).toBe(220);
  });
});

describe('instrumentos das eras 6 e 7', () => {
  it('órgão: duas camadas da onda das parciais (±4 cents), a oitava de baixo, ataque lento e um vibrato leve depois do ataque', () => {
    const c = new ContextoFalso();
    INSTRUMENTOS.orgao(comoContexto(c), destinoFalso(c), 1, 60, 2, 1);
    const os = c.osciladores();
    const camadas = os.filter((o) => o.onda !== null);
    expect(camadas).toHaveLength(2);
    expect(camadas.map((o) => o.detune.eventos[0][1]).sort((a, b) => a - b)).toEqual([-4, 4]);
    expect(os.some((o) => Math.abs(o.frequency.eventos[0][1] - hz(48)) < 1e-9)).toBe(true);
    const prof = c.ganhos().find((g) => g.ligados.includes(camadas[0].detune))!;
    expect(prof.gain.eventos[0]).toEqual(['set', 0, 1]);
    expect(prof.gain.eventos[1].slice(0, 2)).toEqual(['lin', 4]); // 4 cents…
    expect(prof.gain.eventos[1][2]).toBeCloseTo(1.75, 9); // …que entram depois do ataque (0,35 s + 0,4 s)
    const env = c.ganhos().find((g) => g.ligados.includes(camadas[0]) || camadas[0].ligados.includes(g))!;
    expect(env.gain.eventos.find(([t]) => t === 'lin')![2] - 1).toBeGreaterThanOrEqual(0.3); // ataque lento
  });
  it('pad: o passa-baixa abre devagar até o fim da nota', () => {
    const c = new ContextoFalso();
    INSTRUMENTOS.pad(comoContexto(c), destinoFalso(c), 0, 60, 4, 1);
    const f = c.criados.find((n) => 'Q' in n && (n as unknown as { frequency: { eventos: unknown[] } }).frequency.eventos.length >= 2) as unknown as
      { frequency: { eventos: [string, number, number][] } };
    expect(f.frequency.eventos[0][1]).toBeLessThan(400);
    expect(f.frequency.eventos.at(-1)![1]).toBeGreaterThan(1500);
    expect(f.frequency.eventos.at(-1)![2]).toBeCloseTo(4, 6);
  });
  it('tique-taque: estalo curto (menos de 0,1 s), agudo no tique e mais grave no taque', () => {
    const tom = (altura: number) => {
      const c = new ContextoFalso();
      INSTRUMENTOS.tique(comoContexto(c), destinoFalso(c), 0, altura, 0.1, 1);
      for (const o of c.osciladores()) expect(o.fim!).toBeLessThan(0.1);
      return c.osciladores().find((o) => o.buffer === null)!.frequency.eventos[0][1];
    };
    expect(tom(1)).toBeGreaterThan(tom(0));
  });
});
