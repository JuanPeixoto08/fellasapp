-- fellasapp: limite de tamanho no nome e na bio do perfil. Idempotente.
-- Mesmos valores de PROFILE_LIMITS em lib/api/profiles.ts (o app já corta no campo; aqui é a garantia).

alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len
  check (display_name is null or char_length(display_name) <= 50);

alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len
  check (bio is null or char_length(bio) <= 160);
