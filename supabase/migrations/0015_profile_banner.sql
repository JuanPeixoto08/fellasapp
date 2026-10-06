-- fellasapp: banner do perfil (estilo Twitter). Idempotente.
-- profiles.banner_url: caminho no bucket privado post-images (<id>/banner-<horário>.jpg), como o avatar.
-- Cada um edita o próprio (a política profiles_update_own já limita à própria linha).

alter table public.profiles add column if not exists banner_url text;

grant update (banner_url) on public.profiles to authenticated;
