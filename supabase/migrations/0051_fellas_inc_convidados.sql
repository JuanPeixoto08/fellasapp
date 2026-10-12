-- fellasapp: Fellas Inc., Convidados no PPP Podcast (minigame 3). Três cadeiras (frente 100%, meio 50%, canto 25%; abrem
-- com 1, 25 e 50 PPP Podcasts, o gerador 13); 11 convidados com um bônus e um defeito, escalados pelo peso da cadeira.
-- Sentar gasta 1 de 3 trocas, que voltam uma por hora; tirar é de graça. Os efeitos entram na produção, na conta, nas
-- compras, nas oportunidades, nos eventos na tela, na Bolsa e na Horta. Mesmas contas de games/idle/convidados.ts
-- (teste de paridade). Vender a startup não mexe nas cadeiras. Idempotente.

-- ===== catálogo =====
create table if not exists public.idle_cat_conv (
  id   int primary key,
  nome text not null
);
alter table public.idle_cat_conv enable row level security;
revoke all on public.idle_cat_conv from anon, authenticated;
grant select on public.idle_cat_conv to authenticated;
drop policy if exists "idle_cat_conv_select_members" on public.idle_cat_conv;
create policy "idle_cat_conv_select_members" on public.idle_cat_conv for select to authenticated using (public.is_member());

insert into public.idle_cat_conv (id, nome) values
  (1, 'Cristiano Ronaldo'), (2, 'Daniel Vorcaro'), (3, 'Gemaplys'), (4, 'Luva de Pedreiro'), (5, 'Hideo Kojima'),
  (6, 'Gabe Newell'), (7, 'Terry Crews'), (8, 'Viniccius13'), (9, 'MC V.V'), (10, 'Ana Mary B'), (11, 'VSauce')
on conflict (id) do update set nome = excluded.nome;

-- ===== estado =====
alter table public.idle_state
  add column if not exists conv_cadeira    int[] not null default '{null,null,null}',
  add column if not exists conv_desde      timestamptz[] not null default '{null,null,null}',
  add column if not exists conv_trocas     int not null default 3,
  add column if not exists conv_trocas_t   timestamptz,
  add column if not exists conv_vistos     int[] not null default '{}';

-- ===== contas =====
-- peso do convidado c: o da cadeira em que ele está, se ela está aberta pelos PPP Podcasts (0 = não está valendo)
create or replace function public.idle_conv_peso(s public.idle_state, c int)
returns double precision language sql immutable as $$
  select coalesce((select case when i = 1 and coalesce(s.generators[13], 0) >= 1 then 1.0
                               when i = 2 and coalesce(s.generators[13], 0) >= 25 then 0.5
                               when i = 3 and coalesce(s.generators[13], 0) >= 50 then 0.25
                               else 0 end
                     from generate_subscripts(s.conv_cadeira, 1) i where s.conv_cadeira[i] = c limit 1), 0)
$$;

-- desde quando o convidado c está sentado (null = não está)
create or replace function public.idle_conv_desde(s public.idle_state, c int)
returns timestamptz language sql immutable as $$
  select s.conv_desde[i] from generate_subscripts(s.conv_cadeira, 1) i where s.conv_cadeira[i] = c limit 1
$$;

-- trocas em t: as gastas voltam uma por hora a partir de conv_trocas_t (até 3)
create or replace function public.idle_conv_trocas(s public.idle_state, t timestamptz)
returns int language sql immutable as $$
  select case when s.conv_trocas >= 3 or s.conv_trocas_t is null then 3
              else least(3, s.conv_trocas + greatest(0, floor(extract(epoch from t - s.conv_trocas_t) / 3600))::int) end
$$;

-- 06:00 ≤ hora < 12:00 em Brasília (a Ana)
create or replace function public.idle_conv_manha(t timestamptz)
returns boolean language sql immutable as $$
  select extract(hour from t at time zone 'America/Sao_Paulo') between 6 and 11
$$;

