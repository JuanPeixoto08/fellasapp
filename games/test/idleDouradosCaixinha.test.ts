// Dourados novos e oportunidades novas na Caixinha (0076): a sorte do banco é a da página, e a conta, a compra, o pegar,
// a Caixinha e a Bolsa.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo } from '../idle/catalogo';
import { derrubada } from '../idle/convidados';
import { escolhaLinkedin, segundoPix, sorteioDourado, tigrePaga, tipoDourado, tipoGarantido } from '../idle/dourados';
import { produzido, rendasGeradores, VIRAL_MS } from '../idle/economia';
import { OPP_CORTE, pendentes, tipo } from '../idle/oportunidades';
import { freshDb, quartaATarde, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '098d04dc-bba1-433a-9ef8-0e9dd863e4ed';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type J = IdleState & { dourados_cont: Record<string, number> };
const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
/** Fecha a conta no futuro: nada rende entre ler e agir (as contas ficam exatas). */
const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
/** A, membro, empresa aberta com F$ de sobra, 50 do gerador 1 e 20 do 2; B não é membro. */
const abrir = async () => {
  await t.member(A);
  await t.member(B, { isMember: false });
  await t.as(A);
  await t.rpc('idle_start');
  await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
  await parar();
};

beforeEach(async () => {
  t = await freshDb({ conquistas: false });
});

// a idle_rate_at da 0066, com outro nome: a nova (soma de idle_gen_rendas) tem que dar o mesmo
const RATE_0066 = `
create or replace function public.idle_rate_at_0066(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), gen as (
    select c.renda * s.generators[c.id]
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1)
         * case when c.id = 11 then public.idle_conv_food(s, t) else 1 end as v
      from public.idle_cat_gen c
  )
  select coalesce((select sum(v) from gen), 0)
       * coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
       * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
       * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
            * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
       * public.idle_social_mult(s, t)
       * public.idle_bonus_mult(s)
       * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
       * public.idle_conv_prod(s, t)
       * public.idle_place_mult(s)
$$;`;

describe('a sorte (paridade com dourados.ts e oportunidades.ts)', () => {
  it('a roda nova dos dourados: o mesmo tipo em 20 mil segundos, dois jogadores', async () => {
    const ini = 1_760_000_000;
    for (const u of [A, B]) {
      const sql = await q<{ t: number }>(
        'select public.idle_dourado_tipo($1::uuid, s) as t from generate_series($2::bigint, $3::bigint) s order by s', [u, ini, ini + 19_999]);
      expect(sql.map((x) => x.t)).toEqual(Array.from({ length: 20_000 }, (_, i) => tipoDourado(u, ini + i)));
    }
  });
  it('o garantido, o segundo do Pix, a sorte do Tigrinho e o sorteio do LinkedIn são os mesmos', async () => {
    const ini = 1_760_000_000;
    const sql = await q<{ g: number; p: string; tg: boolean; l: number }>(
      `select public.idle_dourado_tipo_garantido($1::uuid, s) as g, public.idle_dourado_pix_seg($1::uuid, s)::text as p,
              public.idle_dourado_tigre_paga($1::uuid, s) as tg, public.idle_dourado_sorteio($1::uuid, s, 5151, 5) as l
         from generate_series($2::bigint, $3::bigint) s order by s`, [A, ini, ini + 4999]);
    expect(sql).toEqual(Array.from({ length: 5000 }, (_, i) => ({
      g: tipoGarantido(A, ini + i), p: String(segundoPix(A, ini + i)), tg: tigrePaga(A, ini + i), l: sorteioDourado(A, ini + i, 5151, 5),
    })));
  });
  it('a roda da Caixinha com o corte: o mesmo tipo em 4 mil janelas em volta de OPP_CORTE, dois jogadores', async () => {
    for (const u of [A, B]) {
      const sql = await q<{ k: number }>(
        'select public.idle_opp_kind($1::uuid, w) as k from generate_series($2::bigint, $3::bigint) w order by w', [u, OPP_CORTE - 2000, OPP_CORTE + 1999]);
      expect(sql.map((x) => x.k)).toEqual(Array.from({ length: 4000 }, (_, i) => tipo(u, OPP_CORTE - 2000 + i)));
    }
  });
  it('o corte é o mesmo número no TS e no SQL', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/0076_fellas_inc_dourados_caixinha.sql'), 'utf8');
    expect(sql).toContain(`when w < ${OPP_CORTE} then`);
  });
  it('a faixa do MC V.V nunca dá Tigrinho no banco também', async () => {
    let seg = 1_760_000_000;
    while (tipoDourado(A, seg) !== 7 || derrubada(A, seg - 7200, 1)) seg++;
    await abrir();
    await q(`update public.idle_state set generators[13] = 1, conv_cadeira = '{9,null,null}',
               conv_desde = array[to_timestamp($2::double precision), null, null]::timestamptz[] where user_id = $1`, [A, seg - 7200]);
    const [{ f }] = await q<{ f: number }>('select public.idle_conv_faixa(s, $2) as f from public.idle_state s where user_id = $1', [A, seg]);
    expect(f).toBe(0);
  });
  it('idle_rate_at soma idle_gen_rendas e dá o mesmo que a conta da 0066', async () => {
    await t.db.exec(RATE_0066);
    await abrir();
    for (const set of [
      'generators[1] = 10',
      `generators[1:6] = '{50,40,30,20,10,5}', upgrades = '{11,12,21,1001}'`,
      `generators[1:12] = '{200,150,120,90,80,60,50,40,30,20,10,5}', strategies = '{0,1,-1,-1}', upgrades = '{11,12,13,21,22,31,1001,1002}'`,
    ]) {
      await q(`update public.idle_state set ${set} where user_id = $1`, [A]);
      const [r] = await q<{ novo: number; velho: number; soma: number }>(
        `select public.idle_rate_at(s, now()) as novo, public.idle_rate_at_0066(s, now()) as velho,
                (select sum(x.renda) from public.idle_gen_rendas(s, now()) x) as soma
           from public.idle_state s where user_id = $1`, [A]);
      expect(r.novo).toBe(r.soma);
      expect(Math.abs(r.novo / r.velho - 1)).toBeLessThan(1e-12);
    }
  });
  it('LinkedIn: o mesmo gerador e o mesmo f (idle_linkedin × escolhaLinkedin com as rendas do banco); a página ordena igual', async () => {
    await abrir();
    await q(`update public.idle_state set generators[1:8] = '{120,80,60,40,30,20,10,5}', upgrades = '{11,12,21,31}' where user_id = $1`, [A]);
    const [{ r }] = await q<{ r: number[] }>(
      'select array(select x.renda from public.idle_gen_rendas(s, now()) x order by x.gen) as r from public.idle_state s where user_id = $1', [A]);
    const ini = 1_760_000_000;
    const sql = await q<{ gen: number; f: number }>(
      `select l.gen, l.f from generate_series($2::bigint, $3::bigint) seg cross join public.idle_state s
         cross join lateral public.idle_linkedin(s, seg) l where s.user_id = $1 order by seg`, [A, ini, ini + 299]);
    expect(sql).toHaveLength(300);
    sql.forEach((x, i) => {
      const e = escolhaLinkedin(A, ini + i, r)!;
      expect(x.gen).toBe(e.gen);
      expect(x.f).toBeCloseTo(e.f, 12);
    });
    const s = await t.rpc<IdleState>('idle_open');
    const ts = rendasGeradores(catalogo, s);
    const soma = (v: number[]) => v.reduce((a, x) => a + x, 0);
    ts.forEach((x, i) => expect(x / soma(ts)).toBeCloseTo(r[i] / soma(r), 12));
  });
});

