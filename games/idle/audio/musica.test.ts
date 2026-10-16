import { describe, expect, it } from 'vitest';

import {
  acorde, acordeEm, BATIDAS_GIRO, batidasDoGiro, bpm, COMPASSOS, FORMA, instrumentosDaEra, notasDoAcorde, notasDoGiro, segundosDoGiro,
  solo, swing, TEMA,
} from './musica';

const FAIXA: Partial<Record<string, readonly [number, number]>> = { baixo: [28, 55], piano: [50, 79], vibrafone: [62, 91], metais: [55, 84],
  orgao: [40, 84], arpejo: [60, 96], grave: [24, 52], pad: [48, 88], tique: [0, 1] };

/** Nos tempos 1 e 3 (posição 0 e 2 do compasso) a melodia está numa nota do acorde. */
function confereFrases(frases: readonly (readonly (readonly [number, number | null])[])[], era: number) {
  expect(frases).toHaveLength(COMPASSOS);
  frases.forEach((frase, c) => {
    expect(frase.reduce((s, [d]) => s + d, 0)).toBe(4);
    let pos = 0;
    for (const [d, n] of frase) {
      if (n !== null && (pos === 0 || pos === 2)) expect(notasDoAcorde(acordeEm(era, c, pos))).toContain(n % 12);
      pos += d;
    }
  });
}

describe('partitura', () => {
  it('forma AABA de 32 compassos, 1 ou 2 acordes por compasso, cifras conhecidas', () => {
    expect(FORMA).toHaveLength(32);
    for (const c of FORMA) {
      expect([1, 2]).toContain(c.length);
      c.forEach((x) => acorde(x));
    }
    expect(FORMA.slice(0, 6)).toEqual(FORMA.slice(8, 14)); // A1 e A2 começam iguais
    expect(FORMA.slice(0, 8)).toEqual(FORMA.slice(24, 32)); // A3 = A1
  });
  it('tema: todo compasso fecha em 4 tempos; nos tempos 1 e 3 a melodia está numa nota do acorde', () => {
    confereFrases(TEMA, 1);
  });
  it('solo (2º giro): as mesmas regras, sempre igual, inclusive com a Sede subindo um tom', () => {
    for (const era of [2, 5]) {
      expect(solo(era)).toEqual(solo(era));
      confereFrases(solo(era), era);
    }
  });
  it('swing de tercina e andamento por era', () => {
    expect(swing(1.5)).toBeCloseTo(1 + 2 / 3);
    expect(swing(2)).toBe(2);
    expect(swing(1 + 1 / 3)).toBeCloseTo(1 + 1 / 3);
    expect([0, 1, 2, 3, 4, 5].map(bpm)).toEqual([120, 120, 126, 132, 138, 144]);
    expect([bpm(6), bpm(7)]).toEqual([66, 60]);
    expect(BATIDAS_GIRO).toBe(128);
    expect(segundosDoGiro(1)).toBe(64);
  });
  it('as notas de cada era: dentro do giro, na faixa de cada instrumento, ordenadas, só instrumentos da era', () => {
    for (let era = 0; era <= 7; era++) {
      for (const giro of [0, 1]) {
        const ns = notasDoGiro(era, giro);
        ns.forEach((n, i) => {
          expect(n.t).toBeGreaterThanOrEqual(0);
          expect(n.t).toBeLessThan(batidasDoGiro(era));
          expect(n.dur).toBeGreaterThan(0);
          expect(n.forca).toBeGreaterThan(0);
          expect(n.forca).toBeLessThanOrEqual(1);
          if (i) expect(n.t).toBeGreaterThanOrEqual(ns[i - 1].t);
          const f = FAIXA[n.inst];
          if (f) {
            expect(n.altura).toBeGreaterThanOrEqual(f[0]);
            expect(n.altura).toBeLessThanOrEqual(f[1]);
          } else expect(n.altura).toBe(0);
          expect(instrumentosDaEra(era)).toContain(n.inst);
        });
      }
    }
  });
  it('cada era tem pelo menos os instrumentos da anterior; o Quarto não tem melodia, a Garagem tem', () => {
    for (let e = 1; e <= 5; e++) for (const i of instrumentosDaEra(e - 1)) expect(instrumentosDaEra(e)).toContain(i);
    expect(notasDoGiro(1, 0).some((n) => n.inst === 'vibrafone')).toBe(false);
    expect(notasDoGiro(2, 0).some((n) => n.inst === 'vibrafone')).toBe(true);
    expect(instrumentosDaEra(0)).toEqual(['baixo', 'escovinha']);
  });
  it('baixo andando: 4 por compasso, a 1ª do compasso é a raiz', () => {
    const b = notasDoGiro(3, 0).filter((n) => n.inst === 'baixo');
    expect(b).toHaveLength(BATIDAS_GIRO);
    for (let c = 0; c < COMPASSOS; c++) expect(b[c * 4].altura % 12).toBe(acordeEm(3, c, 0).raiz);
  });
  it('Sede: a última A sobe um tom (baixo em Sol no compasso 25) e a volta (compasso 32) fica em Fá', () => {
    const baixo = (era: number, t: number) => notasDoGiro(era, 0).find((n) => n.inst === 'baixo' && n.t === t)!.altura % 12;
    expect(baixo(4, 96)).toBe(5);
    expect(baixo(5, 96)).toBe(7);
    expect(baixo(5, 124)).toBe(7); // Gm7 da volta, sem subir
    expect(baixo(5, 0)).toBe(5);
  });
});
