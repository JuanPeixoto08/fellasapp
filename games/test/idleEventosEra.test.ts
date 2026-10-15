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

describe('pegar um evento de era', () => {
  type J = { valuation: number; rate: number; promo_ate: string | null; boosts: string[]; marmita_ate: string | null;
    upg_desc_ate: string | null; eventos_era: Record<string, number>; evento: { tipo: number; premio: number | null; ganho: number; gols: number } };
  const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
  const evento = (seg: number, tipo: number) =>
    q('insert into public.teste_evento values ($1, $2) on conflict (s) do update set tipo = excluded.tipo', [seg, tipo]);
  const shopee = (seg: number, p: number) =>
    q('insert into public.teste_shopee values ($1, $2) on conflict (s) do update set p = excluded.p', [seg, p]);
  const pegar = (seg: number, gols = 0) => t.rpc<J>('idle_evento_pegar', { p_seg: seg, p_gols: gols });
  const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
  const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;

  beforeEach(async () => {
    await t.db.exec(`
      create table public.teste_evento (s bigint primary key, tipo int);
      create table public.teste_shopee (s bigint primary key, p int);
      create or replace function public.idle_evento_era(u uuid, s bigint, era int) returns int language sql stable as
        'select tipo from public.teste_evento where teste_evento.s = idle_evento_era.s';
      create or replace function public.idle_evento_shopee(u uuid, s bigint) returns int language sql stable as
        'select coalesce((select p from public.teste_shopee where teste_shopee.s = idle_evento_shopee.s), 0)';`);
    await t.member(A);
    await t.member(B, { isMember: false });
    await t.as(A);
    await t.rpc('idle_start');
    await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
    await parar();
  });

  it('mãe: Marmita de 3 min; pegar outra soma 3 min no fim', async () => {
    const seg = await agoraSeg();
    await evento(seg, 1);
    const s = await pegar(seg);
    const agora = Date.parse((await q<{ n: string }>('select now()::text as n'))[0].n);
    expect(Date.parse(s.marmita_ate!) - agora).toBeCloseTo(180_000, -3);
    expect(s.eventos_era).toEqual({ mae: 1 });
    const [linha] = await q<{ m: string | null }>('select marmita_ate::text as m from public.idle_state where user_id = $1', [A]);
    expect(linha.m).not.toBeNull();
    await evento(seg + 1, 1);
    const s2 = await pegar(seg + 1);
    expect(Date.parse(s2.marmita_ate!) - agora).toBeCloseTo(360_000, -3);
  });
  it('Shopee: os três prêmios', async () => {
    const r = (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    const seg = await agoraSeg();
    await evento(seg, 2); await shopee(seg, 0);
    const antes = await valor();
    const s0 = await pegar(seg);
    expect(s0.valuation - antes).toBeCloseTo(r * 3600 * 0.8, 2);
    expect(s0.evento).toMatchObject({ tipo: 2, premio: 0 });
    await evento(seg - 1, 2); await shopee(seg - 1, 1);
    const s1 = await pegar(seg - 1);
    expect(s1.promo_ate).not.toBeNull();
    await evento(seg - 2, 2); await shopee(seg - 2, 2);
    const s2 = await pegar(seg - 2);
    expect(s2.boosts).toHaveLength(1);
    expect(s2.eventos_era).toEqual({ shopee: 3 });
  });
  it('call: 30 min de produção; tela azul: −25% por 2 min', async () => {
    const r = (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    const seg = await agoraSeg();
    await evento(seg, 3);
    const antes = await valor();
    expect((await pegar(seg)).valuation - antes).toBeCloseTo(r * 1800, 2);
    await evento(seg - 1, 4);
    expect((await pegar(seg - 1)).upg_desc_ate).not.toBeNull();
  });
  it('Jogo do Brasil: 5 min por gol, no máximo 7; negativo vira 0', async () => {
    const r = (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    const seg = await agoraSeg();
    await evento(seg - 25, 5);
    const antes = await valor();
    const s = await pegar(seg - 25, 9);
    expect(s.valuation - antes).toBeCloseTo(r * 300 * 7, 2);
    expect(s.evento).toMatchObject({ tipo: 5, gols: 7 });
    await evento(seg - 20, 5);
    const antes2 = await valor();
    expect((await pegar(seg - 20, -3)).valuation - antes2).toBeCloseTo(0, 6);
  });
  it('janela de cada tipo (+3 s), segundo sem evento, longe de agora e duas vezes', async () => {
    const seg = await agoraSeg();
    await evento(seg - 12, 1); // mãe: 8 + 3 = 11 s
    await expect(pegar(seg - 12)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 10, 1);
    await expect(pegar(seg - 10)).resolves.toBeTruthy();
    await expect(pegar(seg - 10)).rejects.toThrow(/idle_evento_pego/);
    await expect(pegar(seg - 5)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg + 30, 3);
    await expect(pegar(seg + 30)).rejects.toThrow(/idle_evento_gone/);
    await expect(pegar(9_000_000_000_000_000)).rejects.toThrow(/idle_evento_gone/);
  });
  it('quem não é membro não pega', async () => {
    await t.as(B);
    await expect(pegar(await agoraSeg())).rejects.toThrow(/not_member/);
  });
  it('vender a startup zera Marmita e Atualização, não os contadores', async () => {
    const seg = await agoraSeg();
    await evento(seg, 1);
    await pegar(seg);
    await q(`update public.idle_state set upg_desc_ate = now() + interval '1 minute', prestige_earned = 0 where user_id = $1`, [A]);
    await q('update public.idle_state set valuation = 1e30, generators[30] = 150 where user_id = $1', [A]);
    await t.rpc('idle_prestige');
    const [l] = await q<{ m: string | null; d: string | null; e: Record<string, number> }>(
      'select marmita_ate::text as m, upg_desc_ate::text as d, eventos_era as e from public.idle_state where user_id = $1', [A]);
    expect(l).toEqual({ m: null, d: null, e: { mae: 1 } });
  });
});

describe('conquistas das eras 1–5', () => {
  beforeEach(async () => {
    t = await freshDb(); // com o catálogo das conquistas
    await t.db.exec(`
      create table public.teste_evento (s bigint primary key, tipo int);
      create or replace function public.idle_evento_era(u uuid, s bigint, era int) returns int language sql stable as
        'select tipo from public.teste_evento where teste_evento.s = idle_evento_era.s';`);
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q('update public.idle_state set valuation = 1e40 where user_id = $1', [A]);
  });
  const tem = async (id: number) =>
    (await q('select 1 from public.idle_conquistas where user_id = $1 and conquista_id = $2', [A, id])).length > 0;

  it('mãe 10 vezes = "Já vou, mãe!"; 7 gols = "7 a 1 (pra nós)"', async () => {
    const seg = Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
    await q(`update public.idle_state set eventos_era = '{"mae": 9}' where user_id = $1`, [A]);
    await q('insert into public.teste_evento values ($1, 1), ($2, 5)', [seg, seg - 1]);
    await t.rpc('idle_evento_pegar', { p_seg: seg, p_gols: 0 });
    expect(await tem(116)).toBe(true);
    await t.rpc('idle_evento_pegar', { p_seg: seg - 1, p_gols: 6 });
    expect(await tem(120)).toBe(false);
    await q('insert into public.teste_evento values ($1, 5)', [seg - 2]);
    await t.rpc('idle_evento_pegar', { p_seg: seg - 2, p_gols: 7 });
    expect(await tem(120)).toBe(true);
  });
  it('300 de cada gerador da era 1 e todas as melhorias da era 1', async () => {
    await q('update public.idle_state set generators[1:6] = array[300,300,300,300,300,299] where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(121)).toBe(false);
    await q('update public.idle_state set generators[6] = 300 where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(121)).toBe(true);
    const todas = (await q<{ id: number }>(
      `select u.id from public.idle_cat_upg u left join public.idle_cat_gen g on g.id = u.gerador
        where (u.tipo = 'gerador' and g.era = 1) or (u.tipo = 'geral' and u.requer_era = 1)`)).map((x) => x.id);
    expect(todas).toHaveLength(52);
    await q('update public.idle_state set upgrades = $2 where user_id = $1', [A, todas.slice(1)]);
    await t.rpc('idle_open');
    expect(await tem(126)).toBe(false);
    await q('update public.idle_state set upgrades = $2 where user_id = $1', [A, todas]);
    await t.rpc('idle_open');
    expect(await tem(126)).toBe(true);
  });
});
