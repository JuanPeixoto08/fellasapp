// Eventos de era (0074): a sorte do banco é a da página, e as regras e efeitos do pegar.
import { beforeEach, describe, expect, it } from 'vitest';

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
