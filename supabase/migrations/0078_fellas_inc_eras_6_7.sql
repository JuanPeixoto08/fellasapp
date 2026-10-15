-- fellasapp: Fellas Inc., eras 6 (Em órbita) e 7 (Lua) (15/10, entrega 1 do plano das eras 6–12). O estado guarda 42
-- geradores e 6 estratégias; o legado (as eras antigas ajudam a nova) entra na conta; o Houston (silver tape: produção
-- ×4 por 2 min) fica guardado; os eventos de era 6 e 7 (aceitos também com a era anterior) e as conquistas do monolito e
-- da era inteira. O catálogo (geradores 31–42, gerais, legado, estratégias, conquistas 140–159) é a 0077, gerada.
-- Spec: docs/superpowers/specs/2026-10-15-fellas-inc-eras-6-7-design.md. Idempotente.

-- ===== parte A: o estado, o legado na conta, a escolha, a compra e a venda =====
alter table public.idle_state add column if not exists silver_ate timestamptz; -- Houston (parte B)
alter table public.idle_state alter column generators set default array_fill(0, array[42]);
alter table public.idle_state alter column strategies set default '{-1,-1,-1,-1,-1,-1}';
-- quem tem menos posições ganha as que faltam: zeros nos geradores, -1 nas estratégias (e escolha nula vira -1)
update public.idle_state
   set generators = generators || array_fill(0, array[42 - cardinality(generators)])
 where cardinality(generators) < 42;
update public.idle_state
   set strategies = array(select coalesce(x, -1::smallint) from unnest(strategies) with ordinality u(x, k) order by k)
                    || array_fill(-1::smallint, array[greatest(0, 6 - cardinality(strategies))])
 where cardinality(strategies) < 6 or array_position(strategies, null) is not null;

-- melhoria liberada (a da 0034) com o legado (chega na era alvo) e sem nulo: gerador além do fim da lista conta 0
create or replace function public.idle_upg_unlocked(u public.idle_cat_upg, gens int[])
returns boolean language sql stable set search_path = public as $$
  select case u.tipo
    when 'gerador' then coalesce(gens[u.gerador], 0) >= u.requer
    when 'geral' then public.idle_era(gens) >= u.requer_era
    when 'legado' then public.idle_era(gens) >= u.requer_era
    else coalesce(gens[u.fonte], 0) >= u.requer_fonte and coalesce(gens[u.alvo], 0) >= u.requer_alvo
  end
$$;
revoke all on function public.idle_upg_unlocked(public.idle_cat_upg, int[]) from public, anon, authenticated;

-- quanto cada gerador rende em t (a da 0076) com o legado: os geradores da era A rendem × (1 + Σ p × unidades da era F)
-- de cada legado comprado (F → A), igual a economia.ts multLegado. Gerador além do fim da lista conta 0.
create or replace function public.idle_gen_rendas(s public.idle_state, t timestamptz)
returns table (gen int, renda double precision) language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), glob as (
    select coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
         * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
         * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
              * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
         * public.idle_social_mult(s, t)
         * public.idle_bonus_mult(s)
         * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
         * public.idle_conv_prod(s, t)
         * public.idle_place_mult(s) as g
  ), leg as (
    select u.alvo_era as era,
           1 + sum(u.por_unidade * (select coalesce(sum(coalesce(s.generators[g.id], 0)), 0)
                                      from public.idle_cat_gen g where g.era = u.fonte_era)) as m
      from public.idle_cat_upg u
     where u.tipo = 'legado' and u.id = any (s.upgrades)
     group by u.alvo_era
  )
  select c.id,
         c.renda * coalesce(s.generators[c.id], 0)
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select leg.m from leg where leg.era = c.era), 1)
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1)
         * case when c.id = 11 then public.idle_conv_food(s, t) else 1 end
         * glob.g
    from public.idle_cat_gen c cross join glob
$$;
revoke all on function public.idle_gen_rendas(public.idle_state, timestamptz) from public, anon, authenticated;

