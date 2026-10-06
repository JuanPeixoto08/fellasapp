-- fellasapp: fixar um post no perfil (um por pessoa, como no Twitter). Idempotente.
-- profiles.pinned_post_id: apagou o post, a coluna volta a null sozinha. Fora do grant de update por
-- coluna: só muda pela função abaixo, que só aceita post do próprio autor.

alter table public.profiles
  add column if not exists pinned_post_id uuid references public.posts (id) on delete set null;

-- null desafixa. security definer para gravar a coluna (o app não tem update nela).
create or replace function public.set_pinned_post(p_post_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_post_id is not null
     and not exists (select 1 from public.posts where id = p_post_id and author_id = auth.uid()) then
    raise exception 'not_your_post' using errcode = '42501';
  end if;
  update public.profiles set pinned_post_id = p_post_id where id = auth.uid();
end;
$$;

revoke all on function public.set_pinned_post(uuid) from public;
grant execute on function public.set_pinned_post(uuid) to authenticated;