describe('o estado, a conta e a compra (0076, parte B)', () => {
  beforeEach(abrir);
  const comprar = async (kind: string, id: number, qtd = 1) => {
    const antes = await valor();
    const s = await t.rpc<J>('idle_buy', { p_kind: kind, p_id: id, p_qty: qtd });
    return { gasto: antes - s.valuation, s };
  };
  /** Preço de k do gerador 2 agora, com o custo × fator (0,75 = cupom, 0,5 = Promoção). */
  const precoGen = async (k: number, fator = 1) => (await q<{ p: number }>(
    `select public.idle_price(c.custo, s.generators[2], $2, public.idle_cost_mult(s) * $3) as p
       from public.idle_cat_gen c, public.idle_state s where c.id = 2 and s.user_id = $1`, [A, k, fator]))[0].p;

  it('fechar a conta com LinkedIn e Combo é igual a produzido (sozinhos e com ×5, Viralizou e Marmita)', async () => {
    const casos: (number | null)[][] = [
      [40, null, null, null, null], [null, 30, null, null, null], [40, 30, 20, null, null], [40, 30, null, 60, null], [40, 30, null, null, 50],
    ];
    for (const [li, co, boost, viral, marmita] of casos) {
      await q(`update public.idle_state set settled_at = now(),
                 linkedin_ate = case when $2::int is null then null else now() + make_interval(secs => $2) end, linkedin_mult = 4.5,
                 combo_ate = case when $3::int is null then null else now() + make_interval(secs => $3) end,
                 boost_ate = case when $4::int is null then '{}' else array[now() + make_interval(secs => $4)] end,
                 viral_ate = case when $5::int is null then '{}' else array[now() + make_interval(secs => $5)] end,
                 marmita_ate = case when $6::int is null then null else now() + make_interval(secs => $6) end
               where user_id = $1`, [A, li, co, boost, viral, marmita]);
      const r = await taxa();
      const [{ v0, v1 }] = await q<{ v0: number; v1: number }>(
        `select s.valuation as v0, (public.idle_settle(s, s.settled_at + interval '100 seconds')).valuation as v1
           from public.idle_state s where user_id = $1`, [A]);
      const outros = [...(li === null ? [] : [{ ateMs: li * 1000, mult: 4.5 }]), ...(co === null ? [] : [{ ateMs: co * 1000, mult: 7 }])];
      const esperado = produzido(r, 0, 100_000, boost === null ? null : [boost * 1000], viral === null ? [] : [viral * 1000], VIRAL_MS,
        marmita === null ? null : marmita * 1000, outros);
      expect(v1 - v0).toBeCloseTo(esperado, 0);
    }
  });
  it('cupom: gerador 25% mais barato no 1 e no 10, gasta 1 por compra; melhoria não gasta', async () => {
    await q('update public.idle_state set cupons = 2 where user_id = $1', [A]);
    let p = await precoGen(1, 0.75);
    let r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(p, 3);
    expect(r.s.cupons).toBe(1);
    p = await precoGen(10, 0.75);
    r = await comprar('gerador', 2, 10);
    expect(r.gasto).toBeCloseTo(p, 3);
    expect(r.s.cupons).toBe(0);
    p = await precoGen(1);
    r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(p, 3);
    await q('update public.idle_state set cupons = 1 where user_id = $1', [A]);
    r = await comprar('melhoria', 11);
    expect(r.s.cupons).toBe(1);
  });
  it('Máx com cupom: compra o que dá com o preço do cupom', async () => {
    const tres = await precoGen(3, 0.75);
    await q('update public.idle_state set cupons = 1, valuation = $2 where user_id = $1', [A, tres * 1.0000001]);
    const r = await comprar('gerador', 2, 0);
    expect(r.s.generators[1]).toBe(23);
    expect(r.s.cupons).toBe(0);
  });
  it('com Promoção o cupom fica guardado; com meia-preço a compra de 1 usa a meia e o cupom também fica (até 50%)', async () => {
    await q(`update public.idle_state set cupons = 3, promo_ate = now() + interval '30 seconds' where user_id = $1`, [A]);
    const meio = await precoGen(1, 0.5);
    let r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(meio, 3);
    expect(r.s.cupons).toBe(3);
    await q('update public.idle_state set promo_ate = null, meias = 1 where user_id = $1', [A]);
    const metade = (await precoGen(1)) / 2;
    r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(metade, 3);
    expect(r.s.cupons).toBe(3);
    expect(r.s.meias).toBe(0);
  });
  it('cashback: devolve 30% (gerador e melhoria) e soma no contador; com Promoção paga 35%; acabou há 0,5 s ainda vale', async () => {
    await q(`update public.idle_state set cashback_ate = now() + interval '60 seconds' where user_id = $1`, [A]);
    const cheio = await precoGen(1);
    let r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(cheio * 0.7, 3);
    const [{ upg }] = await q<{ upg: number }>('select preco as upg from public.idle_cat_upg where id = 11');
    r = await comprar('melhoria', 11);
    expect(r.gasto).toBeCloseTo(upg * 0.7, 3);
    expect(r.s.dourados_cont.cashback).toBeCloseTo(0.3 * (cheio + upg), 3);
    await q(`update public.idle_state set promo_ate = now() + interval '30 seconds' where user_id = $1`, [A]);
    const meio = await precoGen(1, 0.5);
    r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(meio * 0.7, 3); // 35% do cheio
    await q(`update public.idle_state set promo_ate = null, cashback_ate = now() - interval '500 milliseconds' where user_id = $1`, [A]);
    const deNovo = await precoGen(1);
    r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(deNovo * 0.7, 3);
  });
  it('o JSON traz os campos novos e esconde o que já passou (Combo, garantido velho, jogadas de ontem)', async () => {
    const agora = await agoraSeg();
    await q(`update public.idle_state set linkedin_ate = now() + interval '1 minute', linkedin_gen = 2, linkedin_mult = 4.5,
               combo_ate = now() - interval '1 second', combo_n = 2, combo_seg = $2::bigint, cashback_ate = now() + interval '1 minute',
               garantidos = jsonb_build_array(jsonb_build_object('seg', $2::bigint - 100, 'tipo', 0, 'dobro', true),
                                              jsonb_build_object('seg', $2::bigint + 5, 'tipo', 2, 'dobro', false)),
               tigre_dia = public.games_today() - 1, tigre_n = 3, chamados = 2, cupons = 7, info_creditos = 1,
               dourados_cont = '{"pix_dev": 4}' where user_id = $1`, [A, agora]);
    const s = await t.rpc<J>('idle_open');
    expect(s).toMatchObject({ linkedin_gen: 2, linkedin_mult: 4.5, combo_ate: null, combo_n: 2, combo_seg: agora, tigre_n: 0,
      chamados: 2, cupons: 7, info_creditos: 1, dourados_cont: { pix_dev: 4 }, horta_crescendo: 0 });
    expect(s.linkedin_ate).not.toBeNull();
    expect(s.cashback_ate).not.toBeNull();
    expect(s.garantidos).toEqual([{ seg: agora + 5, tipo: 2, dobro: false }]);
  });
  it('o JSON conta as jogadas do Tigrinho de hoje e só devolve as espiadas de menos de 2 h', async () => {
    await q(`update public.idle_state set tigre_dia = public.games_today(), tigre_n = 2,
               espiadas = jsonb_build_object('1', jsonb_build_object('ate_tick', 5, 'em', now() - interval '1 hour'),
                                             '2', jsonb_build_object('ate_tick', 5, 'em', now() - interval '3 hours'))
             where user_id = $1`, [A]);
    const s = await t.rpc<J>('idle_open');
    expect(s.tigre_n).toBe(2);
    expect(Object.keys(s.espiadas ?? {})).toEqual(['1']);
  });
  it('horta_crescendo conta só as plantas ainda não maduras', async () => {
    await q('update public.idle_state set generators[11] = 1 where user_id = $1', [A]);
    const [e] = await q<{ id: number; amadurece_s: number }>('select id, amadurece_s from public.idle_cat_horta order by amadurece_s desc limit 1');
    await q(`insert into public.idle_horta_plantas (user_id, canteiro, especie, inicio) values ($1, 0, $2, now()),
               ($1, 1, $2, now() - make_interval(secs => $3 + 10))`, [A, e.id, e.amadurece_s]);
    const s = await t.rpc<J>('idle_open');
    expect(s.horta_crescendo).toBe(1);
  });
  it('horta_crescendo usa o tempo próprio da planta (Terry Crews, árvore): madura pelo dela não conta', async () => {
    await q('update public.idle_state set generators[11] = 1 where user_id = $1', [A]);
    const [e] = await q<{ id: number }>('select id from public.idle_cat_horta where amadurece_s > 300 order by amadurece_s desc limit 1');
    await q(`insert into public.idle_horta_plantas (user_id, canteiro, especie, inicio, amadurece_s) values
               ($1, 0, $2, now() - interval '120 seconds', 60), ($1, 1, $2, now() - interval '120 seconds', 3600)`, [A, e.id]);
    const s = await t.rpc<J>('idle_open');
    expect(s.horta_crescendo).toBe(1);
  });
  it('vender a startup zera os bônus e os estoques novos; os contadores e o Tigrinho do dia ficam', async () => {
    await q(`update public.idle_state set linkedin_ate = now() + interval '1 minute', linkedin_gen = 2, linkedin_mult = 4.5,
               combo_ate = now() + interval '1 minute', combo_n = 2, combo_seg = 1, garantidos = '[{"seg": 1, "tipo": 0, "dobro": true}]',
               tigre_dia = public.games_today(), tigre_n = 3, chamados = 2, cupons = 7, cashback_ate = now() + interval '1 minute',
               info_creditos = 2, espiadas = jsonb_build_object('1', jsonb_build_object('ate_tick', 1, 'em', now())),
               dourados_cont = '{"pix_dev": 4}', prestige_earned = 0, valuation = 1e30, generators[30] = 150, strategies = '{0,0,0,0}' where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    const [l] = await q<Record<string, unknown>>(
      `select linkedin_ate, linkedin_gen, linkedin_mult, combo_ate, combo_n, combo_seg, garantidos, chamados, cupons, cashback_ate,
              info_creditos, espiadas, dourados_cont, tigre_n, tigre_dia = public.games_today() as tigre_hoje
         from public.idle_state where user_id = $1`, [A]);
    expect(l).toEqual({ linkedin_ate: null, linkedin_gen: null, linkedin_mult: null, combo_ate: null, combo_n: 0, combo_seg: null,
      garantidos: [], chamados: 0, cupons: 0, cashback_ate: null, info_creditos: 0, espiadas: {}, dourados_cont: { pix_dev: 4 },
      tigre_n: 3, tigre_hoje: true });
  });
});

describe('pegar os dourados novos (0076, parte C)', () => {
  type JP = J & { dourado: NonNullable<IdleState['dourado']> };
  const dourado = (seg: number, tipo: number) =>
    q('insert into public.teste_dourado values ($1, $2) on conflict (s) do update set tipo = excluded.tipo', [seg, tipo]);
  const sorteio = (seg: number, sal: number, r: number) =>
    q('insert into public.teste_sorteio values ($1, $2, $3) on conflict (s, sal) do update set r = excluded.r', [seg, sal, r]);
  const pegar = (seg: number, lado = 0, moedas?: number) =>
    t.rpc<JP>('idle_dourado_pegar', moedas === undefined ? { p_seg: seg, p_lado: lado } : { p_seg: seg, p_lado: lado, p_moedas: moedas });
  const garantir = (seg: number, tipo: number, dobro = true) => q(
    `update public.idle_state set garantidos = garantidos || jsonb_build_array(jsonb_build_object('seg', $2::bigint, 'tipo', $3::int, 'dobro', $4::boolean))
      where user_id = $1`, [A, seg, tipo, dobro]);
  const combo = (n: number, de: number) => q('update public.idle_state set combo_n = $2, combo_seg = $3 where user_id = $1', [A, n, de]);

  beforeEach(async () => {
    // a sorte vem de tabelas: teste_dourado (o tipo de cada segundo) e teste_sorteio (cada sorteio; sem linha = 0)
    await t.db.exec(`
      create table public.teste_dourado (s bigint primary key, tipo int);
      create or replace function public.idle_dourado(u uuid, s bigint, gema double precision default 0) returns int language sql stable as
        'select tipo from public.teste_dourado where teste_dourado.s = idle_dourado.s';
      create table public.teste_sorteio (s bigint, sal int, r int, primary key (s, sal));
      create or replace function public.idle_dourado_sorteio(u uuid, s bigint, sal int, n int) returns int language sql stable as
        'select coalesce((select r from public.teste_sorteio x where x.s = idle_dourado_sorteio.s and x.sal = idle_dourado_sorteio.sal), 0)';`);
    await abrir();
  });

  it('Trend: 1 min de produção por moedinha, no máximo 20 (25 vira 20, negativo vira 0); vale até a janela + 8 + 3 s', async () => {
    const seg = await agoraSeg();
    const r = await taxa();
    await dourado(seg - 20, 4); // 12 + 8 + 3 = 23 s
    const antes = await valor();
    const s = await pegar(seg - 20, 0, 25);
    expect(s.valuation - antes).toBeCloseTo(r * 60 * 20, 2);
    expect(s.dourado).toMatchObject({ tipo: 4, moedas: 20 });
    expect(s.dourados_cont.trend_max).toBe(20);
    await dourado(seg - 1, 4);
    const antes2 = await valor();
    expect((await pegar(seg - 1, 0, -3)).valuation - antes2).toBeCloseTo(0, 6);
    await dourado(seg - 19, 0); // o Investidor não tem os 8 s: 12 + 3 = 15
    await expect(pegar(seg - 19)).rejects.toThrow(/idle_dourado_gone/);
  });
  it('Pix: ficar paga 30 min; devolver põe um garantido em dobro de 20 a 120 s depois; o mesmo Pix paga uma vez só', async () => {
    const seg = await agoraSeg();
    const r = await taxa();
    await dourado(seg, 6);
    const antes = await valor();
    const s = await pegar(seg, 0);
    expect(s.valuation - antes).toBeCloseTo(r * 1800, 2);
    await expect(pegar(seg, 1)).rejects.toThrow(/idle_dourado_pego/); // ficou: não dá pra devolver o mesmo Pix
    await dourado(seg - 1, 6);
    await sorteio(seg - 1, 6161, 37);
    const d = await pegar(seg - 1, 1);
    expect(d.garantidos).toEqual([{ seg: seg + 56, tipo: tipoGarantido(A, seg + 56), dobro: true }]);
    expect(d.dourados_cont.pix_dev).toBe(1);
    expect(d.dourado).toMatchObject({ tipo: 6, lado: 1, garantido_seg: seg + 56 });
    await expect(pegar(seg - 1, 0)).rejects.toThrow(/idle_dourado_pego/);
  });
  it('garantido em dobro: Investidor 2×, Viralizou em dois fins, Promoção 1 min, LinkedIn 2 min, Trend 2 min por moedinha; sai da lista', async () => {
    const seg = await agoraSeg();
    const r = await taxa();
    await garantir(seg, 0);
    const antes = await valor();
    let s = await pegar(seg);
    expect(s.valuation - antes).toBeCloseTo(r * 1200 * 2, 2);
    expect(s.garantidos).toEqual([]);
    await garantir(seg - 1, 2);
    s = await pegar(seg - 1);
    expect(s.viral).toHaveLength(2);
    expect(Date.parse(s.viral[1]) - Date.parse(s.viral[0])).toBeCloseTo(60_000, -3);
    await garantir(seg - 2, 1);
    s = await pegar(seg - 2);
    expect(Date.parse(s.promo_ate!) - Date.parse(s.server_now)).toBeCloseTo(60_000, -3);
    await garantir(seg - 3, 5);
    s = await pegar(seg - 3);
    expect(Date.parse(s.linkedin_ate!) - Date.parse(s.server_now)).toBeCloseTo(120_000, -3);
    await garantir(seg - 4, 4);
    const antes2 = await valor();
    s = await pegar(seg - 4, 0, 10);
    expect(s.valuation - antes2).toBeCloseTo(r * 60 * 10 * 2, 2);
    expect(s.dourado.dobro).toBe(true);
  });
  it('garantido que passou da janela não paga e sai da lista', async () => {
    const seg = await agoraSeg();
    await garantir(seg - 20, 0);
    await expect(pegar(seg - 20)).rejects.toThrow(/idle_dourado_gone/);
    await q(`update public.idle_state set garantidos = jsonb_build_array(jsonb_build_object('seg', $2::bigint, 'tipo', 0, 'dobro', true)) where user_id = $1`, [A, seg - 61]);
    expect((await t.rpc<J>('idle_open')).garantidos).toEqual([]);
  });
  it('Tigrinho: as 3 primeiras do dia pagam 30 min (mesmo com a sorte ruim); depois a sorte: paga 30 min ou come 15', async () => {
    const seg = await agoraSeg();
    const r = await taxa();
    for (let i = 0; i < 4; i++) {
      await dourado(seg - i, 7);
      await sorteio(seg - i, 4242, 50);
    }
    for (let i = 0; i < 3; i++) {
      const antes = await valor();
      const s = await pegar(seg - i);
      expect(s.valuation - antes).toBeCloseTo(r * 1800, 2);
      expect(s.dourado.tigre).toMatchObject({ pagou: true, gratis: true, n: i + 1 });
    }
    const antes = await valor();
    const s = await pegar(seg - 3);
    expect(antes - s.valuation).toBeCloseTo(r * 900, 2);
    expect(s.dourado.tigre).toMatchObject({ pagou: false, gratis: false, n: 4 });
    expect(s.dourados_cont.tigre_perdeu).toBe(1);
    await dourado(seg - 4, 7);
    await sorteio(seg - 4, 4242, 29);
    const s2 = await pegar(seg - 4);
    expect(s2.dourado.tigre).toMatchObject({ pagou: true, gratis: false });
    expect(s2.dourados_cont.tigre_seq).toBe(1);
  });
  it('Tigrinho: perder com pouco F$ nunca deixa negativo; outro dia volta a ter 3 grátis; vender a startup não devolve as grátis', async () => {
    const seg = await agoraSeg();
    await q('update public.idle_state set tigre_dia = public.games_today(), tigre_n = 3, valuation = 1 where user_id = $1', [A]);
    await dourado(seg, 7);
    await sorteio(seg, 4242, 99);
    const s = await pegar(seg);
    expect(s.valuation).toBe(0);
    expect(s.dourado.tigre!.perdeu).toBe(1);
    await q('update public.idle_state set tigre_dia = public.games_today() - 1, valuation = 1e12 where user_id = $1', [A]);
    await dourado(seg - 1, 7);
    await sorteio(seg - 1, 4242, 99);
    expect((await pegar(seg - 1)).dourado.tigre).toMatchObject({ pagou: true, gratis: true, n: 1 });
    await q(`update public.idle_state set tigre_n = 3, prestige_earned = 0, valuation = 1e30, generators[30] = 150, strategies = '{0,0,0,0}' where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    expect((await q<{ n: number }>('select tigre_n as n from public.idle_state where user_id = $1', [A]))[0].n).toBe(3);
  });
  it('LinkedIn: o gerador sorteado entre os que mais rendem fica ×30 por 1 min (mult = 1 + 29·f); outro substitui', async () => {
    const seg = await agoraSeg();
    const [{ r }] = await q<{ r: number[] }>(
      'select array(select x.renda from public.idle_gen_rendas(s, now()) x order by x.gen) as r from public.idle_state s where user_id = $1', [A]);
    const soma = r.reduce((a, x) => a + x, 0);
    const top = r.indexOf(Math.max(...r)) + 1;
    await dourado(seg, 5);
    const s = await pegar(seg); // sorteio 0 = o que mais rende
    expect(s.linkedin_gen).toBe(top);
    expect(s.linkedin_mult).toBeCloseTo(1 + 29 * (r[top - 1] / soma), 9);
    expect(Date.parse(s.linkedin_ate!) - Date.parse(s.server_now)).toBeCloseTo(60_000, -3);
    await dourado(seg - 1, 5);
    await sorteio(seg - 1, 5151, 1);
    const s2 = await pegar(seg - 1);
    expect(s2.linkedin_gen).not.toBe(top);
    expect(s2.dourado).toMatchObject({ tipo: 5, gen: s2.linkedin_gen });
  });
  it('Combo: 3 pegos seguidos = ×7 por 1 min; o 2º lado da dupla não soma', async () => {
    const seg = await agoraSeg();
    await dourado(seg - 10, 0);
    await dourado(seg - 7, 3);
    await dourado(seg - 5, 0);
    await pegar(seg - 10);
    await pegar(seg - 7, 0);
    let s = await pegar(seg - 7, 1);
    expect(s.combo_n).toBe(2);
    s = await pegar(seg - 5);
    expect(s.dourado.combo).toBe(true);
    expect(s.combo_n).toBe(0);
    expect(Date.parse(s.combo_ate!) - Date.parse(s.server_now)).toBeCloseTo(60_000, -3);
    expect(s.dourados_cont.combos).toBe(1);
  });
  it('Combo quebra com um dourado perdido no meio; não quebra com Tigrinho ignorado nem com garantido perdido; zera depois de 30 min', async () => {
    const seg = await agoraSeg();
    await dourado(seg - 40, 0); // ninguém pegou e a janela já passou
    await dourado(seg, 0);
    await combo(2, seg - 50);
    expect((await pegar(seg)).combo_n).toBe(1);
    await dourado(seg - 30, 7); // Tigrinho ignorado
    await dourado(seg - 1, 0);
    await combo(2, seg - 35);
    expect((await pegar(seg - 1)).dourado.combo).toBe(true);
    await q(`update public.idle_state set garantidos = jsonb_build_array(jsonb_build_object('seg', $2::bigint, 'tipo', 0, 'dobro', false)) where user_id = $1`, [A, seg - 25]);
    await dourado(seg - 2, 0);
    await combo(2, seg - 28);
    expect((await pegar(seg - 2)).dourado.combo).toBe(true);
    await dourado(seg - 3, 0);
    await combo(2, seg - 2000);
    expect((await pegar(seg - 3)).combo_n).toBe(1);
  });
  it('Chamar: sem guardado, idle_chamar_vazio; com 2, gasta 1 e põe um garantido no segundo seguinte (sem dobro, sem Pix nem Tigrinho)', async () => {
    await expect(t.rpc('idle_dourado_chamar')).rejects.toThrow(/idle_chamar_vazio/);
    await q('update public.idle_state set chamados = 2 where user_id = $1', [A]);
    const seg = await agoraSeg();
    const s = await t.rpc<J>('idle_dourado_chamar');
    expect(s.chamados).toBe(1);
    const g = s.garantidos![0];
    expect(g.seg - seg).toBeGreaterThanOrEqual(1);
    expect(g.seg - seg).toBeLessThanOrEqual(2);
    expect(g).toEqual({ seg: g.seg, tipo: tipoGarantido(A, g.seg), dobro: false });
    const s2 = await t.rpc<J>('idle_dourado_chamar');
    expect(s2.chamados).toBe(0);
    expect(new Set(s2.garantidos!.map((x) => x.seg)).size).toBe(2);
  });
  it('Combo: a dupla conta uma vez mesmo com outro dourado pego entre os dois lados', async () => {
    const seg = await agoraSeg();
    await dourado(seg - 10, 3);
    await dourado(seg - 8, 0);
    let s = await pegar(seg - 10, 0);
    expect(s.combo_n).toBe(1);
    s = await pegar(seg - 8);
    expect(s.combo_n).toBe(2);
    s = await pegar(seg - 10, 1); // o 2º lado, depois de outro dourado: nem soma nem quebra nem dispara
    expect(s.combo_n).toBe(2);
    expect(s.dourado.combo).toBe(false);
    expect(s.combo_ate).toBeNull();
    expect(s.combo_seg).toBe(seg - 8);
  });
  it('quem não é membro não pega nem chama', async () => {
    const seg = await agoraSeg();
    await t.as(B);
    await expect(pegar(seg)).rejects.toThrow(/not_member/);
    await expect(t.rpc('idle_dourado_chamar')).rejects.toThrow(/not_member/);
  });
});

describe('conquistas dos dourados (132–135, 138)', () => {
  beforeEach(async () => {
    t = await freshDb(); // com o catálogo das conquistas
    await t.db.exec(`
      create table public.teste_dourado (s bigint primary key, tipo int);
      create or replace function public.idle_dourado(u uuid, s bigint, gema double precision default 0) returns int language sql stable as
        'select tipo from public.teste_dourado where teste_dourado.s = idle_dourado.s';
      create table public.teste_sorteio (s bigint, sal int, r int, primary key (s, sal));
      create or replace function public.idle_dourado_sorteio(u uuid, s bigint, sal int, n int) returns int language sql stable as
        'select coalesce((select r from public.teste_sorteio x where x.s = idle_dourado_sorteio.s and x.sal = idle_dourado_sorteio.sal), 0)';`);
    await abrir();
  });
  const tem = async (id: number) =>
    (await q('select 1 from public.idle_conquistas where user_id = $1 and conquista_id = $2', [A, id])).length > 0;

  it('Combo 10, Trend com 20, Pix devolvido 10, 3 seguidas pagas depois das grátis e 10 derrotas no Tigrinho', async () => {
    const seg = await agoraSeg();
    await q(`update public.idle_state set dourados_cont = '{"pix_dev": 9, "tigre_perdeu": 9, "combos": 9, "tigre_seq": 2}',
               tigre_dia = public.games_today(), tigre_n = 3, combo_n = 2, combo_seg = $2 where user_id = $1`, [A, seg - 11]);
    const vez = async (x: number, tipo: number, lado = 0, moedas?: number, sorte?: number) => {
      await q('insert into public.teste_dourado values ($1, $2)', [x, tipo]);
      if (sorte !== undefined) await q('insert into public.teste_sorteio values ($1, 4242, $2)', [x, sorte]);
      await t.rpc('idle_dourado_pegar', moedas === undefined ? { p_seg: x, p_lado: lado } : { p_seg: x, p_lado: lado, p_moedas: moedas });
    };
    await vez(seg - 10, 4, 0, 19); // o 3º seguido: Combo nº 10
    expect(await tem(135)).toBe(true);
    expect(await tem(132)).toBe(false);
    await vez(seg - 9, 4, 0, 20);
    expect(await tem(132)).toBe(true);
    await vez(seg - 8, 6, 1);
    expect(await tem(133)).toBe(true);
    await vez(seg - 7, 7, 0, undefined, 0); // 4ª do dia, a sorte paga: 3 seguidas
    expect(await tem(138)).toBe(true);
    await vez(seg - 6, 7, 0, undefined, 99); // perde: a 10ª derrota
    expect(await tem(134)).toBe(true);
  });
});

describe('as oportunidades novas (0076, parte D)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); // numa quarta à tarde: a caixinha sempre tem guardadas
    vi.setSystemTime(quartaATarde());
    // o tipo de toda janela vem de teste_opp (o que o teste forçar)
    await t.db.exec(`
      create table public.teste_opp (k int);
      create or replace function public.idle_opp_kind(u uuid, w bigint) returns int language sql stable as
        'select coalesce((select k from public.teste_opp limit 1), 0)';`);
    await abrir();
  });
  afterEach(() => vi.useRealTimers());
  /** Pega a próxima guardada como o tipo k (zera as já pegas, pra sempre ter uma). */
  const pegarOpp = async (k: number) => {
    await q('delete from public.teste_opp where true');
    await q('insert into public.teste_opp values ($1)', [k]);
    await q(`update public.idle_state set opp_claimed = '{}', opp_count = 0 where user_id = $1`, [A]);
    const s = await t.rpc<J>('idle_open');
    const [w] = pendentes(A, Date.parse(s.server_now), [], Date.parse(s.week_start + 'T00:00:00-03:00'));
    return t.rpc<J>('idle_claim_opportunity', { p_window: w });
  };
  const xepa = async () => {
    const [{ id }] = await q<{ id: number }>(`select id from public.idle_cat_no where tipo = 'opp_bonus'`);
    await q('insert into public.idle_arvore (user_id, no_id) values ($1, $2)', [A, id]);
  };

  it('Chamar: guarda 1 (2 com a Xepa), no máximo 3 (o que passa se perde)', async () => {
    expect((await pegarOpp(3)).chamados).toBe(1);
    await xepa();
    expect((await pegarOpp(3)).chamados).toBe(3);
    expect((await pegarOpp(3)).chamados).toBe(3);
  });
  it('Cupom: +10 (+20 com a Xepa) e conta 1 pega', async () => {
    let s = await pegarOpp(4);
    expect(s.cupons).toBe(10);
    expect(s.dourados_cont.cupons).toBe(1);
    await xepa();
    s = await pegarOpp(4);
    expect(s.cupons).toBe(30);
    expect(s.dourados_cont.cupons).toBe(2);
  });
  it('Cashback: 2 min (4 com a Xepa), soma no fim do que já tem', async () => {
    let s = await pegarOpp(6);
    expect(Date.parse(s.cashback_ate!) - Date.parse(s.server_now)).toBeCloseTo(120_000, -3);
    s = await pegarOpp(6);
    expect(Date.parse(s.cashback_ate!) - Date.parse(s.server_now)).toBeCloseTo(240_000, -3);
    await q('update public.idle_state set cashback_ate = null where user_id = $1', [A]);
    await xepa();
    s = await pegarOpp(6);
    expect(Date.parse(s.cashback_ate!) - Date.parse(s.server_now)).toBeCloseTo(240_000, -3);
  });
  it('Informação: +1 crédito (2 com a Xepa) com Bolsa; sem Bolsa, 15 min de produção', async () => {
    const r = await taxa();
    const antes = await valor();
    let s = await pegarOpp(7);
    expect(s.valuation - antes).toBeCloseTo(r * 900, 2);
    expect(s.info_creditos).toBe(0);
    await q('update public.idle_state set generators[19] = 1 where user_id = $1', [A]);
    s = await pegarOpp(7);
    expect(s.info_creditos).toBe(1);
    await xepa();
    s = await pegarOpp(7);
    expect(s.info_creditos).toBe(3);
  });
  it('Adubo: a planta crescendo mais perto de amadurecer fica madura agora; sem planta crescendo (ou sem Horta), 15 min', async () => {
    const r0 = await taxa();
    const antes = await valor();
    let s = await pegarOpp(5);
    expect(s.valuation - antes).toBeCloseTo(r0 * 900, 2); // sem Horta
    await q('update public.idle_state set generators[11] = 1 where user_id = $1', [A]); // lado 2: canteiros 0, 1, 6, 7
    await t.rpc('idle_horta_plantar', { p_canteiro: 0, p_especie: 1 });
    await t.rpc('idle_horta_plantar', { p_canteiro: 1, p_especie: 1 });
    await q(`update public.idle_horta_plantas set inicio = now() - interval '10 minutes' where user_id = $1 and canteiro = 0`, [A]);
    await q(`update public.idle_horta_plantas set inicio = now() - interval '50 minutes' where user_id = $1 and canteiro = 1`, [A]);
    expect((await t.rpc<J>('idle_open')).horta_crescendo).toBe(2);
    s = await pegarOpp(5);
    const amad = async (c: number) => (await q<{ a: number }>(
      'select amadurece_s as a from public.idle_horta_plantas where user_id = $1 and canteiro = $2', [A, c]))[0].a;
    expect(await amad(1)).toBeCloseTo(3000, -1); // a de 50 min (faltavam 10): madura agora
    expect(await amad(0)).toBeCloseTo(3600, 6); // a outra continua
    expect(s.horta_crescendo).toBe(1);
  });
});

