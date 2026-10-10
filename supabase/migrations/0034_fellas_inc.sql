-- fellasapp: Fellas Inc. (idle), núcleo: estado da semana, contas, compras, estratégias, oportunidades, placar e reset.
-- Depende da 0027 (is_member, games_week_start, games_today) e da 0033 (catálogo). Não toca nos créditos do cassino.
-- Tudo é conta feita quando o jogador age (sem cron por minuto): produção = taxa × tempo desde a última ação, com
-- teto de 8h. As mesmas fórmulas existem em games/idle/economia.ts (teste de paridade). Idempotente.

create table if not exists public.idle_state (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  week_start  date not null,
  started     boolean not null default false,
  valuation   double precision not null default 0 check (valuation >= 0),
  generators  int[] not null default array_fill(0, array[30]),
  upgrades    int[] not null default '{}',
  strategies  smallint[] not null default '{-1,-1,-1,-1}',
  boost_until timestamptz,
  half_price  boolean not null default false,
  opp_claimed bigint[] not null default '{}',
  opp_day     date,
  opp_count   int not null default 0,
  settled_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.idle_weeks (
  week_start date primary key,
  unicorn_id uuid references public.profiles (id) on delete set null,
  podium     jsonb not null default '[]',
  closed_at  timestamptz not null default now()
);

alter table public.idle_state enable row level security;
alter table public.idle_weeks enable row level security;
revoke all on public.idle_state, public.idle_weeks from anon, authenticated;
grant select on public.idle_state, public.idle_weeks to authenticated;
drop policy if exists "idle_state_select_members" on public.idle_state;
create policy "idle_state_select_members" on public.idle_state for select to authenticated using (public.is_member());
drop policy if exists "idle_weeks_select_members" on public.idle_weeks;
create policy "idle_weeks_select_members" on public.idle_weeks for select to authenticated using (public.is_member());

-- era = a do gerador mais alto que a pessoa tem (1 se nenhum)
create or replace function public.idle_era(gens int[])
returns int language sql stable set search_path = public as $$
  select coalesce(max(c.era), 1) from public.idle_cat_gen c where gens[c.id] > 0
$$;

-- produção por segundo (igual a economia.ts: taxa)
create or replace function public.idle_rate(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), gen as (
    select c.renda * s.generators[c.id]
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1) as v
      from public.idle_cat_gen c
  )
  select coalesce((select sum(v) from gen), 0)
       * coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
       * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
       * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
            * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
$$;

create or replace function public.idle_cost_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select coalesce(exp(sum(ln(e.custo_mult))), 1) from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
$$;

-- fecha a conta até ts (teto de 8h; ×5 dentro do bônus): igual a economia.ts acumular
create or replace function public.idle_settle(s public.idle_state, ts timestamptz default now())
returns public.idle_state language plpgsql stable set search_path = public as $$
declare
  v_dt    double precision;
  v_boost double precision := 0;
  v_rate  double precision;
begin
  if not s.started or ts <= s.settled_at then
    s.settled_at := greatest(s.settled_at, ts);
    return s;
  end if;
  v_rate := public.idle_rate(s);
  v_dt := least(extract(epoch from ts - s.settled_at), 8 * 3600);
  if s.boost_until is not null and s.boost_until > s.settled_at then
    v_boost := greatest(0, least(extract(epoch from least(ts, s.boost_until) - s.settled_at), v_dt));
  end if;
  s.valuation := s.valuation + v_rate * v_dt + v_rate * 4 * v_boost;
  s.settled_at := ts;
  return s;
end;
$$;

-- oportunidades: horário e tipo saem de uma conta com o usuário e a janela de 10 min (igual a oportunidades.ts)
create or replace function public.idle_opp_seed(u uuid)
returns bigint language sql immutable as $$
  select ('x' || '0' || substr(replace(u::text, '-', ''), 1, 7))::bit(32)::int::bigint
$$;

