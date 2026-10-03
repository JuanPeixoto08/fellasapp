-- fellasapp: reacoes estilo WhatsApp em posts e comentarios
-- 1 reacao por usuario por item (PK alvo+user). Idempotente.

create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comment_reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists post_reactions_user_id_idx    on public.post_reactions (user_id);
create index if not exists comment_reactions_user_id_idx on public.comment_reactions (user_id);

alter table public.post_reactions    enable row level security;
alter table public.comment_reactions enable row level security;

-- post_reactions
drop policy if exists "post_reactions_select_members" on public.post_reactions;
create policy "post_reactions_select_members" on public.post_reactions
  for select to authenticated using (public.is_member());

drop policy if exists "post_reactions_insert_own" on public.post_reactions;
create policy "post_reactions_insert_own" on public.post_reactions
  for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

drop policy if exists "post_reactions_update_own" on public.post_reactions;
create policy "post_reactions_update_own" on public.post_reactions
  for update to authenticated
  using (public.is_member() and user_id = auth.uid())
  with check (public.is_member() and user_id = auth.uid());

drop policy if exists "post_reactions_delete_own" on public.post_reactions;
create policy "post_reactions_delete_own" on public.post_reactions
  for delete to authenticated
  using (public.is_member() and user_id = auth.uid());

-- comment_reactions
drop policy if exists "comment_reactions_select_members" on public.comment_reactions;
create policy "comment_reactions_select_members" on public.comment_reactions
  for select to authenticated using (public.is_member());

drop policy if exists "comment_reactions_insert_own" on public.comment_reactions;
create policy "comment_reactions_insert_own" on public.comment_reactions
  for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

drop policy if exists "comment_reactions_update_own" on public.comment_reactions;
create policy "comment_reactions_update_own" on public.comment_reactions
  for update to authenticated
  using (public.is_member() and user_id = auth.uid())
  with check (public.is_member() and user_id = auth.uid());

drop policy if exists "comment_reactions_delete_own" on public.comment_reactions;
create policy "comment_reactions_delete_own" on public.comment_reactions
  for delete to authenticated
  using (public.is_member() and user_id = auth.uid());
