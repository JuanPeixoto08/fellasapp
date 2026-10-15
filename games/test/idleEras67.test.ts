// Eras 6 e 7 (0078): a conta do banco é a da página (legado, estratégias 6–7), o estado com 42 geradores e 6
// estratégias, a escolha e a compra sem nulo, a venda; o Silver tape, os eventos 6–7 e as conquistas (partes B e C).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { custoMult, produzido, taxa, VIRAL_MS, type Estado } from '../idle/economia';
import { eventoEraEm } from '../idle/eventosEra';
import { freshDb, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '098d04dc-bba1-433a-9ef8-0e9dd863e4ed';
let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const M0078 = readFileSync(resolve(__dirname, '../../supabase/migrations/0078_fellas_inc_eras_6_7.sql'), 'utf8');
type J = { valuation: number; rate: number; generators: number[]; strategies: number[]; upgrades: number[]; era: number; silver_ate?: string | null };

// gerador pseudoaleatório fixo: os mesmos estados toda vez
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
/** Estados com 42 geradores (às vezes os das eras 6–7), melhorias ao acaso (com legado) e as 6 estratégias. */
function estados(n: number): Estado[] {
  const r = rng(67);
  const out: Estado[] = [];
  for (let i = 0; i < n; i++) {
    const generators = Array.from({ length: 42 }, (_, g) => (r() < 0.75 - g * 0.012 ? Math.floor(r() * 150) : 0));
    const upgrades = catalogo.melhorias.filter((m) => r() < (m.tipo === 'legado' ? 0.6 : 0.25)).map((m) => m.id);
    const strategies = [0, 1, 2, 3, 4, 5].map((k) => {
      const ops = catalogo.estrategias.filter((e) => e.era === k + 2 && e.ativa).map((e) => e.opcao);
      return r() < 0.8 ? ops[Math.floor(r() * ops.length)] : -1;
    });
    out.push({ generators, upgrades, strategies });
  }
  return out;
}
async function colocar(s: Estado) {
  await q('delete from public.idle_state where true');
  await q(`insert into public.idle_state (user_id, week_start, started, generators, upgrades, strategies)
           values ($1, public.games_week_start(), true, $2, $3, $4)`, [A, s.generators, s.upgrades, s.strategies]);
}

describe('paridade (0078 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
  });
  it('taxa com o legado e as estratégias das eras 6 e 7 é a de economia.ts', async () => {
    for (const s of estados(30)) {
      await colocar(s);
      const [{ r }] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]);
      const esperado = taxa(catalogo, s);
      expect(Math.abs(r - esperado) / Math.max(1, esperado)).toBeLessThan(1e-9);
    }
  });
  it('o multiplicador de custo com o Hotel na Lua (0,75) é o de economia.ts', async () => {
    for (const strategies of [[0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 1, 1], [0, 0, 0, 0, 0, 0]]) {
      const s: Estado = { generators: Array(42).fill(1), upgrades: [], strategies };
      await colocar(s);
      const [{ m }] = await q<{ m: number }>('select public.idle_cost_mult(s) as m from public.idle_state s where user_id = $1', [A]);
      expect(m).toBeCloseTo(custoMult(catalogo, s), 12);
    }
  });
});

