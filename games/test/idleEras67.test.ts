// Eras 6 e 7 (0078): a conta do banco é a da página (legado, estratégias 6–7), o estado com 42 geradores e 6
// estratégias, a escolha e a compra sem nulo, a venda; o Silver tape, os eventos 6–7 e as conquistas (partes B e C).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { custoMult, taxa, type Estado } from '../idle/economia';
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
