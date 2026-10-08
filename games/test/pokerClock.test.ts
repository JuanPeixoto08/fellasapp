import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';
import { act, balance, expireTurn, members, nextHand, OUT, P, rigDeck, sit, startHand, state, tick, type State } from './poker';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb();
  await members(t);
});

describe('vez vencida', () => {
  it('nada acontece antes do prazo', async () => {
    const before = (await startHand(t, { 0: 300, 1: 300 }, 0)).hand!;
    await tick(t);
    expect((await state(t)).hand).toMatchObject({ action_no: before.action_no, to_act: before.to_act });
  });

  it('estourou em 2 mãos seguidas: fica ausente e a vez dele é jogada na hora', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await expireTurn(t);
    await tick(t); // mão 1: o 1 tinha 5 a pagar → corre (1º estouro)
    let s = await state(t);
    expect(s.hand).toMatchObject({ status: 'done' });
    expect(s.hand!.players['1']).toMatchObject({ folded: true, timed_out: true });

    s = await nextHand(t); // mão 2: cega grande no 1; o botão (0) fala primeiro
    expect(s.hand).toMatchObject({ bb: 1, to_act: 0 });
    await act(t, 0, 'call');
    await expireTurn(t);
    await tick(t); // o 1 não tinha nada a pagar → mesa (2º estouro) → ausente
    s = await state(t);
    expect(s.seats.find((x) => x.seat === 1)).toMatchObject({ status: 'away' });
    // flop: a vez do 1 (ausente) é jogada na hora; volta para o 0
    expect(s.hand).toMatchObject({ street: 'flop', to_act: 0 });
    expect(s.hand!.players['1'].last).toBe('check');

    s = await act(t, 0, 'raise', 20); // ausente com aposta a pagar: corre na hora
    expect(s.hand).toMatchObject({ status: 'done' });
    expect(s.hand!.players['1'].folded).toBe(true);

    s = await nextHand(t); // só 1 pronto: nada de mão nova
    expect(s.hand!.status).toBe('done');

    await t.as(P[1]);
    s = await t.rpc<State>('poker_back'); // mesa parada: volta e a mão sai na hora
    expect(s.hand).toMatchObject({ status: 'betting' });
    expect(Object.keys(s.hand!.players).sort()).toEqual(['0', '1']);
  });

  it('jogada própria zera os estouros', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await q('update public.poker_seats set timeouts = 1 where seat = 1');
    await act(t, 1, 'call');
    expect(await q('select timeouts from public.poker_seats where seat = 1')).toEqual([{ timeouts: 0 }]);
  });

  it('jogada atrasada depois do relógio é recusada', async () => {
    const h = (await startHand(t, { 0: 300, 1: 300 }, 0)).hand!;
    await expireTurn(t);
    await tick(t);
    await t.as(P[1]);
    await expect(
      t.rpc('poker_act', { p_hand: h.id, p_action_no: h.action_no, p_action: 'call', p_amount: null }),
    ).rejects.toThrow(/stale_seq/);
    expect((await state(t)).hand!.players['1'].folded).toBe(true); // jogou uma vez só
  });
});

