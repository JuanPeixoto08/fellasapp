-- fellasapp: notificação da Fellas Inc. "Fulano te contratou como [cargo]" (idle_hired). Idempotente.
-- A função é a da 0021 inteira (mesmo retorno, então create or replace basta) com um bloco a mais no fim do feed.
-- Depende da 0038 (idle_contracts). Fica fora do PGlite dos jogos: a função cita as tabelas de posts e stories.

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

    union all
    -- Fellas Inc.: alguém me contratou (o cargo vai no body; contrato não é apagado, então a notificação fica)
    select 'idle_hired',
           null::uuid,
           null::uuid,
           null::uuid,
           array[c.employer_id],
           1,
           '{}'::text[],
           c.cargo,
           c.created_at
      from public.idle_contracts c
      cross join me
     where c.employee_id = me.uid and c.created_at >= me.since
  )
  select f.kind, f.post_id, f.comment_id, f.story_id, f.actor_ids, f.actor_count, f.emojis, f.body, f.latest_at,
         f.latest_at > me.seen_at as unread
    from feed f
    cross join me
   order by f.latest_at desc
   limit greatest(p_limit, 0);
$$;

revoke all on function public.notifications_feed(integer) from public;
grant execute on function public.notifications_feed(integer) to authenticated;
