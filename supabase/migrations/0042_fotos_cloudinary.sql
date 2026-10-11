-- Fotos do Storage pro Cloudinary (out/2026): o tráfego das fotos estourou o plano grátis do Supabase. As novas já sobem
-- pro Cloudinary (função stories-media, kind foto); esta migração dá à mesma função o que ela precisa pra levar as antigas:
-- listar os caminhos que ainda apontam pro Storage, trocar pelo endereço novo em todo lugar e, se der errado, voltar tudo.
-- Só a função chama (service_role). Os arquivos continuam no Storage até o Juan conferir.

-- caminho antigo -> endereço novo (pra voltar, se precisar)
create table if not exists public.fotos_migradas (
  caminho    text primary key,
  uso        text not null check (uso in ('post', 'perfil', 'banner')),
  url        text not null,
  migrada_em timestamptz not null default now()
);
alter table public.fotos_migradas enable row level security;
revoke all on public.fotos_migradas from anon, authenticated;

-- os caminhos do Storage que ainda aparecem no banco, um por linha, com o uso (tamanho da entrega); endereço completo
-- (http...) já está fora do Storage
create or replace function public.fotos_pendentes(p_limite int)
returns table (caminho text, uso text) language sql stable security definer set search_path = public as $$
  select distinct on (x.caminho) x.caminho, x.uso
    from (
      select p.image_url as caminho, 'post' as uso from public.posts p where p.image_url is not null
      union all select unnest(p.images), 'post' from public.posts p
      union all select unnest(c.images), 'post' from public.comments c
      union all select pr.avatar_url, 'perfil' from public.profiles pr where pr.avatar_url is not null
      union all select pr.banner_url, 'banner' from public.profiles pr where pr.banner_url is not null
    ) x
   where x.caminho !~ '^https?://'
   order by x.caminho
   limit p_limite
$$;

create or replace function public.fotos_pendentes_total()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.fotos_pendentes(1000000)
$$;

-- troca o caminho pelo endereço novo em todo lugar (capa e lista do post, comentários, perfil, banner) e guarda a troca
create or replace function public.foto_trocar(p_caminho text, p_url text, p_uso text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.fotos_migradas (caminho, uso, url) values (p_caminho, p_uso, p_url)
  on conflict (caminho) do update set uso = excluded.uso, url = excluded.url, migrada_em = now();
  update public.posts set image_url = p_url where image_url = p_caminho;
  update public.posts set images = array_replace(images, p_caminho, p_url) where p_caminho = any (images);
  update public.comments set images = array_replace(images, p_caminho, p_url) where p_caminho = any (images);
  update public.profiles set avatar_url = p_url where avatar_url = p_caminho;
  update public.profiles set banner_url = p_url where banner_url = p_caminho;
end;
$$;

-- volta tudo que foi migrado pro caminho do Storage (os arquivos continuam lá); devolve quantas fotos voltaram
create or replace function public.fotos_voltar()
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  f public.fotos_migradas;
  n int := 0;
begin
  for f in select * from public.fotos_migradas loop
    update public.posts set image_url = f.caminho where image_url = f.url;
    update public.posts set images = array_replace(images, f.url, f.caminho) where f.url = any (images);
    update public.comments set images = array_replace(images, f.url, f.caminho) where f.url = any (images);
    update public.profiles set avatar_url = f.caminho where avatar_url = f.url;
    update public.profiles set banner_url = f.caminho where banner_url = f.url;
    n := n + 1;
  end loop;
  delete from public.fotos_migradas where true;
  return n;
end;
$$;

revoke all on function public.fotos_pendentes(int) from public, anon, authenticated;
revoke all on function public.fotos_pendentes_total() from public, anon, authenticated;
revoke all on function public.foto_trocar(text, text, text) from public, anon, authenticated;
revoke all on function public.fotos_voltar() from public, anon, authenticated;
grant execute on function public.fotos_pendentes(int) to service_role;
grant execute on function public.fotos_pendentes_total() to service_role;
grant execute on function public.foto_trocar(text, text, text) to service_role;
grant execute on function public.fotos_voltar() to service_role;
