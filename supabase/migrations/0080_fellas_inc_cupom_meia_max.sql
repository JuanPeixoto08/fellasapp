-- fellasapp: Fellas Inc., cupom e meia-preço no 10 e no Máx (16/10, conserto depois das eras 6–7). Na compra de gerador
-- o Cupom de primeira compra (0076, "−25%, 10 usos") dava 25% em TODAS as unidades do 10 e do Máx e gastava só 1 cupom; e
-- a meia-preço ("Próxima compra pela metade") só valia na compra de 1, ficando guardada no 10 e no Máx. Agora (decidido
-- pelo Juan): o cupom conta 1 por gerador (os min(k, cupons) primeiros com −25%, o resto cheio; o Máx calcula assim o que
-- cabe) e a meia vale a próxima compra inteira (1, 10, Máx ou melhoria) pela metade, guardando os cupons (desconto de
-- compra até 50%); com a Promoção relâmpago os dois ficam guardados. O resto da conta (Horta, convidados, cashback de
-- 30% do preço final, estratégias, 1 s de folga) fica igual. A página faz a mesma conta (economia.ts compraGerador).
-- Idempotente.

-- preço de k tendo n com c cupons (igual a economia.ts precoCupom): os min(k, c) primeiros com p_cmc (o custo com o
-- cupom), o resto com p_cm. Sem cupom é a idle_price.
create or replace function public.idle_price_cupom(p_custo double precision, p_n int, p_k int, p_cm double precision,
                                                   p_cmc double precision, p_c int)
returns double precision language sql immutable set search_path = public as $$
  select public.idle_price(p_custo, p_n, least(p_k, greatest(p_c, 0)), p_cmc)
       + public.idle_price(p_custo, p_n + least(p_k, greatest(p_c, 0)), p_k - least(p_k, greatest(p_c, 0)), p_cm)
$$;

-- Máx com c cupons (igual a economia.ts maxCompraCupom): os com desconto primeiro, depois os cheios com o que sobra
create or replace function public.idle_max_qty_cupom(p_custo double precision, p_n int, p_v double precision,
                                                     p_cm double precision, p_cmc double precision, p_c int)
returns int language plpgsql immutable set search_path = public as $$
declare k int;
begin
  if p_c <= 0 then
    return public.idle_max_qty(p_custo, p_n, p_v, p_cm);
  end if;
  k := public.idle_max_qty(p_custo, p_n, p_v, p_cmc);
  if k >= p_c then
    k := p_c + public.idle_max_qty(p_custo, p_n + p_c, p_v - public.idle_price(p_custo, p_n, p_c, p_cmc), p_cm);
  end if;
  -- arredondamento da soma: nunca cobra mais do que p_v
  while k > 0 and public.idle_price_cupom(p_custo, p_n, k, p_cm, p_cmc, p_c) > p_v loop
    k := k - 1;
  end loop;
  return k;
end;
$$;
revoke all on function public.idle_price_cupom(double precision, int, int, double precision, double precision, int) from public, anon, authenticated;
revoke all on function public.idle_max_qty_cupom(double precision, int, double precision, double precision, double precision, int) from public, anon, authenticated;