-- escolher a estratégia da era (a da 0034) + Cultura de startup: quem você contratou (contratos ativos) passa a
-- ganhar o triplo, então a conta dele fecha antes, com a regra antiga. Vale também para contrato já vencido cujo
-- trecho ainda não foi fechado (ends_at depois do settled_at do contratado): a estratégia atual do chefe vale pra
-- qualquer instante, então sem fechar antes o triplo viraria retroativo. Trava você e essa equipe na ordem de user_id
-- (e fecha exatamente o conjunto travado).
create or replace function public.idle_pick_strategy(p_era int, p_opcao int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  x      public.idle_state;
  v_me   uuid := auth.uid();
  v_mult double precision;
  v_team uuid[];
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct c.employee_id), '{}'::uuid[]) into v_team
    from public.idle_contracts c
    join public.idle_state es on es.user_id = c.employee_id
   where c.employer_id = v_me and c.ends_at > es.settled_at;
  perform public.idle_lock_all(array[v_me] || v_team);
  select * into s from public.idle_state where user_id = v_me;
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if p_era < 2 or p_era > public.idle_era(s.generators) then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if coalesce(s.strategies[p_era - 1], -1) >= 0 then -- posição que falta (lista curta) conta como não escolhida
    raise exception 'idle_strategy_set' using errcode = 'P0001';
  end if;
  select coalesce((e.sociais ->> 'empregadoMult')::double precision, 1) into v_mult
    from public.idle_cat_est e
   where e.era = p_era and e.opcao = p_opcao and e.ativa;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s); -- o tempo até agora rende com a regra antiga
  if v_mult <> 1 then
    for x in select es.* from public.idle_state es where es.user_id = any (v_team) loop
      perform public.idle_save(public.idle_settle(x));
    end loop;
  end if;
  -- 0078: a lista tem 6 posições (eras 2 a 7); completa a curta antes de gravar
  s.strategies := s.strategies || array_fill(-1::smallint, array[greatest(0, 6 - cardinality(s.strategies))]);
  s.strategies[p_era - 1] := p_opcao;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_pick_strategy(int, int) from public, anon;
grant execute on function public.idle_pick_strategy(int, int) to authenticated;

-- comprar (o da 0076) sem nulo: estratégia que falta conta como pendente; gerador que falta na lista conta 0 (0078)
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
  -- Cupom de primeira compra (0076): gerador 25% mais barato (no 1, no 10 e no Máx), sem Promoção (desconto de compra
  -- até 50%); a meia-preço também guarda o cupom (abaixo)
  v_cupom := coalesce(s.cupons, 0) > 0 and not v_promo;
  v_cmc := v_cmg * (case when v_cupom then 0.75 else 1 end);

  if p_kind = 'gerador' then
    select * into g from public.idle_cat_gen where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id > 1 and coalesce(s.generators[p_id - 1], 0) < 1 then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_n := coalesce(s.generators[p_id], 0);
    if p_qty = 0 then
      v_k := public.idle_max_qty(g.custo, v_n, s.valuation, v_cmc);
      if v_k < 1 then
        raise exception 'idle_cant_afford' using errcode = 'P0001';
      end if;
    elsif p_qty in (1, 10) then
      v_k := p_qty;
    else
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    v_preco := public.idle_price(g.custo, v_n, v_k, v_cmc);
    if s.meias > 0 and v_k = 1 and not v_promo then -- desconto máximo 50%: com a Promoção a meia-preço fica guardada
      v_preco := public.idle_price(g.custo, v_n, 1, v_cmg) / 2; -- a meia sem o cupom; o cupom fica guardado (0076)
      v_meia := true;
      v_cupom := false;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.generators[p_id] := v_n + v_k;
    if p_qty = 0 then
      perform public.idle_ganhar(s.user_id, 'jaula', v_k);
    end if;
  elsif p_kind = 'melhoria' then
    v_cupom := false; -- melhoria não gasta cupom
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

  if v_cupom then
    s.cupons := s.cupons - 1;
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

