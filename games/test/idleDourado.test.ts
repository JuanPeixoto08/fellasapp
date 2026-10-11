// Eventos na tela (0045): a sorte do banco é a da página, e as regras e efeitos do pegar.
import { beforeEach, describe, expect, it } from 'vitest';

import { douradoEm } from '../idle/dourados';
import { freshDb, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '098d04dc-bba1-433a-9ef8-0e9dd863e4ed';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb({ conquistas: false });
});

describe('a sorte (paridade com dourados.ts)', () => {
  it('os mesmos segundos e os mesmos tipos num trecho de 60 mil segundos, pra dois jogadores', async () => {
    for (const u of [A, B]) {
      const ini = 1_760_000_000;
      const fim = ini + 60_000;
      const sql = await q<{ s: string; d: number }>(
        `select s::text, public.idle_dourado($1::uuid, s) as d from generate_series($2::bigint, $3::bigint) s
          where public.idle_dourado($1::uuid, s) is not null order by s`, [u, ini, fim - 1]);
      const ts: { s: string; d: number }[] = [];
      for (let s = ini; s < fim; s++) {
        const d = douradoEm(u, s);
        if (d !== null) ts.push({ s: String(s), d });
      }
      expect(ts.length).toBeGreaterThan(50);
      expect(sql).toEqual(ts);
    }
  });
});