-- MC V.V: se t está numa derrubada (30 min depois de uma faixa derrubada), o fim dela; senão null. Faixa k a cada
-- 2 h / peso desde que sentou; 25% derrubada (sorte de idle_horta_sorte com canteiro 50, passo desde + k, sorteio 9)
create or replace function public.idle_conv_derrubada_ate(s public.idle_state, t timestamptz)
returns timestamptz language plpgsql immutable set search_path = public as $$
declare
  p     double precision := public.idle_conv_peso(s, 9);
  d     timestamptz := public.idle_conv_desde(s, 9);
  passo double precision;
  k     bigint;
  ini   timestamptz;
begin
  if p <= 0 or d is null then
    return null;
  end if;
  passo := 7200 / p;
  k := floor(extract(epoch from t - d) / passo)::bigint;
  if k < 1 then
    return null;
  end if;
  ini := d + make_interval(secs => k * passo);
  if t < ini + interval '30 minutes'
     and public.idle_horta_sorte(s.user_id, 50, floor(extract(epoch from d))::bigint + k, 9) < 0.25 then
    return ini + interval '30 minutes';
  end if;
  return null;
end;
$$;

-- multiplicador da produção em t (a Ana de manhã vai só no Food truck, em idle_conv_food)
create or replace function public.idle_conv_prod(s public.idle_state, t timestamptz)
returns double precision language plpgsql immutable set search_path = public as $$
declare
  pk double precision := public.idle_conv_peso(s, 5);
  pa double precision := public.idle_conv_peso(s, 10);
  pm double precision := public.idle_conv_peso(s, 9);
  m  double precision;
begin
  m := (1 + 0.15 * public.idle_conv_peso(s, 1)) * (1 - 0.05 * public.idle_conv_peso(s, 4)) * (1 - 0.05 * public.idle_conv_peso(s, 11));
  if pk > 0 then
    m := m * (1 + pk * (-0.10 + 0.50 * least(24, greatest(0, floor(extract(epoch from t - public.idle_conv_desde(s, 5)) / 3600))) / 24));
  end if;
  if pa > 0 and not public.idle_conv_manha(t) then
    m := m * (1 - 0.05 * pa);
  end if;
  if pm > 0 and public.idle_conv_derrubada_ate(s, t) is not null then
    m := m * (1 - 0.10 * pm);
  end if;
  return m;
end;
$$;

-- o Food truck (gerador 11) com a Ana de manhã
create or replace function public.idle_conv_food(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  select case when public.idle_conv_peso(s, 10) > 0 and public.idle_conv_manha(t) then 1 + public.idle_conv_peso(s, 10) else 1 end
$$;

-- instantes em (de, ate) em que a produção dos convidados muda: degraus do Kojima, 6h e 12h da Ana, início e fim
-- das derrubadas do MC V.V (a conta vira neles)
create or replace function public.idle_conv_mudancas(s public.idle_state, de timestamptz, ate timestamptz)
returns setof timestamptz language plpgsql immutable set search_path = public as $$
declare
  d     timestamptz;
  p     double precision;
  passo double precision;
  k     bigint;
  ini   timestamptz;
  dia   date;
begin
  if de >= ate then
    return;
  end if;
  d := public.idle_conv_desde(s, 5);
  if public.idle_conv_peso(s, 5) > 0 and d is not null then
    return query select d + make_interval(hours => h) from generate_series(1, 24) h
                  where d + make_interval(hours => h) > de and d + make_interval(hours => h) < ate;
  end if;
  if public.idle_conv_peso(s, 10) > 0 then
    for dia in select generate_series((de at time zone 'America/Sao_Paulo')::date, (least(ate, de + interval '8 days') at time zone 'America/Sao_Paulo')::date, interval '1 day')::date loop
      return query select x from (values ((dia + time '06:00') at time zone 'America/Sao_Paulo'),
                                         ((dia + time '12:00') at time zone 'America/Sao_Paulo')) v(x)
                    where x > de and x < ate;
    end loop;
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

-- quantas faixas do MC V.V foram derrubadas desde que ele sentou (conquista "Sample não liberado")
create or replace function public.idle_conv_derrubadas(s public.idle_state, t timestamptz)
returns int language plpgsql immutable set search_path = public as $$
declare
  p     double precision := public.idle_conv_peso(s, 9);
  d     timestamptz := public.idle_conv_desde(s, 9);
  n     int := 0;
  k     bigint;
begin
  if p <= 0 or d is null then
    return 0;
  end if;
  for k in 1 .. least(floor(extract(epoch from t - d) / (7200 / p))::bigint, 2000) loop
    if public.idle_horta_sorte(s.user_id, 50, floor(extract(epoch from d))::bigint + k, 9) < 0.25 then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- os efeitos agora (a página mostra e usa nos preços)
create or replace function public.idle_conv_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'cadeira', to_jsonb(s.conv_cadeira),
    'desde', to_jsonb(s.conv_desde),
    'trocas', s.conv_trocas,
    'trocas_t', s.conv_trocas_t,
    'ppp', coalesce(s.generators[13], 0),
    'derrubada_ate', public.idle_conv_derrubada_ate(s, now()))
