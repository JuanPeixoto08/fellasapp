// Árvore grande (0082): a compra (ponte com dois pedidos, portões, infinitos), a maior era e a paridade dos efeitos
// com o nível; as partes B–E (produção e minigames) acrescentam os describes delas no fim.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { abertura, efeitosArvore, precoContrato, taxa, type Estado } from '../idle/economia';
import { CAIXA_PADRAO, pendentes } from '../idle/oportunidades';
import { freshDb, quartaAntesDoCorte, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const M0082 = readFileSync(resolve(__dirname, '../../supabase/migrations/0082_fellas_inc_arvore_grande.sql'), 'utf8');
type J = {
  valuation: number; rate: number; generators: number[]; pontos: number; pontos_vida: number; vendas: number; era: number; era_max?: number;
  bonus: { arvore: number[]; conquistas: number; niveis?: Record<string, number> };
};
const comprar = (no: number) => t.rpc<J>('idle_buy_node', { p_no: no });
/** pontos ganhos na vida, gastos e vendas de A */
const pontos = (ganhos: number, gastos = 0, vendas = 0) =>
  q('update public.idle_state set prestige_earned = $2, prestige_spent = $3, prestige_count = $4 where user_id = $1', [A, ganhos, gastos, vendas]);
/** Põe os nós direto (sem pagar); `niveis` = o nível de algum infinito. */
async function ter(nos: number[], niveis: Record<number, number> = {}) {
  for (const n of nos) {
    await q('insert into public.idle_arvore (user_id, no_id, nivel) values ($1, $2, $3) on conflict (user_id, no_id) do update set nivel = excluded.nivel',
      [A, n, niveis[n] ?? 1]);
  }
}
const gasto = async () => (await q<{ g: number }>('select prestige_spent as g from public.idle_state where user_id = $1', [A]))[0].g;
const PRODUCAO_1_5 = [1, 11, 12, 13, 14, 15];

describe('comprar nós da árvore grande (0082 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
  });
  it('a ponte pede o nó 5 dos dois ramos: com um só, idle_locked; com os dois, compra', async () => {
    await pontos(1e6, 0, 5);
    await ter([1, 11, 12, 13, 14, 21, 22, 23, 24, 25]);
    await expect(comprar(2005)).rejects.toThrow(/idle_locked/); // falta o 15
    await ter([15]);
    const s = await comprar(2005);
    expect(s.bonus.arvore).toContain(2005);
    expect(await gasto()).toBe(1500);
  });
  it('portões: cada motivo recusa com idle_gate sem gastar nada; passou, compra', async () => {
    await pontos(1e6, 0, 2);
    await ter(PRODUCAO_1_5);
    await expect(comprar(106)).rejects.toThrow(/idle_gate/); // 3 vendas
    expect(await gasto()).toBe(0);
    await pontos(1e6, 0, 3);
    await comprar(106);
    await comprar(107);
    await q('update public.idle_state set era_max = 6 where user_id = $1', [A]);
    await expect(comprar(108)).rejects.toThrow(/idle_gate/); // era 7
    await q('update public.idle_state set era_max = 7 where user_id = $1', [A]);
    expect((await comprar(108)).bonus.arvore).toContain(108);
    await q('update public.idle_state set era_max = 3 where user_id = $1', [A]);
    await expect(comprar(701)).rejects.toThrow(/idle_gate/); // a Bolsa abre na era 4
    await expect(comprar(1001)).rejects.toThrow(/idle_gate/); // o Espaço, na 6
    expect((await comprar(801)).bonus.arvore).toContain(801); // o PPP abre na era 3
  });
  it('a era de agora conta mesmo antes de gravar a maior (comprou o gerador 37 e já vai no nó)', async () => {
    await pontos(1e6, 0, 3);
    await ter([...PRODUCAO_1_5, 106, 107]);
    await q('update public.idle_state set era_max = 1, generators[37] = 1 where user_id = $1', [A]);
    expect((await comprar(108)).bonus.arvore).toContain(108);
  });
  it('infinito: nível 1 por 1.000, o 2 por 1.600, o 3 por 2.560; os níveis no JSON; o fixo comprado de novo é idle_node_owned', async () => {
    await pontos(10_000, 0, 10);
    await ter([...PRODUCAO_1_5, 106, 107, 108, 109, 110]);
    let s = await comprar(3001);
    expect(s.pontos).toBe(9000);
    expect(s.bonus.niveis).toEqual({ 3001: 1 });
    s = await comprar(3001);
    expect(s.pontos).toBe(7400);
    s = await comprar(3001);
    expect(s.pontos).toBe(4840);
    expect(s.bonus.niveis).toEqual({ 3001: 3 });
    expect(s.bonus.arvore.filter((x) => x === 3001)).toHaveLength(1);
    await expect(comprar(110)).rejects.toThrow(/idle_node_owned/);
  });
  it('infinito sem ponto pro próximo nível: idle_points_low e o nível fica', async () => {
    await pontos(2000, 0, 10);
    await ter([...PRODUCAO_1_5, 106, 107, 108, 109, 110]);
    await comprar(3001);
    await expect(comprar(3001)).rejects.toThrow(/idle_points_low/); // 1.600 com 1.000 livres
    expect((await q<{ n: number }>('select nivel as n from public.idle_arvore where user_id = $1 and no_id = 3001', [A]))[0].n).toBe(1);
  });
  it('nível alto: com 1e9 pontos o nível 30 compra e o 31 recusa; nível 100 recusa sem estourar', async () => {
    await pontos(1e9, 0, 10);
    await ter([...PRODUCAO_1_5, 106, 107, 108, 109, 110, 3001], { 3001: 29 });
    const preco30 = Math.round(1000 * 1.6 ** 29);
    expect((await comprar(3001)).pontos).toBe(1e9 - preco30);
    await expect(comprar(3001)).rejects.toThrow(/idle_points_low/);
    await ter([3001], { 3001: 100 });
    await expect(comprar(3001)).rejects.toThrow(/idle_points_low/);
  });
  it('o infinito pede 10 vendas e o nó 10 do ramo', async () => {
    await pontos(1e6, 0, 9);
    await ter([...PRODUCAO_1_5, 106, 107, 108, 109]);
    await expect(comprar(3001)).rejects.toThrow(/idle_locked/);
    await ter([110]);
    await expect(comprar(3001)).rejects.toThrow(/idle_gate/);
  });
});

