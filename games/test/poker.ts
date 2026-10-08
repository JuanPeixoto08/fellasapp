// Ajudantes dos testes de poker: o fella P[i] senta no lugar i; baralho armado; mão começando direto; jogadas;
// relógio adiantado. Formatos iguais aos de poker_tables.state (0030).
import { card } from './cards';
import type { TestDb } from './db';

export const P = [0, 1, 2, 3, 4, 5].map((i) => `00000000-0000-0000-0000-0000000000a${i}`);
export const OUT = '00000000-0000-0000-0000-0000000000ff';

export type Player = {
  user_id: string;
  bet: number;
  total: number;
  folded: boolean;
  all_in: boolean;
  acted: boolean;
  capped: boolean;
  last: string | null;
  timed_out: boolean;
};
export type Results = {
  showdown: boolean;
  pots: { amount: number; winners: number[]; name: string | null }[];
  payouts: Record<string, number>;
  hands: Record<string, string>;
};
export type Hand = {
  id: string;
  no: number;
  status: 'betting' | 'done' | 'void';
  street: string;
  board: number[];
  players: Record<string, Player>;
  pot: number;
  current_bet: number;
  min_raise_to: number;
  to_act: number | null;
  action_no: number;
  deadline: string | null;
  button: number;
  sb: number;
  bb: number;
  runout: boolean;
  results: Results | null;
  shown: Record<string, number[]>;
};
export type Seat = { seat: number; user_id: string; stack: number; status: 'playing' | 'away'; wait_bb: boolean; leaving: boolean; busted: boolean };
export type State = {
  seq: number;
  server_now: string;
  closed: boolean;
  next_hand_at: string | null;
  blinds: number[];
  buyin: number[];
  seats: Seat[];
  hand: Hand | null;
  me?: { rathole_min: number | null };
};

export async function members(t: TestDb) {
  for (const u of P) await t.member(u);
  await t.member(OUT, { isMember: false });
}

/**
 * Próximo baralho: essas cartas primeiro e o resto em ordem. Ordem de distribuição: 2 cartas para cada um a
 * partir do primeiro à esquerda do botão (no heads-up, a cega grande), depois as 5 da mesa.
 */
export async function rigDeck(t: TestDb, codes: string[]) {
  const head = codes.map(card);
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !head.includes(c));
  await t.db.exec(`create or replace function public.poker_shuffle() returns smallint[] language sql volatile as
    $$ select array[${[...head, ...rest].join(',')}]::smallint[] $$`);
}

/** Senta direto (sem carteira) quem está em `stacks`, prontos, e começa a mão com a cega grande em `bb`. */
export async function startHand(t: TestDb, stacks: Record<number, number>, bb: number): Promise<State> {
  const seats = Object.keys(stacks).map(Number).sort((a, b) => a - b);
  for (const s of seats) {
    await t.db.query(`insert into public.poker_seats (seat, user_id, stack, wait_bb) values ($1, $2, $3, false)`, [s, P[s], stacks[s]]);
  }
  const prev = seats[(seats.indexOf(bb) - 1 + seats.length) % seats.length];
  await t.db.query(`update public.poker_tables set last_bb_seat = $1, next_hand_at = null`, [prev]);
  await t.db.exec(`select public.poker_maybe_start(); select public.poker_snapshot();`);
  return state(t);
}

export async function state(t: TestDb): Promise<State> {
  return (await t.db.query<{ s: State }>(`select state as s from public.poker_tables where id = 1`)).rows[0].s;
}

/** Jogada do fella do lugar `seat`, com o número da mão que está na mesa. */
export async function act(t: TestDb, seat: number, action: string, amount?: number): Promise<State> {
  const h = (await state(t)).hand!;
  await t.as(P[seat]);
  return t.rpc<State>('poker_act', { p_hand: h.id, p_action_no: h.action_no, p_action: action, p_amount: amount ?? null });
}

export async function sit(t: TestDb, seat: number, buyin = 300): Promise<State> {
  await t.as(P[seat]);
  return t.rpc<State>('poker_sit', { p_seat: seat, p_buyin: buyin });
}

export async function stacks(t: TestDb): Promise<Record<number, number>> {
  const rows = (await t.db.query<{ seat: number; stack: number }>(`select seat, stack from public.poker_seats order by seat`)).rows;
  return Object.fromEntries(rows.map((r) => [r.seat, r.stack]));
}

export async function balance(t: TestDb, uid: string): Promise<number | undefined> {
  return (await t.db.query<{ b: number }>(`select balance as b from public.game_wallets where user_id = $1`, [uid])).rows[0]?.b;
}

/** O prazo da vez já passou (o tick seguinte joga por quem está na vez). */
export const expireTurn = (t: TestDb) =>
  t.db.exec(`update public.poker_hands set deadline = now() - interval '1 second' where status = 'betting'`);

/** Relógio como o cron: sem usuário. */
export async function tick(t: TestDb) {
  await t.as(null);
  await t.db.query(`select public.poker_tick()`);
}

/** A pausa entre mãos já passou: o tick começa a próxima. */
export async function nextHand(t: TestDb): Promise<State> {
  await t.db.exec(`update public.poker_tables set next_hand_at = now() - interval '1 second'`);
  await tick(t);
  return state(t);
}
