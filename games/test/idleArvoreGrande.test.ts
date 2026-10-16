// Árvore grande (0082): a compra (ponte com dois pedidos, portões, infinitos), a maior era e a paridade dos efeitos
// com o nível; as partes B–E (produção e minigames) acrescentam os describes delas no fim.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { derrubada, kojimaMult, multProducao, trocasAgora } from '../idle/convidados';
import { abertura, efeitosArvore, precoContrato, taxa, type Estado } from '../idle/economia';
import { eventoEraEm } from '../idle/eventosEra';
import { CAIXA_PADRAO, pendentes } from '../idle/oportunidades';
import type { BolsaEstado } from '../shared/types';
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
    expect(await gasto()).toBe(1350);
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

describe('Bolsa e PPP com a árvore grande (0082 parte D)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    // era 4 com 3 traders e F$ de sobra (a Bolsa aberta); 50 PPP Podcasts (as 3 cadeiras)
    await q(`update public.idle_state set generators[1:19] = array_fill(1, array[19]), generators[13] = 50, generators[19] = 3,
               strategies = '{0,0,0,-1,-1,-1}', valuation = 1e30 where user_id = $1`, [A]);
  });
  const bolsa = () => t.rpc<BolsaEstado>('idle_bolsa');
  const BOLSA = [1, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710];
  it('limite: (100 + gerador + Escritório × 1,5 + 350) × 2 × (1 + 5% por nível); corretagem × 0,25; o banco manda o gerador', async () => {
    await q('insert into public.idle_bolsa_nivel (user_id, corretor, escritorio) values ($1, 0, 1) on conflict (user_id) do update set escritorio = 1', [A]);
    await ter([...BOLSA, 3007], { 3007: 4 });
    const b = await bolsa();
    expect(b.corretagem).toBeCloseTo(0.05 * 0.25, 12);
    for (const m of b.empresas) {
      const gen = m.limite_gen!;
      expect(m.limite, String(m.id)).toBe(Math.floor((100 + gen + 25 * 1.5 + 350) * 2 * 1.2));
    }
  });
  it('limite sem a árvore e com a Bolsa fechada (sem trader): o de sempre, sem erro', async () => {
    let b = await bolsa();
    for (const m of b.empresas) expect(m.limite).toBe(100 + m.limite_gen!);
    await q('update public.idle_state set generators[19] = 0 where user_id = $1', [A]);
    await ter(BOLSA);
    b = await bolsa();
    expect(b.aberta).toBe(false);
    expect(b.empresas.every((m) => m.limite > 100)).toBe(true);
  });
  it('espiada grátis: 2 por dia (Telegram + YouTube) antes dos créditos; a 3ª gasta o crédito; sem nada, idle_info_sem_credito', async () => {
    await ter([1, 701, 702, 703, 704, 705, 706, 707]);
    await q('update public.idle_state set info_creditos = 1 where user_id = $1', [A]);
    expect((await bolsa()).info_gratis).toBe(2); // a 1ª chamada também cria o mercado
    // o humor de todas muda daqui a bastante tempo (não "vira" agora): idle_info_vira não atrapalha
    await q('update public.idle_bolsa_mercado set humor_ate = humor_ate + 100, rj_ate = null where true');
    const empresas = (await bolsa()).empresas.map((m) => m.id);
    const espiar = (e: number) => t.rpc<{ info_creditos: number; bolsa: BolsaEstado }>('idle_bolsa_espiar', { p_empresa: e });
    let r = await espiar(empresas[0]);
    expect(r.bolsa.info_gratis).toBe(1);
    expect(r.bolsa.info_creditos).toBe(1);
    r = await espiar(empresas[1]);
    expect(r.bolsa.info_gratis).toBe(0);
    r = await espiar(empresas[2]);
    expect(r.bolsa.info_creditos).toBe(0);
    await expect(espiar(empresas[3])).rejects.toThrow(/idle_info_sem_credito/);
    // outro dia: as grátis voltam
    await q(`update public.idle_state set info_gratis_dia = public.games_today() - 1 where user_id = $1`, [A]);
    expect((await bolsa()).info_gratis).toBe(2);
  });
  it('PPP: o banco manda trocas 5 com recarga de 30 min, cadeiras 1/0,75/0,5, derrubada 5% e efeito +35%; as contas batem com convidados.ts', async () => {
    await ter([1, 801, 802, 803, 804, 805, 806, 807, 808, 809, 810]);
    const desde = Math.floor(Date.now() / 1000) - 30 * 3600;
    await q(`update public.idle_state set conv_cadeira = '{1,5,10}', conv_desde = array_fill(to_timestamp($2), array[3]),
               conv_trocas = 1, conv_trocas_t = now() - interval '45 minutes' where user_id = $1`, [A, desde]);
    const s = await t.rpc<J & { convidados: { trocas: number; trocas_t: string; trocas_max: number; recarga_s: number; pesos: number[]; queda: number; efeito: number; cadeira: (number | null)[]; desde: (string | null)[] } }>('idle_open');
    const c = s.convidados;
    expect(c).toMatchObject({ trocas_max: 5, recarga_s: 1800, pesos: [1, 0.75, 0.5], queda: 0.05 });
    expect(c.efeito).toBeCloseTo(0.35, 12);
    const agora = Date.parse((s as unknown as { server_now: string }).server_now);
    const [{ n }] = await q<{ n: number }>('select public.idle_conv_trocas(s, now()) as n from public.idle_state s where user_id = $1', [A]);
    expect(n).toBe(trocasAgora(c, agora).trocas);
    const [{ m }] = await q<{ m: number }>('select public.idle_conv_prod(s, $2::timestamptz) as m from public.idle_state s where user_id = $1',
      [A, new Date(agora).toISOString()]);
    expect(rel(m, multProducao({ c, ppp: 50, uid: A }, agora))).toBeLessThan(1e-12);
    expect(kojimaMult(0.75, desde * 1000, agora, 0.35)).toBeGreaterThan(kojimaMult(0.75, desde * 1000, agora));
    for (let k = 1; k <= 200; k++) {
      const [{ d }] = await q<{ d: boolean }>(
        'select public.idle_horta_sorte($1, 50, $2::bigint + $3, 9) < public.idle_conv_queda($1) as d', [A, desde, k]);
      expect(d, `faixa ${k}`).toBe(derrubada(A, desde, k, 0.05));
    }
  });
  it('sentar com 5 trocas cheias gasta 1 (fica 4) e marca a recarga', async () => {
    await ter([1, 801, 802, 803, 804, 805, 806, 807, 808]);
    await q(`update public.idle_state set conv_trocas = 5, conv_trocas_t = null where user_id = $1`, [A]);
    const s = await t.rpc<{ convidados: { trocas: number; trocas_t: string | null } }>('idle_conv_sentar', { p_cadeira: 1, p_convidado: 1 });
    expect(s.convidados.trocas).toBe(4);
    expect(s.convidados.trocas_t).not.toBeNull();
  });
});