-- gravar o estado (o da 0076) com o Silver tape (0078)
create or replace function public.idle_save(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
begin
  update public.idle_state
     set started = s.started, valuation = s.valuation, generators = s.generators, upgrades = s.upgrades,
         strategies = s.strategies,
         boost_ate = array(select b from unnest(s.boost_ate) b where b > now() order by b),
         boost_until = (select max(b) from unnest(s.boost_ate) b), meias = greatest(s.meias, 0), half_price = s.meias > 0,
         promo_ate = s.promo_ate, viral_ate = array(select v from unnest(s.viral_ate) v where v > now() order by v),
         marmita_ate = s.marmita_ate, upg_desc_ate = s.upg_desc_ate, eventos_era = coalesce(s.eventos_era, '{}'),
         linkedin_ate = s.linkedin_ate, linkedin_gen = s.linkedin_gen, linkedin_mult = s.linkedin_mult,
         combo_ate = s.combo_ate, combo_n = coalesce(s.combo_n, 0), combo_seg = s.combo_seg, silver_ate = s.silver_ate,
         garantidos = public.idle_garantidos_vivos(s.garantidos),
         tigre_dia = s.tigre_dia, tigre_n = coalesce(s.tigre_n, 0),
         chamados = least(3, greatest(coalesce(s.chamados, 0), 0)), cupons = greatest(coalesce(s.cupons, 0), 0),
         cashback_ate = s.cashback_ate, info_creditos = greatest(coalesce(s.info_creditos, 0), 0),
         espiadas = public.idle_espiadas_vivas(s.espiadas),
         dourados_cont = coalesce(s.dourados_cont, '{}'::jsonb),
         opp_claimed = array(select w from unnest(s.opp_claimed) w
                              where w >= floor(extract(epoch from now()) / 600)::bigint - 60),
         opp_day = s.opp_day, opp_count = s.opp_count,
         settled_at = s.settled_at, updated_at = now(),
         prestige_earned = s.prestige_earned, prestige_spent = s.prestige_spent, prestige_count = s.prestige_count,
         upg_total = s.upg_total, opp_total = s.opp_total, hire_total = s.hire_total, hired_total = s.hired_total,
         est_usadas = array(select distinct x from unnest(s.est_usadas || public.idle_est_codigos(s.strategies)) x order by x),
         opp_recent = s.opp_recent
   where user_id = s.user_id;
  perform public.idle_check_conquistas(s.user_id);
  -- o recorde depois das conquistas novas (o F$/s que a tela mostra já conta com elas)
  update public.idle_state set best_rate = greatest(best_rate, s.best_rate, public.idle_rate(s)) where user_id = s.user_id;
end;
$$;
revoke all on function public.idle_save(public.idle_state) from public, anon, authenticated;

-- vender a startup (o da 0076): recomeça com os geradores do catálogo (42) e as 6 estratégias, e zera o Silver tape (0078)
create or replace function public.idle_prestige()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  v_me    uuid := auth.uid();
  v_rate  double precision;
  v_total int;
  v_ganho int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform public.idle_fechar_equipe(v_me); -- trava você e a equipe (na ordem de user_id) e fecha a conta deles
  select * into s from public.idle_state where user_id = v_me;
  if not found or not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_rate := public.idle_rate(s);
  v_total := public.idle_prestige_total(v_rate);
  v_ganho := v_total - s.prestige_earned;
  if v_ganho < 1 then
    raise exception 'idle_prestige_low' using errcode = 'P0001';
  end if;
  -- os contratos (os que você fez e os que te fizeram) seguem até vencer: foram pagos por tempo (0046)
  if v_ganho = 1 then
    perform public.idle_ganhar(v_me, 'aura_negativa');
  end if;
  if s.hire_total = 0 then
    perform public.idle_ganhar(v_me, 'sigma');
  end if;
  s.best_rate := greatest(s.best_rate, v_rate);
  s.prestige_earned := v_total;
  s.prestige_count := s.prestige_count + 1;
  s.started := false;
  s.valuation := 0;
  s.generators := array_fill(0, array[(select count(*)::int from public.idle_cat_gen)]);
  s.upgrades := case when public.idle_arv(v_me, 'manter_gerais', 'max', 0) > 0
                     then array(select u from unnest(s.upgrades) u
                                 where u in (select g.id from public.idle_cat_upg g where g.tipo = 'geral'))
                     else '{}' end;
  s.strategies := '{-1,-1,-1,-1,-1,-1}';
  s.boost_ate := '{}';
  s.meias := 0;
  s.promo_ate := null;
  s.viral_ate := '{}';
  s.marmita_ate := null;  -- os bônus de tempo dos eventos de era zeram; os contadores (eventos_era) ficam
  s.upg_desc_ate := null;
  -- 0076: os bônus e os estoques dos dourados e da Caixinha zeram; os contadores e o Tigrinho do dia (tigre_dia/tigre_n)
  -- ficam (vender não dá 3 jogadas grátis de novo)
  s.linkedin_ate := null;
  s.linkedin_gen := null;
  s.linkedin_mult := null;
  s.combo_ate := null;
  s.combo_n := 0;
  s.combo_seg := null;
  s.garantidos := '[]';
  s.chamados := 0;
  s.cupons := 0;
  s.cashback_ate := null;
  s.info_creditos := 0;
  s.espiadas := '{}';
  s.silver_ate := null; -- o Silver tape do Houston zera (0078); o contador eventos_era fica
  s.opp_count := 0; -- a cota do dia recomeça com a empresa nova (as janelas já pegas continuam pegas)
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_prestige() from public, anon;
grant execute on function public.idle_prestige() to authenticated;

-- o estado que toda função devolve (o da 0076) + o Silver tape (0078, no 2º objeto)
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_rate double precision := public.idle_rate(s);
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', v_rate, 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators),
    'boosts', to_jsonb(array(select b from unnest(s.boost_ate) b where b > now() order by b)),
    'boost_until', (select max(b) from unnest(s.boost_ate) b where b > now()), -- a página velha lê só este
    'meias', s.meias, 'half_price', s.meias > 0, 'opp_claimed', to_jsonb(s.opp_claimed),
    'promo_ate', case when s.promo_ate > now() then s.promo_ate end,
    'viral', to_jsonb(array(select v from unnest(s.viral_ate) v where v > now() order by v)),
    'marmita_ate', case when s.marmita_ate > now() then s.marmita_ate end,
    'upg_desc_ate', case when s.upg_desc_ate > now() then s.upg_desc_ate end,
    'eventos_era', coalesce(s.eventos_era, '{}'::jsonb),
    'convidados', public.idle_conv_json(s),
    'horta_bonus', (select to_jsonb(b) from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b),
    'opp_left', greatest(0, public.idle_opp_cap(s)
                             - case when s.opp_day = public.games_today() then s.opp_count else 0 end),
    'server_now', now(),
    'avatar', public.idle_avatar_json(s.user_id),
    'equipe', coalesce((select jsonb_agg(jsonb_build_object('user_id', c.employee_id, 'cargo', c.cargo,
                                                            'avatar', public.idle_avatar_json(c.employee_id), 'ate', c.ends_at)
                                         order by c.created_at desc, c.id desc)
                          from public.idle_contracts c
                         where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()), '[]'::jsonb),
    'chefes', coalesce((select jsonb_agg(jsonb_build_object('user_id', c.employer_id, 'cargo', c.cargo,
                                                            'mult', public.idle_employee_mult(c.employer_id), 'ate', c.ends_at)
                                         order by c.created_at desc, c.id desc)
                          from public.idle_contracts c
                         where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now()), '[]'::jsonb),
    'social', jsonb_build_object(
      'contratei', (select count(*) from public.idle_contracts c
                     where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()),
      'empregos', coalesce((select jsonb_agg(public.idle_employee_mult(c.employer_id) order by c.created_at desc, c.id desc)
                              from public.idle_contracts c
                             where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now()), '[]'::jsonb)),
    'hire_price', public.idle_hire_price(s),
    'muda_em', public.idle_next_change(s),
    'bonus', jsonb_build_object(
      'arvore', coalesce((select jsonb_agg(a.no_id order by a.no_id) from public.idle_arvore a where a.user_id = s.user_id), '[]'::jsonb),
      'conquistas', (select count(*) from public.idle_conquistas c where c.user_id = s.user_id)),
    'pontos', s.prestige_earned - s.prestige_spent,
    'pontos_vida', s.prestige_earned,
    'vendas', s.prestige_count,
    'recorde', greatest(s.best_rate, v_rate),
    'pontos_venda', case when s.started then greatest(0, public.idle_prestige_total(v_rate) - s.prestige_earned) else 0 end,
    'conquistas', coalesce((select jsonb_agg(jsonb_build_object('id', c.conquista_id, 'em', c.ganhou_em)
                                             order by c.ganhou_em, c.conquista_id)
                              from public.idle_conquistas c where c.user_id = s.user_id), '[]'::jsonb),
    'novas', coalesce((select jsonb_agg(c.conquista_id order by c.conquista_id)
                         from public.idle_conquistas c where c.user_id = s.user_id and c.ganhou_em = now()), '[]'::jsonb),
    'mapa_mult', public.idle_place_mult(s),
    'mapa_abertos', (select count(*) from public.idle_place_state st where st.user_id = s.user_id),
    'descobertas', coalesce((select jsonb_agg(d.id order by d.id)
                               from (select distinct c.conquista_id as id
                                       from public.idle_conquistas c
                                       join public.idle_cat_conquista k on k.id = c.conquista_id
                                      where k.escondida) d), '[]'::jsonb))
  || jsonb_build_object(
    -- 0076 (num 2º objeto: o 1º já está perto do limite de 100 argumentos de função)
    'linkedin_ate', case when s.linkedin_ate > now() then s.linkedin_ate end,
    'linkedin_gen', case when s.linkedin_ate > now() then s.linkedin_gen end,
    'linkedin_mult', case when s.linkedin_ate > now() then s.linkedin_mult end,
    'combo_ate', case when s.combo_ate > now() then s.combo_ate end,
    'combo_n', coalesce(s.combo_n, 0),
    'combo_seg', s.combo_seg,
    'garantidos', public.idle_garantidos_vivos(s.garantidos),
    'tigre_n', case when s.tigre_dia = public.games_today() then coalesce(s.tigre_n, 0) else 0 end,
    'tigre_dia', s.tigre_dia,
    'chamados', coalesce(s.chamados, 0),
    'cupons', coalesce(s.cupons, 0),
    'cashback_ate', case when s.cashback_ate > now() then s.cashback_ate end,
    'info_creditos', coalesce(s.info_creditos, 0),
    'espiadas', public.idle_espiadas_vivas(s.espiadas),
    'dourados_cont', coalesce(s.dourados_cont, '{}'::jsonb),
    'horta_crescendo', public.idle_horta_crescendo(s.user_id),
    'silver_ate', case when s.silver_ate > now() then s.silver_ate end);