create or replace function public.idle_opp_at(u uuid, w bigint)
returns timestamptz language sql immutable set search_path = public as $$
  select to_timestamp(w * 600 + mod(public.idle_opp_seed(u) * 31 + w * 7919, 590))
$$;

create or replace function public.idle_opp_kind(u uuid, w bigint)
returns int language sql immutable set search_path = public as $$
  select mod(public.idle_opp_seed(u) + w * 13, 3)::int
$$;

-- as até 3 mais recentes que já apareceram, não foram pegas e têm menos de 4h
create or replace function public.idle_opp_list(s public.idle_state, ts timestamptz default now())
returns bigint[] language sql stable set search_path = public as $$
  select coalesce(array_agg(w order by w desc), '{}') from (
    select w
      from generate_series(floor(extract(epoch from ts - interval '4 hours') / 600)::bigint,
                           floor(extract(epoch from ts) / 600)::bigint) w
     where public.idle_opp_at(s.user_id, w) <= ts
       and public.idle_opp_at(s.user_id, w) >= ts - interval '4 hours'
       and not (w = any (s.opp_claimed))
     order by w desc
     limit 3
  ) x
$$;

create or replace function public.idle_opp_cap(s public.idle_state)
returns int language sql stable set search_path = public as $$
  select 10 + coalesce((select sum(e.opp_extra)::int from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]), 0)
$$;

create or replace function public.idle_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', public.idle_rate(s), 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators), 'boost_until', s.boost_until,
    'half_price', s.half_price, 'opp_claimed', to_jsonb(s.opp_claimed),
    'opp_left', greatest(0, public.idle_opp_cap(s)
                             - case when s.opp_day = public.games_today() then s.opp_count else 0 end),
    'server_now', now())
$$;

-- reset da semana (corpo completo na Task 7; aqui só existe para idle_lock compilar)
create or replace function public.idle_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('fellas-inc-semana')); -- um reset por vez, e ninguém jogando no meio
end;
$$;

-- linha da pessoa na semana atual, travada; semana virou antes do cron: fecha a velha primeiro
create or replace function public.idle_lock(p_user uuid)
returns public.idle_state language plpgsql volatile set search_path = public as $$
declare
  s      public.idle_state;
  v_week date := public.games_week_start();
begin
  -- semana virou e o cron ainda não fechou a velha: fecha antes de travar qualquer linha
  if exists (select 1 from public.idle_state where week_start < v_week) then
    perform public.idle_weekly_reset();
  end if;
  -- quem joga segura a "semana" em modo compartilhado; o reset pega exclusivo e espera (e vice-versa)
  perform pg_advisory_xact_lock_shared(hashtext('fellas-inc-semana'));
  insert into public.idle_state (user_id, week_start) values (p_user, v_week)
  on conflict (user_id) do update set user_id = excluded.user_id
  returning * into s;
  return s;
end;
$$;

create or replace function public.idle_save(s public.idle_state)
returns void language sql volatile set search_path = public as $$
  update public.idle_state
     set started = s.started, valuation = s.valuation, generators = s.generators, upgrades = s.upgrades,
         strategies = s.strategies, boost_until = s.boost_until, half_price = s.half_price,
         opp_claimed = s.opp_claimed, opp_day = s.opp_day, opp_count = s.opp_count,
         settled_at = s.settled_at, updated_at = now()
   where user_id = s.user_id
$$;

-- abrir o jogo = bater o ponto: fecha a conta até agora (o teto de 8h recomeça a contar)
create or replace function public.idle_open()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- "Abrir CNPJ": a empresa começa com 1 notebook e R$ 10
create or replace function public.idle_start()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if s.started then
    raise exception 'idle_started' using errcode = 'P0001';
  end if;
  s.started := true;
  s.valuation := 10;
  s.generators[1] := 1;
  s.settled_at := now();
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- preço de k unidades tendo n (igual a economia.ts preco; o divisor é 1,15 − 1 em double, como lá)
create or replace function public.idle_price(p_custo double precision, p_n int, p_k int, p_cm double precision)
returns double precision language sql immutable as $$
  select p_custo * power(1.15::double precision, p_n) * (power(1.15::double precision, p_k) - 1)
         / (1.15::double precision - 1) * p_cm
