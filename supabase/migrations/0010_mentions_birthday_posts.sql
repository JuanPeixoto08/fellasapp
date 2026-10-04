-- fellasapp: marcar com @ e parabéns automático. Idempotente.
-- 1) notifications_feed ganha o tipo `mention` (@usuario em post ou comentário de outra pessoa).
--    Comentário no meu post continua `comment`; resposta na conversa que me marca vira `mention`.
-- 2) post_birthday_greetings(): no dia do aniversário (America/Sao_Paulo), cada membro posta
--    "@aniversariante parabéns" no próprio nome; não repete no mesmo dia.
-- 3) pg_cron roda isso todo dia às 00:00 de Brasília (03:00 UTC).

create or replace function public.notifications_feed(p_limit integer default 50)
returns table (
  kind        text,
  post_id     uuid,
  comment_id  uuid,
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
  feed as (
    -- curtidas no meu post, agrupadas por post
    select 'like'::text as kind,
           e.post_id,
           null::uuid as comment_id,
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
    -- aniversário de hoje (29/02 aparece em 28/02 nos anos não bissextos)
    select 'birthday',
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
           array[n.id],
           1,
           '{}'::text[],
           null::text,
           n.created_at
      from public.profiles n
      cross join me
     where n.is_member and n.id <> me.uid and n.created_at >= me.since
  )
  select f.kind, f.post_id, f.comment_id, f.actor_ids, f.actor_count, f.emojis, f.body, f.latest_at,
         f.latest_at > me.seen_at as unread
    from feed f
    cross join me
   order by f.latest_at desc
   limit greatest(p_limit, 0);
$$;

create or replace function public.post_birthday_greetings(
  p_today date default (now() at time zone 'America/Sao_Paulo')::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.posts (author_id, body)
  select f.id, '@' || b.username || ' parabéns'
    from public.profiles b
    join public.profiles f on f.is_member and f.id <> b.id
   where b.is_member
     and b.birthday is not null
     and (
           to_char(b.birthday, 'MM-DD') = to_char(p_today, 'MM-DD')
           or (
                to_char(b.birthday, 'MM-DD') = '02-29'
                and to_char(p_today, 'MM-DD') = '02-28'
                and extract(day from (make_date(extract(year from p_today)::integer, 3, 1) - 1)) = 28
              )
         )
     and not exists (
           select 1
             from public.posts x
            where x.author_id = f.id
              and x.body = '@' || b.username || ' parabéns'
              and (x.created_at at time zone 'America/Sao_Paulo')::date = p_today
         );
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- só o agendador (dono do banco) chama
revoke all on function public.post_birthday_greetings(date) from public;
revoke all on function public.post_birthday_greetings(date) from anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- cron.schedule com nome atualiza o job se ele já existir
select cron.schedule('fellas-parabens', '0 3 * * *', $$select public.post_birthday_greetings()$$);