describe('estado, escolha e compra (0078 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.member(B, { isMember: false });
    await t.as(A);
    await t.rpc('idle_start');
    // era 5 (1 de cada gerador até o 30) com as estratégias das eras 2–5 escolhidas
    await q(`update public.idle_state set valuation = 1e40, generators[1:30] = array_fill(1, array[30]), strategies = '{0,0,0,0,-1,-1}'
              where user_id = $1`, [A]);
  });
  const comprar = (kind: string, id: number, qty = 1) => t.rpc<J>('idle_buy', { p_kind: kind, p_id: id, p_qty: qty });

  it('o estado novo nasce com 42 geradores e 6 estratégias', async () => {
    await q('delete from public.idle_state where user_id = $1', [A]);
    const s = await t.rpc<J>('idle_open');
    expect(s.generators).toEqual(Array(42).fill(0));
    expect(s.strategies).toEqual([-1, -1, -1, -1, -1, -1]);
  });
  it('a 0078 completa quem tinha 4 estratégias e 30 geradores (e rodar de novo não muda nada)', async () => {
    await q(`update public.idle_state set strategies = '{0,1,0,1}', generators = array_fill(2, array[30]) where user_id = $1`, [A]);
    await t.db.exec(M0078);
    const [l] = await q<{ s: number[]; g: number[] }>('select strategies as s, generators as g from public.idle_state where user_id = $1', [A]);
    expect(l.s).toEqual([0, 1, 0, 1, -1, -1]);
    expect(l.g).toEqual([...Array(30).fill(2), ...Array(12).fill(0)]);
    await t.db.exec(M0078);
    const [l2] = await q<{ s: number[] }>('select strategies as s from public.idle_state where user_id = $1', [A]);
    expect(l2.s).toEqual([0, 1, 0, 1, -1, -1]);
  });
  it('entrar na era 6 pede a estratégia antes da próxima compra; as eras 6 e 7 aceitam a escolha', async () => {
    const s = await comprar('gerador', 31);
    expect(s.era).toBe(6);
    await expect(comprar('gerador', 1)).rejects.toThrow(/idle_strategy_pending/);
    const e6 = await t.rpc<J>('idle_pick_strategy', { p_era: 6, p_opcao: 1 });
    expect(e6.strategies).toEqual([0, 0, 0, 0, 1, -1]);
    await expect(t.rpc('idle_pick_strategy', { p_era: 6, p_opcao: 0 })).rejects.toThrow(/idle_strategy_set/);
    await expect(t.rpc('idle_pick_strategy', { p_era: 7, p_opcao: 0 })).rejects.toThrow(/idle_locked/);
    await q('update public.idle_state set generators[31:36] = array[1,1,1,1,1,1] where user_id = $1', [A]);
    await comprar('gerador', 37);
    const e7 = await t.rpc<J>('idle_pick_strategy', { p_era: 7, p_opcao: 1 });
    expect(e7.strategies).toEqual([0, 0, 0, 0, 1, 1]);
  });
  it('lista curta (4 estratégias, sem a migração rodar de novo): a era 6 ainda pede a escolha, e a escolha completa a lista', async () => {
    await q(`update public.idle_state set strategies = '{0,0,0,0}', generators[31] = 1 where user_id = $1`, [A]);
    await expect(comprar('gerador', 1)).rejects.toThrow(/idle_strategy_pending/);
    const s = await t.rpc<J>('idle_pick_strategy', { p_era: 6, p_opcao: 0 });
    expect(s.strategies).toEqual([0, 0, 0, 0, 0, -1]);
  });
  it('comprar o gerador 31 com a lista de geradores curta (30) não grava nulo', async () => {
    // a era 6 já escolhida (senão a compra do 33 pararia na estratégia antes de olhar o 32)
    await q(`update public.idle_state set strategies = '{0,0,0,0,0,-1}', generators = array_fill(1, array[30]) where user_id = $1`, [A]);
    const s = await comprar('gerador', 31, 10);
    expect(s.generators[30]).toBe(10);
    await expect(comprar('gerador', 33)).rejects.toThrow(/idle_locked/); // o 32 não tem
  });
  it('legado: trancado antes da era alvo; liberado nela; a melhoria do gerador 31 pede o gerador', async () => {
    await expect(comprar('melhoria', 3001)).rejects.toThrow(/idle_locked/);
    await expect(comprar('melhoria', 311)).rejects.toThrow(/idle_locked/);
    await q(`update public.idle_state set strategies = '{0,0,0,0,0,-1}', generators[31] = 1 where user_id = $1`, [A]);
    expect((await comprar('melhoria', 3001)).upgrades.map(Number)).toContain(3001);
    expect((await comprar('melhoria', 311)).upgrades.map(Number)).toContain(311);
    await expect(comprar('melhoria', 3006)).rejects.toThrow(/idle_locked/); // o legado da era 7
  });
  it('vender a startup recomeça com 42 geradores e 6 estratégias, e zera o Silver tape', async () => {
    await q(`update public.idle_state set strategies = '{0,0,0,0,0,0}', generators[30] = 150, generators[42] = 3, prestige_earned = 0,
               silver_ate = now() + interval '1 minute' where user_id = $1`, [A]);
    const s = await t.rpc<J>('idle_prestige');
    expect(s.generators).toEqual(Array(42).fill(0));
    expect(s.strategies).toEqual([-1, -1, -1, -1, -1, -1]);
    expect(s.silver_ate ?? null).toBeNull();
    const [l] = await q<{ x: string | null }>('select silver_ate::text as x from public.idle_state where user_id = $1', [A]);
    expect(l.x).toBeNull();
  });
  it('o JSON traz o Silver tape valendo e esconde o que já passou', async () => {
    await q(`update public.idle_state set silver_ate = now() + interval '90 seconds' where user_id = $1`, [A]);
    expect((await t.rpc<J>('idle_open')).silver_ate).not.toBeNull();
    await q(`update public.idle_state set silver_ate = now() - interval '1 second' where user_id = $1`, [A]);
    expect((await t.rpc<J>('idle_open')).silver_ate).toBeNull();
  });
});