-- comprar (o da 0078) com o cupom por gerador e a meia-preço na compra inteira (0080)
create or replace function public.idle_buy(p_kind text, p_id int, p_qty int default 1)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  g      public.idle_cat_gen;
  u      public.idle_cat_upg;
  v_era  int;
  v_cm   double precision;
  v_n    int;
  v_k    int;
  v_preco double precision;
  v_meia boolean := false;
  v_promo boolean;
  v_cmg   double precision;
  v_hb    record;
  v_cupom boolean := false;
  v_cmc   double precision;
  v_c     int := 0;  -- cupons que valem nesta compra (0080)
  v_gasta int := 0;  -- cupons gastos: 1 por gerador com desconto (0080)
  v_cmb   double precision; -- o custo do gerador com a meia, se valer (0080)
  v_cash  double precision := 0;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_era := public.idle_era(s.generators);
  if v_era >= 2 and coalesce(s.strategies[v_era - 1], -1) < 0 then
    raise exception 'idle_strategy_pending' using errcode = 'P0001';
  end if;
  v_cm := public.idle_cost_mult(s);
  -- 1 s de folga: a página troca os preços no passo de 1 s; quem clicou vendo metade paga metade
  v_promo := s.promo_ate is not null and s.promo_ate > now() - interval '1 second';
  if v_promo then
    v_cm := v_cm / 2; -- Promoção relâmpago: tudo pela metade (preço, 10 e Máx)
  end if;
  -- a horta: geradores e melhorias mais baratos (cada desconto com teto de 50%)
  select * into v_hb from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now());
  v_cmg := v_cm * (1 - v_hb.geradores) * (1 - 0.10 * public.idle_conv_peso(s, 6)); -- Gabe Newell
  -- Cupom de primeira compra (0076): cada cupom deixa 1 gerador 25% mais barato (0080: no 10 e no Máx só os primeiros
  -- min(k, cupons) saem com desconto e gastam 1 cupom cada), sem Promoção (desconto de compra até 50%); a meia-preço
  -- também guarda o cupom (abaixo)
  v_cupom := coalesce(s.cupons, 0) > 0 and not v_promo;
  v_c := case when v_cupom then s.cupons else 0 end;

  if p_kind = 'gerador' then
    select * into g from public.idle_cat_gen where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id > 1 and coalesce(s.generators[p_id - 1], 0) < 1 then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_n := coalesce(s.generators[p_id], 0);
    -- a meia-preço (0080): a compra inteira (1, 10 ou Máx) pela metade, sem o cupom (fica guardado); com a Promoção a
    -- meia-preço fica guardada (desconto máximo 50%)
    v_cmb := v_cmg;
    if s.meias > 0 and not v_promo then
      v_cmb := v_cmg / 2;
      v_c := 0;
      v_meia := true;
    end if;
    v_cmc := v_cmb * 0.75;
    if p_qty = 0 then
      v_k := public.idle_max_qty_cupom(g.custo, v_n, s.valuation, v_cmb, v_cmc, v_c);
      if v_k < 1 then
        raise exception 'idle_cant_afford' using errcode = 'P0001';
      end if;
    elsif p_qty in (1, 10) then
      v_k := p_qty;
    else
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    v_preco := public.idle_price_cupom(g.custo, v_n, v_k, v_cmb, v_cmc, v_c);
    v_gasta := least(v_k, v_c);
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.generators[p_id] := v_n + v_k;
    if p_qty = 0 then
      perform public.idle_ganhar(s.user_id, 'jaula', v_k);
    end if;
  elsif p_kind = 'melhoria' then
    v_gasta := 0; -- melhoria não gasta cupom
    select * into u from public.idle_cat_upg where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id = any (s.upgrades) then
      raise exception 'idle_owned' using errcode = 'P0001';
    end if;
    if not public.idle_upg_unlocked(u, s.generators) then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_preco := u.preco * v_cm * (1 - v_hb.melhorias) * (1 + 0.10 * public.idle_conv_peso(s, 1)) -- Cristiano
               * (1 + 0.10 * public.idle_conv_peso(s, 10)) -- Toby Fox
               * (case when s.upg_desc_ate > now() - interval '1 second' then 0.75 else 1 end); -- Atualização instalada (0074)
    if s.meias > 0 and not v_promo then
      v_preco := v_preco / 2;
      v_meia := true;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.upgrades := array_append(s.upgrades, p_id);
    s.upg_total := s.upg_total + 1;
  else
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;

  if v_gasta > 0 then
    s.cupons := s.cupons - v_gasta; -- 1 por gerador com desconto (0080)
  end if;
  -- Cashback (0076): devolve 30% do preço final na hora; é devolução, passa do teto dos descontos (com Promoção: paga 35%).
  -- 1 s de folga, como a Promoção
  if s.cashback_ate > now() - interval '1 second' then
    v_cash := 0.3 * v_preco;
    s.valuation := s.valuation + v_cash;
    s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'cashback', v_cash);
    perform public.idle_ganhar(s.user_id, 'cashback', (s.dourados_cont ->> 'cashback')::double precision);
  end if;
  if v_meia then
    s.meias := s.meias - 1; -- gasta uma; as outras ficam pras próximas compras
  end if;
  s.valuation := greatest(s.valuation, 0);
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_buy(text, int, int) from public, anon;
grant execute on function public.idle_buy(text, int, int) to authenticated;