describe('a maior era (0082 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
  });
  it('toda gravação guarda a maior era; vender não zera; o nó de era 7 compra com a empresa nova', async () => {
    await q(`update public.idle_state set generators[1:37] = array_fill(1, array[37]), strategies = '{0,0,0,0,0,0}', valuation = 0
              where user_id = $1`, [A]);
    expect((await t.rpc<J>('idle_open')).era_max).toBe(7);
    const v = await t.rpc<J>('idle_prestige');
    expect(v).toMatchObject({ era_max: 7, vendas: 1 });
    const [l] = await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]);
    expect(l.e).toBe(7);
    await pontos(1e6, 0, 3);
    await ter([...PRODUCAO_1_5, 106, 107]);
    expect((await comprar(108)).bonus.arvore).toContain(108); // empresa fechada, era de agora 1
    await t.rpc('idle_start');
    expect((await t.rpc<J>('idle_open')).era_max).toBe(7);
  });
  it('o backfill da 0082: a era de agora, ou a das conquistas de era de quem já vendeu (rodar de novo não baixa)', async () => {
    await q('update public.idle_state set era_max = 1, generators = array_fill(0, array[42]) where user_id = $1', [A]);
    await q('insert into public.idle_conquistas (user_id, conquista_id) values ($1, 41)', [A]); // "Andar inteiro" = era 4
    await t.db.exec(M0082);
    expect((await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]))[0].e).toBe(4);
    await q('update public.idle_state set generators[31] = 1 where user_id = $1', [A]); // era 6 sem gravar
    await t.db.exec(M0082);
    expect((await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]))[0].e).toBe(6);
    await q('update public.idle_state set generators = array_fill(0, array[42]) where user_id = $1', [A]);
    await t.db.exec(M0082);
    expect((await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]))[0].e).toBe(6);
  });
  it('o backfill não inventa era: sem conquista de era, a maior era e a de agora (não 5)', async () => {
    await q('update public.idle_state set era_max = 1, generators = array_fill(0, array[42]) where user_id = $1', [A]);
    await q('delete from public.idle_conquistas where user_id = $1', [A]);
    await q('insert into public.idle_conquistas (user_id, conquista_id) values ($1, 1)', [A]); // conquista que não é de era
    await t.db.exec(M0082);
    expect((await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]))[0].e).toBe(1);
    await q('update public.idle_state set generators[13] = 1 where user_id = $1', [A]); // era 3 de agora, sem conquista
    await t.db.exec(M0082);
    expect((await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]))[0].e).toBe(3);
  });
  it('o backfill enxerga as eras 6 e 7 pelas conquistas de ter 100 (140–145 = era 6, 146–151 = era 7)', async () => {
    const era = async () => (await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]))[0].e;
    await q('update public.idle_state set era_max = 1, generators = array_fill(0, array[42]) where user_id = $1', [A]);
    await q('update public.idle_state set generators[13] = 1 where user_id = $1', [A]); // vendeu: hoje na era 3
    await q('insert into public.idle_conquistas (user_id, conquista_id) values ($1, 141)', [A]);
    await t.db.exec(M0082);
    expect(await era()).toBe(6);
    await q('insert into public.idle_conquistas (user_id, conquista_id) values ($1, 146)', [A]);
    await t.db.exec(M0082);
    expect(await era()).toBe(7);
    await t.db.exec(M0082);
    expect(await era()).toBe(7); // idempotente
  });
});