$$;

-- ===== ações =====
create or replace function public.idle_conv_sentar(p_cadeira int, p_convidado int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s     public.idle_state;
  v_me  uuid := auth.uid();
  v_n   int;
  v_k   int;
  v_i   int := p_cadeira + 1;
  v_ppp int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if p_cadeira is null or p_cadeira not between 0 and 2 or p_convidado is null
     or not exists (select 1 from public.idle_cat_conv c where c.id = p_convidado) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  v_ppp := coalesce(s.generators[13], 0);
  if v_ppp < 1 then
    raise exception 'idle_conv_fechado' using errcode = 'P0001';
  end if;
  if v_ppp < (array[1, 25, 50])[v_i] then
    raise exception 'idle_conv_trancada' using errcode = 'P0001';
  end if;
  if p_convidado = any (s.conv_cadeira) then
    raise exception 'idle_conv_ja_sentado' using errcode = 'P0001';
  end if;
  -- Gemaplys e MC V.V são a mesma pessoa: não muda nada, mas a conquista escondida sai (sem exceção: o rollback a apagaria)
  if (p_convidado = 3 and 9 = any (s.conv_cadeira[1:v_i - 1] || s.conv_cadeira[v_i + 1:3]))
     or (p_convidado = 9 and 3 = any (s.conv_cadeira[1:v_i - 1] || s.conv_cadeira[v_i + 1:3])) then
    perform public.idle_ganhar(v_me, 'conv_mesma');
    return public.idle_json(s) || jsonb_build_object('mesma_pessoa', true);
  end if;
  v_n := public.idle_conv_trocas(s, now());
  if v_n < 1 then
    raise exception 'idle_conv_sem_troca' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  if v_n >= 3 then
    s.conv_trocas := 2;
    s.conv_trocas_t := now();
  else
    v_k := greatest(0, floor(extract(epoch from now() - s.conv_trocas_t) / 3600))::int;
    s.conv_trocas := v_n - 1;
    s.conv_trocas_t := s.conv_trocas_t + make_interval(hours => v_k);
  end if;
  s.conv_cadeira[v_i] := p_convidado;
  s.conv_desde[v_i] := now();
  if not (p_convidado = any (s.conv_vistos)) then
    s.conv_vistos := s.conv_vistos || p_convidado;
  end if;
  update public.idle_state
     set conv_cadeira = s.conv_cadeira, conv_desde = s.conv_desde, conv_trocas = s.conv_trocas,
         conv_trocas_t = s.conv_trocas_t, conv_vistos = s.conv_vistos
   where user_id = v_me;
  perform public.idle_ganhar(v_me, 'conv_sentou');
  if (select count(*) from unnest(s.conv_cadeira) c where c is not null) = 3 then
    perform public.idle_ganhar(v_me, 'conv_mesa');
  end if;
  if p_convidado = 1 and v_i = 1 then
    perform public.idle_ganhar(v_me, 'conv_cr');
  end if;
  if p_convidado = 6 and v_i = 3 then
    perform public.idle_ganhar(v_me, 'conv_hl3');
  end if;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

create or replace function public.idle_conv_tirar(p_cadeira int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s    public.idle_state;
  v_me uuid := auth.uid();
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if p_cadeira is null or p_cadeira not between 0 and 2 then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  s.conv_cadeira[p_cadeira + 1] := null;
  s.conv_desde[p_cadeira + 1] := null;
  update public.idle_state set conv_cadeira = s.conv_cadeira, conv_desde = s.conv_desde where user_id = v_me;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_conv_sentar(int, int) from public, anon;
grant execute on function public.idle_conv_sentar(int, int) to authenticated;
revoke all on function public.idle_conv_tirar(int) from public, anon;
grant execute on function public.idle_conv_tirar(int) to authenticated;


-- produção em t (a da 0048) × os convidados (e o Food truck com a Ana de manhã)
create or replace function public.idle_rate_at(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), gen as (
    select c.renda * s.generators[c.id]
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1)
         * case when c.id = 11 then public.idle_conv_food(s, t) else 1 end as v
      from public.idle_cat_gen c
  )
  select coalesce((select sum(v) from gen), 0)
       * coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
       * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
       * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
            * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
       * public.idle_social_mult(s, t)
       * public.idle_bonus_mult(s)
       * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
       * public.idle_conv_prod(s, t)
$$;

-- fecha a conta (a da 0048) + vira nos instantes em que os convidados mudam a produção
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
      select x from (select s.boost_until as x where s.boost_until > v_a and s.boost_until < v_b
                     union select v - interval '60 seconds' from unnest(s.viral_ate) v
                            where v - interval '60 seconds' > v_a and v - interval '60 seconds' < v_b
                     union select v from unnest(s.viral_ate) v where v > v_a and v < v_b
                     union select v_b) y
       order by x
    loop
      v_meio := v_p + (v_q - v_p) / 2;
      v_k := (select count(*) from unnest(s.viral_ate) v where v - interval '60 seconds' <= v_meio and v > v_meio);
      v_mult := (case when s.boost_until is not null and s.boost_until > v_meio then 5 else 1 end) * 10 ^ v_k; -- sem teto: cada Viralizou ativo multiplica ×10
      s.valuation := s.valuation + v_rate * v_mult * extract(epoch from v_q - v_p);
      v_p := v_q;
    end loop;
    v_a := v_b;
  end loop;
  s.settled_at := ts;
  return s;
end;
$$;

-- o próximo instante que muda a taxa (a da 0048) + os convidados
create or replace function public.idle_next_change(s public.idle_state)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  v_c    timestamptz;
  v_h    timestamptz;
  v_lado int := public.idle_horta_lado(coalesce(s.generators[11], 0));
begin
  select min(c.ends_at) into v_c from public.idle_contracts c
   where (c.employer_id = s.user_id or c.employee_id = s.user_id) and c.ends_at > now();
  if v_lado > 0 then
    select min(x) into v_h from public.idle_horta_mudancas(s.user_id, now(), 'infinity') x;
    if (select count(*) from public.idle_horta_plantas p
         where p.user_id = s.user_id and p.fim is null and public.idle_horta_morte(p) > now()) < v_lado * v_lado
       and ((select count(*) from public.idle_horta_plantas p join public.idle_cat_horta k on k.id = p.especie
              where p.user_id = s.user_id and p.fim is null and p.inicio + make_interval(secs => k.amadurece_s) <= now()
                and public.idle_horta_morte(p) > now()) >= 2
            or exists (select 1 from public.idle_horta_plantas p
                        where p.user_id = s.user_id and p.fim is null
                          and public.idle_horta_morte(p) between now() - interval '6 hours' and now())) then
      v_h := least(v_h, to_timestamp((floor(extract(epoch from now()) / 300) + 1) * 300));
    end if;
  end if;
  return least(v_c, v_h, (select min(x) from public.idle_conv_mudancas(s, now(), now() + interval '2 days') x));
end;
$$;

-- comprar (a da 0048) + os convidados: geradores mais baratos (Gabe), melhorias mais caras (Cristiano)
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
    v_preco := u.preco * v_cm * (1 - v_hb.melhorias) * (1 + 0.10 * public.idle_conv_peso(s, 1)); -- Cristiano
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

-- quantas oportunidades por dia (a da 0041) + Luva de Pedreiro e Gabe Newell (no mínimo 1)
create or replace function public.idle_opp_cap(s public.idle_state)
returns int language sql stable set search_path = public as $$
  select greatest(1, 10 + coalesce((select sum(e.opp_extra)::int from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]), 0)
            + public.idle_arv(s.user_id, 'opp_extra', 'soma', 0)::int
            + ceil(5 * public.idle_conv_peso(s, 4))::int - ceil(3 * public.idle_conv_peso(s, 6))::int)
