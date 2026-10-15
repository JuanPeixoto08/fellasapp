import { describe, expect, it } from 'vitest';

import { formatarTaxa, formatarValor, nomeGrupo } from './formatar';

describe('formatarValor', () => {
  it.each([
    [0, 'F$ 0'], [9.99, 'F$ 9'], [999, 'F$ 999'], [1000, 'F$ 1 mil'], [1234, 'F$ 1,23 mil'], [12_345, 'F$ 12,3 mil'],
    [999_999, 'F$ 999 mil'], [3_400_000, 'F$ 3,4 mi'], [1.2e9, 'F$ 1,2 bi'], [7.1e12, 'F$ 7,1 tri'], [5e15, 'F$ 5 quatri'],
    [2.5e18, 'F$ 2,5 quinti'], [1e21, 'F$ 1 sexti'], [1e24, 'F$ 1 septi'], [1e27, 'F$ 1 octi'], [4.2e30, 'F$ 4,2 noni'],
    [1e33, 'F$ 1 deci'], [1150, 'F$ 1,15 mil'], [2300, 'F$ 2,3 mil'], [1.15e6, 'F$ 1,15 mi'], [8200, 'F$ 8,2 mil'],
    [9.999999999999998e32, 'F$ 999 noni'], // o double logo abaixo de 1e33
  ])('%s → %s', (n, s) => expect(formatarValor(n)).toBe(s));
  it('trunca, nunca arredonda pra cima (999.999 não vira "1.000 mil")', () => expect(formatarValor(999_999.9)).toBe('F$ 999 mil'));
});

describe('formatarTaxa', () => {
  it('pequena com uma casa; grande abreviada', () => {
    expect(formatarTaxa(0.5)).toBe('+F$ 0,5/s');
    expect(formatarTaxa(1234)).toBe('+F$ 1,23 mil/s');
  });
});

describe('valores inválidos', () => {
  it('não finito ou negativo mostra zero', () => {
    for (const n of [Infinity, -Infinity, NaN, -5]) {
      expect(formatarValor(n)).toBe('F$ 0');
      expect(formatarTaxa(n)).toBe('+F$ 0/s');
    }
  });
});

describe('números gigantes (eras 6+)', () => {
  it('depois de "deci", os nomes saem por regra (prefixo + dezena) até o centilhão', () => {
    expect(Array.from({ length: 11 }, (_, i) => nomeGrupo(i))).toEqual(
      ['mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci']);
    expect(Array.from({ length: 10 }, (_, i) => nomeGrupo(11 + i))).toEqual(
      ['undeci', 'duodeci', 'tredeci', 'quatordeci', 'quindeci', 'sexdeci', 'septendeci', 'octodeci', 'novendeci', 'viginti']);
    expect([nomeGrupo(21), nomeGrupo(30), nomeGrupo(32), nomeGrupo(99), nomeGrupo(100)])
      .toEqual(['unviginti', 'triginti', 'duotriginti', 'novennonaginti', 'centi']);
    expect(new Set(Array.from({ length: 101 }, (_, i) => nomeGrupo(i))).size).toBe(101);
  });
  it.each([
    [1e36, 'F$ 1 undeci'], [4.5e63, 'F$ 4,5 viginti'], [1e99, 'F$ 1 duotriginti'], [2.5e100, 'F$ 2,5 googol'],
    [1e102, 'F$ 100 googol'], [9.999999999999999e102, 'F$ 999 googol'], [1e103, 'F$ 10 tretriginti'], [1e303, 'F$ 1 centi'],
    [9.99e305, 'F$ 999 centi'], [1.2e306, 'F$ 1,2 × 10³⁰⁶'], [Number.MAX_VALUE, 'F$ 1,79 × 10³⁰⁸'],
  ])('%s → %s', (n, s) => expect(formatarValor(n)).toBe(s));
  it('trunca na borda de cada faixa (nunca mostra mais do que tem)', () => {
    expect(formatarValor(9.999999999999999e98)).toBe('F$ 999 untriginti');
    expect(formatarValor(9.999999999999999e99)).toBe('F$ 9,99 duotriginti');
    expect(formatarValor(9.99999e305)).toBe('F$ 999 centi');
  });
  it('a taxa usa os mesmos nomes', () => {
    expect(formatarTaxa(2.5e100)).toBe('+F$ 2,5 googol/s');
    expect(formatarTaxa(3e306)).toBe('+F$ 3 × 10³⁰⁶/s');
  });
});
