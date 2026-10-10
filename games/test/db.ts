// Postgres de verdade (PGlite) com o mínimo do Supabase que as migrações dos jogos usam.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SKELETON } from './skeleton';

export const MIGRATIONS: string[] = [
  '0027_fellas_games.sql',
  '0028_blackjack.sql',
  '0029_fellas_games_ajustes.sql',
  '0030_poker.sql',
  '0031_poker_safeupdate.sql',
  '0033_fellas_inc_catalogo.sql',
  '0034_fellas_inc.sql',
  '0035_fellas_inc_placar_taxa.sql',
  '0036_fellas_inc_sem_reset.sql',
  '0037_fellas_inc_catalogo_gente.sql',
];

export type TestDb = Awaited<ReturnType<typeof freshDb>>;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SKELETON);
  for (const name of MIGRATIONS) {
    await db.exec(readFileSync(resolve(__dirname, '../../supabase/migrations', name), 'utf8'));
  }
  const t = {
    db,
    async as(uid: string | null) {
      await db.query(`select set_config('test.uid', $1, false)`, [uid ?? '']);
    },
    async member(uid: string, opts: { username?: string; isMember?: boolean } = {}) {
      await db.query(
        `insert into public.profiles (id, username, display_name, is_member) values ($1, $2, $2, $3)`,
        [uid, opts.username ?? uid.slice(-4), opts.isMember ?? true],
      );
    },
    /** Chama a função como `authenticated` (o papel do app), devolvendo o jsonb/escalar. */
    async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      const names = Object.keys(args);
      const call = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as v`;
      const rows = await t.asRole<{ v: T }>('authenticated', call, Object.values(args));
      return rows[0].v;
    },
    async asRole<T>(role: 'authenticated' | 'anon', sql: string, params: unknown[] = []): Promise<T[]> {
      await db.exec(`set role ${role}`);
      try {
        return (await db.query<T>(sql, params)).rows;
      } finally {
        await db.exec('reset role');
      }
    },
  };
  return t;
}
