-- fellasapp: ingresso no post — a sua review do Letterboxd ou a música do Last.fm, congelada. Idempotente.
-- O app escreve o post (RLS), então o banco confere o anexo: chaves fixas, tamanhos, só links e imagens do
-- Last.fm / Letterboxd (nada de imagem rastreadora nem javascript:), e ele não muda depois de postar.

-- usuário do Letterboxd no perfil (a função letterboxd-reviews lê o feed público dele)
alter table public.profiles add column if not exists letterboxd_user text
  check (letterboxd_user is null or letterboxd_user ~ '^[A-Za-z0-9_]{2,15}$');
grant update (letterboxd_user) on public.profiles to authenticated;

alter table public.posts add column if not exists media jsonb;

-- regras do anexo (as mesmas de lib/postMedia.ts). CASE garante a ordem: nada é convertido sem conferir o tipo.
create or replace function public.post_media_ok(m jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when m is null or jsonb_typeof(m) <> 'object' or pg_column_size(m) > 8192 then false
    when m->>'kind' = 'track' then
      (select array_agg(k order by k) from jsonb_object_keys(m) as k)
        = array['album', 'artist', 'image', 'kind', 'live', 'title', 'url']
      and jsonb_typeof(m->'title') = 'string' and char_length(m->>'title') between 1 and 200
      and jsonb_typeof(m->'artist') = 'string' and char_length(m->>'artist') between 1 and 200
      and case jsonb_typeof(m->'album') when 'null' then true
            when 'string' then char_length(m->>'album') between 1 and 200 else false end
      and jsonb_typeof(m->'url') = 'string' and (m->>'url') ~* '^https://(www\.)?last\.fm/'
      and case jsonb_typeof(m->'image') when 'null' then true
            when 'string' then (m->>'image') ~* '^https://lastfm-img\.freetls\.fastly\.net/' else false end
      and jsonb_typeof(m->'live') = 'boolean'
    when m->>'kind' = 'review' then
      (select array_agg(k order by k) from jsonb_object_keys(m) as k)
        = array['kind', 'liked', 'poster', 'rating', 'rewatch', 'spoiler', 'text', 'title', 'url', 'watched', 'year']
      and jsonb_typeof(m->'title') = 'string' and char_length(m->>'title') between 1 and 200
      and case jsonb_typeof(m->'year') when 'null' then true
            when 'number' then (m->>'year')::numeric between 1870 and 2100
                               and (m->>'year')::numeric = trunc((m->>'year')::numeric)
            else false end
      and case jsonb_typeof(m->'rating') when 'null' then true
            when 'number' then (m->>'rating')::numeric between 0.5 and 5
                               and (m->>'rating')::numeric * 2 = trunc((m->>'rating')::numeric * 2)
            else false end
      and jsonb_typeof(m->'liked') = 'boolean'
      and jsonb_typeof(m->'rewatch') = 'boolean'
      and jsonb_typeof(m->'spoiler') = 'boolean'
      and case jsonb_typeof(m->'watched') when 'null' then true
            when 'string' then (m->>'watched') ~ '^\d{4}-\d{2}-\d{2}$' else false end
      and case jsonb_typeof(m->'poster') when 'null' then true
            when 'string' then (m->>'poster') ~* '^https://a\.ltrbxd\.com/' else false end
      and jsonb_typeof(m->'url') = 'string' and (m->>'url') ~* '^https://letterboxd\.com/[A-Za-z0-9_]+/film/'
      and jsonb_typeof(m->'text') = 'string' and char_length(m->>'text') <= 6000
    else false
  end;
$$;

alter table public.posts drop constraint if exists posts_media_ok;
alter table public.posts add constraint posts_media_ok check (media is null or public.post_media_ok(media));

-- um anexo por post: ingresso ou enquete (fotos e local podem junto do ingresso)
alter table public.posts drop constraint if exists posts_poll_or_media;
alter table public.posts add constraint posts_poll_or_media check (poll_options is null or media is null);

-- post só com o ingresso vale (sem texto e sem foto)
alter table public.posts drop constraint if exists posts_body_or_image;
alter table public.posts add constraint posts_body_or_image
  check (char_length(body) > 0 or image_url is not null or cardinality(images) > 0 or media is not null);

-- depois de postar o ingresso não muda (como as opções da enquete)
create or replace function public.posts_media_on_update()
returns trigger
language plpgsql
as $$
begin
  if new.media is distinct from old.media then
    raise exception 'media_locked' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_media_lock on public.posts;
create trigger posts_media_lock
  before update on public.posts
  for each row execute function public.posts_media_on_update();
