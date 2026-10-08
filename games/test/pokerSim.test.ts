// 6 fellas, 200 mãos com jogadas aleatórias válidas (semente fixa), relógio estourando, entradas, saídas e
// completas. A cada passo: carteiras + fichas na mesa + apostas da mão aberta = constante (nenhum crédito surge ou
// some), e o extrato de cada um soma o saldo.
import { beforeAll, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';
import { act, balance, expireTurn, members, nextHand, P, sit, state, tick, type State } from './poker';

let t: TestDb;
let expected = 0;

function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const one = async <T>(sql: string) => (await t.db.query<{ v: T }>(sql)).rows[0].v;

async function invariants() {
  const total = await one<number>(`
    select ((select coalesce(sum(balance), 0) from public.game_wallets)
          + (select coalesce(sum(stack), 0) from public.poker_seats)
          + coalesce((select sum((e.value ->> 'total')::int)
                        from public.poker_hands h, jsonb_each(h.players) e where h.status = 'betting'), 0))::int as v`);
  expect(total).toBe(expected);
  expect(
    await one<number>(`select count(*)::int as v from public.game_wallets w
                        where w.balance <> (select sum(delta) from public.game_ledger l where l.user_id = w.user_id)`),
  ).toBe(0);
}

// Só jogadas que o banco aceita: o PGlite (wasm) perde pilha a cada exceção vinda de função plpgsql e estoura
// depois de ~3.000 delas. No Postgres de verdade isso não acontece; aqui a simulação não pode depender de erro.
let refused = 0;
const tolerate = <T>(p: Promise<T>) =>
  p.catch(() => {
    refused++;
    return null;
  });

async function randomAct(s: State, r: () => number) {
  const h = s.hand!;
  const seat = h.to_act!;
  const p = h.players[String(seat)];
  const stack = s.seats.find((x) => x.seat === seat)!.stack;
  const facing = h.current_bet > p.bet;
  const safe = facing ? 'call' : 'check';
  const canRaise = !p.capped && p.bet + stack > h.current_bet;
  const x = r();
  if (x < 0.15) await act(t, seat, 'fold');
  else if (x < 0.6 || !canRaise) await act(t, seat, safe);
  else if (x < 0.9) {
    // o mínimo exato pode ser quebrado; acima dele, de 5 em 5
    const k = Math.floor(r() * 10);
    const to = k === 0 ? h.min_raise_to : Math.ceil(h.min_raise_to / 5) * 5 + 5 * k;
    await act(t, seat, 'raise', Math.min(to, p.bet + stack));
  }
  else await act(t, seat, 'allin');
}

/** Carteira sem o bastante: entra um fiado de mentira (e o esperado sobe junto), para a mesa nunca parar. */
async function topUp(uid: string, need: number) {
  if ((await balance(t, uid))! >= need) return;
  await t.db.query(`update public.game_wallets set balance = balance + 500 where user_id = $1`, [uid]);
  await t.db.query(`insert into public.game_ledger (user_id, delta, reason) values ($1, 500, 'fiado')`, [uid]);
  expected += 500;
}

async function betweenHands(s: State, r: () => number) {
  for (const seat of s.seats) {
    const uid = P[seat.seat];
    await t.as(uid);
    const x = r();
    if (seat.status === 'away') await tolerate(t.rpc('poker_back'));
    else if (seat.stack === 0) {
      if (x < 0.7) {
        await topUp(uid, 200);
        await t.as(uid);
        await tolerate(t.rpc('poker_rebuy', { p_amount: 200 }));
      } else await tolerate(t.rpc('poker_leave'));
    } else if (x < 0.05) await tolerate(t.rpc('poker_leave'));
    else if (x < 0.1 && seat.stack <= 400) {
      await topUp(uid, 100);
      await t.as(uid);
      await tolerate(t.rpc('poker_rebuy', { p_amount: 100 }));
    }
  }
  for (let i = 0; i < 6; i++) {
    if (s.seats.some((x) => x.seat === i) || r() > 0.4) continue;
    await t.as(P[i]);
    const min = Math.max(200, (await t.rpc<State>('poker_state')).me?.rathole_min ?? 0); // anti-rathole
    await topUp(P[i], min);
    await tolerate(sit(t, i, min));
  }
}

beforeAll(async () => {
  t = await freshDb();
  await members(t);
});

describe('simulação', () => {
  it('200 mãos sem criar nem sumir crédito', async () => {
    const r = rng(42);
    for (let i = 0; i < 6; i++) await sit(t, i, 200 + 10 * Math.floor(r() * 31));
    expected = 6000;
    await invariants();
    let steps = 0;
    let s = await state(t);
    while ((s.hand?.no ?? 0) < 200 && steps < 20000) {
      steps++;
      if (s.hand?.status === 'betting') {
        if (r() < 0.03) {
          await expireTurn(t);
          await tick(t);
        } else {
          await randomAct(s, r);
        }
      } else {
        await betweenHands(s, r);
        await nextHand(t);
      }
      await invariants();
      s = await state(t);
    }
    expect(s.hand!.no).toBeGreaterThanOrEqual(200);
    expect(refused).toBeLessThan(50); // quase nada recusado: a simulação joga dentro das regras
  }, 600_000);
});
