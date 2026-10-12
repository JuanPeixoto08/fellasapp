// Oportunidades na sorte (0049): o segundo e o tipo de cada janela no banco são os da página, e não seguem padrão.
import { beforeEach, describe, expect, it } from 'vitest';

import { instante, tipo } from '../idle/oportunidades';
import { freshDb, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '00000000-0000-0000-0000-00000000000a';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb({ conquistas: false });
});

describe('a sorte das oportunidades (paridade com oportunidades.ts)', () => {
  it('o mesmo segundo e o mesmo tipo em 2 mil janelas, pra dois jogadores', async () => {
    const w0 = 2_980_000;
    for (const u of [A, B]) {
      const sql = await q<{ ms: string; k: number }>(
        `select (extract(epoch from public.idle_opp_at($1::uuid, w)) * 1000)::bigint::text as ms, public.idle_opp_kind($1::uuid, w) as k
           from generate_series($2::bigint, $3::bigint) w order by w`, [u, w0, w0 + 1999]);
      const ts = Array.from({ length: 2000 }, (_, i) => ({ ms: String(instante(u, w0 + i)), k: tipo(u, w0 + i) }));
      expect(sql).toEqual(ts);
    }
  });
});

describe('sem padrão', () => {
  it('o tipo não gira em sequência e o segundo não anda um passo fixo', () => {
    const w0 = 2_980_000;
    const N = 3000;
    const tipos = Array.from({ length: N }, (_, i) => tipo(A, w0 + i));
    const cont = [0, 1, 2].map((k) => tipos.filter((x) => x === k).length);
    for (const c of cont) expect(c / N).toBeGreaterThan(0.29); // ~1/3 cada
    const repetidos = tipos.filter((x, i) => i > 0 && x === tipos[i - 1]).length / (N - 1);
    expect(repetidos).toBeGreaterThan(0.28); // em sequência (0, 1, 2…) daria 0
    expect(repetidos).toBeLessThan(0.39);
    const passos = new Set(Array.from({ length: 200 }, (_, i) => {
      const off = (w: number) => instante(A, w) / 1000 - w * 600;
      return (off(w0 + i + 1) - off(w0 + i) + 590) % 590;
    }));
    expect(passos.size).toBeGreaterThan(100); // antes era sempre 249
  });
});
