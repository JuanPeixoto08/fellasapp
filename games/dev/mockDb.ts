// Só no dev (?mock): o banco roda no navegador (PGlite) com as migrações de verdade. Compartilhado pelo Blackjack e
// pelo Poker. Uma chamada por vez (o usuário do teste e o papel mudam por chamada): a fila evita misturar os bots
// com quem está jogando. Nunca entra no build.
import { PGlite } from '@electric-sql/pglite';

import m27 from '../../supabase/migrations/0027_fellas_games.sql?raw';
import m28 from '../../supabase/migrations/0028_blackjack.sql?raw';
import m29 from '../../supabase/migrations/0029_fellas_games_ajustes.sql?raw';
import m30 from '../../supabase/migrations/0030_poker.sql?raw';
import { toGameError } from '../shared/errors';
import { SKELETON } from '../test/skeleton';

export const ME = '00000000-0000-0000-0000-0000000000aa';
export const FRIENDS: [string, string, number][] = [
  ['00000000-0000-0000-0000-0000000000b1', 'Oliveira', 3420],
  ['00000000-0000-0000-0000-0000000000b2', 'Bia', 2180],
  ['00000000-0000-0000-0000-0000000000b3', 'Teteu', 640],
];

export const ready = (async () => {
  const db = new PGlite();
  await db.exec(SKELETON);
  for (const m of [m27, m28, m29, m30]) await db.exec(m);
  await db.query(`insert into public.profiles (id, username, display_name) values ($1, 'eu', 'Você')`, [ME]);
  for (const [id, name, balance] of FRIENDS) {
    await db.query(`insert into public.profiles (id, username, display_name) values ($1, lower($2), $2)`, [id, name]);
    await db.query(
      `insert into public.game_wallets (user_id, balance, week_start, last_played_at) values ($1, $2, public.games_week_start(), now())`,
      [id, balance],
    );
  }
  return db;
})();

let queue: Promise<unknown> = Promise.resolve();

/** Roda `sql` (que devolve uma coluna `v`) como `authenticated`, no papel de `as`. */
export function call<T>(sql: string, params: unknown[] = [], as = ME): Promise<T> {
  const run = queue.then(async () => {
    const db = await ready;
    try {
      await db.query(`select set_config('test.uid', $1, false)`, [as]);
      await db.exec('set role authenticated');
      return (await db.query<{ v: T }>(sql, params)).rows[0]?.v as T;
    } catch (e) {
      throw toGameError(e);
    } finally {
      await db.exec('reset role');
    }
  });
  queue = run.catch(() => undefined);
  return run;
}
