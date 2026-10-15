-- fellasapp: Fellas Inc., eventos de era (14/10, entrega 4 do plano das eras 6–12). Um evento por era, numa roda
-- separada dos dourados: a sorte é a de eventosEra.ts (semente id + segundo), o banco confere o clique e paga. A Marmita
-- da mãe (produção ×3 por 3 min) e a Atualização instalada (melhorias −25% por 2 min) ficam guardadas no estado e valem
-- no fechamento da conta e na compra. Idempotente.

-- ===== parte A: a sorte =====
-- o evento do segundo s pra quem está na era `era` (1 a 5; acima de 5 conta como 5), ou null. O da era atual pesa 3, os
-- antigos 1 (igual a eventoEraEm)
create or replace function public.idle_evento_era(u uuid, s bigint, era int)
returns int language plpgsql immutable set search_path = public as $$
declare
  p   constant numeric := 2147483647;
  k   constant numeric := 1013904223;
  h   numeric;
  v_ate int := greatest(1, least(era, 5));
  r   int;
  e   int;
begin
  h := mod(s::numeric * s * 16807 + s::numeric * 69621 + public.idle_opp_seed(u)::numeric * 48271 + 4242, p);
  h := mod(h * h + k, p);
  if mod(h, 1800) <> 0 then
    return null;
  end if;
  r := mod(mod(h * h + k, p), v_ate - 1 + 3)::int;
  for e in 1 .. v_ate loop
    r := r - case when e = v_ate then 3 else 1 end;
    if r < 0 then
      return e;
    end if;
  end loop;
  return v_ate;
end;
$$;
revoke all on function public.idle_evento_era(uuid, bigint, int) from public, anon, authenticated;

-- o que sai na caixa da Shopee: 0 = 1 h de produção menos 20%, 1 = Promoção por 1 min, 2 = ×5 por 2 min (igual a premioShopee)
create or replace function public.idle_evento_shopee(u uuid, s bigint)
returns int language plpgsql immutable set search_path = public as $$
declare
  p constant numeric := 2147483647;
  k constant numeric := 1013904223;
  h numeric;
  r int;
begin
  h := mod(s::numeric * s * 16807 + s::numeric * 69621 + public.idle_opp_seed(u)::numeric * 48271 + 4242, p);
  h := mod(h * h + k, p);
  r := mod(mod((h + 31337) * (h + 31337) + k, p), 100)::int;
  return case when r < 50 then 0 when r < 85 then 1 else 2 end;
end;
$$;
revoke all on function public.idle_evento_shopee(uuid, bigint) from public, anon, authenticated;
