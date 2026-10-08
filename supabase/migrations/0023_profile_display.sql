-- fellasapp: o que cada um mostra no perfil (seção "O que aparece no perfil" do Editar perfil). Idempotente.
-- show_now_playing: "ouvindo agora" ao lado do nome nos posts e no cabeçalho do perfil.
-- hidden_badges: selos que a pessoa escondeu. Guarda os escondidos (não os mostrados): selo novo dado pelo
-- banco já aparece. Sem check contra badges: a conta no app é sempre badges − hidden_badges.

alter table public.profiles
  add column if not exists show_now_playing boolean not null default true,
  add column if not exists hidden_badges text[] not null default '{}';

grant update (show_now_playing, hidden_badges) on public.profiles to authenticated;
