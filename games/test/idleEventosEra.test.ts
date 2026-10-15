// Eventos de era (0074): a sorte do banco é a da página, e as regras e efeitos do pegar.
import { beforeEach, describe, expect, it } from 'vitest';

import { produzido, VIRAL_MS } from '../idle/economia';
import { eventoEraEm, premioShopee } from '../idle/eventosEra';
import { freshDb, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '098d04dc-bba1-433a-9ef8-0e9dd863e4ed';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb({ conquistas: false });
});

describe('a sorte (paridade com eventosEra.ts)', () => {
  it('os mesmos segundos e tipos em 200 mil segundos, eras 1, 3 e 5, dois jogadores', async () => {
    const ini = 1_760_000_000;
    for (const u of [A, B]) for (const era of [1, 3, 5]) {
      const sql = await q<{ s: string; e: number }>(
        `select s::text, e from (select s, public.idle_evento_era($1::uuid, s, $4) as e from generate_series($2::bigint, $3::bigint) s) x
          where e is not null order by s`, [u, ini, ini + 200_000 - 1, era]);
      const ts: { s: string; e: number }[] = [];
      for (let s = ini; s < ini + 200_000; s++) {
        const e = eventoEraEm(u, s, era);
        if (e !== null) ts.push({ s: String(s), e });
      }
      expect(ts.length).toBeGreaterThan(60);
      expect(sql).toEqual(ts);
    }
  });
  it('o prêmio da Shopee é o mesmo', async () => {
    const ini = 1_760_000_000;
    const sql = await q<{ p: number }>(
      'select public.idle_evento_shopee($1::uuid, s) as p from generate_series($2::bigint, $3::bigint) s order by s', [A, ini, ini + 2999]);
    expect(sql.map((x) => x.p)).toEqual(Array.from({ length: 3000 }, (_, i) => premioShopee(A, ini + i)));
  });
});

const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;

describe('Marmita e Atualização no banco', () => {
  beforeEach(async () => {
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
  });

  it('fechar a conta com a Marmita é igual a produzido (sozinha, com ×5 e com Viralizou)', async () => {
    for (const [boost, viral] of [[null, null], [20, null], [null, 60]] as const) {
      await q(`update public.idle_state set settled_at = now(), marmita_ate = now() + interval '40 seconds',
                 boost_ate = case when $2::int is null then '{}' else array[now() + make_interval(secs => $2)] end,
                 viral_ate = case when $3::int is null then '{}' else array[now() + make_interval(secs => $3)] end
               where user_id = $1`, [A, boost, viral]);
      const r = await taxa();
      const [{ v0, v1 }] = await q<{ v0: number; v1: number }>(
        `select s.valuation as v0, (public.idle_settle(s, s.settled_at + interval '100 seconds')).valuation as v1
           from public.idle_state s where user_id = $1`, [A]);
      const esperado = produzido(r, 0, 100_000, boost === null ? null : [boost * 1000], viral === null ? [] : [viral * 1000], VIRAL_MS, 40_000);
      expect(v1 - v0).toBeCloseTo(esperado, 0);
    }
  });

  it('Atualização: a melhoria custa 75%; com Promoção, 37,5%; acabou há 0,5 s ainda vale', async () => {
    const preco = async () => (await q<{ p: number }>('select preco as p from public.idle_cat_upg where id = 11'))[0].p;
    const comprar = async () => {
      const antes = (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
      await q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
      const s = await t.rpc<{ valuation: number }>('idle_buy', { p_kind: 'melhoria', p_id: 11, p_qty: 1 });
      await q('update public.idle_state set upgrades = array_remove(upgrades, 11) where user_id = $1', [A]);
      return antes - s.valuation;
    };
    const cheio = await preco();
    await q(`update public.idle_state set upg_desc_ate = now() + interval '60 seconds' where user_id = $1`, [A]);
    expect(await comprar()).toBeCloseTo(cheio * 0.75, 3);
    await q(`update public.idle_state set promo_ate = now() + interval '30 seconds' where user_id = $1`, [A]);
    expect(await comprar()).toBeCloseTo(cheio * 0.375, 3);
    await q(`update public.idle_state set promo_ate = null, upg_desc_ate = now() - interval '500 milliseconds' where user_id = $1`, [A]);
    expect(await comprar()).toBeCloseTo(cheio * 0.75, 3);
  });

  it('o JSON traz os campos novos e esconde os que já passaram', async () => {
    await q(`update public.idle_state set marmita_ate = now() + interval '1 minute', upg_desc_ate = now() - interval '1 minute',
               eventos_era = '{"mae": 2}' where user_id = $1`, [A]);
    const s = await t.rpc<{ marmita_ate: string | null; upg_desc_ate: string | null; eventos_era: Record<string, number> }>('idle_open');
    expect(s.marmita_ate).not.toBeNull();
    expect(s.upg_desc_ate).toBeNull();
    expect(s.eventos_era).toEqual({ mae: 2 });
  });
});
