-- fellasapp: Fellas Inc., eventos na tela (tipo cookie dourado). A cada segundo há chance 1/600 de aparecer um evento
-- pra quem está com o jogo aberto; fica 12 s na tela. Três tipos: Investidor apressado (20 min de produção), Promoção
-- relâmpago (30 s de compras pela metade) e Viralizou (×10 por 1 min; dois se multiplicam, ×100). A sorte tem semente
-- (id + segundo) e é a mesma conta da página (games/idle/dourados.ts, teste de paridade); o banco confere o clique.
-- As oportunidades não mudam aqui (só deixam de passar na cena, na página). Idempotente.

-- ===== a sorte =====
-- null = nada; 0 Investidor, 1 Promoção, 2 Viralizou, 3 dupla de Viralizou. numeric: os quadrados passam de bigint.
create or replace function public.idle_dourado(u uuid, s bigint)
returns int language plpgsql immutable set search_path = public as $$
declare
  p  constant numeric := 2147483647;
  k  constant numeric := 1013904223;
  h1 numeric;
  h2 numeric;
  r  int;
begin
  h1 := mod(s::numeric * s * 48271 + s::numeric * 16807 + public.idle_opp_seed(u)::numeric * 69621 + 12345, p);
  h2 := mod(h1 * h1 + k, p);
  if mod(h2, 600) <> 0 then
    return null;
  end if;
  r := mod(mod(h2 * h2 + k, p), 100)::int;
  return case when r < 2 then 3 when r < 20 then 2 when r < 55 then 1 else 0 end;
end;
$$;
revoke all on function public.idle_dourado(uuid, bigint) from public, anon, authenticated;
