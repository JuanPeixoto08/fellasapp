import { describe, expect, it } from 'vitest';

import { criarLimite, GRANDES, IDS_EFEITOS, RECEITAS, type IdEfeito, type OpcoesEfeito } from './efeitos';
import { comoContexto, ContextoFalso, destinoFalso } from './falso';

const tocar = (id: IdEfeito, o: OpcoesEfeito = {}) => {
  const c = new ContextoFalso();
  const dura = RECEITAS[id](comoContexto(c), destinoFalso(c), 1, o);
  return { c, dura };
};

describe('efeitos', () => {
  it('todos os momentos da spec têm receita; cada uma agenda, se desliga e diz quanto dura', () => {
    expect([...IDS_EFEITOS].sort()).toEqual(
      ['abrir', 'acaoCompra', 'acaoVende', 'cnpj', 'clique', 'compra', 'compraMuitas', 'conquista', 'contratado', 'dourado',
        'douradoPego', 'era', 'erro', 'fechar', 'no', 'oportunidade', 'pegar', 'plantar', 'po', 'venda',
        'mae', 'shopee', 'call', 'telaAzul', 'gol', 'trend', 'linkedin', 'pix', 'tigreGira', 'tigrePaga', 'tigreCome', 'combo', 'lixo', 'houston', 'conserto'].sort(),
    );
    for (const id of IDS_EFEITOS) {
      const { c, dura } = tocar(id);
      expect(c.osciladores().length, id).toBeGreaterThan(0);
      expect(dura, id).toBeGreaterThan(0);
      expect(dura, id).toBeLessThan(3);
      for (const o of c.osciladores()) expect(o.fim!, id).toBeLessThan(1 + 4);
    }
  });
  it('mais compras, cascata maior (de 3 a 8 moedas)', () => {
    const moedas = (quantas: number) => tocar('compraMuitas', { quantas }).c.osciladores().length;
    expect(moedas(10)).toBeLessThan(moedas(1000));
    expect(moedas(1)).toBe(3);
    expect(moedas(1e9)).toBe(8);
  });
  it('vender com lucro e com prejuízo soam diferente', () => {
    const notas = (lucro: boolean) => tocar('acaoVende', { lucro }).c.osciladores().map((o) => o.frequency.eventos[0][1]);
    expect(notas(true)).not.toEqual(notas(false));
  });
  it('limite: o mesmo efeito no máximo a cada 60 ms; outro efeito não espera', () => {
    const pode = criarLimite();
    expect(pode('clique', 0)).toBe(true);
    expect(pode('clique', 30)).toBe(false);
    expect(pode('compra', 30)).toBe(true);
    expect(pode('clique', 60)).toBe(true);
  });
  it('clique, abrir e fechar são um "toc" com nota, sem chiado de ruído (o chiado parecia choque)', () => {
    for (const id of ['clique', 'abrir', 'fechar'] as const) {
      const { c, dura } = tocar(id);
      expect(c.osciladores().every((o) => o.buffer === null), id).toBe(true);
      expect(dura, id).toBeLessThanOrEqual(0.15);
      const picos = c.ganhos().flatMap((g) => g.gain.eventos.map((e) => e[1]));
      expect(Math.max(...picos), id).toBeLessThanOrEqual(0.12);
    }
    const f = tocar('clique').c.osciladores()[0].frequency.eventos;
    expect(f[f.length - 1][1]).toBeLessThan(f[0][1]); // cai: "toc", não "pi"
  });
  it('momentos grandes', () => {
    expect([...GRANDES].sort()).toEqual(['cnpj', 'combo', 'conquista', 'douradoPego', 'era', 'venda']);
  });
});
