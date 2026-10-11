import { describe, expect, it } from 'vitest';

import { faltaVirar, proximaBusca, RECARREGA_BOLSA } from './bolsa';

describe('o main e a Bolsa', () => {
  it('busca de novo logo depois da virada do minuto', () => {
    expect(proximaBusca(42_000)).toBe(42_300);
    expect(proximaBusca(0)).toBe(1000);
  });
  it('quanto falta pra virar o minuto, contando o tempo desde a busca', () => {
    expect(faltaVirar(42_000, 1_000, 1_000)).toBe(42_000);
    expect(faltaVirar(42_000, 1_000, 33_500)).toBe(9_500);
    expect(faltaVirar(42_000, 1_000, 50_000)).toBe(0);
  });
  it('recusas que pedem o mercado de novo', () => {
    expect(RECARREGA_BOLSA).toContain('idle_bolsa_preco_mudou');
    expect(RECARREGA_BOLSA).toContain('idle_bolsa_rj');
  });
});
