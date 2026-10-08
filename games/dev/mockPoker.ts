// Só no dev (?mock): o poker no PGlite do navegador (migrações de verdade) com 3 fellas de mentira sentados que
// jogam sozinhos, e o "tempo real" é um aviso local depois de cada mudança. Mesmas funções que poker/main.ts usa.
import type { BoardRow, Fella, PokerAction, PokerCards, PokerHistoryRow, PokerState, Wallet } from '../shared/types';
import { call, FRIENDS, ME, ready } from './mockDb';

const BOTS = FRIENDS.map(([id]) => id);
const listeners = new Set<(s: PokerState) => void>();

async function emit() {
  const s = await call<PokerState>('select public.poker_state() as v');
  for (const fn of listeners) fn(s);
}
async function change<T>(sql: string, params: unknown[] = []): Promise<T> {
  const v = await call<T>(sql, params);
  void emit();
  return v;
}

export const hasSession = async () => true;
export const myId = async () => ME;
export const gamesWallet = () => call<Wallet>('select public.games_wallet() as v');
export const pokerState = () => call<PokerState>('select public.poker_state() as v');
export const pokerMyCards = () => call<PokerCards>('select public.poker_my_cards() as v');
export const pokerHistory = () => call<PokerHistoryRow[]>('select public.poker_history() as v');
export const pokerSit = (seat: number, buyin: number) => change<PokerState>('select public.poker_sit($1, $2) as v', [seat, buyin]);
export const pokerAct = (hand: string, actionNo: number, action: PokerAction, amount?: number) =>
  change<PokerState>('select public.poker_act($1, $2, $3, $4) as v', [hand, actionNo, action, amount ?? null]);
export const pokerRebuy = (amount: number) => change<PokerState>('select public.poker_rebuy($1) as v', [amount]);
export const pokerLeave = () => change<PokerState>('select public.poker_leave() as v');
export const pokerBack = () => change<PokerState>('select public.poker_back() as v');
export const pokerShow = () => change<PokerState>('select public.poker_show() as v');
export const pokerTick = () => change<PokerState | null>('select public.poker_tick() as v');

export async function fellas(ids: string[]): Promise<Fella[]> {
  const rows = await call<{ id: string; name: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name)), '[]') as v
       from public.profiles where id = any($1::uuid[])`,
    [`{${ids.join(',')}}`],
  );
  return rows.map((r) => ({ ...r, avatarUrl: null }));
}

export async function weekBoard(): Promise<BoardRow[]> {
  const rows = await call<{ user_id: string; balance: number }[]>('select public.games_board() as v');
  const names = await fellas(rows.map((r) => r.user_id));
  return rows.slice(0, 6).map((r) => ({ userId: r.user_id, balance: r.balance, name: names.find((n) => n.id === r.user_id)?.name ?? 'Alguém' }));
}

export function watchTable(onState: (s: PokerState) => void, onLive: (live: boolean) => void) {
  listeners.add(onState);
  onLive(true);
  return { stop: () => void listeners.delete(onState) };
}

// bots: sentam nos lugares 1, 3 e 4 e jogam quando é a vez deles; o relógio roda como o cron
async function botTurn() {
  await call('select public.poker_tick() as v', [], BOTS[0]).catch(() => null);
  const s = await call<PokerState>('select public.poker_state() as v', [], BOTS[0]);
  const h = s.hand;
  if (h?.status === 'betting' && h.to_act !== null) {
    const p = h.players[String(h.to_act)];
    if (BOTS.includes(p.user_id)) {
      const facing = h.current_bet > p.bet;
      const x = Math.random();
      const safe = facing ? 'call' : 'check';
      const [action, amount] = x < 0.12 && facing ? ['fold', null] : x < 0.85 ? [safe, null] : ['raise', h.min_raise_to];
      await call('select public.poker_act($1, $2, $3, $4) as v', [h.id, h.action_no, action, amount], p.user_id).catch(() =>
        call('select public.poker_act($1, $2, $3, null) as v', [h.id, h.action_no, safe], p.user_id).catch(() => null),
      );
    }
  }
  await emit();
}

void (async () => {
  await ready;
  for (const [i, id] of BOTS.entries()) {
    await call('select public.poker_sit($1, 300) as v', [[1, 3, 4][i]], id).catch(() => null);
  }
  await emit();
  setInterval(() => void botTurn(), 1500);
})();

// console do dev: __rigPoker([0, 13, ...]) faz o próximo baralho começar com essas cartas
(window as unknown as { __rigPoker: (cards: number[]) => Promise<void> }).__rigPoker = async (cards) => {
  const db = await ready;
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !cards.includes(c));
  await db.exec(`create or replace function public.poker_shuffle() returns smallint[] language sql volatile as
    $$ select array[${[...cards, ...rest].map(Number).join(',')}]::smallint[] $$`);
};
