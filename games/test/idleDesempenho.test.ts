// Desempenho da conta do banco (0079): idle_gen_rendas roda uma vez por gerador (42 linhas) e o Postgres embutia os CTEs
// (os multiplicadores gerais e o legado) em cada linha — cada compra levava ~0,1 s só nessa conta. Com "materialized" eles
// rodam uma vez por chamada. O valor é o mesmo (a paridade com economia.ts fica em idleEras67/idleParidade).
import { beforeAll, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';

let t: TestDb;

describe('idle_gen_rendas (0079)', () => {
  beforeAll(async () => {
    t = await freshDb({ conquistas: false });
  });
  it('os CTEs de fora da linha do gerador rodam uma vez só (materialized)', async () => {
    const [{ def }] = (await t.db.query<{ def: string }>(
      "select pg_get_functiondef('public.idle_gen_rendas(public.idle_state, timestamptz)'::regprocedure) as def")).rows;
    for (const cte of ['est', 'glob', 'leg']) expect(def, cte).toMatch(new RegExp(`\\b${cte} as materialized \\(`));
  });
});
