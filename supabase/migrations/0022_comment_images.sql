-- fellasapp: até 4 imagens por comentário (foto ou GIF). Idempotente.
-- Os arquivos ficam no mesmo bucket das fotos dos posts (post-images, só membros leem), na pasta do autor.
-- Comentário pode ser só texto, só imagem ou os dois; vazio continua proibido.

alter table public.comments add column if not exists images text[] not null default '{}';

alter table public.comments drop constraint if exists comments_images_max;
alter table public.comments add constraint comments_images_max check (cardinality(images) <= 4);

-- a regra antiga (0001) exigia texto de 1 a 1000
alter table public.comments drop constraint if exists comments_body_check;
alter table public.comments add constraint comments_body_check
  check (char_length(body) <= 1000 and (char_length(body) >= 1 or cardinality(images) >= 1));
