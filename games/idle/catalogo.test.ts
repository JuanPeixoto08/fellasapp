import { describe, expect, it } from 'vitest';

import { catalogo, montarCatalogo, PARAMETROS } from './catalogo';

describe('catálogo', () => {
  it('30 geradores em 5 eras de 6, custo e renda crescentes', () => {
    const g = catalogo.geradores;
    expect(g).toHaveLength(30);
    expect(g.map((x) => x.era)).toEqual(Array.from({ length: 30 }, (_, i) => Math.floor(i / 6) + 1));
    expect(g[0]).toMatchObject({ id: 1, custo: 15, renda: 0.5 });
    for (let i = 1; i < 30; i++) {
      expect(g[i].custo).toBeGreaterThan(g[i - 1].custo);
      expect(g[i].renda).toBeGreaterThan(g[i - 1].renda);
    }
  });

  it('melhorias: 150 de gerador, 20 gerais, 30 sinergias, ids únicos', () => {
    const m = catalogo.melhorias;
    expect(m.filter((x) => x.tipo === 'gerador')).toHaveLength(150);
    expect(m.filter((x) => x.tipo === 'geral')).toHaveLength(20);
    expect(m.filter((x) => x.tipo === 'sinergia')).toHaveLength(30);
    expect(new Set(m.map((x) => x.id)).size).toBe(200);
    expect(m.find((x) => x.id === 71)).toMatchObject({ tipo: 'gerador', gerador: 7, nivel: 1, requer: 1, nome: 'Crachá com foto' });
    expect(m.find((x) => x.id === 305)).toMatchObject({ gerador: 30, nivel: 5, requer: 100 });
  });

  it('12 estratégias; as que dependem de contratos/propriedades vêm desligadas', () => {
    const e = catalogo.estrategias;
    expect(e).toHaveLength(12);
    expect(e.filter((x) => !x.ativa).map((x) => x.nome)).toEqual(['Networking', 'Marca forte', 'Monopólio', 'Cultura de startup']);
    expect(e.find((x) => x.nome === 'Queimar caixa')).toMatchObject({ custoMult: 1.25, prodMult: 1.6, genMult: 1 });
  });

  it('montarCatalogo usa os parâmetros', () => {
    const c = montarCatalogo({ ...PARAMETROS, custoInicial: 20 });
    expect(c.geradores[0].custo).toBe(20);
  });
});
