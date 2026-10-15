// Dourados novos e oportunidades novas na Caixinha (0076): a sorte do banco é a da página, e a conta, a compra, o pegar,
// a Caixinha e a Bolsa.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo } from '../idle/catalogo';
import { derrubada } from '../idle/convidados';
import { escolhaLinkedin, segundoPix, sorteioDourado, tigrePaga, tipoDourado, tipoGarantido } from '../idle/dourados';
import { produzido, rendasGeradores, VIRAL_MS } from '../idle/economia';
import { OPP_CORTE, tipo } from '../idle/oportunidades';
import { freshDb, type TestDb } from './db';

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