describe('os eventos do Espaço com a árvore grande (0082 parte E)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
  });
  it('TARS (1,5×): os mesmos segundos e tipos que eventoEraEm(…, 1,5) em 60 mil segundos', async () => {
    await ter([1, 1001, 1002, 1003, 1004, 1005]);
    const ini = 1_760_000_000;
    // 60 mil segundos (cada segundo sem sorte consulta a árvore: 200 mil deixaria o teste lento)
    const sql = await q<{ s: string; e: number }>(
      `select s::text, e from (select s, public.idle_evento_era($1::uuid, s, 7) as e from generate_series($2::bigint, $3::bigint) s) x
        where e is not null order by s`, [A, ini, ini + 60_000 - 1]);
    const ts: { s: string; e: number }[] = [];
    for (let s = ini; s < ini + 60_000; s++) {
      const e = eventoEraEm(A, s, 7, 1.5);
      if (e !== null) ts.push({ s: String(s), e });
    }
    expect(ts.length).toBeGreaterThan(40);
    expect(sql).toEqual(ts);
  });
});

describe('pegar os eventos do Espaço com a árvore grande (0082 parte E)', () => {
  type JE = J & { silver_ate: string | null; evento: { tipo: number; ganho: number; gols: number } };
  const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
  const evento = (seg: number, tipo: number) => q('insert into public.teste_evento_arv values ($1, $2)', [seg, tipo]);
  const pegar = (seg: number, gols = 0) => t.rpc<JE>('idle_evento_pegar', { p_seg: seg, p_gols: gols, p_tipo: null });
  const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
  const taxaA = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
  const ESPACO = [1, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009];

  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.db.exec(`
      create table public.teste_evento_arv (s bigint, tipo int);
      create or replace function public.idle_evento_era(u uuid, s bigint, era int) returns int language sql stable as
        'select x.tipo from public.teste_evento_arv x where x.s = idle_evento_era.s limit 1';`);
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q(`update public.idle_state set valuation = 1e12, generators[1:42] = array_fill(1, array[42]), strategies = '{0,0,0,0,0,0}',
               settled_at = now() + interval '1 day' where user_id = $1`, [A]);
    await ter(ESPACO);
  });
  it('Lixo: 15 min de produção por destroço com o Treino na NASA', async () => {
    const seg = await agoraSeg();
    await evento(seg, 6);
    const r = await taxaA();
    const antes = await valor();
    expect((await pegar(seg, 2)).valuation - antes).toBeCloseTo(r * 900 * 2, 0);
  });
  it('Houston: o Silver tape dura 3 min e outro soma 3 min no fim', async () => {
    const seg = await agoraSeg();
    await evento(seg, 7);
    const s = await pegar(seg);
    const agora = Date.parse((await q<{ n: string }>('select now()::text as n'))[0].n);
    expect(Date.parse(s.silver_ate!) - agora).toBeCloseTo(180_000, -3);
    await evento(seg - 1, 7);
    expect(Date.parse((await pegar(seg - 1)).silver_ate!) - agora).toBeCloseTo(360_000, -3);
  });
  it('Fita prateada industrial: fechar a conta com o Silver tape vale ×5', async () => {
    await q(`update public.idle_state set settled_at = now(), silver_ate = now() + interval '40 seconds' where user_id = $1`, [A]);
    const r = await taxaA();
    const [{ v0, v1 }] = await q<{ v0: number; v1: number }>(
      `select s.valuation as v0, (public.idle_settle(s, s.settled_at + interval '100 seconds')).valuation as v1
         from public.idle_state s where user_id = $1`, [A]);
    expect(v1 - v0).toBeCloseTo(r * (40 * 5 + 60), 0);
  });
  it('Ancoragem manual: a janela dobra (Lixo 20 + 3 s; Jogo do Brasil 60 + 3 s, aceito até 120 s de agora)', async () => {
    const seg = await agoraSeg();
    await evento(seg - 21, 6); // 21 s < 23 s
    await expect(pegar(seg - 21, 1)).resolves.toBeTruthy();
    await evento(seg - 25, 6);
    await expect(pegar(seg - 25, 1)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 61, 5); // o Jogo do Brasil: 61 s < 63 s
    await expect(pegar(seg - 61, 1)).resolves.toBeTruthy();
  });
});

