import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { catalogo, catalogoSql, montarCatalogo, PARAMETROS } from './catalogo';

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

  it('melhorias: 240 de gerador, 20 gerais, 30 sinergias, ids únicos', () => {
    const m = catalogo.melhorias;
    expect(m.filter((x) => x.tipo === 'gerador')).toHaveLength(240);
    expect(m.filter((x) => x.tipo === 'geral')).toHaveLength(20);
    expect(m.filter((x) => x.tipo === 'sinergia')).toHaveLength(30);
    expect(new Set(m.map((x) => x.id)).size).toBe(290);
    expect(m.find((x) => x.id === 71)).toMatchObject({ tipo: 'gerador', gerador: 7, nivel: 1, requer: 1, nome: 'Crachá com foto' });
    expect(m.find((x) => x.id === 305)).toMatchObject({ gerador: 30, nivel: 5, requer: 100 });
    expect(m.find((x) => x.id === 16)).toMatchObject({ gerador: 1, nivel: 6, requer: 150, nome: 'ChatGPT fazendo o TCC' });
    expect(m.find((x) => x.id === 138)).toMatchObject({ gerador: 13, nivel: 8, requer: 300, nome: 'Mensagem subliminar no episódio' });
    expect(m.find((x) => x.id === 308)).toMatchObject({ gerador: 30, nivel: 8, requer: 300, nome: 'Passagem só de ida' });
    // cada nível novo custa mais que o anterior do mesmo gerador
    for (let g = 1; g <= 30; g++) {
      const precos = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => m.find((x) => x.id === g * 10 + k)!.preco);
      for (let k = 1; k < 8; k++) expect(precos[k]).toBeGreaterThan(precos[k - 1]);
    }
  });

  it('12 estratégias; todas ligadas (Marca forte e Monopólio dependem dos lugares)', () => {
    const e = catalogo.estrategias;
    expect(e).toHaveLength(12);
    expect(e.filter((x) => !x.ativa)).toEqual([]);
    expect(e.find((x) => x.nome === 'Marca forte')).toMatchObject({ requer: 'lugares', sociais: { porLugar: 0.05 } });
    expect(e.find((x) => x.nome === 'Monopólio')).toMatchObject({ requer: 'lugares', sociais: { marcosMult: 2 } });
    expect(e.find((x) => x.nome === 'Queimar caixa')).toMatchObject({ custoMult: 1.25, prodMult: 1.6, genMult: 1 });
    expect(e.find((x) => x.nome === 'Networking')).toMatchObject({ ativa: true, sociais: { contratoEfeitoMult: 2 } });
    expect(e.find((x) => x.nome === 'Cultura de startup')).toMatchObject({ ativa: true, sociais: { porContratado: 0.15, empregadoMult: 3 } });
    expect(e.find((x) => x.nome === 'Abrir capital')).toMatchObject({ prodMult: 1.3, sociais: { contratoCustoMult: 2 } });
  });

  it('cargos: lista de piada, sem repetir, curtos', () => {
    expect(catalogo.cargos.length).toBeGreaterThanOrEqual(12);
    expect(new Set(catalogo.cargos).size).toBe(catalogo.cargos.length);
    for (const c of catalogo.cargos) expect(c.length).toBeLessThanOrEqual(40);
    expect(catalogo.cargos).toContain('CEO de nada');
  });

  it('conquistas: 110 visíveis e 17 escondidas (com as da horta e dos convidados), ids únicos, uma de 100 pra cada gerador, textos curtos', () => {
    const c = catalogo.conquistas;
    expect(c.filter((x) => !x.escondida)).toHaveLength(110);
    expect(c.filter((x) => x.escondida)).toHaveLength(17);
    expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
    for (let g = 1; g <= 30; g++) expect(c.find((x) => x.id === g)).toMatchObject({ tipo: 'gerador', alvo: g, valor: 100, escondida: false });
    expect(c.find((x) => x.id === 7)!.nome).toBe('Estágio não remunerado em escala');
    for (const x of c) {
      expect(x.nome.length, x.nome).toBeGreaterThan(0);
      expect(x.nome.length, x.nome).toBeLessThanOrEqual(34);
      expect(x.frase.length, x.nome).toBeGreaterThan(0);
      expect(x.condicao.length, x.nome).toBeGreaterThan(0);
    }
  });
  it('as conquistas das eras 1–5 (116–131)', () => {
    const c = catalogo.conquistas;
    expect(c.find((x) => x.id === 120)).toMatchObject({ tipo: 'evt_gols', valor: 7, nome: '7 a 1 (pra nós)', escondida: false });
    for (let e = 1; e <= 5; e++) {
      expect(c.find((x) => x.id === 120 + e)).toMatchObject({ tipo: 'era_300', alvo: e });
      expect(c.find((x) => x.id === 125 + e)).toMatchObject({ tipo: 'era_melhorias', alvo: e });
    }
    expect(c.find((x) => x.id === 131)).toMatchObject({ tipo: 'melhoria', alvo: 138, escondida: true });
  });
  it('as conquistas dos dourados e da Caixinha (132–139): visíveis antes das escondidas', () => {
    const c = catalogo.conquistas;
    expect(c.find((x) => x.id === 132)).toMatchObject({ tipo: 'trend_max', valor: 20, nome: 'Dancinha do TikTok', escondida: false });
    expect(c.find((x) => x.id === 135)).toMatchObject({ tipo: 'combos', valor: 10, nome: 'C-C-C-Combo!', escondida: false });
    expect(c.find((x) => x.id === 137)).toMatchObject({ tipo: 'cashback', valor: 1e12, nome: 'Volta pra conta', escondida: false });
    expect(c.find((x) => x.id === 138)).toMatchObject({ tipo: 'tigre_seq', valor: 3, nome: 'O tigre tá pagando', escondida: true });
    expect(c.find((x) => x.id === 139)).toMatchObject({ tipo: 'insider', valor: 1, nome: 'Insider (shh)', escondida: true });
    const ids = c.map((x) => x.id);
    expect(ids.indexOf(137)).toBeLessThan(ids.indexOf(101));
    expect(ids.slice(-2)).toEqual([138, 139]);
  });
  it('escondidas: as da spec; a Guiana Brasileira é a Filial em Portugal (a melhoria 283, que mudou de nome)', () => {
    expect(catalogo.conquistas.filter((x) => x.escondida).map((x) => x.nome)).toEqual([
      '6-7', 'Farmou aura', 'Aura negativa', 'Tá saindo da jaula', 'Guiana Brasileira', 'Fez o L', '3h06',
      'Modo sigma', 'Pai tá on', 'Brainrot', 'Ele tem pescoço sim', 'São a mesma pessoa?', 'Coleção encalhada', 'Deu PT', 'Embaixo do lago prateado', 'O tigre tá pagando', 'Insider (shh)',
    ]);
    expect(catalogo.melhorias.find((m) => m.id === 283)).toMatchObject({ nome: 'Filial em Portugal', gerador: 28, requer: 25 });
    expect(catalogo.conquistas.find((x) => x.nome === 'Guiana Brasileira')).toMatchObject({ tipo: 'melhoria', alvo: 283 });
    expect(catalogo.conquistas.some((x) => x.id === 104)).toBe(false); // o limaumdoc saiu; o id não é reaproveitado
  });
  it('árvore: a raiz e 6 ramos de 5 nós; custos 1 · 2 · 4 · 8 · 15 · 30; cada nó exige o anterior (o 1º, a raiz)', () => {
    const a = catalogo.arvore;
    expect(a).toHaveLength(31);
    expect(a[0]).toMatchObject({ id: 1, ramo: 0, nome: 'Virou MEI', custo: 1, requer: null, tipo: 'producao', valor: 1.05 });
    for (let r = 1; r <= 6; r++) {
      const ramo = a.filter((n) => n.ramo === r);
      expect(ramo.map((n) => n.id)).toEqual([1, 2, 3, 4, 5].map((p) => r * 10 + p));
      expect(ramo.map((n) => n.custo)).toEqual([2, 4, 8, 15, 30]);
      expect(ramo.map((n) => n.requer)).toEqual([1, r * 10 + 1, r * 10 + 2, r * 10 + 3, r * 10 + 4]);
    }
    expect(a.reduce((t, n) => t + n.custo, 0)).toBe(355);
    expect(a.filter((n) => n.ramo === 4).map((n) => [n.tipo, n.valor])).toEqual([
      ['dourado_freq', 1.5], ['dourado_tela', 24], ['dourado_investidor', 2], ['dourado_duracao', 2], ['dourado_freq', 2]]);
    expect(a.filter((n) => n.ramo === 6).map((n) => [n.tipo, n.valor])).toEqual([
      ['horta_amadurece', 0.75], ['horta_vida', 1.5], ['horta_cruza', 2], ['horta_mult', 1.5], ['morango_chance', 5]]);
    expect(a.some((n) => (n.tipo as string) === 'teto')).toBe(false);
    for (const n of a) expect(n.nome.length, n.nome).toBeLessThanOrEqual(30);
  });
  it('montarCatalogo usa os parâmetros', () => {
    const c = montarCatalogo({ ...PARAMETROS, custoInicial: 20 });
    expect(c.geradores[0].custo).toBe(20);
  });
});

