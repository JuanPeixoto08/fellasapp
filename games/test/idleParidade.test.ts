import { beforeAll, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { acumular, acumularTrechos, custoMult, maxCompra, preco, taxa, type Estado } from '../idle/economia';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const D = '00000000-0000-0000-0000-00000000000d';
// estratégias dos outros: C escolheu Cultura de startup (paga o triplo a quem contrata)
const OUTROS: [string, number[]][] = [[B, [0, 0, -1, -1]], [C, [0, 0, 2, -1]], [D, [2, -1, -1, -1]]];
const contrato = (de: string, para: string, criado = 'now()', vence = `now() + interval '7 days'`) =>
  q(`insert into public.idle_contracts (employer_id, employee_id, cargo, created_at, ends_at) values ($1, $2, 'x', ${criado}, ${vence})`, [de, para]);
/** Recomeça com A no estado s e os outros três com empresa aberta, sem contrato nenhum. */
async function preparar(s: Estado, extras = '', valores: unknown[] = []) {
  await q('delete from public.idle_contracts where true');
  await q('delete from public.idle_state where true');
  await q(
    `insert into public.idle_state (user_id, week_start, started, generators, upgrades, strategies${extras ? `, ${extras}` : ''})
     values ($1, public.games_week_start(), true, $2, $3, $4${valores.map((_, i) => `, $${i + 5}`).join('')})`,
    [A, s.generators, s.upgrades, s.strategies, ...valores],
  );
  for (const [u, est] of OUTROS) {
    await q(`insert into public.idle_state (user_id, week_start, started, strategies) values ($1, public.games_week_start(), true, $2)`, [u, est]);
  }
}
let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

// gerador pseudoaleatório fixo: os mesmos estados toda vez
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
function estados(n: number): Estado[] {
  const r = rng(42);
  const out: Estado[] = [];
  for (let i = 0; i < n; i++) {
    const generators = Array.from({ length: 30 }, (_, g) => (r() < 0.7 - g * 0.02 ? Math.floor(r() * 120) : 0));
    const upgrades = catalogo.melhorias.filter(() => r() < 0.3).map((m) => m.id);
    const strategies = [0, 1, 2, 3].map((k) => {
      const ops = catalogo.estrategias.filter((e) => e.era === k + 2 && e.ativa).map((e) => e.opcao);
      return r() < 0.7 ? ops[Math.floor(r() * ops.length)] : -1;
    });
    out.push({ generators, upgrades, strategies });
  }
  return out;
}
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));

beforeAll(async () => {
  t = await freshDb();
  await t.member(A);
  for (const u of [B, C, D]) await t.member(u);
});