// gerador pseudoaleatório fixo: os mesmos casos toda vez
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));

describe('paridade dos efeitos com níveis (0082 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
  });
  it('cada nó sozinho (o infinito no nível 1 e no 7) e 30 pedaços ao acaso com níveis: banco = economia.ts', async () => {
    const r = rng(16);
    const casos: [number[], Record<number, number>][] = [[[], {}]];
    for (const n of catalogo.arvore) {
      casos.push([[n.id], {}]);
      if (n.cresce !== null) casos.push([[n.id], { [n.id]: 7 }]);
    }
    for (let i = 0; i < 30; i++) {
      const nos = catalogo.arvore.filter(() => r() < 0.4).map((n) => n.id);
      const niveis = Object.fromEntries(nos.filter((id) => id > 3000).map((id) => [id, 1 + Math.floor(r() * 25)]));
      casos.push([nos, niveis]);
    }
    for (const [nos, niveis] of casos) {
      await q('delete from public.idle_arvore where user_id = $1', [A]);
      await ter(nos, niveis);
      const [{ e }] = await q<{ e: Record<string, number | boolean> }>('select public.idle_arvore_efeitos($1) as e', [A]);
      const ts = efeitosArvore(catalogo, nos, niveis);
      expect(Object.keys(e).sort(), String(nos)).toEqual(Object.keys(ts).sort());
      for (const [k, v] of Object.entries(ts)) {
        if (typeof v === 'boolean') expect(e[k], `${nos} ${k}`).toBe(v);
        else expect(rel(e[k] as number, v), `${nos} ${JSON.stringify(niveis)} ${k}`).toBeLessThan(1e-12);
      }
    }
  });
});

describe('paridade da produção com a árvore grande (0082 parte B)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
  });
  it('taxa com a soma, o Espaço, o legado e os infinitos (níveis ao acaso) é a de economia.ts', async () => {
    const r = rng(82);
    const producao = catalogo.arvore.filter((n) => ['producao', 'producao_soma', 'espaco_soma', 'legado_mult'].includes(n.tipo)).map((n) => n.id);
    for (let i = 0; i < 30; i++) {
      const generators = Array.from({ length: 42 }, (_, g) => (r() < 0.75 - g * 0.012 ? Math.floor(r() * 150) : 0));
      const upgrades = catalogo.melhorias.filter((m) => r() < (m.tipo === 'legado' ? 0.6 : 0.25)).map((m) => m.id);
      const strategies = [0, 1, 2, 3, 4, 5].map((k) => {
        const ops = catalogo.estrategias.filter((e) => e.era === k + 2 && e.ativa).map((e) => e.opcao);
        return r() < 0.8 ? ops[Math.floor(r() * ops.length)] : -1;
      });
      const nos = producao.filter(() => r() < 0.5);
      const niveis = Object.fromEntries(nos.filter((id) => id > 3000).map((id) => [id, 1 + Math.floor(r() * 25)]));
      await q('delete from public.idle_state where true');
      await q('delete from public.idle_arvore where true');
      await q(`insert into public.idle_state (user_id, week_start, started, generators, upgrades, strategies)
               values ($1, public.games_week_start(), true, $2, $3, $4)`, [A, generators, upgrades, strategies]);
      await ter(nos, niveis);
      const s: Estado = { generators, upgrades, strategies, bonus: { arvore: nos, conquistas: 0, niveis } };
      const [{ v }] = await q<{ v: number }>('select public.idle_rate(s) as v from public.idle_state s where user_id = $1', [A]);
      expect(rel(v, taxa(catalogo, s)), `${nos} ${JSON.stringify(niveis)}`).toBeLessThan(1e-9);
    }
  });
});