const taxaA = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const tem = async (id: number) => (await q('select 1 from public.idle_conquistas where user_id = $1 and conquista_id = $2', [A, id])).length > 0;

describe('a sorte das eras 6 e 7 (paridade com eventosEra.ts)', () => {
  beforeEach(async () => { t = await freshDb({ conquistas: false }); });
  it('os mesmos segundos e tipos em 200 mil segundos, eras 6 e 7', async () => {
    const ini = 1_760_000_000;
    for (const era of [6, 7]) {
      const sql = await q<{ s: string; e: number }>(
        `select s::text, e from (select s, public.idle_evento_era($1::uuid, s, $4) as e from generate_series($2::bigint, $3::bigint) s) x
          where e is not null order by s`, [A, ini, ini + 200_000 - 1, era]);
      const ts: { s: string; e: number }[] = [];
      for (let s = ini; s < ini + 200_000; s++) {
        const e = eventoEraEm(A, s, era);
        if (e !== null) ts.push({ s: String(s), e });
      }
      expect(ts.length).toBeGreaterThan(60);
      expect(sql).toEqual(ts);
    }
  });
});

describe('Silver tape na conta (0078 parte B)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
  });
  it('fechar a conta com o Silver tape é igual a produzido, sozinho e junto de ×5, Viralizou, Marmita, LinkedIn e Combo', async () => {
    const casos = [
      { boost: null, viral: null, marmita: null, linkedin: null, combo: null },
      { boost: 20, viral: 60, marmita: 30, linkedin: 50, combo: 70 },
    ];
    for (const c of casos) {
      await q(`update public.idle_state set settled_at = now(), silver_ate = now() + interval '40 seconds',
                 boost_ate = case when $2::int is null then '{}' else array[now() + make_interval(secs => $2)] end,
                 viral_ate = case when $3::int is null then '{}' else array[now() + make_interval(secs => $3)] end,
                 marmita_ate = case when $4::int is null then null else now() + make_interval(secs => $4) end,
                 linkedin_ate = case when $5::int is null then null else now() + make_interval(secs => $5) end, linkedin_mult = 2.5,
                 combo_ate = case when $6::int is null then null else now() + make_interval(secs => $6) end
               where user_id = $1`, [A, c.boost, c.viral, c.marmita, c.linkedin, c.combo]);
      const r = await taxaA();
      const [{ v0, v1 }] = await q<{ v0: number; v1: number }>(
        `select s.valuation as v0, (public.idle_settle(s, s.settled_at + interval '100 seconds')).valuation as v1
           from public.idle_state s where user_id = $1`, [A]);
      const outros = [
        ...(c.linkedin === null ? [] : [{ ateMs: c.linkedin * 1000, mult: 2.5 }]),
        ...(c.combo === null ? [] : [{ ateMs: c.combo * 1000, mult: 7 }]),
        { ateMs: 40_000, mult: 4 },
      ];
      const esperado = produzido(r, 0, 100_000, c.boost === null ? null : [c.boost * 1000], c.viral === null ? [] : [c.viral * 1000],
        VIRAL_MS, c.marmita === null ? null : c.marmita * 1000, outros);
      expect(v1 - v0).toBeCloseTo(esperado, 0);
    }
  });
});

