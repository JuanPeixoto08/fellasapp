-- fellasapp: mural de ideias (voto ↑/↓ estilo Reddit). Idempotente. Depende da 0012 (is_admin).
-- ideas: texto curto de um fella. idea_votes: um voto por pessoa por ideia (+1 ou -1); trocar o voto
-- atualiza a linha, tirar apaga. ideas_feed(sort) devolve as ideias já com pontuação e o meu voto.

create table if not exists public.ideas (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create table if not exists public.idea_votes (
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create index if not exists ideas_created_at_idx   on public.ideas (created_at desc);
create index if not exists idea_votes_user_id_idx on public.idea_votes (user_id);

alter table public.ideas      enable row level security;
alter table public.idea_votes enable row level security;

-- ideas: membros leem; cada um manda em nome próprio; autor ou admin apaga; ninguém edita.
drop policy if exists "ideas_select_members" on public.ideas;
create policy "ideas_select_members" on public.ideas
  for select to authenticated using (public.is_member());

drop policy if exists "ideas_insert_own" on public.ideas;
create policy "ideas_insert_own" on public.ideas
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_member());

drop policy if exists "ideas_delete_own_or_admin" on public.ideas;
create policy "ideas_delete_own_or_admin" on public.ideas
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

revoke update on public.ideas from anon, authenticated;

-- idea_votes: membros leem; cada um só mexe no próprio voto (insert/upsert, update, delete).
drop policy if exists "idea_votes_select_members" on public.idea_votes;
create policy "idea_votes_select_members" on public.idea_votes
  for select to authenticated using (public.is_member());

drop policy if exists "idea_votes_insert_own" on public.idea_votes;
create policy "idea_votes_insert_own" on public.idea_votes
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());

drop policy if exists "idea_votes_update_own" on public.idea_votes;
create policy "idea_votes_update_own" on public.idea_votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member());

drop policy if exists "idea_votes_delete_own" on public.idea_votes;
create policy "idea_votes_delete_own" on public.idea_votes
  for delete to authenticated
  using (user_id = auth.uid());

-- security invoker: as políticas acima valem (não-membro recebe lista vazia).
-- p_sort diferente de 'new' cai em 'top'.
create or replace function public.ideas_feed(p_sort text default 'top')
returns table (
  id         uuid,
  author_id  uuid,
  body       text,
  created_at timestamptz,
  score      integer,
  my_vote    smallint
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.id,
         i.author_id,
         i.body,
         i.created_at,
         coalesce(sum(v.value), 0)::integer as score,
         max(case when v.user_id = auth.uid() then v.value end)::smallint as my_vote
    from public.ideas i
    left join public.idea_votes v on v.idea_id = i.id
   group by i.id
   order by case when p_sort = 'new' then null else coalesce(sum(v.value), 0) end desc nulls last,
            i.created_at desc
   limit 100;
$$;

revoke all on function public.ideas_feed(text) from public;
grant execute on function public.ideas_feed(text) to authenticated;

-- tempo real: mesma publicação da 0009
do $$
declare
  t text;
begin
  foreach t in array array['ideas', 'idea_votes'] loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
