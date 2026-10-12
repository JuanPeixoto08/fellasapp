-- fellasapp: Fellas Inc., as oportunidades passam a sair na sorte. Antes (0034) o segundo e o tipo eram uma conta em
-- sequência: o tipo girava 0, 1, 2 e o segundo andava 249 s por janela, então dava pra prever a próxima. Agora os
-- dois saem da mesma mistura dos eventos na tela (idle_dourado na 0045), com outros pesos; a página faz a mesma conta
-- (games/idle/oportunidades.ts, teste de paridade). Continua uma por janela de 10 min, num segundo entre 0 e 589. As
-- janelas já pegas continuam pegas (opp_claimed guarda a janela). Idempotente.

-- a sorte da janela w (0 a 2^31 − 2). numeric: os quadrados passam de bigint.
create or replace function public.idle_opp_sorte(u uuid, w bigint)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  p constant numeric := 2147483647;
  k constant numeric := 1013904223;
  h numeric;
begin
  h := mod(w::numeric * w * 69621 + w::numeric * 48271 + public.idle_opp_seed(u)::numeric * 16807 + 7, p);
  h := mod(h * h + k, p);
  return mod(h * h + k, p);
end;
$$;

create or replace function public.idle_opp_at(u uuid, w bigint)
returns timestamptz language sql immutable set search_path = public as $$
  select to_timestamp(w * 600 + mod(public.idle_opp_sorte(u, w), 590))
$$;

create or replace function public.idle_opp_kind(u uuid, w bigint)
returns int language sql immutable set search_path = public as $$
  select mod(mod(x.h * x.h + 1013904223, 2147483647), 3)::int from (select public.idle_opp_sorte(u, w) as h) x
$$;

revoke all on function public.idle_opp_sorte(uuid, bigint) from public, anon, authenticated;
revoke all on function public.idle_opp_at(uuid, bigint) from public, anon, authenticated;
revoke all on function public.idle_opp_kind(uuid, bigint) from public, anon, authenticated;
