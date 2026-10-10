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
