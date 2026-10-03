-- fellasapp: ate 4 fotos por post. Idempotente.
-- `images` guarda os caminhos no bucket post-images, na ordem de exibicao.
-- `image_url` continua preenchida com a primeira foto: apps antigos ainda abertos mostram ao menos ela.

alter table public.posts add column if not exists images text[] not null default '{}';

alter table public.posts drop constraint if exists posts_images_max;
alter table public.posts add constraint posts_images_max check (cardinality(images) <= 4);

-- posts antigos: a foto unica vira a primeira (e unica) da lista
update public.posts
   set images = array[image_url]
 where image_url is not null
   and cardinality(images) = 0;

-- texto ou foto: agora qualquer uma das duas colunas conta como foto
-- (posts_check e o nome gerado para o check sem nome de 0001_init.sql)
alter table public.posts drop constraint if exists posts_check;
alter table public.posts drop constraint if exists posts_body_or_image;
alter table public.posts add constraint posts_body_or_image
  check (char_length(body) > 0 or image_url is not null or cardinality(images) > 0);
