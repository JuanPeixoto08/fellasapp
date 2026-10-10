import { describe, expect, it } from 'vitest';

import { CENAS, chaveGente, quadroEm } from './palco';
import { PADRAO } from './personagem';

describe('palco', () => {
  it('todas as cenas têm quadros e ritmo', () => {
    expect(CENAS['cena-0-abrindo']).toEqual({ quadros: 12, atrasoMs: 180 });
    expect(CENAS['cena-5'].quadros).toBe(12);
  });
  it('loop: quadro = tempo / atraso, dando a volta', () => {
    expect(quadroEm('cena-1', 0, false)).toBe(0);
    expect(quadroEm('cena-1', 149, false)).toBe(0);
    expect(quadroEm('cena-1', 150, false)).toBe(1);
    expect(quadroEm('cena-1', 150 * 8, false)).toBe(0);
  });
  it('chave da gente muda com o visual e com a ordem da equipe', () => {
    const a = chaveGente({ dono: PADRAO, equipe: [] });
    expect(chaveGente({ dono: { ...PADRAO }, equipe: [] })).toBe(a);
    expect(chaveGente({ dono: { ...PADRAO, pele: 0 }, equipe: [] })).not.toBe(a);
    const x = { ...PADRAO, roupa: 1 };
    expect(chaveGente({ dono: PADRAO, equipe: [x, PADRAO] })).not.toBe(chaveGente({ dono: PADRAO, equipe: [PADRAO, x] }));
  });
  it('uma vez: para no fim (null)', () => {
    expect(quadroEm('cena-0-abrindo', 180 * 11, true)).toBe(11);
    expect(quadroEm('cena-0-abrindo', 180 * 12, true)).toBeNull();
  });
});
