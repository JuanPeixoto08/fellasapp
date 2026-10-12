import { describe, expect, it } from 'vitest';

import {
  bonusHorta, destrancado, dica, ESPECIES, especie, fase, falta, GRADE, ladoDaGrade, PASSO_S, precoSemente, resumoBonus,
} from './horta';

const H = 3600_000;

describe('o catálogo da horta', () => {
  it('as 8 plantas da spec, ids 1 a 8; só Pix e Couve sem pais; o Morango é a rara', () => {
    expect(ESPECIES.map((e) => e.nome)).toEqual([
      'Pé de Pix', 'Couve do Coach', 'Mandioca Turbo', 'Inhame do Primo Rico', 'Coentro', 'Abacate Proteico',
      'Quiabo Escorregadio', 'Morango com Pescoço',
    ]);
    expect(ESPECIES.map((e) => e.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ESPECIES.filter((e) => e.pais === null && !e.rara).map((e) => e.id)).toEqual([1, 2]);
    expect(especie(8).rara).toBe(true);
    expect(especie(3).pais).toEqual([1, 1]);
    expect(especie(6).pais).toEqual([3, 4]);
    expect(PASSO_S).toBe(300);
    expect(GRADE).toBe(6);
  });
});

describe('a grade', () => {
  it('cresce com os Food trucks: 1 → 2×2, 25 → 3×3, 50 → 4×4, 100 → 5×5, 200 → 6×6', () => {
    expect([0, 1, 24, 25, 49, 50, 99, 100, 199, 200, 999].map(ladoDaGrade)).toEqual([0, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });
  it('canteiro = linha × 6 + coluna; destrancado se cabe no lado atual', () => {
    expect(destrancado(0, 2)).toBe(true);
    expect(destrancado(7, 2)).toBe(true); // linha 1, coluna 1
    expect(destrancado(2, 2)).toBe(false); // coluna 2
    expect(destrancado(12, 2)).toBe(false); // linha 2
    expect(destrancado(35, 6)).toBe(true);
    expect(destrancado(0, 0)).toBe(false);
  });
});

describe('as fases', () => {
  const pix = especie(1); // amadurece 1 h, vive 8 h madura
  it('muda, crescendo, madura, murchando (última hora) e morta', () => {
    expect(fase(pix, 0, 0)).toBe('muda');
    expect(fase(pix, 0, 0.3 * H)).toBe('muda');
    expect(fase(pix, 0, 0.5 * H)).toBe('crescendo');
    expect(fase(pix, 0, 1 * H)).toBe('madura');
    expect(fase(pix, 0, 7.9 * H)).toBe('madura');
    expect(fase(pix, 0, 8.1 * H)).toBe('murchando');
    expect(fase(pix, 0, 9 * H)).toBe('morta');
  });
  it('quanto falta: pra amadurecer, depois pra morrer', () => {
    expect(falta(pix, 0, 0.25 * H)).toEqual({ ate: 'amadurecer', ms: 0.75 * H });
    expect(falta(pix, 0, 3 * H)).toEqual({ ate: 'morrer', ms: 6 * H });
  });
  it('preço da semente: minutos da produção atual', () => {
    expect(precoSemente(especie(1), 2)).toBe(600 * 2);
    expect(precoSemente(especie(6), 2)).toBe(1800 * 2);
  });
});

describe('os bônus', () => {
  const agora = 10 * H;
  const madura = (canteiro: number, esp: number) => ({ canteiro, especie: esp, inicioMs: agora - 2 * H });
  it('somam por planta madura destrancada; muda e trancada não contam', () => {
    const b = bonusHorta([madura(0, 1), madura(1, 1), madura(6, 5), { canteiro: 7, especie: 1, inicioMs: agora }, madura(2, 1)], 2, agora);
    // dois Pix (+2%) + Coentro (−1% produção, −3% melhorias); a muda (7) e o Pix trancado (2) ficam de fora
    expect(b.producao).toBeCloseTo(0.01, 9);
    expect(b.melhorias).toBeCloseTo(0.03, 9);
    expect(b.geradores).toBe(0);
  });
  it('descontos têm teto de 50%', () => {
    const muitos = Array.from({ length: 36 }, (_, i) => ({ canteiro: i, especie: 7, inicioMs: agora - 7 * H }));
    expect(bonusHorta(muitos, 6, agora).geradores).toBe(0.5);
  });
  it('resumo em texto', () => {
    expect(resumoBonus({ producao: 0.05, geradores: 0.03, melhorias: 0, oportunidades: 0.05 })).toBe('Produção +5% · Geradores 3% mais baratos · Oportunidades +5%');
    expect(resumoBonus({ producao: -0.01, geradores: 0, melhorias: 0.03, oportunidades: 0 })).toBe('Produção −1% · Melhorias 3% mais baratas');
    expect(resumoBonus({ producao: 0, geradores: 0, melhorias: 0, oportunidades: 0 })).toBe('Nada madura ainda');
  });
});

describe('as dicas da coleção', () => {
  it('com os dois pais descobertos aparece a dica; sem eles, nada; o Morango tem a frase dele', () => {
    expect(dica(especie(4), [1, 2])).toBe('Nasce perto de Pé de Pix e Couve do Coach');
    expect(dica(especie(3), [1, 2])).toBe('Nasce perto de dois Pé de Pix');
    expect(dica(especie(6), [1, 2, 3])).toBeNull();
    expect(dica(especie(8), [1, 2])).toBe('Tem gente que jura que viu');
  });
});
