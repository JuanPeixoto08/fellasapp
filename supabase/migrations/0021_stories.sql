-- fellasapp: stories (foto 5 s / vídeo até 15 s) que somem em 1 dia. Idempotente.
-- Arquivos ficam no Cloudinary (plano grátis), enviados direto do app com assinatura da Edge Function
-- stories-media; aqui só as listas e o nome do arquivo (media_id). Story com mais de 24 h não é lido nem
-- antes da limpeza (política de leitura). Arquivos com mais de 24 h somem pela limpeza da função (cron).

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('photo', 'video')),
  media_id    text not null check (media_id ~ '^stories/[0-9a-f]{64}$'),
  duration_ms integer not null check (duration_ms between 1 and 15000),
  created_at  timestamptz not null default now()
);
create index if not exists stories_created_at_idx on public.stories (created_at desc);
-- um arquivo, um story: sem isso dava para apontar um story seu para o arquivo de outro e apagá-lo
create unique index if not exists stories_media_id_key on public.stories (media_id);

create table if not exists public.story_views (
  story_id  uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table if not exists public.story_reactions (
  story_id   uuid not null references public.stories (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.story_reactions enable row level security;

drop policy if exists "stories_select_members" on public.stories;
create policy "stories_select_members" on public.stories
  for select to authenticated using (public.is_member() and created_at > now() - interval '24 hours');
drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own" on public.stories
  for insert to authenticated with check (
    public.is_member()
    and author_id = auth.uid()
    -- story nasce agora: data forjada no futuro faria um story que nunca vence
    and created_at between now() - interval '1 minute' and now() + interval '1 minute'
  );
drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own" on public.stories
  for delete to authenticated using (author_id = auth.uid());

-- quem viu: cada um vê as próprias visualizações; o dono do story vê todas as dele
drop policy if exists "story_views_select" on public.story_views;
create policy "story_views_select" on public.story_views
  for select to authenticated using (
    viewer_id = auth.uid()
    or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid())
  );
drop policy if exists "story_views_insert_own" on public.story_views;
create policy "story_views_insert_own" on public.story_views
  for insert to authenticated with check (public.is_member() and viewer_id = auth.uid());

drop policy if exists "story_reactions_select_members" on public.story_reactions;
create policy "story_reactions_select_members" on public.story_reactions
  for select to authenticated using (public.is_member());
drop policy if exists "story_reactions_insert_own" on public.story_reactions;
create policy "story_reactions_insert_own" on public.story_reactions
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "story_reactions_update_own" on public.story_reactions;
create policy "story_reactions_update_own" on public.story_reactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "story_reactions_delete_own" on public.story_reactions;
create policy "story_reactions_delete_own" on public.story_reactions
  for delete to authenticated using (user_id = auth.uid());

-- tempo real: faixa e notificações
do $$
declare
  t text;
begin
  foreach t in array array['stories', 'story_reactions'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- limpeza de hora em hora (visualizações e reações vão junto)
select cron.schedule('fellas-stories-limpeza', '7 * * * *', $$delete from public.stories where created_at < now() - interval '24 hours'$$);

-- arquivos no Cloudinary: a função stories-media apaga os com mais de 24 h. O segredo fica no Vault
-- (criado por comando, fora do git): select vault.create_secret('<segredo>', 'stories_cron_secret');
create extension if not exists pg_net;
select cron.schedule('fellas-stories-arquivos', '17 * * * *', $$
  select net.http_post(
    url := 'https://xygtrrdliqhwibxalvap.supabase.co/functions/v1/stories-media/cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'stories_cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);

-- notificações: a função ganha a coluna story_id (mudar o retorno exige recriar) e o tipo story_reaction
drop function if exists public.unread_notifications_count();
drop function if exists public.notifications_feed(integer);

create or replace function public.notifications_feed(p_limit integer default 50)
returns table (
  kind        text,
  post_id     uuid,
  comment_id  uuid,
  story_id    uuid,
  actor_ids   uuid[],
  actor_count integer,
  emojis      text[],
  body        text,
  latest_at   timestamptz,
  unread      boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select p.id as uid,
           p.notifications_seen_at as seen_at,
           now() - interval '30 days' as since,
           (now() at time zone 'America/Sao_Paulo')::date as today,
           -- @usuario no texto (usuário só tem [a-z0-9_], seguro dentro da regex)
           '(^|[^a-z0-9_@])@' || p.username || '([^a-z0-9_]|$)' as mention_re
      from public.profiles p
     where p.id = auth.uid() and p.is_member
  ),
  like_ev as (
    select l.post_id, l.user_id, l.created_at
      from public.likes l
      join public.posts po on po.id = l.post_id
      cross join me
     where po.author_id = me.uid and l.user_id <> me.uid and l.created_at >= me.since
  ),
  post_reaction_ev as (
    select r.post_id, r.user_id, r.emoji, r.created_at
      from public.post_reactions r
      join public.posts po on po.id = r.post_id
      cross join me
     where po.author_id = me.uid and r.user_id <> me.uid and r.created_at >= me.since
  ),
  comment_reaction_ev as (
    select c.post_id, r.comment_id, r.user_id, r.emoji, r.created_at
      from public.comment_reactions r
      join public.comments c on c.id = r.comment_id
      cross join me
     where c.author_id = me.uid and r.user_id <> me.uid and r.created_at >= me.since
  ),
  story_reaction_ev as (
    select r.story_id, r.user_id, r.emoji, r.created_at
      from public.story_reactions r
      join public.stories s on s.id = r.story_id
      cross join me
     where s.author_id = me.uid
       and r.user_id <> me.uid
       and s.created_at > now() - interval '24 hours'
  ),
  feed as (
    -- curtidas no meu post, agrupadas por post
    select 'like'::text as kind,
           e.post_id,
           null::uuid as comment_id,
           null::uuid as story_id,
           (array_agg(e.user_id order by e.created_at desc))[1:3] as actor_ids,
           count(*)::integer as actor_count,
           '{}'::text[] as emojis,
           null::text as body,
           max(e.created_at) as latest_at
      from like_ev e
     group by e.post_id

    union all
    -- reações no meu post, agrupadas por post; até 3 emojis distintos, o mais recente primeiro
    select 'post_reaction',
           e.post_id,
           null::uuid,
           null::uuid,
           (array_agg(e.user_id order by e.created_at desc))[1:3],
           count(*)::integer,
           (select (array_agg(x.emoji order by x.at desc))[1:3]
              from (select e2.emoji, max(e2.created_at) as at
                      from post_reaction_ev e2
                     where e2.post_id = e.post_id
                     group by e2.emoji) x),
           null::text,
           max(e.created_at)
      from post_reaction_ev e
     group by e.post_id

    union all
    -- reações no meu comentário, agrupadas por comentário
    select 'comment_reaction',
           e.post_id,
           e.comment_id,
           null::uuid,
           (array_agg(e.user_id order by e.created_at desc))[1:3],
           count(*)::integer,
           (select (array_agg(x.emoji order by x.at desc))[1:3]
              from (select e2.emoji, max(e2.created_at) as at
                      from comment_reaction_ev e2
                     where e2.comment_id = e.comment_id
                     group by e2.emoji) x),
           null::text,
           max(e.created_at)
      from comment_reaction_ev e
     group by e.post_id, e.comment_id

    union all
    -- comentário de outra pessoa no meu post (um por linha)
    select 'comment',
           c.post_id,
           c.id,
           null::uuid,
           array[c.author_id],
           1,
           '{}'::text[],
           c.body,
           c.created_at
      from public.comments c
      join public.posts po on po.id = c.post_id
      cross join me
     where po.author_id = me.uid and c.author_id <> me.uid and c.created_at >= me.since

    union all
    -- resposta na conversa: post de outra pessoa em que eu comentei antes
    select 'thread_reply',
           c.post_id,
           c.id,
           null::uuid,
           array[c.author_id],
           1,
           '{}'::text[],
           c.body,
           c.created_at
      from public.comments c
      join public.posts po on po.id = c.post_id
      cross join me
     where po.author_id <> me.uid
       and c.author_id <> me.uid
       and c.created_at >= me.since
       and c.body !~* me.mention_re -- quem me marca vira "te marcou"
       and exists (
             select 1
               from public.comments mine
              where mine.post_id = c.post_id
                and mine.author_id = me.uid
                and mine.created_at < c.created_at
           )

    union all
    -- me marcaram num post de outra pessoa
    select 'mention',
           p.id,
           null::uuid,
           null::uuid,
           array[p.author_id],
           1,
           '{}'::text[],
           p.body,
           p.created_at
      from public.posts p
      cross join me
     where p.author_id <> me.uid and p.created_at >= me.since and p.body ~* me.mention_re

    union all
    -- me marcaram num comentário (no meu post já vira "comentou")
    select 'mention',
           c.post_id,
           c.id,
           null::uuid,
           array[c.author_id],
           1,
           '{}'::text[],
           c.body,
           c.created_at
      from public.comments c
      join public.posts po on po.id = c.post_id
      cross join me
     where c.author_id <> me.uid
       and po.author_id <> me.uid
       and c.created_at >= me.since
       and c.body ~* me.mention_re

    union all
    -- reações no meu story ativo, agrupadas por story
    select 'story_reaction',
           null::uuid,
           null::uuid,
           e.story_id,
           (array_agg(e.user_id order by e.created_at desc))[1:3],
           count(*)::integer,
           (select (array_agg(x.emoji order by x.at desc))[1:3]
              from (select e2.emoji, max(e2.created_at) as at
                      from story_reaction_ev e2
                     where e2.story_id = e.story_id
                     group by e2.emoji) x),
           null::text,
           max(e.created_at)
      from story_reaction_ev e
     group by e.story_id

    union all
    -- aniversário de hoje (29/02 aparece em 28/02 nos anos não bissextos)
    select 'birthday',
           null::uuid,
           null::uuid,
           null::uuid,
           array[b.id],
           1,
           '{}'::text[],
           null::text,
           (me.today::timestamp at time zone 'America/Sao_Paulo')
      from public.profiles b
      cross join me
     where b.is_member
       and b.id <> me.uid
       and b.birthday is not null
       and (
             to_char(b.birthday, 'MM-DD') = to_char(me.today, 'MM-DD')
             or (
                  to_char(b.birthday, 'MM-DD') = '02-29'
                  and to_char(me.today, 'MM-DD') = '02-28'
                  and extract(day from (make_date(extract(year from me.today)::integer, 3, 1) - 1)) = 28
                )
           )

    union all
    -- fella novo
    select 'new_member',
           null::uuid,
           null::uuid,
           null::uuid,
           array[n.id],
           1,
           '{}'::text[],
           null::text,
           n.created_at
      from public.profiles n
      cross join me
     where n.is_member and n.id <> me.uid and n.created_at >= me.since
  )
  select f.kind, f.post_id, f.comment_id, f.story_id, f.actor_ids, f.actor_count, f.emojis, f.body, f.latest_at,
         f.latest_at > me.seen_at as unread
    from feed f
    cross join me
   order by f.latest_at desc
   limit greatest(p_limit, 0);
$$;

create or replace function public.unread_notifications_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer from public.notifications_feed(50) f where f.unread;
$$;

revoke all on function public.notifications_feed(integer) from public;
revoke all on function public.unread_notifications_count() from public;
grant execute on function public.notifications_feed(integer) to authenticated;
grant execute on function public.unread_notifications_count() to authenticated;
