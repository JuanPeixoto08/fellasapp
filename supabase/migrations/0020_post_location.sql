-- fellasapp: local nos posts. Idempotente.
-- O local é texto livre (posts.location). O banco limpa (pontas e espaços repetidos) e grava a chave
-- posts.place_key (minúsculas, sem acento) por gatilho: "Bar do Zé" e "bar do ze" são o mesmo lugar.
-- Regras iguais às de lib/places.ts (a tabela de acentos do translate também; um teste confere).
-- place_suggestions(prefixo) sugere no compositor os locais já usados.

create or replace function public.clean_place(p text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), '');
$$;

create or replace function public.place_key(p text)
returns text
language sql
immutable
as $$
  select translate(lower(public.clean_place(p)), 'áàâãäåāéèêëēíìîïīóòôõöōúùûüūçñý', 'aaaaaaaeeeeeiiiiioooooouuuuucny');
$$;

alter table public.posts add column if not exists location text;
alter table public.posts add column if not exists place_key text;

alter table public.posts drop constraint if exists posts_location_len;
alter table public.posts add constraint posts_location_len
  check (location is null or char_length(location) between 1 and 60);

create or replace function public.set_post_place()
returns trigger
language plpgsql
as $$
begin
  new.location := public.clean_place(new.location);
  new.place_key := public.place_key(new.location);
  return new;
end;
$$;

-- em qualquer update (não só do local): assim ninguém grava posts.place_key direto pela API
drop trigger if exists posts_set_place on public.posts;
create trigger posts_set_place
  before insert or update on public.posts
  for each row execute function public.set_post_place();

create index if not exists posts_place_key_idx on public.posts (place_key) where place_key is not null;

-- security invoker: a RLS de posts (só membros) vale aqui também.
-- name = a grafia mais usada da chave (empate: a mais recente). % e _ digitados não são curinga.
create or replace function public.place_suggestions(p_prefix text, p_limit integer default 5)
returns table (key text, name text, posts integer)
language sql
stable
security invoker
set search_path = public
as $$
  with spellings as (
    select p.place_key as k, p.location as n, count(*) as c, max(p.created_at) as last_at
      from public.posts p
     where p.place_key is not null
       and p.place_key like replace(replace(replace(coalesce(public.place_key(p_prefix), ''),
             '\', '\\'), '%', '\%'), '_', '\_') || '%'
     group by p.place_key, p.location
  )
  select k, (array_agg(n order by c desc, last_at desc))[1], sum(c)::integer
    from spellings
   group by k
   order by sum(c) desc, k
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.place_suggestions(text, integer) from public;
grant execute on function public.place_suggestions(text, integer) to authenticated;