end;
$$;

-- ===== parte B: Houston, temos um problema (Silver tape: produção ×4 até silver_ate) =====
-- fechar a conta (a da 0076) com o Silver tape do Houston (×4, 0078), como a Marmita: multiplica por cima, só o fim importa
create or replace function public.idle_settle(s public.idle_state, ts timestamptz default now())
returns public.idle_state language plpgsql stable set search_path = public as $$
declare
  v_fim  timestamptz;
  v_a    timestamptz;
  v_b    timestamptz;
  v_p    timestamptz;
  v_q    timestamptz;
  v_meio timestamptz;
  v_rate double precision;
  v_mult double precision;
  v_k    int;
  v_kb   int;
  v_dur  interval := make_interval(secs => 60 * public.idle_arv(s.user_id, 'dourado_duracao', 'max', 1)); -- Hype: o dobro
begin
  if not s.started or ts <= s.settled_at then
    s.settled_at := greatest(s.settled_at, ts);
    return s;
  end if;
  v_fim := ts; -- sem teto desde a 0061: o jogo fechado rende tudo
  v_a := s.settled_at;
  for v_b in
    select x from (select c.ends_at as x from public.idle_contracts c
                    where (c.employer_id = s.user_id or c.employee_id = s.user_id)
                      and c.ends_at > s.settled_at and c.ends_at < v_fim
                   union
                   select m from public.idle_horta_mudancas(s.user_id, s.settled_at, v_fim) m
                   union
                   select m from public.idle_conv_mudancas(s, s.settled_at, v_fim) m
                   union
                   select v_fim) y
     order by x
  loop
    v_rate := public.idle_rate_at(s, v_a);
    v_p := v_a;
    for v_q in
      select x from (select b as x from unnest(s.boost_ate) b where b > v_a and b < v_b
                     union select v - v_dur from unnest(s.viral_ate) v
                            where v - v_dur > v_a and v - v_dur < v_b
                     union select v from unnest(s.viral_ate) v where v > v_a and v < v_b
                     union select s.marmita_ate where s.marmita_ate > v_a and s.marmita_ate < v_b
                     union select s.linkedin_ate where s.linkedin_ate > v_a and s.linkedin_ate < v_b
                     union select s.combo_ate where s.combo_ate > v_a and s.combo_ate < v_b
                     union select s.silver_ate where s.silver_ate > v_a and s.silver_ate < v_b
                     union select v_b) y
       order by x
    loop
      v_meio := v_p + (v_q - v_p) / 2;
      v_k := (select count(*) from unnest(s.viral_ate) v where v - v_dur <= v_meio and v > v_meio);
      -- os ×5 da oportunidade no ar SOMAM (dois = ×10, três = ×15) e o total multiplica com os Viralizou (×10 cada, sem
      -- teto): dois ×5 com dois Viralizou = ×1.000. Todo ×5 começou antes de settled_at (pegar fecha a conta antes), então
      -- só o fim importa.
      v_kb := (select count(*) from unnest(s.boost_ate) b where b > v_meio);
      -- a Marmita da mãe (×3, 0074) multiplica por cima; começou antes de settled_at (pegar fecha a conta), só o fim importa
      v_mult := (case when v_kb > 0 then 5 * v_kb else 1 end) * 10 ^ v_k
                * (case when s.marmita_ate > v_meio then 3 else 1 end)
                -- LinkedIn e Combo (0076): começaram antes de settled_at (pegar fecha a conta), só o fim importa
                * (case when s.linkedin_ate > v_meio then coalesce(s.linkedin_mult, 1) else 1 end)
                * (case when s.combo_ate > v_meio then 7 else 1 end)
                -- Silver tape do Houston (0078): começou antes de settled_at (pegar fecha a conta), só o fim importa
                * (case when s.silver_ate > v_meio then 4 else 1 end);
      s.valuation := s.valuation + v_rate * v_mult * extract(epoch from v_q - v_p);
      v_p := v_q;
    end loop;
    v_a := v_b;
  end loop;
  s.settled_at := ts;
  return s;
