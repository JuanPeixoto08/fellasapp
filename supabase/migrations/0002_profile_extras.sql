-- 0002: campos extras do perfil (idempotente).
alter table public.profiles add column if not exists accent_color text;
alter table public.profiles add column if not exists status text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists birthday date;

alter table public.profiles drop constraint if exists profiles_status_len;
alter table public.profiles add constraint profiles_status_len check (status is null or char_length(status) <= 80);
alter table public.profiles drop constraint if exists profiles_location_len;
alter table public.profiles add constraint profiles_location_len check (location is null or char_length(location) <= 60);

grant update (username, display_name, avatar_url, bio, accent_color, status, location, birthday)
  on public.profiles to authenticated;
