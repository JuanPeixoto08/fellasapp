import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { freshDb, type TestDb } from './db';

export const A = '00000000-0000-0000-0000-00000000000a';
export const B = '00000000-0000-0000-0000-00000000000b';
export const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb();
  for (const u of [A, B]) await t.member(u);
  await t.member(OUT, { isMember: false });
  await t.as(A);
});

describe('catálogo no banco', () => {
  it('tem os mesmos números do catalogo.ts', async () => {
    const gens = await q<{ id: number; custo: number; renda: number }>('select id, custo, renda from public.idle_cat_gen order by id');
    expect(gens.map((g) => [g.id, g.custo, g.renda])).toEqual(catalogo.geradores.map((g) => [g.id, g.custo, g.renda]));
    expect((await q<{ n: number }>('select count(*)::int as n from public.idle_cat_upg'))[0].n).toBe(200);
    expect((await q<{ n: number }>('select count(*)::int as n from public.idle_cat_est where ativa'))[0].n).toBe(8);
  });
  it('membro lê; anônimo não', async () => {
    const lidos = await t.asRole<{ n: number }>('authenticated', 'select count(*)::int as n from public.idle_cat_gen');
    expect(lidos[0].n).toBe(30);
    await expect(t.asRole('anon', 'select * from public.idle_cat_gen')).rejects.toThrow();
  });
});

type Estado = {
  user_id: string; week_start: string; started: boolean; valuation: number; rate: number; generators: number[];
  upgrades: number[]; strategies: number[]; era: number; boost_until: string | null; half_price: boolean;
  opp_claimed: number[]; opp_left: number; server_now: string;
};
const recuar = (uid: string, segundos: number) =>
  q(`update public.idle_state set settled_at = settled_at - make_interval(secs => $2) where user_id = $1`, [uid, segundos]);

describe('idle_open / idle_start', () => {
  it('primeira vez cria o estado da semana sem empresa aberta', async () => {
    const s = await t.rpc<Estado>('idle_open');
    expect(s).toMatchObject({ user_id: A, started: false, valuation: 0, rate: 0, era: 1, strategies: [-1, -1, -1, -1], upgrades: [], half_price: false });
    expect(s.generators).toEqual(Array(30).fill(0));
  });
  it('não membro é barrado', async () => {
    await t.as(OUT);
    await expect(t.rpc('idle_open')).rejects.toThrow(/not_member/);
  });
  it('Abrir CNPJ: 1 notebook e R$ 10; abrir de novo é erro', async () => {
    const s = await t.rpc<Estado>('idle_start');
    expect(s).toMatchObject({ started: true, valuation: 10, rate: 0.5 });
    expect(s.generators[0]).toBe(1);
    await expect(t.rpc('idle_start')).rejects.toThrow(/idle_started/);
  });
  it('bater o ponto acumula taxa × tempo', async () => {
    await t.rpc('idle_start');
    await recuar(A, 100);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.valuation).toBeCloseTo(60, 0);
  });
  it('teto de 8 horas', async () => {
    await t.rpc('idle_start');
    await recuar(A, 10 * 3600);
    expect((await t.rpc<Estado>('idle_open')).valuation).toBeCloseTo(10 + 0.5 * 8 * 3600, 0);
  });
  it('quem não abriu a empresa não acumula', async () => {
    await t.rpc('idle_open');
    await recuar(A, 3600);
    expect((await t.rpc<Estado>('idle_open')).valuation).toBe(0);
  });
  it('ninguém escreve direto no estado', async () => {
    await t.rpc('idle_start');
    await expect(t.asRole('authenticated', `update public.idle_state set valuation = 1e9 where user_id = '${A}'`)).rejects.toThrow();
  });
});
