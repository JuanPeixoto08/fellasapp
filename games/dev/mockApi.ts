// Só no dev (?mock): o banco roda no navegador (PGlite) com as migrações de verdade, para ver a mesa jogando
// antes de a migração estar no Supabase. Mesmas funções e formatos de shared/api.ts. Nunca entra no build.
import { PGlite } from '@electric-sql/pglite';

import m27 from '../../supabase/migrations/0027_fellas_games.sql?raw';
import m28 from '../../supabase/migrations/0028_blackjack.sql?raw';
import { toGameError } from '../shared/errors';
import type { Action, BoardRow, RoundState, Wallet } from '../shared/types';
import { SKELETON } from '../test/skeleton';

const ME = '00000000-0000-0000-0000-0000000000aa';
const FRIENDS: [string, string, number][] = [
  ['00000000-0000-0000-0000-0000000000b1', 'Oliveira', 3420],
  ['00000000-0000-0000-0000-0000000000b2', 'Bia', 2180],
  ['00000000-0000-0000-0000-0000000000b3', 'Teteu', 640],
];

const ready = (async () => {
  const db = new PGlite();
  await db.exec(SKELETON);
  await db.exec(m27);
  await db.exec(m28);
  await db.query(`insert into public.profiles (id, username, display_name) values ($1, 'eu', 'Você')`, [ME]);
  for (const [id, name, balance] of FRIENDS) {
    await db.query(`insert into public.profiles (id, username, display_name) values ($1, lower($2), $2)`, [id, name]);
    await db.query(
      `insert into public.game_wallets (user_id, balance, week_start, last_played_at) values ($1, $2, public.games_week_start(), now())`,
      [id, balance],
    );
  }
  await db.query(`select set_config('test.uid', $1, false)`, [ME]);
  return db;
})();

async function call<T>(sql: string, params: unknown[] = []): Promise<T> {
  const db = await ready;
  try {
    await db.exec('set role authenticated');
    return (await db.query<{ v: T }>(sql, params)).rows[0]?.v as T;
  } catch (e) {
    throw toGameError(e);
  } finally {
    await db.exec('reset role');
  }
}

export const gamesWallet = () => call<Wallet>('select public.games_wallet() as v');
export const gamesFiado = () => call<Wallet>('select public.games_fiado() as v');
export const bjDeal = (bet: number) => call<RoundState>('select public.bj_deal($1) as v', [bet]);
export const bjAct = (id: string, action: Action) => call<RoundState>('select public.bj_act($1, $2) as v', [id, action]);
export const bjCurrent = () => call<RoundState | null>('select public.bj_current() as v');
export const hasSession = async () => true;
export const myId = async () => ME;

export async function weekBoard(): Promise<BoardRow[]> {
  const rows = await call<{ userId: string; name: string; balance: number }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('userId', w.user_id, 'name', p.display_name, 'balance', w.balance)
       order by w.balance desc, w.fiado_count asc, w.last_played_at asc), '[]') as v
       from public.game_wallets w join public.profiles p on p.id = w.user_id
      where w.last_played_at is not null`,
  );
  return rows.slice(0, 6);
}

// console do dev: __rig([8, 12, 47, 32, ...]) faz o próximo sapato começar com essas cartas (ordem de distribuição)
(window as unknown as { __rig: (cards: number[]) => Promise<void> }).__rig = async (cards) => {
  const db = await ready;
  await db.exec(`create or replace function public.bj_shuffle() returns smallint[] language sql volatile as
    $$ select array[${cards.map(Number).join(',')}]::smallint[] || array_fill(1::smallint, array[300]) $$`);
};