describe('quem sai e quem some', () => {
  it('ausente há 10 minutos é levantado e as fichas voltam', async () => {
    await sit(t, 0, 300);
    await q(`update public.poker_seats set status = 'away', away_since = now() - interval '11 minutes'`);
    await tick(t);
    expect((await state(t)).seats).toEqual([]);
    expect(await balance(t, P[0])).toBe(1000);
  });

  it('quem sai no meio da mão corre quando a vez chega e levanta no fim', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await t.as(P[2]);
    let s = await t.rpc<State>('poker_leave');
    expect(s.seats.find((x) => x.seat === 2)).toMatchObject({ leaving: true });
    await act(t, 0, 'call');
    s = await act(t, 1, 'fold'); // vez do 2 (saindo): corre na hora → só o 0 sobra
    expect(s.hand).toMatchObject({ status: 'done' });
    expect(s.hand!.players['2'].folded).toBe(true);
    expect(s.seats.map((x) => x.seat)).toEqual([0, 1]);
    expect(await balance(t, P[2])).toBe(1000 + 290);
  });

  it('quem sai estando all-in fica até o fim', async () => {
    await rigDeck(t, ['Ah', 'Ad', '2c', '7d', 'Ks', 'Qh', '9c', '4d', '3s']); // ordem: 0 (cega grande), 1
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await act(t, 1, 'raise', 50);
    await act(t, 0, 'allin');
    await t.as(P[0]);
    await t.rpc('poker_leave');
    const s = await act(t, 1, 'call');
    expect(s.hand).toMatchObject({ status: 'done', runout: true });
    expect(s.hand!.results!.payouts).toEqual({ '0': 600 });
    expect(s.seats.map((x) => x.seat)).toEqual([1]);
    expect(await balance(t, P[0])).toBe(1000 + 600);
  });

  it('sem fichas: completa no minuto e volta a receber cartas', async () => {
    await rigDeck(t, ['Ah', 'Ad', '2c', '7d', 'Ks', 'Qh', '9c', '4d', '3s']);
    await startHand(t, { 0: 300, 1: 100 }, 0);
    await act(t, 1, 'allin');
    let s = await act(t, 0, 'call');
    expect(s.seats.find((x) => x.seat === 1)).toMatchObject({ stack: 0, busted: true });
    s = await nextHand(t);
    expect(s.hand!.status).toBe('done'); // só o 0 tem fichas
    await t.as(P[1]);
    s = await t.rpc<State>('poker_rebuy', { p_amount: 200 });
    expect(s.seats.find((x) => x.seat === 1)).toMatchObject({ stack: 200 - 10, busted: false }); // já pagou a cega grande
    expect(Object.keys(s.hand!.players).sort()).toEqual(['0', '1']);
  });

  it('sem fichas: depois de 1 minuto levanta, sem lançamento de 0', async () => {
    await rigDeck(t, ['Ah', 'Ad', '2c', '7d', 'Ks', 'Qh', '9c', '4d', '3s']);
    await startHand(t, { 0: 300, 1: 100 }, 0);
    await act(t, 1, 'allin');
    await act(t, 0, 'call');
    await q(`update public.poker_seats set busted_at = now() - interval '61 seconds' where seat = 1`);
    await tick(t);
    expect((await state(t)).seats.map((x) => x.seat)).toEqual([0]);
    expect(await q(`select count(*)::int as n from public.game_ledger where user_id = $1 and reason = 'cashout'`, [P[1]])).toEqual([{ n: 0 }]);
  });
});

describe('mesa fechada e cron', () => {
  it('domingo 23:55 em diante a mesa fecha; segunda 00:00 abre', async () => {
    const closed = async (ts: string) =>
      (await q<{ c: boolean }>(`select public.poker_closed($1::timestamptz) as c`, [ts]))[0].c;
    expect(await closed('2026-10-11 23:54:59-03')).toBe(false);
    expect(await closed('2026-10-11 23:55:00-03')).toBe(true);
    expect(await closed('2026-10-12 00:00:00-03')).toBe(false);
    expect(await closed('2026-10-10 23:59:00-03')).toBe(false);
  });

  it('o relógio roda pelo cron a cada minuto', async () => {
    expect(await q(`select schedule, command from cron.jobs where name = 'fellas-poker-tick'`)).toEqual([
      { schedule: '* * * * *', command: 'select public.poker_tick()' },
    ]);
  });

  it('membro chamando o relógio recebe o retrato; não membro é barrado', async () => {
    await t.as(P[0]);
    expect(await t.rpc<State>('poker_tick')).toMatchObject({ seats: [], hand: null });
    await t.as(OUT);
    await expect(t.rpc('poker_tick')).rejects.toThrow(/not_member/);
  });
});