describe('pegar os eventos das eras 6 e 7 (0078 parte C)', () => {
  type JE = J & { eventos_era: Record<string, number>; evento: { tipo: number; ganho: number; gols: number } };
  const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
  /** O tipo do segundo `seg`; com `era`, só pra essa era (a anterior pode sortear outro tipo no mesmo segundo). */
  const evento = (seg: number, tipo: number, era: number | null = null) => q('insert into public.teste_evento67 values ($1, $2, $3)', [seg, era, tipo]);
  const pegar = (seg: number, gols = 0, tipo: number | null = null) => t.rpc<JE>('idle_evento_pegar', { p_seg: seg, p_gols: gols, p_tipo: tipo });
  const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;

  beforeEach(async () => {
    t = await freshDb(); // com o catálogo das conquistas (156, 157)
    await t.db.exec(`
      create table public.teste_evento67 (s bigint, era int, tipo int);
      create or replace function public.idle_evento_era(u uuid, s bigint, era int) returns int language sql stable as
        'select x.tipo from public.teste_evento67 x where x.s = idle_evento_era.s and (x.era is null or x.era = idle_evento_era.era)
          order by x.era nulls last limit 1';`);
    await t.member(A);
    await t.member(B, { isMember: false });
    await t.as(A);
    await t.rpc('idle_start');
    // era 7 (1 de cada gerador), estratégias escolhidas, e a conta parada (o settle não mexe no valuation)
    await q(`update public.idle_state set valuation = 1e12, generators[1:42] = array_fill(1, array[42]), strategies = '{0,0,0,0,0,0}',
               settled_at = now() + interval '1 day' where user_id = $1`, [A]);
  });

  it('Lixo: 10 min de produção por destroço; 4 vira 3, negativo vira 0; 2 desvios não dão a conquista, 3 dão', async () => {
    const seg = await agoraSeg();
    await evento(seg, 6);
    let r = await taxaA();
    let antes = await valor();
    const s2 = await pegar(seg, 2);
    expect(s2.valuation - antes).toBeCloseTo(r * 600 * 2, 2);
    expect(await tem(156)).toBe(false);
    await evento(seg - 1, 6);
    r = await taxaA();
    antes = await valor();
    const s = await pegar(seg - 1, 4);
    expect(s.valuation - antes).toBeCloseTo(r * 600 * 3, 2);
    expect(s.evento).toMatchObject({ tipo: 6, gols: 3 });
    expect(s.eventos_era).toMatchObject({ lixo: 2 });
    expect(await tem(156)).toBe(true);
    await evento(seg - 2, 6);
    antes = await valor();
    expect((await pegar(seg - 2, -5)).valuation - antes).toBeCloseTo(0, 6);
  });
  it('Houston: Silver tape ×4 por 2 min; outro com um valendo soma 2 min; o 10º dá "Silver tape resolve"', async () => {
    const seg = await agoraSeg();
    await q(`update public.idle_state set eventos_era = '{"houston": 8}' where user_id = $1`, [A]);
    await evento(seg, 7);
    const s = await pegar(seg);
    const agora = Date.parse((await q<{ n: string }>('select now()::text as n'))[0].n);
    expect(Date.parse(s.silver_ate!) - agora).toBeCloseTo(120_000, -3);
    expect(s.evento).toMatchObject({ tipo: 7, ganho: 0 });
    expect(await tem(157)).toBe(false);
    await evento(seg - 1, 7);
    const s2 = await pegar(seg - 1);
    expect(Date.parse(s2.silver_ate!) - agora).toBeCloseTo(240_000, -3);
    expect(s2.eventos_era).toMatchObject({ houston: 10 });
    expect(await tem(157)).toBe(true);
  });
  it('janelas: Lixo até 10 + 3 s, Houston até 8 + 3 s', async () => {
    const seg = await agoraSeg();
    await evento(seg - 14, 6);
    await expect(pegar(seg - 14, 1)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 11, 6); // 11 s (+ o que passou do segundo) < 13 s
    await expect(pegar(seg - 11, 1)).resolves.toBeTruthy();
    await evento(seg - 13, 7);
    await expect(pegar(seg - 13)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 9, 7);
    await expect(pegar(seg - 9)).resolves.toBeTruthy();
  });
  it('a era mudou entre aparecer e clicar: vale o tipo da era anterior que a página mostrou; outro tipo é gone; sem p_tipo, o de agora', async () => {
    const seg = await agoraSeg();
    await evento(seg, 5, 6); // com a era 6 o segundo sorteia o Jogo do Brasil…
    await evento(seg, 7, 7); // …e com a 7 (a de agora) o Houston
    const r = await taxaA();
    const antes = await valor();
    const s = await pegar(seg, 2, 5);
    expect(s.evento).toMatchObject({ tipo: 5, gols: 2 });
    expect(s.valuation - antes).toBeCloseTo(r * 300 * 2, 2);
    await evento(seg - 1, 3, 6);
    await evento(seg - 1, 7, 7);
    await expect(pegar(seg - 1, 0, 1)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 2, 5, 6);
    await evento(seg - 2, 7, 7);
    expect((await pegar(seg - 2)).evento).toMatchObject({ tipo: 7 });
  });
  it('quem não é membro não pega', async () => {
    await t.as(B);
    await expect(pegar(await agoraSeg())).rejects.toThrow(/not_member/);
  });
});

