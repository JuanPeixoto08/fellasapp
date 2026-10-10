import { describe, expect, it } from 'vitest';

import { linhaPlacar } from './types';

describe('linhaPlacar', () => {
  it('passa a linha do banco para o formato da tela', () => {
    const v = { pele: 1, cabelo: 2, cor_cabelo: 3, roupa: 1, cor_roupa: 4, acessorio: 0, cor_acessorio: 0 };
    expect(
      linhaPlacar(
        { user_id: 'b', valuation: 10, rate: 2, era: 2, strategies: [0, -1, -1, -1], avatar: v, hired_count: 3, by_me: true, most_hired: true },
        'Bia',
      ),
    ).toEqual({ userId: 'b', name: 'Bia', valuation: 10, rate: 2, era: 2, strategies: [0, -1, -1, -1], avatar: v, hiredCount: 3, byMe: true, mostHired: true });
  });
});