end;
$$;
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;

-- ===== parte C: os eventos das eras 6 e 7 e as conquistas =====
-- o evento do segundo s pra quem está na era `era` (a da 0074, agora de 1 a 7; acima de 7 conta como 7), ou null. O da
-- era atual pesa 3, os antigos 1 (igual a eventoEraEm)
create or replace function public.idle_evento_era(u uuid, s bigint, era int)
returns int language plpgsql immutable set search_path = public as $$
declare
  p   constant numeric := 2147483647;
  k   constant numeric := 1013904223;
  h   numeric;
  v_ate int := greatest(1, least(era, 7));
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

-- pegar o evento de era (o da 0074) com as eras 6 e 7: Lixo espacial (10 min de produção por destroço desviado; a página
-- manda quantos no fim, em p_gols, e o banco aceita 0 a 3) e "Houston, temos um problema" (Silver tape: produção ×4 por 2
-- min; outro com um valendo soma 2 min no fim). p_tipo = o tipo que a página mostrou: vale se ele sai com a era de agora
-- ou com a anterior (comprou o 1º gerador da era seguinte com o evento na tela); outro tipo é gone; sem p_tipo (página
-- velha), o da era de agora. Devolve o estado + "evento": {tipo, premio, ganho, gols (no Lixo, os desvios)}.
drop function if exists public.idle_evento_pegar(bigint, int);
create or replace function public.idle_evento_pegar(p_seg bigint, p_gols int default 0, p_tipo int default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  v_me    uuid := auth.uid();
  v_era   int;
  v_tipo  int;
  v_ini   timestamptz;
  v_rate  double precision;
  v_ganho double precision := 0;
  v_premio int;
  v_gols  int := 0;
  v_chave text;
  v_n     int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  -- segundo longe de agora (ou nulo) nem chega no to_timestamp (um valor absurdo daria erro de data)
  if p_seg is null or abs(p_seg - extract(epoch from now())) > 60 then
    raise exception 'idle_evento_gone' using errcode = 'P0001';
  end if;
  v_era := public.idle_era(s.generators);
  v_tipo := public.idle_evento_era(v_me, p_seg, v_era);
  if p_tipo is not null and p_tipo is distinct from v_tipo then
    if v_era > 1 and p_tipo = public.idle_evento_era(v_me, p_seg, v_era - 1) then
      v_tipo := p_tipo; -- a página mostrou com a era anterior
    else
      raise exception 'idle_evento_gone' using errcode = 'P0001';
    end if;
  end if;
  v_ini := to_timestamp(p_seg);
  -- na tela: 8 / 12 / 12 / 5 / 30 / 10 / 8 s (igual a JANELA_EVENTO_S); o banco aceita 3 s a mais (rede)
  if v_tipo is null or now() < v_ini - interval '2 seconds'
     or now() > v_ini + make_interval(secs => (array[8, 12, 12, 5, 30, 10, 8])[v_tipo] + 3) then
    raise exception 'idle_evento_gone' using errcode = 'P0001';
  end if;
  delete from public.idle_eventos_pegos where user_id = v_me and pegou_em < now() - interval '1 hour';
  insert into public.idle_eventos_pegos (user_id, seg) values (v_me, p_seg) on conflict do nothing;
  if not found then
    raise exception 'idle_evento_pego' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_rate := public.idle_rate(s);
  case v_tipo
    when 1 then -- Desce pra almoçar!: Marmita da mãe, ×3 por 3 min (outra soma no fim)
      s.marmita_ate := greatest(coalesce(s.marmita_ate, now()), now()) + interval '3 minutes';
    when 2 then -- Pacote da Shopee
      v_premio := public.idle_evento_shopee(v_me, p_seg);
      if v_premio = 0 then
        v_ganho := v_rate * 3600 * 0.8; -- Taxa das blusinhas: −20%
      elsif v_premio = 1 then
        s.promo_ate := greatest(coalesce(s.promo_ate, now()), now() + interval '1 minute');
      else
        s.boost_ate := array(select b from unnest(s.boost_ate) b where b > now()) || (now() + interval '2 minutes');
      end if;
    when 3 then -- Reunião que podia ser um e-mail: o tempo que você ia perder
      v_ganho := v_rate * 1800;
    when 4 then -- Tela azul: Atualização instalada, melhorias −25% por 2 min
      s.upg_desc_ate := greatest(coalesce(s.upg_desc_ate, now()), now()) + interval '2 minutes';
    when 5 then -- Jogo do Brasil: 5 min de produção por gol, até 7
      v_gols := least(greatest(coalesce(p_gols, 0), 0), 7);
      v_ganho := v_rate * 300 * v_gols;
    when 6 then -- Lixo espacial: 10 min de produção por destroço desviado, até 3
      v_gols := least(greatest(coalesce(p_gols, 0), 0), 3);
      v_ganho := v_rate * 600 * v_gols;
    else -- Houston, temos um problema: Silver tape, produção ×4 por 2 min (outro com um valendo soma 2 min no fim)
      s.silver_ate := greatest(coalesce(s.silver_ate, now()), now()) + interval '2 minutes';
  end case;
  s.valuation := s.valuation + v_ganho;
  v_chave := (array['mae', 'shopee', 'call', 'tela', 'jogos', 'lixo', 'houston'])[v_tipo];
  v_n := coalesce((s.eventos_era ->> v_chave)::int, 0) + 1;
  s.eventos_era := coalesce(s.eventos_era, '{}'::jsonb) || jsonb_build_object(v_chave, v_n);
  perform public.idle_ganhar(v_me, (array['evt_mae', 'evt_shopee', 'evt_call', 'evt_tela', 'evt_gols', 'evt_lixo', 'evt_houston'])[v_tipo],
                             case when v_tipo in (5, 6) then v_gols else v_n end);
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('evento', jsonb_build_object(
    'tipo', v_tipo, 'premio', v_premio, 'ganho', v_ganho, 'gols', v_gols));
end;
$$;
revoke all on function public.idle_evento_pegar(bigint, int, int) from public, anon;
grant execute on function public.idle_evento_pegar(bigint, int, int) to authenticated;

-- conquistas de estado (a da 0074) com o monolito (1 de cada gerador da era 7) e o legado em "todas as melhorias da era" (0078)
create or replace function public.idle_check_conquistas(p_user uuid)
returns int[] language plpgsql volatile set search_path = public as $$
declare
  s       public.idle_state;
  v_rate  double precision;
  v_era   int;
  v_novas int[];
  n       int;
begin
  select * into s from public.idle_state where user_id = p_user;
  if not found then
    return '{}';
  end if;
  v_rate := public.idle_rate(s);
  v_era := public.idle_era(s.generators);
  n := cardinality(s.opp_recent);
  with novas as (
    insert into public.idle_conquistas (user_id, conquista_id)
    select p_user, c.id
      from public.idle_cat_conquista c
     where case
             when exists (select 1 from public.idle_conquistas x where x.user_id = p_user and x.conquista_id = c.id) then false
             when c.tipo = 'gerador' then s.generators[c.alvo] >= c.valor
             when c.tipo = 'fez_o_l' then s.generators[c.alvo] >= c.valor and s.valuation >= 13e9
             when c.tipo = 'gerador_exato' then c.valor::int = any (s.generators)
             when c.tipo = 'taxa' then v_rate >= c.valor
             when c.tipo = 'era' then v_era >= c.valor
             when c.tipo = 'melhoria' then c.alvo = any (s.upgrades)
             when c.tipo = 'melhorias' then s.upg_total >= c.valor
             when c.tipo = 'oportunidades' then s.opp_total >= c.valor
             when c.tipo = 'vendas' then s.prestige_count >= c.valor
             when c.tipo = 'contratei' then s.hire_total >= c.valor
             when c.tipo = 'contratado' then s.hired_total >= c.valor
             -- as 3 opções de alguma era (era com opção desligada não conta)
             when c.tipo = 'estrategia_era' then exists (
               select 1 from public.idle_cat_est e group by e.era
               having count(*) = count(*) filter (where e.era * 10 + e.opcao = any (s.est_usadas)))
             -- todas as ligadas
             when c.tipo = 'estrategia_todas' then not exists (
               select 1 from public.idle_cat_est e where e.ativa and not (e.era * 10 + e.opcao = any (s.est_usadas)))
             -- 3 oportunidades em menos de c.valor segundos
             when c.tipo = 'brainrot' then n >= 3 and s.opp_recent[n] - s.opp_recent[n - 2] < make_interval(secs => c.valor)
             -- 1º no placar (F$/s), com mais alguém com empresa aberta e ninguém com mais
             when c.tipo = 'aura' then s.started and v_rate > 0
               and exists (select 1 from public.idle_state o where o.started and o.user_id <> p_user)
               and not exists (select 1 from public.idle_state o
                                where o.started and o.user_id <> p_user and public.idle_rate(o) >= v_rate)
             -- horta (0048)
             when c.tipo = 'horta_plantou' then s.horta_plantou >= c.valor
             when c.tipo = 'horta_colheu' then s.horta_colheu >= c.valor
             when c.tipo = 'horta_morreu' then s.horta_morreu >= c.valor
             when c.tipo = 'horta_morango' then s.horta_morangos >= 1
             when c.tipo = 'horta_colecao' then 2 + (select count(*) from public.idle_horta_descobertas d
                                                       where d.user_id = p_user and d.especie not in (1, 2)) >= c.valor
             -- convidados (0051)
             when c.tipo = 'conv_vistos' then cardinality(s.conv_vistos) >= c.valor
             when c.tipo = 'conv_fgc' then s.conv_fgc
             when c.tipo = 'conv_kojima' then public.idle_conv_peso(s, 5) > 0 and public.idle_conv_desde(s, 5) <= now() - interval '24 hours'
             when c.tipo = 'conv_derrubada' then public.idle_conv_derrubadas(s, now()) >= c.valor
             when c.tipo = 'conv_toby' then public.idle_conv_peso(s, 10) > 0 and public.idle_conv_desde(s, 10) <= now() - interval '20 hours'
             -- eras 1–5 (0074): 300 de cada gerador da era; todas as melhorias da era (as dos geradores dela + as gerais dela)
             when c.tipo = 'era_300' then not exists (
               select 1 from public.idle_cat_gen g where g.era = c.alvo and coalesce(s.generators[g.id], 0) < 300)
             when c.tipo = 'era_melhorias' then not exists (
               select 1 from public.idle_cat_upg u left join public.idle_cat_gen g on g.id = u.gerador
                where ((u.tipo = 'gerador' and g.era = c.alvo) or (u.tipo in ('geral', 'legado') and u.requer_era = c.alvo))
                  and not (u.id = any (s.upgrades)))
             -- eras 6–7 (0078): o monolito aparece com 1 de cada gerador da era 7
             when c.tipo = 'monolito' then not exists (
               select 1 from public.idle_cat_gen g where g.era = 7 and coalesce(s.generators[g.id], 0) < 1)
             else false
           end
    on conflict do nothing
    returning conquista_id
  )
  select coalesce(array_agg(conquista_id order by conquista_id), '{}') into v_novas from novas;
  return v_novas;
end;
$$;
revoke all on function public.idle_check_conquistas(uuid) from public, anon, authenticated;
