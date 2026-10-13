// Sem teto (0061): voltar depois de 10 dias com a horta 6 × 6 cheia (cruzando e morrendo o tempo todo) e convidados
// sentados não pode deixar a abertura lenta. O PGlite é bem mais lento que o Postgres; o limite aqui é folgado.
import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb({ conquistas: true });
  await t.member(A);
  await t.as(A);
  await t.rpc('idle_start');
});

describe('abrir depois de 10 dias fora', () => {
  it('com a horta cheia, cruzando, e o MC V.V sentado: abre em menos de 8 s e paga os 10 dias', async () => {
    await q(`update public.idle_state set generators[1] = 50, generators[11] = 200, generators[13] = 50, strategies = '{0,0,0,0}' where user_id = $1`, [A]);
    const r0 = (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    // cruzamento sempre: a horta enche de planta nova a cada passo que dá
    await t.db.exec(`create or replace function public.idle_horta_sorte(u uuid, c int, t bigint, k int) returns double precision language sql immutable as 'select 0::double precision'`);
    await q(`insert into public.idle_horta_descobertas (user_id, especie) select $1, e from generate_series(1, 7) e on conflict do nothing`, [A]);
    // metade da grade plantada há quase 7 dias (o tanto que a horta anda pra trás): o resto vai brotando e morrendo
    for (let c = 0; c < 36; c += 2) {
      await q(`insert into public.idle_horta_plantas (user_id, canteiro, especie, inicio) values ($1, $2, $3, now() - interval '167 hours' + make_interval(secs => $4))`, [A, c, 1 + (c % 4 === 0 ? 0 : 1), c * 60]);
    }
    await q(`update public.idle_state set conv_cadeira = array[9, null, null]::int[], conv_desde = array[now() - interval '10 days', null, null]::timestamptz[] where user_id = $1`, [A]);
    await q(`update public.idle_state set settled_at = now() - interval '10 days', horta_passo = floor(extract(epoch from now() - interval '167 hours') / 300)::bigint, valuation = 0 where user_id = $1`, [A]);
    const t0 = performance.now();
    const s = await t.rpc<{ valuation: number; rate: number }>('idle_open');
    const ms = performance.now() - t0;
    const plantas = (await q<{ n: number }>('select count(*)::int as n from public.idle_horta_plantas where user_id = $1', [A]))[0].n;
    expect(plantas).toBeGreaterThan(200); // a horta viveu de verdade nesses dias
    expect(ms).toBeLessThan(8000);
    // pagou os 10 dias inteiros (sem teto): a horta só soma; o Coentro e as derrubadas do MC V.V tiram um pouco
    expect(s.valuation).toBeGreaterThan(r0 * 10 * 86400 * 0.85);
  }, 120_000);
});
