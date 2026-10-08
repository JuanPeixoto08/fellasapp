// Só no dev (?mock): o Blackjack contra as migrações rodando no navegador (dev/mockDb.ts). Mesmas funções e
// formatos de shared/api.ts. Nunca entra no build.
import type { Action, BoardRow, RoundState, Wallet } from '../shared/types';
import { call, ME, ready } from './mockDb';

export const gamesWallet = () => call<Wallet>('select public.games_wallet() as v');
export const gamesFiado = () => call<Wallet>('select public.games_fiado() as v');
export const bjDeal = (bet: number) => call<RoundState>('select public.bj_deal($1) as v', [bet]);
export const bjAct = (id: string, action: Action) => call<RoundState>('select public.bj_act($1, $2) as v', [id, action]);
export const bjCurrent = () => call<RoundState | null>('select public.bj_current() as v');
export const hasSession = async () => true;
export const myId = async () => ME;

export async function weekBoard(): Promise<BoardRow[]> {
  const rows = await call<{ user_id: string; balance: number }[]>('select public.games_board() as v');
  const names = await call<{ id: string; name: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name)), '[]') as v from public.profiles`,
  );
  return rows
    .slice(0, 6)
    .map((r) => ({ userId: r.user_id, balance: r.balance, name: names.find((n) => n.id === r.user_id)?.name ?? 'Alguém' }));
}

// console do dev: __rig([8, 12, 47, 32, ...]) faz o próximo sapato começar com essas cartas (ordem de distribuição)
(window as unknown as { __rig: (cards: number[]) => Promise<void> }).__rig = async (cards) => {
  const db = await ready;
  await db.exec(`create or replace function public.bj_shuffle() returns smallint[] language sql volatile as
    $$ select array[${cards.map(Number).join(',')}]::smallint[] || array_fill(1::smallint, array[300]) $$`);
};