describe('o Espiar da Bolsa (0076, parte D)', () => {
  type Bolsa = { info_creditos: number; empresas: { id: number; humor: number | null; espiada: boolean; muda_em: number | null }[] };
  const T = 5000;
  const espiar = (empresa: number, agora = T) =>
    q<{ v: J & { bolsa: Bolsa } }>('select public.idle_bolsa_espiar_em($1, $2, $3) as v', [A, empresa, agora]).then((r) => r[0].v);
  const estado = (agora = T) => q<{ v: Bolsa }>('select public.idle_bolsa_estado($1, $2) as v', [A, agora]).then((r) => r[0].v);
  beforeEach(async () => {
    await abrir();
    await q('update public.idle_state set generators[19] = 2, generators[11] = 20 where user_id = $1', [A]);
    await q('select public.idle_bolsa_avancar_ate($1)', [T]);
    await q('update public.idle_bolsa_mercado set humor = 3, humor_ate = $1 where empresa = 1', [T + 7]);
  });

  it('sem crédito: idle_info_sem_credito; com 2: gasta 1 e mostra o humor e em quantos minutos ele muda', async () => {
    await expect(espiar(1)).rejects.toThrow(/idle_info_sem_credito/);
    await q('update public.idle_state set info_creditos = 2 where user_id = $1', [A]);
    const r = await espiar(1);
    expect(r.info_creditos).toBe(1);
    expect(r.bolsa.info_creditos).toBe(1);
    expect(r.bolsa.empresas[0]).toMatchObject({ id: 1, humor: 3, espiada: true, muda_em: 7 });
    expect(r.bolsa.empresas[1]).toMatchObject({ humor: null, espiada: false, muda_em: null });
  });
  it('a mesma empresa de novo: idle_info_ja (não gasta); o humor virou: some', async () => {
    await q('update public.idle_state set info_creditos = 2 where user_id = $1', [A]);
    await espiar(1);
    await expect(espiar(1)).rejects.toThrow(/idle_info_ja/);
    expect((await t.rpc<J>('idle_open')).info_creditos).toBe(1);
    await q('update public.idle_bolsa_mercado set humor = 4, humor_ate = $1 where empresa = 1', [T + 30]);
    expect((await estado()).empresas[0]).toMatchObject({ humor: null, espiada: false, muda_em: null });
  });
  it('com o VSauce sentado o humor já aparece (sem o "muda em"); espiar acrescenta o "muda em"', async () => {
    await q(`update public.idle_state set generators[13] = 1, conv_cadeira = '{11,null,null}',
               conv_desde = array[now(), null, null]::timestamptz[], info_creditos = 1 where user_id = $1`, [A]);
    expect((await estado()).empresas[0]).toMatchObject({ humor: 3, espiada: false, muda_em: null });
    expect((await espiar(1)).bolsa.empresas[0]).toMatchObject({ humor: 3, espiada: true, muda_em: 7 });
  });
  it('empresa quebrada (RJ): não espia', async () => {
    await q('update public.idle_state set info_creditos = 1 where user_id = $1', [A]);
    await q('update public.idle_bolsa_mercado set rj_ate = $1 where empresa = 2', [T + 5]);
    await expect(espiar(2)).rejects.toThrow(/idle_bolsa_rj/);
  });
});