$$;

-- pegar oportunidade (a da 0048) + a conquista das 15 num dia
create or replace function public.idle_claim_opportunity(p_window bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_mult double precision;
  v_rate double precision;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if p_window is null or not (p_window = any (public.idle_opp_list(s))) then
    raise exception 'idle_opp_gone' using errcode = 'P0001';
  end if;
  if s.opp_day is distinct from public.games_today() then
    s.opp_day := public.games_today();
    s.opp_count := 0;
  end if;
  if s.opp_count >= public.idle_opp_cap(s) then
    raise exception 'idle_opp_cap' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_mult := coalesce((select exp(sum(ln(e.opp_bonus_mult))) from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]), 1)
            * public.idle_arv(s.user_id, 'opp_bonus', 'mult', 1);
  v_rate := public.idle_rate(s);
  case public.idle_opp_kind(s.user_id, p_window)
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b));
    when 1 then s.boost_until := greatest(now(), coalesce(s.boost_until, now())) + make_interval(secs => 60 * v_mult);
    else s.half_price := true;
  end case;
  s.opp_claimed := array_append(s.opp_claimed, p_window);
  s.opp_count := s.opp_count + 1;
  perform public.idle_ganhar(s.user_id, 'opp_dia', s.opp_count); -- "Receba!": 15 num dia
  s.opp_total := s.opp_total + 1;
  s.opp_recent := array_append(s.opp_recent, now());
  s.opp_recent := s.opp_recent[greatest(1, cardinality(s.opp_recent) - 2):];
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- o estado que toda função devolve (o da 0048) + as cadeiras
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
    'descobertas', coalesce((select jsonb_agg(d.id order by d.id)
                               from (select distinct c.conquista_id as id
                                       from public.idle_conquistas c
                                       join public.idle_cat_conquista k on k.id = c.conquista_id
                                      where k.escondida) d), '[]'::jsonb));
end;
$$;

-- conquistas de estado (a da 0048) + as dos convidados
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
             when c.tipo = 'conv_kojima' then public.idle_conv_peso(s, 5) > 0 and public.idle_conv_desde(s, 5) <= now() - interval '24 hours'
             when c.tipo = 'conv_derrubada' then public.idle_conv_derrubadas(s, now()) >= c.valor
             when c.tipo = 'conv_ana' then public.idle_conv_peso(s, 10) > 0
               and public.idle_conv_desde(s, 10) <= ((now() at time zone 'America/Sao_Paulo')::date + time '06:00') at time zone 'America/Sao_Paulo'
               and now() >= ((now() at time zone 'America/Sao_Paulo')::date + time '06:00') at time zone 'America/Sao_Paulo'
             else false
           end
    on conflict do nothing
    returning conquista_id
  )
  select coalesce(array_agg(conquista_id order by conquista_id), '{}') into v_novas from novas;
  return v_novas;
end;
$$;
