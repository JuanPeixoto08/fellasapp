-- fellasapp: story que veio de um post ("compartilhar no story"). Idempotente.
-- Quem assiste vê "Ver post". Post apagado: o story continua (a imagem já é dele), só perde o link.
-- Sem mudança de RLS: o insert já exige o próprio author_id e ser membro, e todo membro lê qualquer post.
alter table public.stories
  add column if not exists post_id uuid references public.posts (id) on delete set null;