describe('Mapa do rolê com a árvore grande (0082 parte E)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q(`update public.idle_state set valuation = 1e30, generators[1:13] = array_fill(1, array[13]), strategies = '{0,0,-1,-1,-1,-1}'
              where user_id = $1`, [A]);
  });
  it('abrir lugar 50% mais barato (e as horas da caixinha); subir nível 40% mais barato; venda em 15 min; Copão ×1,5', async () => {
    await ter([1, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910]);
    const [{ j, r }] = await q<{ j: { lugares: { id: number; preco: number; horas: number }[] }; r: number }>(
      'select public.idle_mapa_json(s) as j, public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]);
    const tee = j.lugares.find((l) => l.id === 3)!;
    expect(rel(tee.preco, 2 * 3600 * r * 0.5)).toBeLessThan(1e-12);
    expect(tee.horas).toBeCloseTo(1, 12);
    // o desconto é o que deixa abrir: com 0,75 do preço cheio, sem os nós recusa; com eles abre e sobra ~0,25 do preço cheio
    const cheio = 2 * 3600 * r;
    const tudo = [1, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910];
    await q('delete from public.idle_arvore where user_id = $1', [A]);
    await q('update public.idle_state set valuation = $2 where user_id = $1', [A, 0.75 * cheio]);
    await expect(t.rpc('idle_place_abrir', { p_lugar: 3 })).rejects.toThrow(/idle_cant_afford/);
    await ter(tudo);
    const s = await t.rpc<J & { mapa: unknown }>('idle_place_abrir', { p_lugar: 3 });
    expect(s.mapa).toBeTruthy();
    expect(rel(s.valuation, 0.25 * cheio)).toBeLessThan(1e-3);
    expect(await q('select 1 from public.idle_place_state where user_id = $1 and lugar = 3', [A])).toHaveLength(1);
    // subir nível: com 0,8 do custo cheio na moeda, sem os nós recusa; com eles sobe e sobra ~0,2 do custo cheio
    const custo = 450 * 1.55;
    await q('update public.idle_place_state set nivel = 2, moeda = $2 where user_id = $1 and lugar = 3', [A, 0.8 * custo]);
    await q('delete from public.idle_arvore where user_id = $1', [A]);
    await expect(t.rpc('idle_place_nivel', { p_lugar: 3 })).rejects.toThrow(/idle_lugar_moeda/);
    await ter(tudo);
    await t.rpc('idle_place_nivel', { p_lugar: 3 });
    const [{ moeda, nivel }] = await q<{ moeda: number; nivel: number }>('select moeda, nivel from public.idle_place_state where user_id = $1 and lugar = 3', [A]);
    expect(nivel).toBe(3);
    expect(rel(moeda, 0.2 * custo)).toBeLessThan(1e-9);
    await q('update public.idle_place_state set nivel = 2 where user_id = $1 and lugar = 3', [A]);
    const [{ l }] = await q<{ l: { preco_nivel: number; venda_min: number; copao_mult: number } }>(
      'select public.idle_lugar_json(s, 3) as l from public.idle_state s where user_id = $1', [A]);
    expect(rel(l.preco_nivel, 450 * 1.55 * 0.6)).toBeLessThan(1e-12);
    expect(l.venda_min).toBeCloseTo(15, 12);
    expect(l.copao_mult).toBe(1.5);
  });
});