describe('Recomeço, Oportunidades e Gente com a árvore grande (0082 parte C)', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
  });
  const RECOMECO = [1, 21, 22, 23, 24, 25];
  it.each([
    ['F$ 1 bi', [...RECOMECO, 206], {}],
    ['eras 1 e 2', [...RECOMECO, 206, 207], {}],
    ['F$ 1 tri, eras 1 a 4', [...RECOMECO, 206, 207, 208, 209, 210], {}],
    ['×10 por nível (3)', [...RECOMECO, 206, 207, 208, 209, 210, 3002], { 3002: 3 }],
  ] as [string, number[], Record<number, number>][])('abertura: %s (idle_start = economia.ts abertura)', async (_n, nos, niveis) => {
    await ter(nos, niveis);
    const esperado = abertura(catalogo, efeitosArvore(catalogo, nos, niveis));
    const s = await t.rpc<J>('idle_start');
    expect(rel(s.valuation, esperado.valuation)).toBeLessThan(1e-12);
    expect(s.generators).toEqual(esperado.generators);
  });
  it('contratar: Estágio "pela experiência" (×0,3) e o Happy hour (−2% por nível, piso 10%), igual a precoContrato', async () => {
    await t.rpc('idle_start');
    for (const [nos, niveis] of [[[509], {}], [[509, 3005], { 3005: 10 }], [[509, 3005], { 3005: 40 }]] as [number[], Record<number, number>][]) {
      await q('delete from public.idle_arvore where user_id = $1', [A]);
      await ter(nos, niveis);
      const [{ p, g, u, st }] = await q<{ p: number; g: number[]; u: number[]; st: number[] }>(
        'select public.idle_hire_price(s) as p, s.generators as g, s.upgrades as u, s.strategies as st from public.idle_state s where user_id = $1', [A]);
      const est = { generators: g, upgrades: u, strategies: st, bonus: { arvore: nos, conquistas: 0, niveis }, social: { contratei: 0, empregos: [] } };
      expect(rel(p, precoContrato(catalogo, est, 0)), `${nos} ${JSON.stringify(niveis)}`).toBeLessThan(1e-9);
    }
  });
  it('Cliente fiel: a oportunidade de F$ rende +2% por nível (com a Xepa e o Cupom empilhado: ×3 × 1,1)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); // numa quarta à tarde, não na virada do dia
    vi.setSystemTime(quartaAntesDoCorte());
    await t.rpc('idle_start');
    await q('update public.idle_state set week_start = public.games_week_start() - 7 where user_id = $1', [A]);
    const nos = [1, 31, 32, 33, 34, 35, 306, 307, 308, 309, 310, 3003];
    await ter(nos, { 3003: 5 });
    const com = await t.rpc<J & { server_now: string; week_start: string }>('idle_open');
    const agora = Date.parse(com.server_now);
    const semana = Date.parse(com.week_start + 'T00:00:00-03:00');
    const lista = pendentes(A, agora, [], semana, { tamanho: efeitosArvore(catalogo, nos).caixinha, validadeS: CAIXA_PADRAO.validadeS });
    await q(`update public.idle_state set settled_at = now() + interval '1 hour' where user_id = $1`, [A]);
    // a de F$ em qualquer janela: troca o sorteio do tipo por um que dá sempre 0 (a conta do valor é a que importa aqui)
    await t.db.exec('create or replace function public.idle_opp_kind(u uuid, w bigint) returns int language sql immutable as $$ select 0 $$;');
    const w = lista[0];
    expect(w).toBeDefined();
    const depois = await t.rpc<J>('idle_claim_opportunity', { p_window: w });
    expect((depois.valuation - com.valuation) / (com.rate * 900)).toBeCloseTo(3 * 1.1, 6);
  });
});
