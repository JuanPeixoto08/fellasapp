-- fellasapp: schema inicial (grupo fechado de amigos)
-- Idempotente onde razoavel: pode ser reaplicada no SQL editor.

-- ---------------------------------------------------------------- tabelas

create table if not exists public.allowed_emails (
  email      text primary key check (email = lower(email)),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text,
  avatar_url   text,
  bio          text,
  is_member    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 2000),
  image_url  text,
  created_at timestamptz not null default now(),
  check (char_length(body) > 0 or image_url is not null)
);

create table if not exists public.likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx   on public.posts (created_at desc);
create index if not exists posts_author_id_idx    on public.posts (author_id);
create index if not exists likes_user_id_idx      on public.likes (user_id);
create index if not exists comments_post_id_idx   on public.comments (post_id, created_at);
create index if not exists comments_author_id_idx on public.comments (author_id);

-- ---------------------------------------------------------------- funcoes

-- Membro = usuario logado cujo profile tem is_member = true.
-- security definer para evitar recursao de RLS em profiles.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_member from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- Novo usuario no auth -> cria profile; is_member vem de allowed_emails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  final_name text;
begin
  base_name := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  if char_length(base_name) < 3 then
    base_name := 'user';
  end if;
  base_name := left(base_name, 22);
  final_name := base_name;
  -- garante unicidade com sufixo aleatorio
  while exists (select 1 from public.profiles where username = final_name) loop
    final_name := base_name || '_' || substr(md5(random()::text), 1, 6);
  end loop;

  insert into public.profiles (id, username, display_name, is_member)
  values (
    new.id,
    final_name,
    split_part(new.email, '@', 1),
    exists (select 1 from public.allowed_emails a where a.email = lower(new.email))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Convite adicionado depois do cadastro -> promove profile existente.
create or replace function public.handle_new_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
     set is_member = true
    from auth.users u
   where u.id = p.id and lower(u.email) = new.email;
  return new;
end;
$$;

drop trigger if exists on_allowed_email_created on public.allowed_emails;
create trigger on_allowed_email_created
  after insert on public.allowed_emails
  for each row execute function public.handle_new_invite();

-- ---------------------------------------------------------------- RLS

alter table public.allowed_emails enable row level security;
alter table public.profiles       enable row level security;
alter table public.posts          enable row level security;
alter table public.likes          enable row level security;
alter table public.comments       enable row level security;

-- allowed_emails: so leitura para membros (escrita via service role / SQL editor)
drop policy if exists "allowed_emails_select_members" on public.allowed_emails;
create policy "allowed_emails_select_members" on public.allowed_emails
  for select to authenticated using (public.is_member());

-- profiles: membros leem todos; qualquer um le o proprio (gate de convite)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_member());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Usuario nao pode se auto-promover: so estas colunas sao editaveis.
-- (insert/delete de profiles: apenas via trigger / cascade de auth.users)
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url, bio) on public.profiles to authenticated;

-- posts
drop policy if exists "posts_select_members" on public.posts;
create policy "posts_select_members" on public.posts
  for select to authenticated using (public.is_member());

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts
  for insert to authenticated
  with check (public.is_member() and author_id = auth.uid());

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts
  for update to authenticated
  using (public.is_member() and author_id = auth.uid())
  with check (public.is_member() and author_id = auth.uid());

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts
  for delete to authenticated
  using (public.is_member() and author_id = auth.uid());

-- likes (sem update: curtir/descurtir = insert/delete)
drop policy if exists "likes_select_members" on public.likes;
create policy "likes_select_members" on public.likes
  for select to authenticated using (public.is_member());

drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own" on public.likes
  for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own" on public.likes
  for delete to authenticated
  using (public.is_member() and user_id = auth.uid());

-- comments
drop policy if exists "comments_select_members" on public.comments;
create policy "comments_select_members" on public.comments
  for select to authenticated using (public.is_member());

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (public.is_member() and author_id = auth.uid());

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update to authenticated
  using (public.is_member() and author_id = auth.uid())
  with check (public.is_member() and author_id = auth.uid());

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete to authenticated
  using (public.is_member() and author_id = auth.uid());

-- ---------------------------------------------------------------- storage

-- Bucket privado: so membros leem (use createSignedUrl). Arquivos em
-- <user_id>/<arquivo>. Para URLs publicas, mude para public = true.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "post_images_select_members" on storage.objects;
create policy "post_images_select_members" on storage.objects
  for select to authenticated
  using (bucket_id = 'post-images' and public.is_member());

drop policy if exists "post_images_insert_own" on storage.objects;
create policy "post_images_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and public.is_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "post_images_update_own" on storage.objects;
create policy "post_images_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-images' and owner = auth.uid());

drop policy if exists "post_images_delete_own" on storage.objects;
create policy "post_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and owner = auth.uid());
