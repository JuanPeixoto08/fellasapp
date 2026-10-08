// Postgres de verdade (PGlite) com o mínimo do Supabase que as migrações dos jogos usam.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const MIGRATIONS: string[] = ['0027_fellas_games.sql'];

const SKELETON = `
create role anon nologin; create role authenticated nologin;
grant usage on schema public to anon, authenticated;
create schema auth; grant usage on schema auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create table public.profiles (
  id uuid primary key, username text, display_name text, is_member boolean not null default true,
  badges text[] not null default '{}', featured_badge text);
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (true);
grant select on public.profiles to authenticated;
create function public.is_member() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce((select is_member from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.is_member() to anon, authenticated;
create schema cron;
create table cron.jobs (name text primary key, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as
  $$ insert into cron.jobs values (n, s, c) on conflict (name) do update set schedule = s, command = c; select 1::bigint $$;
`;

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