describe('conquistas das eras 6 e 7 (0078 parte C)', () => {
  beforeEach(async () => {
    t = await freshDb();
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q(`update public.idle_state set valuation = 1e40, strategies = '{0,0,0,0,0,0}', generators[1:30] = array_fill(1, array[30])
              where user_id = $1`, [A]);
  });
  it('a 100ª unidade do gerador 31 dá a 140 (não a 31)', async () => {
    await q('update public.idle_state set generators[31] = 100 where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(140)).toBe(true);
  });
  it('o monolito (158) aparece com 1 de cada gerador da era 7; faltando um, não', async () => {
    await q('update public.idle_state set generators[31:42] = array[1,1,1,1,1,1,1,1,1,1,1,0] where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(158)).toBe(false);
    await q('update public.idle_state set generators[42] = 1 where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(158)).toBe(true);
  });
  it('300 de cada gerador da era 6 (152); todas as 57 melhorias da era 6 (154: 48 de gerador, 4 gerais, 5 de legado)', async () => {
    await q('update public.idle_state set generators[31:36] = array[300,300,300,300,300,299] where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(152)).toBe(false);
    await q('update public.idle_state set generators[36] = 300 where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(152)).toBe(true);
    const todas = (await q<{ id: number }>(
      `select u.id from public.idle_cat_upg u left join public.idle_cat_gen g on g.id = u.gerador
        where (u.tipo = 'gerador' and g.era = 6) or (u.tipo in ('geral', 'legado') and u.requer_era = 6)`)).map((x) => x.id);
    expect(todas).toHaveLength(57);
    await q('update public.idle_state set upgrades = $2 where user_id = $1', [A, todas.filter((id) => id !== 3005)]);
    await t.rpc('idle_open');
    expect(await tem(154)).toBe(false);
    await q('update public.idle_state set upgrades = $2 where user_id = $1', [A, todas]);
    await t.rpc('idle_open');
    expect(await tem(154)).toBe(true);
  });
  it('Daisy, Daisy (159): comprar a última melhoria do HAL', async () => {
    await q('update public.idle_state set generators[31:34] = array[1,1,1,300] where user_id = $1', [A]);
    await t.rpc('idle_buy', { p_kind: 'melhoria', p_id: 348, p_qty: 1 });
    expect(await tem(159)).toBe(true);
  });
});
