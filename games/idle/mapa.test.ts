import { describe, expect, it } from 'vitest';
import { LUGARES, MARCOS, custoNivel, formatarNumero, lancado, multMapa, nomeValido, posicaoGenerica, precoAbrir, semanaIdx } from './mapa';

/** [lugar, sal, n, semana, índice]: fixos; o banco tem que dar os mesmos (a mesma lista em test/idleMapa.test.ts). */
const SEMANA_FIXOS: [number, number, number, string, number][] = [
  [3, 0, 12, '2026-10-12', 3], [4, 0, 12, '2026-10-12', 9], [7, 0, 12, '2026-10-12', 4], [3, 0, 12, '2026-10-19', 10],
  [7, 1, 5, '2027-03-01', 2], [4, 2, 7, '2026-01-05', 4], [3, 0, 1, '2026-11-02', 0], [7, 0, 12, '2025-12-29', 0],
];

describe('lugares', () => {
  it('9 lugares, 2 lançados no lote 1 (camisetaria, copão); o jantar fica pro lote 2', () => {
    expect(LUGARES.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(LUGARES.filter(lancado).map((l) => l.id)).toEqual([3, 4]);
    expect(LUGARES[6]).toMatchObject({ id: 7, lote: 2 });
  });
  it('faixas: barato 2 h era 2, médio 6 h era 3, caro 16 h era 4', () => {
    for (const l of LUGARES) expect([l.horas, l.era]).toEqual({ barato: [2, 2], medio: [6, 3], caro: [16, 4] }[l.faixa]);
  });
  it('preço de abrir = horas da produção', () => {
    expect(precoAbrir(LUGARES[2], 10)).toBe(72_000);
    expect(precoAbrir(LUGARES[6], 1)).toBe(57_600);
  });
});

describe('nível e marcos', () => {
  it('custo do nível sobe 55% e para no 25', () => {
    expect(custoNivel(LUGARES[2], 1)).toBe(100);
    expect(custoNivel(LUGARES[2], 2)).toBeCloseTo(155);
    expect(custoNivel(LUGARES[2], 24)).toBeCloseTo(100 * 1.55 ** 23);
    expect(custoNivel(LUGARES[2], 25)).toBeNull();
  });
  it('8 marcos por lugar com mecânica (o jantar já com os dele), somando 22%', () => {
    for (const id of [3, 4, 7]) {
      const ms = MARCOS.filter((m) => m.lugar === id);
      expect(ms.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((k) => id * 10 + k));
      expect(ms.reduce((a, m) => a + m.bonus, 0)).toBeCloseTo(0.22);
    }
  });
  it('mult do mapa: marcos, Monopólio dobra, Marca forte +5% por lugar', () => {
    expect(multMapa(0.07, 2, { marcosMult: 1, porLugar: 0 })).toBeCloseTo(1.07);
    expect(multMapa(0.07, 2, { marcosMult: 2, porLugar: 0 })).toBeCloseTo(1.14);
    expect(multMapa(0.07, 2, { marcosMult: 1, porLugar: 0.05 })).toBeCloseTo(1.17);
    expect(multMapa(0, 0, { marcosMult: 2, porLugar: 0.05 })).toBe(1);
  });
});

describe('semana, nome, número', () => {
  it('semanaIdx é estável, fica em [0, n) e muda com a semana', () => {
    const a = semanaIdx(3, 0, 12, '2026-10-12');
    expect(a).toBe(semanaIdx(3, 0, 12, '2026-10-12'));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(12);
    const semanas = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'].map((s) => semanaIdx(3, 0, 12, s));
    expect(new Set(semanas).size).toBeGreaterThan(1);
  });
  it('semanaIdx: valores fixos (o banco tem os mesmos em idleMapa.test.ts)', () => {
    for (const [l, sal, n, semana, idx] of SEMANA_FIXOS) expect(semanaIdx(l, sal, n, semana)).toBe(idx);
  });
  it('semanaIdx: em 52 semanas seguidas com 12 opções, cada lugar passa por todas, e o 3 e o 7 não andam juntos', () => {
    const ano = (l: number) => Array.from({ length: 52 }, (_, k) => semanaIdx(l, 0, 12, new Date(Date.UTC(2026, 0, 5 + 7 * k)).toISOString().slice(0, 10)));
    for (const l of [3, 4, 7]) expect(new Set(ano(l)).size).toBe(12);
    expect(ano(3).some((x, k) => x !== ano(7)[k])).toBe(true);
  });
  it('nome: trim, 1 a 30, sem quebra de linha', () => {
    expect(nomeValido('  Camisa do Luis  ')).toBe('Camisa do Luis');
    expect(nomeValido('   ')).toBeNull();
    expect(nomeValido('a'.repeat(31))).toBeNull();
    expect(nomeValido('a'.repeat(30))).toBe('a'.repeat(30));
    expect(nomeValido('duas\nlinhas')).toBeNull();
  });
  it('nome: conta letras de verdade (emoji = 1) e recusa os separadores de linha do Unicode', () => {
    expect(nomeValido('😎'.repeat(16))).toBe('😎'.repeat(16));
    expect(nomeValido('😎'.repeat(30))).toBe('😎'.repeat(30));
    expect(nomeValido('😎'.repeat(31))).toBeNull();
    for (const sep of ['\u2028', '\u2029', '\u0085']) expect(nomeValido(`duas${sep}linhas`)).toBeNull();
  });
  it('número do pódio de cada lugar', () => {
    expect(formatarNumero(LUGARES[2], 230.4)).toBe('230%');
    expect(formatarNumero(LUGARES[3], 741.6)).toBe('742');
    expect(formatarNumero(LUGARES[6], 4.4)).toBe('4,4');
  });
  it('posição genérica fica dentro do mapa 160×96', () => {
    for (const l of LUGARES) {
      const p = posicaoGenerica(l.id);
      expect(p.x).toBeGreaterThan(5); expect(p.x).toBeLessThan(155);
      expect(p.y).toBeGreaterThan(5); expect(p.y).toBeLessThan(91);
    }
  });
});
