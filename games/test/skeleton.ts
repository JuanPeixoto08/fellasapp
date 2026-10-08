// O mínimo do Supabase que as migrações dos jogos usam (papéis, auth.uid(), profiles, is_member(), cron).
// Usado pelos testes (PGlite no Node) e pelo modo ?mock do dev (PGlite no navegador).
export const SKELETON = `
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
