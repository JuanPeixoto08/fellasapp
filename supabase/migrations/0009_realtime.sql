-- fellasapp: tempo real (Supabase Realtime) para a aba aberta se atualizar sozinha. Idempotente.
-- Coloca as tabelas na publicação `supabase_realtime`. O Realtime respeita as políticas de leitura
-- (só membros recebem INSERT/UPDATE); DELETE chega só com a chave primária.

do $$
declare
  t text;
begin
  foreach t in array array['posts', 'likes', 'comments', 'post_reactions', 'comment_reactions', 'profiles'] loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
