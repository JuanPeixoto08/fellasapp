-- fellasapp: #tags em posts. Idempotente.
-- A tag mora no texto do post; o banco tira as tags dele (extract_tags) e guarda em posts.tags (gatilho),
-- com índice para a página da tag. tag_suggestions(prefixo) sugere as que já existem no compositor.
-- Regra (igual à de lib/tags.ts): '#' no começo ou depois de algo que não é letra/número/_/#//,
-- 2 a 30 de [[:alnum:]_] (com acento), sem continuar colado; minúsculas e sem repetir.

create or replace function public.extract_tags(p_body text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct lower(m[1])), '{}')
    from regexp_matches(
           coalesce(p_body, ''),
           '(?:^|[^[:alnum:]_#/])#([[:alnum:]_]{2,30})(?![[:alnum:]_])',
           'g'
         ) as m;
$$;

alter table public.posts add column if not exists tags text[] not null default '{}';

create or replace function public.set_post_tags()
returns trigger
language plpgsql
as $$
begin
  new.tags := public.extract_tags(new.body);
  return new;
end;
$$;

drop trigger if exists posts_set_tags on public.posts;
create trigger posts_set_tags
  before insert or update of body on public.posts
  for each row execute function public.set_post_tags();

-- posts que já existiam
update public.posts
   set tags = public.extract_tags(body)
 where tags is distinct from public.extract_tags(body);

create index if not exists posts_tags_idx on public.posts using gin (tags);

-- security invoker: a RLS de posts (só membros) vale aqui também.
create or replace function public.tag_suggestions(p_prefix text, p_limit integer default 5)
returns table (tag text, posts integer)
language sql
stable
security invoker
set search_path = public
as $$
  select t, count(*)::integer
    from public.posts p, unnest(p.tags) as t
   where t like lower(coalesce(p_prefix, '')) || '%'
   group by t
   order by count(*) desc, t
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.tag_suggestions(text, integer) from public;
grant execute on function public.tag_suggestions(text, integer) to authenticated;
