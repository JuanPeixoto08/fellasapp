import { describe, expect, it } from 'vitest';

import { batidasDoGiro, bpm, eraMusica, instrumentosDaEra, notasDoGiro, segundosDoGiro } from './musica';
import { forma, MELODIA_LUA, MELODIA_ORBITA, notasEspaco } from './musicaEspaco';

describe('músicas das eras 6 (Órbita) e 7 (Lua)', () => {
  it('16 compassos de 4 tempos; Órbita a 66 bpm e Lua a 60 (giro de 64 s); a era 9 toca a 7', () => {
    expect([batidasDoGiro(5), batidasDoGiro(6), batidasDoGiro(7)]).toEqual([128, 64, 64]);
    expect([bpm(6), bpm(7)]).toEqual([66, 60]);
    expect(segundosDoGiro(7)).toBe(64);
    expect(eraMusica(9)).toBe(7);
    expect(notasDoGiro(7, 1)).toEqual(notasEspaco(7, 1));
  });
  it('as melodias fecham 4 tempos por compasso e, nos tempos 1 e 3, são nota do acorde (o baixo ou o órgão)', () => {
    for (const [era, mel] of [[6, MELODIA_ORBITA], [7, MELODIA_LUA]] as const) {
      const f = forma(era);
      mel.forEach((frase, i) => {
        expect(frase.reduce((a, [d]) => a + d, 0)).toBe(4);
        const k = f[8 + i];
        const pcs = [k.baixo, ...k.orgao].map((n) => n % 12);
        let pos = 0;
        for (const [d, n] of frase) {
          if (n !== null && (pos === 0 || pos === 2)) expect(pcs, `era ${era}, compasso ${9 + i}`).toContain(n % 12);
          pos += d;
        }
      });
    }
  });
  it('humanizado com semente: o mesmo giro sai igual; o tempo varia no máximo 0,02 batida e a força varia; o tique-taque não sai do tempo', () => {
    for (const era of [6, 7] as const) {
      for (const giro of [0, 1]) {
        const a = notasEspaco(era, giro);
        expect(notasEspaco(era, giro)).toEqual(a);
        for (const n of a) expect(Math.abs(n.t - Math.round(n.t * 4) / 4)).toBeLessThanOrEqual(0.0201);
        expect(a.filter((n) => n.inst === 'tique').every((n) => Number.isInteger(n.t))).toBe(true);
        expect(new Set(a.map((n) => n.forca)).size).toBeGreaterThan(10);
        for (const n of a) expect(instrumentosDaEra(era)).toContain(n.inst);
      }
    }
  });
  it('a Lua marca o tempo: tique-taque em cada batida (64 por giro), agudo e grave alternando; a Órbita não tem', () => {
    const tiques = notasEspaco(7, 0).filter((n) => n.inst === 'tique');
    expect(tiques).toHaveLength(64);
    expect(tiques.slice(0, 4).map((n) => n.altura)).toEqual([1, 0, 1, 0]);
    expect(notasEspaco(6, 0).some((n) => n.inst === 'tique')).toBe(false);
  });
  it('a Órbita cresce: o giro 1 tem mais arpejo que o 0, e só ele tem a melodia (órgão acima do Lá 4)', () => {
    const arpejos = (g: number) => notasEspaco(6, g).filter((n) => n.inst === 'arpejo').length;
    expect(arpejos(1)).toBeGreaterThan(arpejos(0));
    const melodia = (g: number) => notasEspaco(6, g).filter((n) => n.inst === 'orgao' && n.altura >= 69).length;
    expect(melodia(0)).toBe(0);
    expect(melodia(1)).toBeGreaterThan(0);
  });
});
