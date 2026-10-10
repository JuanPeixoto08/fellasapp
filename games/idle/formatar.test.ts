import { describe, expect, it } from 'vitest';

import { formatarTaxa, formatarValor } from './formatar';

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
