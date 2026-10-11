import { beforeAll, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import {
  acumular, acumularTrechos, custoMult, efeitosArvore, estrategiasAtivas, maxCompra, pontosTotais, precoContrato, preco, taxa, type Estado,
} from '../idle/economia';
import { CAIXA_PADRAO, LIMITE_DIA, pendentes } from '../idle/oportunidades';
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

/** A fica com exatamente n conquistas (ids 1..n; a conta só olha quantas). */
async function conquistas(n: number) {
  await q('delete from public.idle_conquistas where true');
  if (n) await q('insert into public.idle_conquistas (user_id, conquista_id) select $1, g from generate_series(1, $2) g', [A, n]);
}
/** A fica com exatamente esses nós da árvore (a conta não confere a ordem dos ramos: isso é do idle_buy_node). */
async function arvore(nos: number[]) {
  await q('delete from public.idle_arvore where true');
  for (const n of nos) await q('insert into public.idle_arvore (user_id, no_id) values ($1, $2)', [A, n]);
}
/** Um pedaço sorteado da árvore. */
const nosAoAcaso = (r: () => number) => catalogo.arvore.filter(() => r() < 0.4).map((n) => n.id);

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
  it('o que a árvore faz é igual no banco e em economia.ts (cada nó sozinho e pedaços sorteados)', async () => {
    const r = rng(3);
    const casos = [[], ...catalogo.arvore.map((n) => [n.id]), ...Array.from({ length: 30 }, () => nosAoAcaso(r))];
    for (const nos of casos) {
      await arvore(nos);
      const [{ e }] = await q<{ e: Record<string, number | boolean> }>('select public.idle_arvore_efeitos($1) as e', [A]);
      const ts = efeitosArvore(catalogo, nos);
      expect(Object.keys(e).sort(), String(nos)).toEqual(Object.keys(ts).sort());
      for (const [k, v] of Object.entries(ts)) {
        if (typeof v === 'boolean') expect(e[k], `${nos} ${k}`).toBe(v);
        else expect(rel(e[k] as number, v), `${nos} ${k}`).toBeLessThan(1e-12);
      }
    }
    await arvore([]);
  });
  it('taxa com a árvore, as conquistas e os contratos (Aniversariante do mês e Passe de craque)', async () => {
    const r = rng(5);
    for (const s of estados(30)) {
      const bonus = { arvore: nosAoAcaso(r), conquistas: Math.floor(r() * 60) };
      await preparar(s);
      await arvore(bonus.arvore);
      await conquistas(bonus.conquistas);
      const contratei = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      const chefes = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      for (const u of contratei) await contrato(A, u);
      for (const u of chefes) await contrato(u, A);
      const social = { contratei: contratei.length, empregos: chefes.map((u) => (u === C ? 3 : 1)) };
      const [db] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]);
      expect(rel(db.r, taxa(catalogo, { ...s, bonus, social }))).toBeLessThan(1e-9);
    }
    await arvore([]);
    await conquistas(0);
  });
  it('fechar a conta com a árvore: teto do ramo Tempo, vencimento no meio e bônus', async () => {
    const T0 = Date.parse('2026-10-12T10:00:00Z');
    const iso = (ms: number) => `'${new Date(ms).toISOString()}'::timestamptz`;
    const s = estados(4)[3];
    for (const nos of [[], [1, 41], [1, 41, 42, 43], [1, 11, 41, 42, 43, 44, 45, 54]]) {
      const bonus = { arvore: nos, conquistas: 9 };
      const tetoS = efeitosArvore(catalogo, nos).tetoS;
      await preparar(s, 'valuation, settled_at, boost_until', [1000, new Date(T0).toISOString(), new Date(T0 + 200_000).toISOString()]);
      await arvore(nos);
      await conquistas(bonus.conquistas);
      await contrato(C, A, iso(T0 - 86400_000), iso(T0 + 300_000)); // C (Cultura) contratou A: vence 300 s depois
      const trechos = [
        { desdeMs: T0, r: taxa(catalogo, { ...s, bonus, social: { contratei: 0, empregos: [3] } }) },
        { desdeMs: T0 + 300_000, r: taxa(catalogo, { ...s, bonus, social: { contratei: 0, empregos: [] } }) },
      ];
      for (const ate of [T0 + 50_000, T0 + 1000_000, T0 + 10 * 3600_000, T0 + 30 * 3600_000, T0 + 60 * 3600_000]) {
        const [db] = await q<{ v: number }>(
          `select (public.idle_settle(s, $2::timestamptz)).valuation as v from public.idle_state s where user_id = $1`,
          [A, new Date(ate).toISOString()],
        );
        expect(rel(db.v, acumularTrechos(1000, trechos, T0, ate, T0 + 200_000, tetoS)), `${nos} ${ate}`).toBeLessThan(1e-9);
      }
    }
    await q('delete from public.idle_contracts where true');
    await arvore([]);
    await conquistas(0);
  });
  it('caixinha com a árvore: banco e oportunidades.ts concordam (a validade segue 4h)', async () => {
    const s = estados(1)[0];
    await preparar(s);
    const [{ semana }] = await q<{ semana: string }>(
      `select (public.games_week_start()::timestamp at time zone 'America/Sao_Paulo')::text as semana`,
    );
    const base = Date.parse(semana) + 2 * 86400_000; // um instante fixo, dois dias dentro da semana
    for (const nos of [[], [1, 31], [1, 31, 32], [1, 31, 32, 33, 34, 35]]) {
      await arvore(nos);
      const ef = efeitosArvore(catalogo, nos);
      for (const horas of [0, 3, 5, 7]) {
        const ts = base + horas * 3600_000;
        const [db] = await q<{ l: string[] }>(
          'select public.idle_opp_list(s, $2::timestamptz) as l from public.idle_state s where user_id = $1',
          [A, new Date(ts).toISOString()],
        );
        expect(db.l.map(Number), `${nos} +${horas}h`).toEqual(
          pendentes(A, ts, [], Date.parse(semana), { tamanho: ef.caixinha, validadeS: CAIXA_PADRAO.validadeS }),
        );
      }
    }
    await arvore([]);
  });
  it('limite de oportunidades por dia: 10 + a estratégia + o nó Relâmpago da Shopee', async () => {
    const s = estados(1)[0];
    for (const [nos, strategies, esperado] of [[[], [-1, -1, -1, -1], 10], [[1, 31, 33], [-1, -1, -1, -1], 13], [[1, 31, 33], [-1, 0, -1, -1], 16]] as const) {
      const est = { ...s, strategies: [...strategies] };
      await preparar(est);
      await arvore([...nos]);
      const [db] = await q<{ c: number }>('select public.idle_opp_cap(s) as c from public.idle_state s where user_id = $1', [A]);
      expect(db.c, `${nos} ${strategies}`).toBe(esperado);
      const ts = LIMITE_DIA + estrategiasAtivas(catalogo, est).reduce((a, e) => a + e.oppExtra, 0) + efeitosArvore(catalogo, [...nos]).oppExtra;
      expect(db.c).toBe(ts);
    }
    await arvore([]);
  });
  it('preço do contrato com a árvore (e Abrir capital)', async () => {
    const r = rng(8);
    for (const s of estados(10)) {
      const nos = nosAoAcaso(r);
      await preparar(s);
      await arvore(nos);
      const contratei = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      for (const u of contratei) await contrato(A, u);
      const [db] = await q<{ p: number }>('select public.idle_hire_price(s) as p from public.idle_state s where user_id = $1', [A]);
      const est = { ...s, bonus: { arvore: nos, conquistas: 0 }, social: { contratei: contratei.length, empregos: [] } };
      expect(rel(db.p, precoContrato(catalogo, est, contratei.length))).toBeLessThan(1e-9);
    }
    await arvore([]);
  });
  it('pontos de prestígio iguais no banco e em economia.ts, inclusive em cima dos cubos', async () => {
    const r = rng(11);
    const valores = [0, -1, NaN, Infinity, 1e40, 1e33, 1, 999_999, 1e6, 8e6, 27e6, 1e9, 1e12];
    for (let i = 0; i < 150; i++) valores.push(10 ** (r() * 16));
    for (let n = 1; n <= 150; n++) {
      const cubo = n ** 3 * 1e6;
      valores.push(cubo, cubo * (1 - 2 ** -52), cubo * (1 + 2 ** -52));
    }
    for (const v of valores) {
      const [db] = await q<{ n: number }>('select public.idle_prestige_total($1) as n', [v]);
      expect(db.n, String(v)).toBe(pontosTotais(v));
    }
  });
  it('o estado devolve o bônus que a conta usa', async () => {
    const s = estados(5)[4];
    const bonus = { arvore: [1, 11, 12, 41], conquistas: 7 };
    await preparar(s);
    await arvore(bonus.arvore);
    await conquistas(bonus.conquistas);
    const [db] = await q<{ r: number; b: { arvore: number[]; conquistas: number } }>(
      `select (public.idle_json(s) ->> 'rate')::double precision as r, public.idle_json(s) -> 'bonus' as b
         from public.idle_state s where user_id = $1`,
      [A],
    );
    expect(db.b).toEqual(bonus);
    expect(rel(db.r, taxa(catalogo, { ...s, bonus }))).toBeLessThan(1e-9);
    await arvore([]);
    await conquistas(0);
  });
});
