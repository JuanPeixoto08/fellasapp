-- fellasapp: enquetes nos posts (2 a 4 opções de texto, prazo de 5 min a 7 dias). Idempotente.
-- A enquete mora no post (sai junto ao apagar e chega pelo mesmo tempo real). Votos anônimos e definitivos:
-- cada um lê só o próprio voto; as contagens ficam em posts.poll_counts, mantidas só pelo banco.

alter table public.posts add column if not exists poll_options text[];
alter table public.posts add column if not exists poll_ends_at timestamptz;
alter table public.posts add column if not exists poll_counts int[];

-- cada opção com 1 a 25 caracteres (sem contar espaços nas pontas)
create or replace function public.poll_options_ok(p_options text[])
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(o is not null and char_length(btrim(o)) between 1 and 25), false)
  from unnest(p_options) as o;
$$;

alter table public.posts drop constraint if exists posts_poll_shape;
alter table public.posts add constraint posts_poll_shape check (
  (poll_options is null and poll_ends_at is null and poll_counts is null)
  or (
    poll_options is not null and poll_ends_at is not null
    and cardinality(poll_options) between 2 and 4
    and public.poll_options_ok(poll_options)
  )
);

-- enquete é com pergunta e sem fotos
alter table public.posts drop constraint if exists posts_poll_text_only;
alter table public.posts add constraint posts_poll_text_only check (
  poll_options is null
  or (char_length(btrim(body)) > 0 and image_url is null and cardinality(images) = 0)
);

-- ao postar: prazo entre 5 min e 7 dias (2 min de folga para o relógio do aparelho) e contagens zeradas
create or replace function public.posts_poll_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.poll_options is null then
    new.poll_counts := null;
    return new;
  end if;
  if new.poll_ends_at < now() + interval '3 minutes'
     or new.poll_ends_at > now() + interval '7 days 2 minutes' then
    raise exception 'poll_bad_duration' using errcode = 'check_violation';
  end if;
  new.poll_counts := array_fill(0, array[cardinality(new.poll_options)]);
  return new;
end;
$$;

drop trigger if exists posts_poll_insert on public.posts;
create trigger posts_poll_insert
  before insert on public.posts
  for each row execute function public.posts_poll_on_insert();

-- depois de postar: opções e prazo não mudam; contagens só pelo gatilho dos votos
create or replace function public.posts_poll_on_update()
returns trigger
language plpgsql
as $$
begin
  if new.poll_options is distinct from old.poll_options or new.poll_ends_at is distinct from old.poll_ends_at then
    raise exception 'poll_locked' using errcode = 'check_violation';
  end if;
  if new.poll_counts is distinct from old.poll_counts
     and coalesce(current_setting('fellas.poll_vote', true), '') <> 'on' then
    raise exception 'poll_locked' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_poll_update on public.posts;
create trigger posts_poll_update
  before update on public.posts
  for each row execute function public.posts_poll_on_update();

-- votos: um por pessoa por enquete
create table if not exists public.poll_votes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  option     smallint not null check (option between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists poll_votes_user_id_idx on public.poll_votes (user_id);

alter table public.poll_votes enable row level security;

-- anônimo: cada um lê só o próprio voto
drop policy if exists "poll_votes_select_own" on public.poll_votes;
create policy "poll_votes_select_own" on public.poll_votes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "poll_votes_insert_own" on public.poll_votes;
create policy "poll_votes_insert_own" on public.poll_votes
  for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());
-- sem update nem delete: voto é definitivo

-- antes de votar: o post tem enquete, ela está aberta e a opção existe
create or replace function public.poll_votes_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_options text[];
  v_ends timestamptz;
begin
  select poll_options, poll_ends_at into v_options, v_ends from public.posts where id = new.post_id;
  if v_options is null then
    raise exception 'poll_invalid_option' using errcode = 'check_violation';
  end if;
  if v_ends <= now() then
    raise exception 'poll_closed' using errcode = 'check_violation';
  end if;
  if new.option >= cardinality(v_options) then
    raise exception 'poll_invalid_option' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists poll_votes_before_insert on public.poll_votes;
create trigger poll_votes_before_insert
  before insert on public.poll_votes
  for each row execute function public.poll_votes_check();

-- depois de votar: soma na contagem do post (o UPDATE em posts chega a todos pelo tempo real)
create or replace function public.poll_votes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('fellas.poll_vote', 'on', true);
  update public.posts
     set poll_counts[new.option + 1] = poll_counts[new.option + 1] + 1
   where id = new.post_id;
  perform set_config('fellas.poll_vote', 'off', true);
  return new;
end;
$$;

drop trigger if exists poll_votes_after_insert on public.poll_votes;
create trigger poll_votes_after_insert
  after insert on public.poll_votes
  for each row execute function public.poll_votes_count();
