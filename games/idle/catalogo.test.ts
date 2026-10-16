import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  catalogo, catalogoSql, CUSTO_ESPACO, CUSTO_NOVOS_HOJE, CUSTO_PONTE, CUSTO_RECURSO, idConquistaGerador, idNo, montarCatalogo,
  ORDEM_RAMOS, PARAMETROS, PARAMETROS_ESPACO,
} from './catalogo';
import { ERAS, FRASES_GERADOR } from './nomes';

describe('catálogo', () => {
  it('42 geradores em 7 eras de 6, custo e renda crescentes; do 31 em diante, o 2º trecho da curva', () => {
    const g = catalogo.geradores;
    expect(g).toHaveLength(42);
    expect(g.map((x) => x.era)).toEqual(Array.from({ length: 42 }, (_, i) => Math.floor(i / 6) + 1));
    expect(g[0]).toMatchObject({ id: 1, custo: 15, renda: 0.5 });
    expect(PARAMETROS_ESPACO).toEqual({ aPartirDe: 31, custoInicial: 6e14, crescimentoCusto: 1.6, retornoInicial: 2.5e6, crescimentoRetorno: 1.45 });
    expect(g[30]).toMatchObject({ id: 31, era: 6, nome: 'Constelação de satélites', custo: 6e14, renda: 2.4e8 });
    expect(g[41]).toMatchObject({ id: 42, era: 7, nome: 'Base no lado escuro da Lua' });
    expect(g[41].custo).toBeCloseTo(6e14 * 1.6 ** 11, -3);
    for (let i = 1; i < 42; i++) {
      expect(g[i].custo).toBeGreaterThan(g[i - 1].custo);
      expect(g[i].renda).toBeGreaterThan(g[i - 1].renda);
    }
  });
  it('os geradores 1–30 e as melhorias de antes são os da 0075, byte a byte (preço em produção)', () => {
    const antiga = readFileSync(resolve(MIGRACOES, '0075_fellas_inc_catalogo_dourados.sql'), 'utf8').replace(/\r\n/g, '\n');
    const nova = catalogoSql();
    const bloco = (sql: string, tabela: string) =>
      sql.split(`insert into public.${tabela} `)[1].split(';\n')[0].split('\n').slice(1).map((l) => l.replace(/,$/, ''));
    const gAntes = bloco(antiga, 'idle_cat_gen');
    expect(gAntes).toHaveLength(30);
    expect(bloco(nova, 'idle_cat_gen').slice(0, 30)).toEqual(gAntes);
    // a linha das melhorias ganhou fonte_era e alvo_era no fim (null fora do legado)
    const uNova = new Set(bloco(nova, 'idle_cat_upg'));
    for (const l of bloco(antiga, 'idle_cat_upg')) expect(uNova.has(l.replace(/\)$/, ', null, null)')), l).toBe(true);
  });
  it('nomes das eras e as frases dos geradores 31–42', () => {
    expect(ERAS).toEqual(['Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede', 'Em órbita', 'Lua']);
    for (let g = 31; g <= 42; g++) expect(FRASES_GERADOR[g]?.length, `frase ${g}`).toBeGreaterThan(10);
    expect(FRASES_GERADOR[34]).toBe('Desculpe, Dave. Receio que não posso cancelar sua assinatura.');
    expect(FRASES_GERADOR[30]).toBeUndefined();
  });

  it('melhorias: 336 de gerador, 28 gerais, 30 sinergias, 11 de legado, ids únicos', () => {
    const m = catalogo.melhorias;
    expect(m.filter((x) => x.tipo === 'gerador')).toHaveLength(336);
    expect(m.filter((x) => x.tipo === 'geral')).toHaveLength(28);
    expect(m.filter((x) => x.tipo === 'sinergia')).toHaveLength(30);
    expect(m.filter((x) => x.tipo === 'legado')).toHaveLength(11);
    expect(new Set(m.map((x) => x.id)).size).toBe(405);
    expect(m.find((x) => x.id === 71)).toMatchObject({ tipo: 'gerador', gerador: 7, nivel: 1, requer: 1, nome: 'Crachá com foto' });
    expect(m.find((x) => x.id === 305)).toMatchObject({ gerador: 30, nivel: 5, requer: 100 });
    expect(m.find((x) => x.id === 16)).toMatchObject({ gerador: 1, nivel: 6, requer: 150, nome: 'ChatGPT fazendo o TCC' });
    expect(m.find((x) => x.id === 138)).toMatchObject({ gerador: 13, nivel: 8, requer: 300, nome: 'Mensagem subliminar no episódio' });
    expect(m.find((x) => x.id === 308)).toMatchObject({ gerador: 30, nivel: 8, requer: 300, nome: 'Passagem só de ida' });
    expect(m.find((x) => x.id === 331)).toMatchObject({ gerador: 33, nivel: 1, requer: 1, nome: 'Valsa do Danúbio Azul na acoplagem' });
    expect(m.find((x) => x.id === 348)).toMatchObject({ gerador: 34, nivel: 8, requer: 300, nome: 'Daisy, Daisy' });
    expect(m.find((x) => x.id === 428)).toMatchObject({ gerador: 42, nivel: 8, nome: 'Eclipse particular' });
    expect(m.find((x) => x.id === 1021)).toMatchObject({ tipo: 'geral', requerEra: 6, mult: 1.3, nome: 'Lançamento transmitido ao vivo', preco: 6e14 * 20 });
    expect(m.find((x) => x.id === 1028)).toMatchObject({ tipo: 'geral', requerEra: 7, mult: 1.4, nome: 'Lua cheia de clientes' });
    expect(m.find((x) => x.id === 3001)).toMatchObject({
      tipo: 'legado', fonteEra: 1, alvoEra: 6, porUnidade: 0.0005, requerEra: 6, preco: 6e14 * 20,
      nome: 'O notebook da faculdade foi pro espaço', frase: 'Cada gerador da era 1 que você tem dá +0,05% nos geradores da era 6.',
    });
    expect(m.find((x) => x.id === 3005)).toMatchObject({ fonteEra: 5, alvoEra: 6, preco: 6e14 * 320 });
    expect(m.find((x) => x.id === 3011)).toMatchObject({ fonteEra: 6, alvoEra: 7, nome: 'Satélite de retransmissão', preco: catalogo.geradores[36].custo * 640 });
    // cada nível novo custa mais que o anterior do mesmo gerador
    for (let g = 1; g <= 42; g++) {
      const precos = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => m.find((x) => x.id === g * 10 + k)!.preco);
      for (let k = 1; k < 8; k++) expect(precos[k]).toBeGreaterThan(precos[k - 1]);
    }
  });

  it('16 estratégias; todas ligadas (Marca forte e Monopólio dependem dos lugares)', () => {
    const e = catalogo.estrategias;
    expect(e).toHaveLength(16);
    expect(e.filter((x) => !x.ativa)).toEqual([]);
    expect(e.find((x) => x.nome === 'Marca forte')).toMatchObject({ requer: 'lugares', sociais: { porLugar: 0.05 } });
    expect(e.find((x) => x.nome === 'Monopólio')).toMatchObject({ requer: 'lugares', sociais: { marcosMult: 2 } });
    expect(e.find((x) => x.nome === 'Queimar caixa')).toMatchObject({ custoMult: 1.25, prodMult: 1.6, genMult: 1 });
    expect(e.find((x) => x.nome === 'Networking')).toMatchObject({ ativa: true, sociais: { contratoEfeitoMult: 2 } });
    expect(e.find((x) => x.nome === 'Cultura de startup')).toMatchObject({ ativa: true, sociais: { porContratado: 0.15, empregadoMult: 3 } });
    expect(e.find((x) => x.nome === 'Abrir capital')).toMatchObject({ prodMult: 1.3, sociais: { contratoCustoMult: 2 } });
    expect(e.find((x) => x.nome === 'Turismo espacial')).toMatchObject({ era: 6, opcao: 0, genDe: 31, genAte: 36, genMult: 2 });
    expect(e.find((x) => x.nome === 'Satélites de internet')).toMatchObject({ era: 6, opcao: 1, oppBonusMult: 1.5, oppExtra: 2 });
    expect(e.find((x) => x.nome === 'Mineração lunar')).toMatchObject({ era: 7, opcao: 0, genDe: 37, genAte: 42, genMult: 2 });
    expect(e.find((x) => x.nome === 'Hotel na Lua')).toMatchObject({ era: 7, opcao: 1, custoMult: 0.75 });
  });

  it('cargos: lista de piada, sem repetir, curtos', () => {
    expect(catalogo.cargos.length).toBeGreaterThanOrEqual(12);
    expect(new Set(catalogo.cargos).size).toBe(catalogo.cargos.length);
    for (const c of catalogo.cargos) expect(c.length).toBeLessThanOrEqual(40);
    expect(catalogo.cargos).toContain('CEO de nada');
  });

  it('conquistas: 128 visíveis e 19 escondidas, ids únicos, uma de 100 pra cada gerador (31–42 nos ids 140–151), textos curtos', () => {
    const c = catalogo.conquistas;
    expect(c.filter((x) => !x.escondida)).toHaveLength(128);
    expect(c.filter((x) => x.escondida)).toHaveLength(19);
    expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
    expect([idConquistaGerador(1), idConquistaGerador(30), idConquistaGerador(31), idConquistaGerador(42)]).toEqual([1, 30, 140, 151]);
    for (let g = 1; g <= 42; g++) {
      expect(c.find((x) => x.id === idConquistaGerador(g)), `gerador ${g}`).toMatchObject({ tipo: 'gerador', alvo: g, valor: 100, escondida: false });
    }
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
    expect(ids.slice(-4)).toEqual([138, 139, 158, 159]);
  });
  it('as conquistas das eras 6 e 7 (140–159): as de gerador, a era inteira, os eventos e as duas escondidas no fim', () => {
    const c = catalogo.conquistas;
    expect(c.find((x) => x.id === 140)).toMatchObject({ nome: 'Céu poluído', condicao: 'Ter 100 "Constelação de satélites"', alvo: 31 });
    expect(c.find((x) => x.id === 143)).toMatchObject({ nome: 'Abra a porta, HAL', alvo: 34 });
    expect(c.find((x) => x.id === 151)).toMatchObject({ nome: 'Do lado de lá', alvo: 42 });
    for (const e of [6, 7]) {
      expect(c.find((x) => x.id === 146 + e)).toMatchObject({ tipo: 'era_300', alvo: e, escondida: false });
      expect(c.find((x) => x.id === 148 + e)).toMatchObject({ tipo: 'era_melhorias', alvo: e, escondida: false });
    }
    expect(c.find((x) => x.id === 156)).toMatchObject({ tipo: 'evt_lixo', valor: 3, nome: 'Desviou de tudo' });
    expect(c.find((x) => x.id === 157)).toMatchObject({ tipo: 'evt_houston', valor: 10, nome: 'Silver tape resolve' });
    expect(c.find((x) => x.id === 158)).toMatchObject({ tipo: 'monolito', escondida: true, nome: 'Meu Deus, está cheio de estrelas' });
    expect(c.find((x) => x.id === 159)).toMatchObject({ tipo: 'melhoria', alvo: 348, escondida: true, nome: 'Daisy, Daisy' });
    const ids = c.map((x) => x.id);
    expect(ids.indexOf(157)).toBeLessThan(ids.indexOf(101)); // as visíveis antes das escondidas
  });
  it('escondidas: as da spec; a Guiana Brasileira é a Filial em Portugal (a melhoria 283, que mudou de nome)', () => {
    expect(catalogo.conquistas.filter((x) => x.escondida).map((x) => x.nome)).toEqual([
      '6-7', 'Farmou aura', 'Aura negativa', 'Tá saindo da jaula', 'Guiana Brasileira', 'Fez o L', '3h06',
      'Modo sigma', 'Pai tá on', 'Brainrot', 'Ele tem pescoço sim', 'São a mesma pessoa?', 'Coleção encalhada', 'Deu PT', 'Embaixo do lago prateado', 'O tigre tá pagando', 'Insider (shh)', 'Meu Deus, está cheio de estrelas', 'Daisy, Daisy',
    ]);
    expect(catalogo.melhorias.find((m) => m.id === 283)).toMatchObject({ nome: 'Filial em Portugal', gerador: 28, requer: 25 });
    expect(catalogo.conquistas.find((x) => x.nome === 'Guiana Brasileira')).toMatchObject({ tipo: 'melhoria', alvo: 283 });
    expect(catalogo.conquistas.some((x) => x.id === 104)).toBe(false); // o limaumdoc saiu; o id não é reaproveitado
  });
  it('árvore: 120 nós (a raiz, 10 ramos de 10, 10 infinitos e 9 pontes); os 31 de hoje iguais', () => {
    const a = catalogo.arvore;
    expect(a).toHaveLength(120);
    expect(new Set(a.map((n) => n.id)).size).toBe(120);
    expect(a[0]).toMatchObject({
      id: 1, ramo: 0, nome: 'Virou MEI', custo: 1, requer: null, tipo: 'producao', valor: 1.05, requer2: null, reqVendas: null, reqEra: null, cresce: null,
    });
    for (let r = 1; r <= 6; r++) {
      const hoje = a.filter((n) => n.ramo === r && n.posicao <= 5);
      expect(hoje.map((n) => n.id)).toEqual([1, 2, 3, 4, 5].map((p) => r * 10 + p));
      expect(hoje.map((n) => n.custo)).toEqual([2, 4, 8, 15, 30]);
      expect(hoje.map((n) => n.requer)).toEqual([1, r * 10 + 1, r * 10 + 2, r * 10 + 3, r * 10 + 4]);
      for (const n of hoje) expect(n, String(n.id)).toMatchObject({ requer2: null, reqVendas: null, reqEra: null, cresce: null });
    }
    expect(a.filter((n) => n.id <= 65).reduce((t, n) => t + n.custo, 0)).toBe(355);
    expect(a.filter((n) => n.ramo === 4 && n.posicao <= 5).map((n) => [n.tipo, n.valor])).toEqual([
      ['dourado_freq', 1.5], ['dourado_tela', 24], ['dourado_investidor', 2], ['dourado_duracao', 2], ['dourado_freq', 2]]);
    expect(a.filter((n) => n.ramo === 6 && n.posicao <= 5).map((n) => [n.tipo, n.valor])).toEqual([
      ['horta_amadurece', 0.75], ['horta_vida', 1.5], ['horta_cruza', 2], ['horta_mult', 1.5], ['morango_chance', 5]]);
    expect(a.some((n) => (n.tipo as string) === 'teto')).toBe(false);
    for (const n of a) expect(n.nome.length, n.nome).toBeLessThanOrEqual(40);
  });
  it('os 31 nós de hoje são os da 0077, byte a byte (com as 4 colunas novas nulas no fim)', () => {
    const antiga = readFileSync(resolve(MIGRACOES, '0077_fellas_inc_catalogo_eras_6_7.sql'), 'utf8').replace(/\r\n/g, '\n');
    const bloco = (sql: string) => sql.split('insert into public.idle_cat_no ')[1].split('\n').slice(1).map((l) => l.replace(/[,;]$/, '')).filter(Boolean);
    const antes = bloco(antiga);
    expect(antes).toHaveLength(31);
    const nova = new Set(bloco(catalogoSql()));
    for (const l of antes) expect(nova.has(l.replace(/\)$/, ', null, null, null, null)')), l).toBe(true);
  });
  it('nós novos: ids, custos, quem pede quem e os portões', () => {
    const no = (id: number) => catalogo.arvore.find((n) => n.id === id)!;
    expect([idNo(0, 1), idNo(1, 5), idNo(1, 6), idNo(6, 10), idNo(7, 1), idNo(10, 10), idNo(4, 11)]).toEqual([1, 15, 106, 610, 701, 1010, 3004]);
    expect(CUSTO_NOVOS_HOJE).toEqual([14, 32, 63, 135, 270]);
    expect(CUSTO_RECURSO).toEqual([7, 14, 32, 63, 135, 180, 315, 495, 765, 1350]);
    expect(CUSTO_ESPACO).toEqual([135, 180, 315, 495, 900, 1350, 2700, 4050, 6300, 13500]);
    expect(CUSTO_PONTE).toEqual([495, 630, 765, 900, 1350, 4950, 3600, 1350, 1800]);
    expect(no(106)).toMatchObject({ ramo: 1, posicao: 6, nome: 'Coach quântico', tipo: 'producao_soma', valor: 0.2, custo: 14, requer: 15, reqVendas: 3, reqEra: null });
    expect(no(107)).toMatchObject({ requer: 106, reqVendas: 3, reqEra: null, custo: 32 });
    expect(no(108)).toMatchObject({ requer: 107, reqVendas: null, reqEra: 7, custo: 63, nome: 'Reunião cancelada (podia ser um e-mail)' });
    expect(no(610)).toMatchObject({ tipo: 'morango_chance', valor: 10, custo: 270, reqEra: 7 });
    expect(no(701)).toMatchObject({ ramo: 7, nome: 'Corretora "sem taxa"', tipo: 'bolsa_corretagem', valor: 0.8, custo: 7, requer: 1, reqEra: 4, reqVendas: null });
    expect(no(801)).toMatchObject({ tipo: 'conv_recarga', valor: 1.25, requer: 1, reqEra: 3 });
    expect(no(901)).toMatchObject({ tipo: 'mapa_abrir', valor: 0.75, requer: 1, reqEra: 2 });
    expect(no(1001)).toMatchObject({ tipo: 'lixo_min', valor: 15, custo: 135, requer: 1, reqEra: 6 });
    expect(no(1006)).toMatchObject({ tipo: 'silver_mult', valor: 5, reqEra: 7, requer: 1005 });
    expect(no(1010)).toMatchObject({ tipo: 'espaco_soma', valor: 1, custo: 13500, reqEra: 7 });
    for (let r = 1; r <= 10; r++) {
      expect(no(3000 + r), `infinito ${r}`).toMatchObject({ ramo: r, posicao: 11, custo: 1000, cresce: 1.6, reqVendas: 10, reqEra: null, requer: idNo(r, 10), requer2: null });
    }
    expect(no(3002)).toMatchObject({ tipo: 'inicio_mult', valor: 10 });
    expect(no(3004)).toMatchObject({ tipo: 'dourado_investidor', valor: 1.02 });
    // pontes: entre os vizinhos na ordem da copa, cada uma pede o nó 5 dos dois
    expect(ORDEM_RAMOS).toEqual([6, 9, 5, 8, 2, 1, 10, 3, 7, 4]);
    const pontes = catalogo.arvore.filter((n) => n.ramo === 11);
    expect(pontes.map((n) => n.id)).toEqual([2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009]);
    pontes.forEach((n, i) => {
      expect(n).toMatchObject({ posicao: i + 1, tipo: 'producao_soma', custo: CUSTO_PONTE[i], reqVendas: 5, reqEra: null, cresce: null });
      expect([n.requer, n.requer2]).toEqual([idNo(ORDEM_RAMOS[i], 5), idNo(ORDEM_RAMOS[i + 1], 5)]);
    });
    expect(no(2001)).toMatchObject({ nome: 'Feira orgânica no rolê', requer: 65, requer2: 905, valor: 0.15 });
    expect(no(2006)).toMatchObject({ nome: 'Fábrica em órbita', requer: 15, requer2: 1005, valor: 0.25 });
    // a conta da §6: soma da Produção 2,75, das pontes 1,9, do Espaço fixo 1,75
    const soma = (f: (n: (typeof catalogo.arvore)[number]) => boolean) => catalogo.arvore.filter(f).reduce((t, n) => t + n.valor, 0);
    expect(soma((n) => n.ramo === 1 && n.posicao >= 6 && n.posicao <= 10)).toBeCloseTo(2.75, 12);
    expect(soma((n) => n.ramo === 11)).toBeCloseTo(1.9, 12);
    expect(soma((n) => n.ramo === 10 && n.posicao <= 10 && n.tipo === 'espaco_soma')).toBeCloseTo(1.75, 12);
    // a parte fixa nova custa 58.917 (era 65.454 na Decisão 2; ×0,9 na calibração do veterano, Task 6)
    expect(catalogo.arvore.filter((n) => n.id > 65 && n.cresce === null).reduce((t, n) => t + n.custo, 0)).toBe(58917);
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
  it('a árvore entra no SQL gerado, com as colunas novas (banco que já tinha a tabela ganha as colunas antes do insert)', () => {
    const sql = catalogoSql();
    expect(sql).toContain('insert into public.idle_cat_no (id, ramo, posicao, nome, efeito, custo, tipo, valor, requer, requer2, req_vendas, req_era, cresce) values');
    expect(sql).toContain("(41, 4, 1, 'Pé de coelho', 'Eventos aparecem 50% mais vezes.', 2, 'dourado_freq', 1.5, 1, null, null, null, null)");
    expect(sql).toContain(`(51, 5, 1, 'Placa de "Precisa-se"', 'Contratar custa 25% menos.', 2, 'contrato_preco', 0.75, 1, null, null, null, null)`);
    expect(sql).toContain("(106, 1, 6, 'Coach quântico', 'Produção +20%, somando com os outros nós de soma.', 14, 'producao_soma', 0.2, 15, null, 3, null, null)");
    expect(sql).toContain("(2001, 11, 1, 'Feira orgânica no rolê', 'Produção +15%, somando com os outros nós de soma.', 495, 'producao_soma', 0.15, 65, 905, 5, null, null)");
    expect(sql).toContain("(3001, 1, 11, 'Hora extra infinita', 'Produção +5% por nível, somando com os outros nós de soma.', 1000, 'producao_soma', 0.05, 110, null, 10, null, 1.6)");
    expect(sql).toContain('alter table public.idle_cat_no add column if not exists requer2 int, add column if not exists req_vendas int, add column if not exists req_era int, add column if not exists cresce double precision;');
    expect(sql.indexOf('alter table public.idle_cat_no add column')).toBeLessThan(sql.indexOf('insert into public.idle_cat_no'));
  });
  it('o SQL gerado cria as colunas do legado e troca o check do tipo (banco que já tinha a tabela)', () => {
    const sql = catalogoSql();
    expect(sql).toContain('alter table public.idle_cat_upg add column if not exists fonte_era int, add column if not exists alvo_era int;');
    expect(sql).toContain("alter table public.idle_cat_upg add constraint idle_cat_upg_tipo_check check (tipo in ('gerador', 'geral', 'sinergia', 'legado'));");
    expect(sql.indexOf('add constraint idle_cat_upg_tipo_check')).toBeLessThan(sql.indexOf('insert into public.idle_cat_upg'));
    expect(sql).toContain("(3001, 'legado', 'O notebook da faculdade foi pro espaço', 'Cada gerador da era 1 que você tem dá +0,05% nos geradores da era 6.', 12000000000000000, null, null, null, null, 6, null, null, 0.0005, null, null, 1, 6)");
  });
  it('frase da sinergia 2006 usa vírgula decimal (pt-BR)', () => {
    expect(catalogo.melhorias.find((x) => x.id === 2006)?.frase).toContain('+0,5%');
  });
});
