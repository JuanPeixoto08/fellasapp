import { beforeAll, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { acumular, custoMult, maxCompra, preco, taxa, type Estado } from '../idle/economia';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
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
});
