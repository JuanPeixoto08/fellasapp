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

-- ===== o estado =====
alter table public.idle_state
  add column if not exists promo_ate timestamptz,
  add column if not exists viral_ate timestamptz[] not null default '{}';

-- eventos já pegos (cada lado da dupla conta separado); podados a cada pegar (mais de 1 h)
create table if not exists public.idle_dourados_pegos (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  seg      bigint not null,
  lado     smallint not null,
  pegou_em timestamptz not null default now(),
  primary key (user_id, seg, lado)
);
alter table public.idle_dourados_pegos enable row level security;
revoke all on public.idle_dourados_pegos from anon, authenticated;

-- fecha a conta até ts (a da 0041) + os Viralizou: em cada trecho de taxa, divide nos pontos em que o ×5 da
-- oportunidade ou um Viralizou ([fim − 60 s, fim)) começa/acaba; multiplicador = (×5 se oportunidade) × 10^min(k, 2).
-- Igual a economia.ts acumularTrechos.
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
begin
  if not s.started or ts <= s.settled_at then
    s.settled_at := greatest(s.settled_at, ts);
    return s;
  end if;
  v_fim := least(ts, s.settled_at + make_interval(secs => 3600 * public.idle_arv(s.user_id, 'teto', 'max', 8)));
  v_a := s.settled_at;
  for v_b in
    select x from (select c.ends_at as x from public.idle_contracts c
                    where (c.employer_id = s.user_id or c.employee_id = s.user_id)
                      and c.ends_at > s.settled_at and c.ends_at < v_fim
                   union
                   select v_fim) y
     order by x
  loop
    v_rate := public.idle_rate_at(s, v_a);
    v_p := v_a;
    for v_q in
      select x from (select s.boost_until as x where s.boost_until > v_a and s.boost_until < v_b
                     union select v - interval '60 seconds' from unnest(s.viral_ate) v
                            where v - interval '60 seconds' > v_a and v - interval '60 seconds' < v_b
                     union select v from unnest(s.viral_ate) v where v > v_a and v < v_b
                     union select v_b) y
       order by x
    loop
      v_meio := v_p + (v_q - v_p) / 2;
      v_k := (select count(*) from unnest(s.viral_ate) v where v - interval '60 seconds' <= v_meio and v > v_meio);
      v_mult := (case when s.boost_until is not null and s.boost_until > v_meio then 5 else 1 end) * 10 ^ least(v_k, 2);
      s.valuation := s.valuation + v_rate * v_mult * extract(epoch from v_q - v_p);
      v_p := v_q;
    end loop;
    v_a := v_b;
  end loop;
  s.settled_at := ts;
  return s;
end;
$$;

-- gravar o estado (o da 0041) + a Promoção e os Viralizou ativos
create or replace function public.idle_save(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
begin
  update public.idle_state
     set started = s.started, valuation = s.valuation, generators = s.generators, upgrades = s.upgrades,
         strategies = s.strategies, boost_until = s.boost_until, half_price = s.half_price,
         promo_ate = s.promo_ate, viral_ate = array(select v from unnest(s.viral_ate) v where v > now() order by v),
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

-- o estado que toda função devolve (o da 0041) + a Promoção (se valendo) e os fins dos Viralizou ativos
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_rate double precision := public.idle_rate(s);
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', v_rate, 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators), 'boost_until', s.boost_until,
    'half_price', s.half_price, 'opp_claimed', to_jsonb(s.opp_claimed),
    'promo_ate', case when s.promo_ate > now() then s.promo_ate end,
    'viral', to_jsonb(array(select v from unnest(s.viral_ate) v where v > now() order by v)),
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
    'descobertas', coalesce((select jsonb_agg(d.id order by d.id)
                               from (select distinct c.conquista_id as id
                                       from public.idle_conquistas c
                                       join public.idle_cat_conquista k on k.id = c.conquista_id
                                      where k.escondida) d), '[]'::jsonb));
end;
$$;

-- comprar (a da 0041) + a Promoção relâmpago: custo pela metade; a meia-preço da Caixinha não soma (fica guardada)
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
  v_promo := s.promo_ate is not null and s.promo_ate > now();
  if v_promo then
    v_cm := v_cm / 2; -- Promoção relâmpago: tudo pela metade (preço, 10 e Máx)
  end if;

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
    v_preco := u.preco * v_cm;
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

-- vender a startup (a da 0044) + zera a Promoção e os Viralizou
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
  -- created_at < now(): um contrato criado neste mesmo instante não pode vencer antes de começar (check da tabela)
  update public.idle_contracts set ends_at = now()
   where employer_id = v_me and ends_at > now() and created_at < now();
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
  s.generators := array_fill(0, array[30]);
  s.upgrades := case when public.idle_arv(v_me, 'manter_gerais', 'max', 0) > 0
                     then array(select u from unnest(s.upgrades) u
                                 where u in (select g.id from public.idle_cat_upg g where g.tipo = 'geral'))
                     else '{}' end;
  s.strategies := '{-1,-1,-1,-1}';
  s.boost_until := null;
  s.half_price := false;
  s.promo_ate := null;
  s.viral_ate := '{}';
  s.opp_count := 0; -- a cota do dia recomeça com a empresa nova (as janelas já pegas continuam pegas)
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- ===== pegar um evento =====
-- o evento existe no segundo p_seg; lado 0 (ou 1 na dupla); agora entre p_seg − 2 s e p_seg + 15 s (12 s na tela + a
-- folga da rede); não pego antes. Fecha a conta e aplica o efeito.
create or replace function public.idle_dourado_pegar(p_seg bigint, p_lado int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_me   uuid := auth.uid();
  v_tipo int;
  v_ini  timestamptz;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  v_tipo := case when p_seg is null then null else public.idle_dourado(v_me, p_seg) end;
  v_ini := to_timestamp(p_seg);
  if v_tipo is null or now() < v_ini - interval '2 seconds' or now() > v_ini + interval '15 seconds' then
    raise exception 'idle_dourado_gone' using errcode = 'P0001';
  end if;
  if p_lado is null or p_lado not in (0, 1) or (p_lado = 1 and v_tipo <> 3) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  delete from public.idle_dourados_pegos where user_id = v_me and pegou_em < now() - interval '1 hour';
  insert into public.idle_dourados_pegos (user_id, seg, lado) values (v_me, p_seg, p_lado) on conflict do nothing;
  if not found then
    raise exception 'idle_dourado_pego' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  case v_tipo
    when 0 then s.valuation := s.valuation + public.idle_rate(s) * 1200;
    when 1 then s.promo_ate := greatest(coalesce(s.promo_ate, now()), now() + interval '30 seconds');
    else s.viral_ate := array(select v from unnest(s.viral_ate) v where v > now()) || (now() + interval '60 seconds');
  end case;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_dourado_pegar(bigint, int) from public, anon;
grant execute on function public.idle_dourado_pegar(bigint, int) to authenticated;
