import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';
import { balance, members, P, sit, state, type State } from './poker';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type Wallet = { balance: number; can_fiado: boolean; seated_stack: number | null };

beforeEach(async () => {
  t = await freshDb();
  await members(t);
});

describe('poker_sit', () => {
  it('sentar tira a entrada da carteira e entra esperando a cega grande', async () => {
    const s = await sit(t, 2, 300);
    expect(await balance(t, P[2])).toBe(700);
    expect(await q('select delta, reason from public.game_ledger where user_id = $1 order by id', [P[2]])).toEqual([
      { delta: 1000, reason: 'start' },
      { delta: -300, reason: 'buyin' },
    ]);
    expect(s.seats).toEqual([{ seat: 2, user_id: P[2], stack: 300, status: 'playing', wait_bb: true, leaving: false, busted: false }]);
    expect(s.hand).toBeNull();
  });

  it('entrada fora de 200–500, fora do passo de 10 ou maior que a carteira é recusada', async () => {
    await expect(sit(t, 0, 190)).rejects.toThrow(/buyin_out_of_range/);
    await expect(sit(t, 0, 510)).rejects.toThrow(/buyin_out_of_range/);
    await expect(sit(t, 0, 205)).rejects.toThrow(/buyin_out_of_range/);
    await t.rpc('games_wallet'); // a carteira só nasce no primeiro acesso
    await q('update public.game_wallets set balance = 250 where user_id = $1', [P[0]]);
    await expect(sit(t, 0, 300)).rejects.toThrow(/insufficient_credits/);
    expect(await q('select count(*)::int as n from public.poker_seats')).toEqual([{ n: 0 }]);
  });

  it('lugar ocupado, já sentado e lugar que não existe', async () => {
    await sit(t, 2);
    await expect(sit(t, 2)).rejects.toThrow(/already_seated/);
    await t.as(P[1]);
    await expect(t.rpc('poker_sit', { p_seat: 2, p_buyin: 300 })).rejects.toThrow(/seat_taken/);
    await expect(t.rpc('poker_sit', { p_seat: 6, p_buyin: 300 })).rejects.toThrow(/invalid_action/);
  });

  it('não membro é barrado', async () => {
    await t.as('00000000-0000-0000-0000-0000000000ff');
    await expect(t.rpc('poker_sit', { p_seat: 0, p_buyin: 300 })).rejects.toThrow(/not_member/);
    await expect(t.rpc('poker_state')).rejects.toThrow(/not_member/);
  });
});

describe('poker_leave e anti-rathole', () => {
  it('levantar fora de mão devolve as fichas e marca a saída', async () => {
    await sit(t, 2, 300);
    await q('update public.poker_seats set stack = 735 where seat = 2');
    await t.as(P[2]);
    const s = await t.rpc<State>('poker_leave');
    expect(s.seats).toEqual([]);
    expect(await balance(t, P[2])).toBe(700 + 735);
    expect(await q(`select delta from public.game_ledger where user_id = $1 and reason = 'cashout'`, [P[2]])).toEqual([{ delta: 735 }]);
    expect((await t.rpc<State>('poker_state')).me).toEqual({ rathole_min: 735 });
  });

  it('anti-rathole aceita o valor exato de saída', async () => {
    await sit(t, 2, 300);
    await q('update public.poker_seats set stack = 735 where seat = 2');
    await t.as(P[2]);
    await t.rpc('poker_leave');
    await expect(sit(t, 2, 300)).rejects.toThrow(/rathole_min/);
    await expect(sit(t, 2, 730)).rejects.toThrow(/rathole_min/);
    const s = await sit(t, 2, 735);
    expect(s.seats[0].stack).toBe(735);
    expect((await t.rpc<State>('poker_state')).me).toEqual({ rathole_min: null });
  });

  it('depois de 30 min volta com a entrada normal', async () => {
    await sit(t, 2, 400);
    await t.as(P[2]);
    await t.rpc('poker_leave');
    await expect(sit(t, 2, 200)).rejects.toThrow(/rathole_min/);
    await q(`update public.poker_leaves set left_at = now() - interval '31 minutes'`);
    expect((await sit(t, 2, 200)).seats[0].stack).toBe(200);
  });

  it('levantar sem estar sentado', async () => {
    await t.as(P[0]);
    await expect(t.rpc('poker_leave')).rejects.toThrow(/not_seated/);
  });
});

describe('poker_rebuy e poker_back', () => {
  it('completar: fora da mão, de 10 em 10 e até 500 na mesa', async () => {
    await sit(t, 2, 300);
    await t.as(P[2]);
    expect((await t.rpc<State>('poker_rebuy', { p_amount: 200 })).seats[0].stack).toBe(500);
    expect(await balance(t, P[2])).toBe(500);
    await expect(t.rpc('poker_rebuy', { p_amount: 10 })).rejects.toThrow(/rebuy_out_of_range/);
    await q('update public.poker_seats set stack = 295');
    await expect(t.rpc('poker_rebuy', { p_amount: 15 })).rejects.toThrow(/rebuy_out_of_range/);
    await expect(t.rpc('poker_rebuy', { p_amount: 0 })).rejects.toThrow(/rebuy_out_of_range/);
  });

  it('voltar do ausente entra esperando a cega grande', async () => {
    await sit(t, 2, 300);
    await q(`update public.poker_seats set status = 'away', away_since = now(), timeouts = 2, wait_bb = false`);
    await t.as(P[2]);
    const s = await t.rpc<State>('poker_back');
    expect(s.seats[0]).toMatchObject({ status: 'playing', wait_bb: true });
    expect(await q('select timeouts, away_since from public.poker_seats')).toEqual([{ timeouts: 0, away_since: null }]);
    await t.as(P[0]);
    await expect(t.rpc('poker_back')).rejects.toThrow(/not_seated/);
  });
});

describe('retrato', () => {
  it('seq sobe a cada mudança; cegas, entrada e hora do servidor', async () => {
    const before = await state(t);
    expect(before).toMatchObject({ blinds: [5, 10], buyin: [200, 500], closed: expect.any(Boolean), hand: null, seats: [] });
    await sit(t, 1);
    const after = await state(t);
    expect(after.seq).toBeGreaterThan(before.seq);
    expect(Date.parse(after.server_now)).not.toBeNaN();
  });
});

describe('carteira, fiado e placar', () => {
  it('fichas na mesa aparecem na carteira e o fiado espera levantar', async () => {
    await sit(t, 2, 300);
    await q('update public.game_wallets set balance = 0 where user_id = $1', [P[2]]);
    await t.as(P[2]);
    expect(await t.rpc<Wallet>('games_wallet')).toMatchObject({ balance: 0, seated_stack: 300, can_fiado: false });
    await expect(t.rpc('games_fiado')).rejects.toThrow(/fiado_seated/);
    await q('update public.poker_seats set stack = 0');
    await t.rpc('poker_leave');
    expect(await t.rpc<Wallet>('games_wallet')).toMatchObject({ balance: 0, seated_stack: null, can_fiado: true });
  });

  it('placar soma carteira e fichas na mesa', async () => {
    await sit(t, 0, 300); // 700 + 300 na mesa
    await t.as(P[1]);
    await t.rpc('games_wallet');
    await q(`update public.game_wallets set balance = 900 where user_id = $1`, [P[1]]);
    await q(`update public.game_wallets set last_played_at = now()`);
    expect(await t.rpc('games_board')).toEqual([
      { user_id: P[0], balance: 1000, fiado_count: 0 },
      { user_id: P[1], balance: 900, fiado_count: 0 },
    ]);
  });
});
