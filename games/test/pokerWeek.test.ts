import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';
import { act, balance, members, nextHand, OUT, P, sit, state } from './poker';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const ageWeek = () => q(`update public.game_wallets set week_start = week_start - 7`);

beforeEach(async () => {
  t = await freshDb();
  await members(t);
});

describe('reset da semana (M2)', () => {
  it('anula a mão aberta, devolve as apostas, levanta todo mundo e conta as fichas no pódio', async () => {
    await sit(t, 0, 300);
    await sit(t, 1, 300); // mesa parada: a mão sai; cega grande no 0, o 1 fala
    await act(t, 1, 'raise', 50);
    await q('update public.poker_seats set stack = stack + 500 where seat = 0'); // o 0 vinha ganhando
    await ageWeek();
    await q('select public.games_weekly_reset()');

    const s = await state(t);
    expect(s.seats).toEqual([]);
    expect(s.hand!.status).toBe('void');
    // 0: carteira 700 + mesa (290 + 500) + 10 devolvido = 1.500; 1: 700 + 250 + 50 = 1.000
    expect(await q('select podium from public.game_weeks')).toEqual([
      {
        podium: [
          { user_id: P[0], balance: 1500, fiado_count: 0 },
          { user_id: P[1], balance: 1000, fiado_count: 0 },
        ],
      },
    ]);
    expect(await balance(t, P[0])).toBe(1000);
    expect(await q('select count(*)::int as n from public.poker_leaves')).toEqual([{ n: 0 }]); // sem anti-rathole
    expect(await q('select count(*)::int as n from public.poker_secrets')).toEqual([{ n: 0 }]);
  });

  it('reset devolve a aposta de quem já tinha levantado', async () => {
    await sit(t, 0, 300);
    await sit(t, 1, 300); // mão 1: 0 e 1
    await sit(t, 2, 300);
    await act(t, 1, 'fold'); // 0 leva: 305 × 295
    await q('update public.poker_seats set wait_bb = false');
    let s = await nextHand(t); // mão 2: cega grande no 1, pequena no 0, botão no 2
    expect(s.hand).toMatchObject({ bb: 1, sb: 0, button: 2, to_act: 2 });
    await act(t, 2, 'call');
    await act(t, 0, 'fold'); // pôs 5 e correu
    await q('select public.poker_stand(0::smallint, true)'); // levantado (como o ausente de 10 min)
    await q('select public.games_close_open_rounds()');
    // 0: 700 + 300 (levantou) + 5 (anulada); 1: 700 + 285 + 10; 2: 700 + 290 + 10
    expect([await balance(t, P[0]), await balance(t, P[1]), await balance(t, P[2])]).toEqual([1005, 995, 1000]);
    s = await state(t);
    expect(s.seats).toEqual([]);
  });

  it('segunda chamada do reset não mexe na mesa', async () => {
    await sit(t, 0, 300);
    await ageWeek();
    await q('select public.games_weekly_reset()');
    const seq = (await state(t)).seq;
    await q('select public.games_weekly_reset()');
    expect((await state(t)).seq).toBe(seq);
  });
});

describe('segurança', () => {
  const denied = /permission denied/;

  it('ninguém lê o baralho nem as saídas', async () => {
    await t.as(P[0]);
    await expect(t.asRole('authenticated', 'select * from public.poker_secrets')).rejects.toThrow(denied);
    await expect(t.asRole('authenticated', 'select * from public.poker_leaves')).rejects.toThrow(denied);
  });

  it('o app não escreve direto nas tabelas da mesa', async () => {
    await t.as(P[0]);
    await expect(
      t.asRole('authenticated', `insert into public.poker_seats (seat, user_id, stack) values (0, '${P[0]}', 500)`),
    ).rejects.toThrow(denied);
    await expect(t.asRole('authenticated', 'update public.poker_tables set seq = 0')).rejects.toThrow(denied);
    await expect(t.asRole('authenticated', `update public.poker_hands set status = 'void'`)).rejects.toThrow(denied);
  });

  it('funções internas fechadas para o app; anon não chama nada', async () => {
    await t.as(P[0]);
    for (const fn of [
      'poker_maybe_start()',
      'poker_snapshot()',
      `poker_stand(0::smallint, true)`,
      `poker_finish('00000000-0000-0000-0000-000000000000'::uuid)`,
      `poker_rank('{0,1,2,3,4}'::smallint[])`,
      'games_close_open_rounds()',
    ]) {
      await expect(t.asRole('authenticated', `select public.${fn}`)).rejects.toThrow(denied);
    }
    await expect(t.asRole('anon', 'select public.poker_state()')).rejects.toThrow(denied);
    await expect(t.asRole('anon', 'select public.poker_tick()')).rejects.toThrow(denied);
  });

  it('membro lê a mesa; quem não é membro não vê nada', async () => {
    await t.as(P[0]);
    expect(await t.asRole('authenticated', 'select id from public.poker_tables')).toEqual([{ id: 1 }]);
    await t.as(OUT);
    expect(await t.asRole('authenticated', 'select id from public.poker_tables')).toEqual([]);
  });
});
