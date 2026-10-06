-- fellasapp: usuário do Last.fm no perfil (aba Música e "ouvindo agora"). Idempotente.
-- Nada de música fica no banco: o app lê do Last.fm na hora. Cada um edita o próprio.

alter table public.profiles add column if not exists lastfm_user text
  check (lastfm_user is null or lastfm_user ~ '^[A-Za-z][A-Za-z0-9_-]{1,14}$');

grant update (lastfm_user) on public.profiles to authenticated;