describe('conquistas da Caixinha e da Bolsa (136, 137, 139)', () => {
  const T = 5000;
  const negociar = (empresa: number, lado: string, qtd: number) =>
    q('select public.idle_bolsa_negociar_em($1, $2, $3, $4, $5, $6) as v', [A, empresa, lado, qtd, T, T]);
  const tem = async (id: number) =>
    (await q('select 1 from public.idle_conquistas where user_id = $1 and conquista_id = $2', [A, id])).length > 0;
  beforeEach(async () => {
    t = await freshDb(); // com o catálogo das conquistas
    await abrir();
  });

  it('o 25º cupom pego = Primeira compra (de novo); F$ 1 tri de cashback = Volta pra conta', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(quartaATarde());
    try {
      await t.db.exec(`create or replace function public.idle_opp_kind(u uuid, w bigint) returns int language sql stable as 'select 4';`);
      await q(`update public.idle_state set dourados_cont = '{"cupons": 24}' where user_id = $1`, [A]);
      const s = await t.rpc<J>('idle_open');
      const [w] = pendentes(A, Date.parse(s.server_now), [], Date.parse(s.week_start + 'T00:00:00-03:00'));
      await t.rpc('idle_claim_opportunity', { p_window: w });
      expect(await tem(136)).toBe(true);
      await q(`update public.idle_state set cashback_ate = now() + interval '1 minute' where user_id = $1`, [A]);
      await t.rpc('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 1 }); // volta 30% de um gerador: longe de F$ 1 tri
      expect(await tem(137)).toBe(false);
      await q(`update public.idle_state set dourados_cont = dourados_cont || '{"cashback": 999999999999}' where user_id = $1`, [A]);
      await t.rpc('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 1 }); // mais que F$ 1 de volta: passa de 1 tri
      expect(await tem(137)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('Insider (shh): vender com 100% de lucro uma ação espiada nas últimas 2 h; sem espiar, ou espiada há mais de 2 h, não', async () => {
    await q('update public.idle_state set generators[19] = 2, generators[11] = 20, info_creditos = 1 where user_id = $1', [A]);
    await q('select public.idle_bolsa_avancar_ate($1)', [T]);
    await q('update public.idle_bolsa_mercado set humor = 3, humor_ate = $1 where empresa in (1, 2)', [T + 50]);
    await q('select public.idle_bolsa_espiar_em($1, 1, $2)', [A, T]);
    await negociar(2, 'comprar', 1); // a 2 não foi espiada
    await q('update public.idle_bolsa_mercado set valor = valor * 3 where empresa = 2');
    await negociar(2, 'vender', 1);
    expect(await tem(139)).toBe(false);
    await negociar(1, 'comprar', 1);
    await q(`update public.idle_state set espiadas = jsonb_set(espiadas, '{1,em}', to_jsonb(now() - interval '3 hours')) where user_id = $1`, [A]);
    await q('update public.idle_bolsa_mercado set valor = valor * 3 where empresa = 1');
    await negociar(1, 'vender', 1);
    expect(await tem(139)).toBe(false);
    await negociar(1, 'comprar', 1);
    // a espiada velha saiu no idle_save da venda (mais de 2 h): espiada de novo, agora
    await q(`update public.idle_state set espiadas = jsonb_build_object('1', jsonb_build_object('ate_tick', $2::bigint, 'em', now())) where user_id = $1`, [A, T + 50]);
    await q('update public.idle_bolsa_mercado set valor = valor * 3 where empresa = 1');
    await negociar(1, 'vender', 1);
    expect(await tem(139)).toBe(true);
  });
});