const MIGRACOES = resolve(__dirname, '../../supabase/migrations');
const maisRecente = readdirSync(MIGRACOES)
  .filter((n) => /^\d{4}_fellas_inc_catalogo.*\.sql$/.test(n))
  .sort()
  .pop()!;
// ATUALIZAR_CATALOGO=<nome>.sql escreve uma migração NOVA; outro valor não reescreve migração antiga
const novoNome = process.env.ATUALIZAR_CATALOGO?.endsWith('.sql') ? process.env.ATUALIZAR_CATALOGO : null;
if (novoNome) writeFileSync(resolve(MIGRACOES, novoNome), catalogoSql());
const ARQUIVO = resolve(MIGRACOES, novoNome ?? maisRecente);

describe('catálogo no banco (migração mais recente)', () => {
  it('é exatamente o que catalogo.ts gera', () => {
    expect(readFileSync(ARQUIVO, 'utf8').replace(/\r\n/g, '\n')).toBe(catalogoSql());
  });
  it('db.ts e mockDb.ts listam esse arquivo', () => {
    const nome = novoNome ?? maisRecente;
    expect(readFileSync(resolve(__dirname, '../test/db.ts'), 'utf8')).toContain(nome);
    expect(readFileSync(resolve(__dirname, '../dev/mockDb.ts'), 'utf8')).toContain(nome);
  });
  it('escapa aspas simples nos textos', () => {
    expect(catalogoSql()).toContain("'Selo de \"open to work\"'");
    expect(catalogoSql({ geradores: [{ id: 1, era: 1, nome: "Pão d'água", custo: 1, renda: 1 }], melhorias: [], estrategias: [], cargos: [], conquistas: [], arvore: [] }))
      .toContain("'Pão d''água'");
  });
  it('cargos entram no SQL gerado', () => {
    expect(catalogoSql()).toContain('insert into public.idle_cat_cargo (id, nome) values');
    expect(catalogoSql()).toContain("(1, 'estagiário')");
  });
  it('conquistas entram no SQL gerado', () => {
    expect(catalogoSql()).toContain('insert into public.idle_cat_conquista (id, nome, frase, condicao, tipo, alvo, valor, escondida) values');
    expect(catalogoSql()).toContain("(101, '6-7', 'Seis sete. Ninguém sabe por quê.', 'Ter exatamente 67 de algum gerador', 'gerador_exato', null, 67, true)");
  });
  it('a árvore entra no SQL gerado', () => {
    expect(catalogoSql()).toContain('insert into public.idle_cat_no (id, ramo, posicao, nome, efeito, custo, tipo, valor, requer) values');
    expect(catalogoSql()).toContain("(41, 4, 1, 'Pé de coelho', 'Eventos aparecem 50% mais vezes.', 2, 'dourado_freq', 1.5, 1)");
    expect(catalogoSql()).toContain(`(51, 5, 1, 'Placa de "Precisa-se"', 'Contratar custa 25% menos.', 2, 'contrato_preco', 0.75, 1)`);
  });
  it('frase da sinergia 2006 usa vírgula decimal (pt-BR)', () => {
    expect(catalogo.melhorias.find((x) => x.id === 2006)?.frase).toContain('+0,5%');
  });
});
