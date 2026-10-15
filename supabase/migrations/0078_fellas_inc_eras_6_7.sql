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
