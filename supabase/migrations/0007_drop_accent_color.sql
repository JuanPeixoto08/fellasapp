-- fellasapp: a "cor de perfil" saiu do app (out/2026). Remove a coluna. Idempotente.
-- O grant de update por coluna (0002_profile_extras.sql) sai junto com a coluna.

alter table public.profiles drop column if exists accent_color;
