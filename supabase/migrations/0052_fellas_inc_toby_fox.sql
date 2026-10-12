-- fellasapp: Fellas Inc., o Toby Fox entra no lugar da Ana Mary B (convidado 10). "Chapter 5 ano que vem": a produção
-- sobe +2% a cada hora inteira sentado, até +40% em 20 h (× o peso da cadeira); trocar ou tirar zera (é o conv_desde);
-- melhorias 10% mais caras (× o peso). Sai a Ana: o Food truck de manhã e o −5% da tarde. A conquista 81 vira a do
-- Toby (20 h sentado). Mesmas contas de games/idle/convidados.ts (tobyMult). Idempotente.

update public.idle_cat_conv set nome = 'Toby Fox' where id = 10;

update public.idle_cat_conquista
   set nome = 'Já já sai o Chapter 5', frase = 'Ficou 20 horas esperando. O Toby também.',
       condicao = 'Deixar o Toby Fox 20 h sentado sem trocar', tipo = 'conv_toby'
 where id = 81;

-- multiplicador da produção em t
create or replace function public.idle_conv_prod(s public.idle_state, t timestamptz)
returns double precision language plpgsql immutable set search_path = public as $$
declare
  pk double precision := public.idle_conv_peso(s, 5);
  pt double precision := public.idle_conv_peso(s, 10);
  pm double precision := public.idle_conv_peso(s, 9);
  m  double precision;
begin
  m := (1 + 0.15 * public.idle_conv_peso(s, 1)) * (1 - 0.05 * public.idle_conv_peso(s, 4)) * (1 - 0.05 * public.idle_conv_peso(s, 11));
  if pk > 0 then
    m := m * (1 + pk * (-0.10 + 0.50 * least(24, greatest(0, floor(extract(epoch from t - public.idle_conv_desde(s, 5)) / 3600))) / 24));
  end if;
  if pt > 0 then
    m := m * (1 + pt * 0.02 * least(20, greatest(0, floor(extract(epoch from t - public.idle_conv_desde(s, 10)) / 3600))));
  end if;
  if pm > 0 and public.idle_conv_derrubada_ate(s, t) is not null then
    m := m * (1 - 0.10 * pm);
  end if;
  return m;
end;
$$;

-- o Food truck não tem mais nada só dele (era a Ana de manhã); fica 1 pra idle_rate_at não mudar de forma
create or replace function public.idle_conv_food(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  select 1::double precision
$$;

-- instantes em (de, ate) em que a produção dos convidados muda: degraus do Kojima (24) e do Toby (20), início e fim
-- das derrubadas do MC V.V (a conta vira neles)
create or replace function public.idle_conv_mudancas(s public.idle_state, de timestamptz, ate timestamptz)
returns setof timestamptz language plpgsql immutable set search_path = public as $$
declare
  d     timestamptz;
  p     double precision;
  passo double precision;
  k     bigint;
  ini   timestamptz;
begin
  if de >= ate then
    return;
  end if;
  d := public.idle_conv_desde(s, 5);
  if public.idle_conv_peso(s, 5) > 0 and d is not null then
    return query select d + make_interval(hours => h) from generate_series(1, 24) h
                  where d + make_interval(hours => h) > de and d + make_interval(hours => h) < ate;
  end if;
  d := public.idle_conv_desde(s, 10);
  if public.idle_conv_peso(s, 10) > 0 and d is not null then
    return query select d + make_interval(hours => h) from generate_series(1, 20) h
                  where d + make_interval(hours => h) > de and d + make_interval(hours => h) < ate;
  end if;
  p := public.idle_conv_peso(s, 9);
  d := public.idle_conv_desde(s, 9);
  if p > 0 and d is not null then
    passo := 7200 / p;
    for k in greatest(1, floor(extract(epoch from de - d) / passo)::bigint)
             .. least(floor(extract(epoch from ate - d) / passo)::bigint, floor(extract(epoch from de - d) / passo)::bigint + 200) loop
      if public.idle_horta_sorte(s.user_id, 50, floor(extract(epoch from d))::bigint + k, 9) < 0.25 then
        ini := d + make_interval(secs => k * passo);
        return query select x from (values (ini), (ini + interval '30 minutes')) v(x) where x > de and x < ate;
      end if;
    end loop;
  end if;
end;
$$;

-- a manhã de Brasília era só da Ana
drop function if exists public.idle_conv_manha(timestamptz);

-- compras: as melhorias com o Toby Fox ficam mais caras (igual a 0051 fora isso)
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
  if v_era >= 2 and s.strategies[v_era - 1] < 0 then
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

  if p_kind = 'gerador' then
    select * into g from public.idle_cat_gen where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id > 1 and s.generators[p_id - 1] < 1 then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_n := s.generators[p_id];
    if p_qty = 0 then
      v_k := public.idle_max_qty(g.custo, v_n, s.valuation, v_cmg);
      if v_k < 1 then
        raise exception 'idle_cant_afford' using errcode = 'P0001';
      end if;
    elsif p_qty in (1, 10) then
      v_k := p_qty;
    else
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    v_preco := public.idle_price(g.custo, v_n, v_k, v_cmg);
    if s.half_price and v_k = 1 and not v_promo then -- desconto máximo 50%: com a Promoção a meia-preço fica guardada
      v_preco := v_preco / 2;
      v_meia := true;
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
               * (1 + 0.10 * public.idle_conv_peso(s, 10)); -- Toby Fox
    if s.half_price and not v_promo then
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

  if v_meia then
    s.half_price := false;
  end if;
  s.valuation := greatest(s.valuation, 0);
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- conquistas: a 81 agora é a do Toby (igual a 0051 fora isso)
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
             else false
           end
    on conflict do nothing
    returning conquista_id
  )
  select coalesce(array_agg(conquista_id order by conquista_id), '{}') into v_novas from novas;
  return v_novas;
end;
$$;
