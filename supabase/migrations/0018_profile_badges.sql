-- fellasapp: selos do perfil (começa com o de verificado). Idempotente.
-- profiles.badges: lista de selos ('verified', …). Fica fora do grant de update por coluna: só o banco
-- (SQL editor) dá ou tira selo. O @oliveira já sai verificado.

alter table public.profiles add column if not exists badges text[] not null default '{}';

update public.profiles
   set badges = array_append(badges, 'verified')
 where username = 'oliveira' and not ('verified' = any (badges));
