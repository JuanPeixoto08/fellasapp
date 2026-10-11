import { describe, expect, it } from 'vitest';

import { proximaBusca, RECARREGA_BOLSA } from './bolsa';

describe('o main e a Bolsa', () => {
  it('busca de novo logo depois da virada do minuto', () => {
    expect(proximaBusca(42_000)).toBe(42_300);
    expect(proximaBusca(0)).toBe(1000);
  });
  it('recusas que pedem o mercado de novo', () => {
    expect(RECARREGA_BOLSA).toContain('idle_bolsa_preco_mudou');
    expect(RECARREGA_BOLSA).toContain('idle_bolsa_rj');
  });
});