describe('paridade', () => {
  it('taxa e multiplicador de custo', async () => {
    for (const s of estados(40)) {
      await q('delete from public.idle_state where true');
      await q(
        `insert into public.idle_state (user_id, week_start, started, generators, upgrades, strategies)
         values ($1, public.games_week_start(), true, $2, $3, $4)`,
        [A, s.generators, s.upgrades, s.strategies],
      );
      const [db] = await q<{ r: number; cm: number }>(
        'select public.idle_rate(s) as r, public.idle_cost_mult(s) as cm from public.idle_state s where user_id = $1',
        [A],
      );
      expect(rel(db.r, taxa(catalogo, s))).toBeLessThan(1e-9);
      expect(rel(db.cm, custoMult(catalogo, s))).toBeLessThan(1e-12);
    }
  });
  it('preço e máx', async () => {
    const r = rng(7);
    for (let i = 0; i < 200; i++) {
      const g = catalogo.geradores[Math.floor(r() * 30)];
      const n = Math.floor(r() * 300);
      const cm = [1, 1.25][Math.floor(r() * 2)];
      const v = preco(g.custo, n, 1 + Math.floor(r() * 40), cm) * (0.5 + r());
      const [db] = await q<{ p: number; k: number }>(
        'select public.idle_price($1, $2, 10, $3) as p, public.idle_max_qty($1, $2, $4, $3) as k',
        [g.custo, n, cm, v],
      );
      expect(rel(db.p, preco(g.custo, n, 10, cm))).toBeLessThan(1e-12);
      expect(db.k).toBe(maxCompra(g.custo, n, v, cm));
    }
  });
  it('fechar a conta (com teto e bônus)', async () => {
    const s = estados(1)[0];
    await q('delete from public.idle_state where true');
    await q(
      `insert into public.idle_state (user_id, week_start, started, valuation, generators, upgrades, strategies, settled_at, boost_until)
       values ($1, public.games_week_start(), true, 1000, $2, $3, $4, '2026-10-12 10:00:00+00', '2026-10-12 10:00:40+00')`,
      [A, s.generators, s.upgrades, s.strategies],
    );
    for (const ate of ['2026-10-12 10:01:00+00', '2026-10-12 23:00:00+00']) {
      const [db] = await q<{ v: number }>(
        `select (public.idle_settle(s, $2::timestamptz)).valuation as v from public.idle_state s where user_id = $1`,
        [A, ate],
      );
      const ts = acumular(1000, taxa(catalogo, s), Date.parse('2026-10-12T10:00:00Z'), Date.parse(ate.replace(' ', 'T').replace('+00', 'Z')), Date.parse('2026-10-12T10:00:40Z'));
      expect(rel(db.v, ts)).toBeLessThan(1e-9);
    }
  });
  it('taxa com contratos: piso, +10%/+15% por contratado, Networking e chefe com Cultura de startup', async () => {
    const r = rng(99);
    for (const s of estados(30)) {
      await preparar(s);
      const contratei = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      const chefes = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      for (const u of contratei) await contrato(A, u);
      for (const u of chefes) await contrato(u, A);
      const social = { contratei: contratei.length, empregos: chefes.map((u) => (u === C ? 3 : 1)) };
      const [db] = await q<{ r: number; soc: { contratei: number; empregos: number[] } }>(
        `select public.idle_rate(s) as r, public.idle_json(s) -> 'social' as soc from public.idle_state s where user_id = $1`,
        [A],
      );
      expect(rel(db.r, taxa(catalogo, { ...s, social }))).toBeLessThan(1e-9);
      expect(db.soc.contratei).toBe(social.contratei);
      // o banco multiplica por exp(soma de ln): o 3 da Cultura volta como 3.0000000000000004
      const emp = [...db.soc.empregos].sort();
      const esperado = [...social.empregos].sort();
      expect(emp).toHaveLength(esperado.length);
      emp.forEach((m, i) => expect(m).toBeCloseTo(esperado[i], 12));
    }
  });
  it('fechar a conta atravessando vencimentos (com bônus e teto de 8h)', async () => {
    const T0 = Date.parse('2026-10-12T10:00:00Z');
    const iso = (ms: number) => `'${new Date(ms).toISOString()}'::timestamptz`;
    const s = estados(3)[2];
    await preparar(s, 'valuation, settled_at, boost_until', [1000, new Date(T0).toISOString(), new Date(T0 + 200_000).toISOString()]);
    const criado = iso(T0 - 86400_000);
    await contrato(A, B, criado, iso(T0 + 100_000)); // A contratou B: vence 100 s depois
    await contrato(C, A, criado, iso(T0 + 300_000)); // C (Cultura) contratou A: vence 300 s depois
    await contrato(D, A, criado, iso(T0 + 9 * 3600_000)); // D contratou A: vence depois do teto
    const r = (social: { contratei: number; empregos: number[] }) => taxa(catalogo, { ...s, social });
    const trechos = [
      { desdeMs: T0, r: r({ contratei: 1, empregos: [3, 1] }) },
      { desdeMs: T0 + 100_000, r: r({ contratei: 0, empregos: [3, 1] }) },
      { desdeMs: T0 + 300_000, r: r({ contratei: 0, empregos: [1] }) },
      { desdeMs: T0 + 9 * 3600_000, r: r({ contratei: 0, empregos: [] }) },
    ];
    for (const ate of [T0 + 50_000, T0 + 1000_000, T0 + 10 * 3600_000]) {
      const [db] = await q<{ v: number }>(
        `select (public.idle_settle(s, $2::timestamptz)).valuation as v from public.idle_state s where user_id = $1`,
        [A, new Date(ate).toISOString()],
      );
      expect(rel(db.v, acumularTrechos(1000, trechos, T0, ate, T0 + 200_000))).toBeLessThan(1e-9);
    }
    await q('delete from public.idle_contracts where true');
  });
});
