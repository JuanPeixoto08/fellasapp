import { describe, expect, it } from 'vitest';

import { formatarTaxa, formatarValor } from './formatar';

describe('formatarValor', () => {
  it.each([
    [0, 'R$ 0'], [9.99, 'R$ 9'], [999, 'R$ 999'], [1000, 'R$ 1 mil'], [1234, 'R$ 1,23 mil'], [12_345, 'R$ 12,3 mil'],
    [999_999, 'R$ 999 mil'], [3_400_000, 'R$ 3,4 mi'], [1.2e9, 'R$ 1,2 bi'], [7.1e12, 'R$ 7,1 tri'], [5e15, 'R$ 5 quatri'],
    [2.5e18, 'R$ 2,5 quinti'], [1e21, 'R$ 1 sexti'], [1e24, 'R$ 1 septi'], [1e27, 'R$ 1 octi'], [4.2e30, 'R$ 4,2 noni'],
    [1e33, 'R$ 1 deci'], [1150, 'R$ 1,15 mil'], [2300, 'R$ 2,3 mil'], [1.15e6, 'R$ 1,15 mi'], [8200, 'R$ 8,2 mil'],
    [9.999999999999998e32, 'R$ 999 noni'], // o double logo abaixo de 1e33
  ])('%s → %s', (n, s) => expect(formatarValor(n)).toBe(s));
  it('trunca, nunca arredonda pra cima (999.999 não vira "1.000 mil")', () => expect(formatarValor(999_999.9)).toBe('R$ 999 mil'));
});

describe('formatarTaxa', () => {
  it('pequena com uma casa; grande abreviada', () => {
    expect(formatarTaxa(0.5)).toBe('+R$ 0,5/s');
    expect(formatarTaxa(1234)).toBe('+R$ 1,23 mil/s');
  });
});

describe('valores inválidos', () => {
  it('não finito ou negativo mostra zero', () => {
    for (const n of [Infinity, -Infinity, NaN, -5]) {
      expect(formatarValor(n)).toBe('R$ 0');
      expect(formatarTaxa(n)).toBe('+R$ 0/s');
    }
  });
});