$$;

-- quantas unidades cabem em v (igual a economia.ts maxCompra)
create or replace function public.idle_max_qty(p_custo double precision, p_n int, p_v double precision, p_cm double precision)
returns int language plpgsql immutable set search_path = public as $$
declare k int;
begin
  if p_v <= 0 then
    return 0;
  end if;
  k := floor(ln(p_v * (1.15::double precision - 1) / (p_custo * power(1.15::double precision, p_n) * p_cm) + 1)
             / ln(1.15::double precision))::int;
  while k > 0 and public.idle_price(p_custo, p_n, k, p_cm) > p_v loop
    k := k - 1;
  end loop;
  while public.idle_price(p_custo, p_n, k + 1, p_cm) <= p_v loop
    k := k + 1;
  end loop;
  return greatest(k, 0);
end;
$$;

create or replace function public.idle_upg_unlocked(u public.idle_cat_upg, gens int[])
returns boolean language sql stable set search_path = public as $$
  select case u.tipo
    when 'gerador' then gens[u.gerador] >= u.requer
    when 'geral' then public.idle_era(gens) >= u.requer_era
    else gens[u.fonte] >= u.requer_fonte and gens[u.alvo] >= u.requer_alvo
  end
$$;

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
      v_k := public.idle_max_qty(g.custo, v_n, s.valuation, v_cm);
      if v_k < 1 then
        raise exception 'idle_cant_afford' using errcode = 'P0001';
      end if;
    elsif p_qty in (1, 10) then
      v_k := p_qty;
    else
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    v_preco := public.idle_price(g.custo, v_n, v_k, v_cm);
    if s.half_price and v_k = 1 then
      v_preco := v_preco / 2;
      v_meia := true;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.generators[p_id] := v_n + v_k;
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
    v_preco := u.preco * v_cm;
    if s.half_price then
      v_preco := v_preco / 2;
      v_meia := true;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.upgrades := array_append(s.upgrades, p_id);
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

create or replace function public.idle_pick_strategy(p_era int, p_opcao int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if p_era < 2 or p_era > public.idle_era(s.generators) then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if s.strategies[p_era - 1] >= 0 then
    raise exception 'idle_strategy_set' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.idle_cat_est e where e.era = p_era and e.opcao = p_opcao and e.ativa) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s); -- o tempo até agora rende com a regra antiga
  s.strategies[p_era - 1] := p_opcao;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_era(int[]) from public, anon, authenticated;
revoke all on function public.idle_rate(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_cost_mult(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_opp_seed(uuid) from public, anon, authenticated;
revoke all on function public.idle_opp_at(uuid, bigint) from public, anon, authenticated;
revoke all on function public.idle_opp_kind(uuid, bigint) from public, anon, authenticated;
revoke all on function public.idle_opp_list(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_opp_cap(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_weekly_reset() from public, anon, authenticated;
revoke all on function public.idle_lock(uuid) from public, anon, authenticated;
revoke all on function public.idle_save(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_open() from public, anon;
revoke all on function public.idle_start() from public, anon;
grant execute on function public.idle_open() to authenticated;
grant execute on function public.idle_start() to authenticated;
revoke all on function public.idle_price(double precision, int, int, double precision) from public, anon, authenticated;
revoke all on function public.idle_max_qty(double precision, int, double precision, double precision) from public, anon, authenticated;
revoke all on function public.idle_upg_unlocked(public.idle_cat_upg, int[]) from public, anon, authenticated;
revoke all on function public.idle_buy(text, int, int) from public, anon;
revoke all on function public.idle_pick_strategy(int, int) from public, anon;
grant execute on function public.idle_buy(text, int, int) to authenticated;
grant execute on function public.idle_pick_strategy(int, int) to authenticated;
