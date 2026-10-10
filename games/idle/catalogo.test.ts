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

  it('melhorias: 150 de gerador, 20 gerais, 30 sinergias, ids únicos', () => {
    const m = catalogo.melhorias;
    expect(m.filter((x) => x.tipo === 'gerador')).toHaveLength(150);
    expect(m.filter((x) => x.tipo === 'geral')).toHaveLength(20);
    expect(m.filter((x) => x.tipo === 'sinergia')).toHaveLength(30);
    expect(new Set(m.map((x) => x.id)).size).toBe(200);
    expect(m.find((x) => x.id === 71)).toMatchObject({ tipo: 'gerador', gerador: 7, nivel: 1, requer: 1, nome: 'Crachá com foto' });
    expect(m.find((x) => x.id === 305)).toMatchObject({ gerador: 30, nivel: 5, requer: 100 });
  });

  it('12 estratégias; só as que dependem de propriedades vêm desligadas', () => {
    const e = catalogo.estrategias;
    expect(e).toHaveLength(12);
    expect(e.filter((x) => !x.ativa).map((x) => x.nome)).toEqual(['Marca forte', 'Monopólio']);
    expect(e.find((x) => x.nome === 'Queimar caixa')).toMatchObject({ custoMult: 1.25, prodMult: 1.6, genMult: 1 });
    expect(e.find((x) => x.nome === 'Networking')).toMatchObject({ ativa: true, sociais: { contratoEfeitoMult: 2, propriedadeEfeitoMult: 2 } });
    expect(e.find((x) => x.nome === 'Cultura de startup')).toMatchObject({ ativa: true, sociais: { porContratado: 0.15, empregadoMult: 3 } });
    expect(e.find((x) => x.nome === 'Abrir capital')).toMatchObject({ prodMult: 1.3, sociais: { contratoCustoMult: 2 } });
  });

  it('cargos: lista de piada, sem repetir, curtos', () => {
    expect(catalogo.cargos.length).toBeGreaterThanOrEqual(12);
    expect(new Set(catalogo.cargos).size).toBe(catalogo.cargos.length);
    for (const c of catalogo.cargos) expect(c.length).toBeLessThanOrEqual(40);
    expect(catalogo.cargos).toContain('CEO de nada');
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
    expect(catalogoSql({ geradores: [{ id: 1, era: 1, nome: "Pão d'água", custo: 1, renda: 1 }], melhorias: [], estrategias: [], cargos: [] }))
      .toContain("'Pão d''água'");
  });
  it('cargos entram no SQL gerado', () => {
    expect(catalogoSql()).toContain('insert into public.idle_cat_cargo (id, nome) values');
    expect(catalogoSql()).toContain("(1, 'estagiário')");
  });
  it('frase da sinergia 2006 usa vírgula decimal (pt-BR)', () => {
    expect(catalogo.melhorias.find((x) => x.id === 2006)?.frase).toContain('+0,5%');
  });
});
