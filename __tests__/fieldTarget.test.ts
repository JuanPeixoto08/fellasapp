import { isFieldTarget } from '../lib/fieldTarget';

// na web o alvo do clique é um elemento do DOM; no celular, um número (tag nativa)
const element = (inField: boolean) => ({ closest: (sel: string) => (inField && sel.includes('input') ? {} : null) });

describe('isFieldTarget', () => {
  it('clique dentro de um campo de texto (web)', () => {
    expect(isFieldTarget(element(true))).toBe(true);
  });

  it('clique fora de campo (web)', () => {
    expect(isFieldTarget(element(false))).toBe(false);
  });

  it('celular (alvo é número) ou sem alvo', () => {
    expect(isFieldTarget(42)).toBe(false);
    expect(isFieldTarget(undefined)).toBe(false);
    expect(isFieldTarget(null)).toBe(false);
  });
});
