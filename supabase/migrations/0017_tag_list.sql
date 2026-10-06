-- fellasapp: tela Tags (lista de todas). Idempotente.
-- A lista usa a mesma tag_suggestions do compositor com prefixo vazio; o teto sobe de 20 para 200
-- (as sugestões do compositor continuam pedindo 5).

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
   limit least(greatest(coalesce(p_limit, 5), 1), 200);
$$;
