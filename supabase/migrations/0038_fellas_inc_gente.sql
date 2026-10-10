-- fellasapp: Fellas Inc., entrega 2 (gente): personagem, contratos de 7 dias, a conta da produção com contratos (e
-- com os vencimentos no meio), placar com o "mais disputado" e a foto de segunda guardando ele. A Fellas Inc. não tem
-- reset (0036): nada aqui apaga estado, contrato ou personagem. As funções que mudam são trocadas com create or replace
-- a partir da versão mais nova (0034/0035/0036, já em produção). As mesmas contas existem em games/idle/economia.ts
-- (teste de paridade). Não toca nos créditos do cassino. Idempotente.

-- ===== personagem =====

create table if not exists public.idle_avatar (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  pele          smallint not null check (pele between 0 and 5),
  cabelo        smallint not null check (cabelo between 0 and 5),
  cor_cabelo    smallint not null check (cor_cabelo between 0 and 7),
  roupa         smallint not null check (roupa between 0 and 3),
  cor_roupa     smallint not null check (cor_roupa between 0 and 9),
  acessorio     smallint not null check (acessorio between 0 and 5),
  cor_acessorio smallint not null check (cor_acessorio between 0 and 9),
  updated_at    timestamptz not null default now()
);

alter table public.idle_avatar enable row level security;
revoke all on public.idle_avatar from anon, authenticated;
grant select on public.idle_avatar to authenticated;
drop policy if exists "idle_avatar_select_members" on public.idle_avatar;
create policy "idle_avatar_select_members" on public.idle_avatar for select to authenticated using (public.is_member());

-- o visual de alguém no formato do jogo (null = nunca salvou: a tela usa o fundador padrão)
create or replace function public.idle_avatar_json(u uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('pele', a.pele, 'cabelo', a.cabelo, 'cor_cabelo', a.cor_cabelo, 'roupa', a.roupa,
                            'cor_roupa', a.cor_roupa, 'acessorio', a.acessorio, 'cor_acessorio', a.cor_acessorio)
    from public.idle_avatar a
   where a.user_id = u
$$;

-- o estado que toda função do jogo devolve: o da 0034 + personagem, equipe (contratos ativos que você fez, do mais
-- recente ao mais antigo), chefes (quem te contratou e quanto paga), social (o que entra na conta), o preço do próximo
-- contrato e muda_em (o próximo vencimento que mexe na sua taxa: a tela bate o ponto de novo nessa hora).
-- plpgsql: as funções que ela chama podem vir depois neste arquivo.
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', public.idle_rate(s), 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators), 'boost_until', s.boost_until,
    'half_price', s.half_price, 'opp_claimed', to_jsonb(s.opp_claimed),
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
    'muda_em', public.idle_next_change(s));
end;
$$;

-- "Bora" do editor: só o próprio, de graça, quantas vezes quiser. Fecha a conta (a tela ancora o número no estado
-- devolvido).
create or replace function public.idle_set_avatar(p_pele int, p_cabelo int, p_cor_cabelo int, p_roupa int,
                                                  p_cor_roupa int, p_acessorio int, p_cor_acessorio int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_pele is null or p_cabelo is null or p_cor_cabelo is null or p_roupa is null or p_cor_roupa is null
     or p_acessorio is null or p_cor_acessorio is null
     or p_pele not between 0 and 5 or p_cabelo not between 0 and 5 or p_cor_cabelo not between 0 and 7
     or p_roupa not between 0 and 3 or p_cor_roupa not between 0 and 9 or p_acessorio not between 0 and 5
     or p_cor_acessorio not between 0 and 9 then
    raise exception 'idle_bad_avatar' using errcode = 'P0001';
  end if;
  insert into public.idle_avatar (user_id, pele, cabelo, cor_cabelo, roupa, cor_roupa, acessorio, cor_acessorio)
  values (auth.uid(), p_pele, p_cabelo, p_cor_cabelo, p_roupa, p_cor_roupa, p_acessorio, p_cor_acessorio)
  on conflict (user_id) do update
    set pele = excluded.pele, cabelo = excluded.cabelo, cor_cabelo = excluded.cor_cabelo, roupa = excluded.roupa,
        cor_roupa = excluded.cor_roupa, acessorio = excluded.acessorio, cor_acessorio = excluded.cor_acessorio,
        updated_at = now();
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_avatar_json(uuid) from public, anon, authenticated;
revoke all on function public.idle_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_set_avatar(int, int, int, int, int, int, int) from public, anon;
grant execute on function public.idle_set_avatar(int, int, int, int, int, int, int) to authenticated;

-- ===== contratos (duram 7 dias; nada apaga: o vencido só deixa de contar) =====

create table if not exists public.idle_contracts (
  id          bigint generated always as identity primary key,
  employer_id uuid not null references public.profiles (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  cargo       text not null,
  created_at  timestamptz not null default now(),
  ends_at     timestamptz not null default now() + interval '7 days',
  check (employer_id <> employee_id),
  check (ends_at > created_at)
);
create index if not exists idle_contracts_employer on public.idle_contracts (employer_id, ends_at);
create index if not exists idle_contracts_employee on public.idle_contracts (employee_id, ends_at);

alter table public.idle_contracts enable row level security;
revoke all on public.idle_contracts from anon, authenticated;
grant select on public.idle_contracts to authenticated;
drop policy if exists "idle_contracts_select_members" on public.idle_contracts;
create policy "idle_contracts_select_members" on public.idle_contracts for select to authenticated using (public.is_member());

-- quanto uma empresa paga a quem ela contratou: ×3 com Cultura de startup, 1 sem estratégia que mexa nisso
create or replace function public.idle_employee_mult(p_employer uuid)
returns double precision language sql stable set search_path = public as $$
  select coalesce((select exp(sum(ln((e.sociais ->> 'empregadoMult')::double precision)))
                     from public.idle_state es
                     join public.idle_cat_est e on e.opcao = es.strategies[e.era - 1]
                    where es.user_id = p_employer and (e.sociais ->> 'empregadoMult') is not null), 1)
$$;

-- multiplicador dos contratos ativos em t (igual a economia.ts multContratos):
-- 1 + efeito × (por_contratado × quantos você contratou + Σ 2% × o que cada empresa que te contratou paga).
-- Ninguém te contratou = piso de freela (2%, como 1 contrato). efeito = ×2 com Networking; por_contratado = 10%
-- (15% com Cultura de startup).
create or replace function public.idle_social_mult(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.sociais from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  )
  select 1 + coalesce((select exp(sum(ln((x.sociais ->> 'contratoEfeitoMult')::double precision))) from est x
                        where (x.sociais ->> 'contratoEfeitoMult') is not null), 1)
           * (coalesce((select max((x.sociais ->> 'porContratado')::double precision) from est x
                         where (x.sociais ->> 'porContratado') is not null), 0.1)
                * (select count(*) from public.idle_contracts c
                    where c.employer_id = s.user_id and c.created_at <= t and c.ends_at > t)
              + coalesce((select sum(0.02 * public.idle_employee_mult(c.employer_id)) from public.idle_contracts c
                           where c.employee_id = s.user_id and c.created_at <= t and c.ends_at > t), 0.02))
$$;

-- produção por segundo em t (igual a economia.ts taxa): a da 0034 × o multiplicador dos contratos ativos em t
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
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1) as v
      from public.idle_cat_gen c
  )
  select coalesce((select sum(v) from gen), 0)
       * coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
       * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
       * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
            * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
       * public.idle_social_mult(s, t)
$$;

-- produção por segundo agora (é a que o placar, a foto de segunda e a tela usam)
create or replace function public.idle_rate(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_rate_at(s, now())
$$;

-- fecha a conta até ts (a da 0034: teto de 8h, ×5 dentro do bônus), agora em trechos: um contrato da pessoa que vence
-- no meio muda a taxa dali pra frente (igual a economia.ts acumularTrechos). Contrato novo e Cultura de startup não
-- precisam de trecho: quem cria fecha a conta dos dois lados antes.
create or replace function public.idle_settle(s public.idle_state, ts timestamptz default now())
returns public.idle_state language plpgsql stable set search_path = public as $$
declare
  v_fim   timestamptz;
  v_a     timestamptz;
  v_b     timestamptz;
  v_rate  double precision;
  v_boost double precision;
begin
  if not s.started or ts <= s.settled_at then
    s.settled_at := greatest(s.settled_at, ts);
    return s;
  end if;
  v_fim := least(ts, s.settled_at + interval '8 hours');
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
    v_boost := 0;
    if s.boost_until is not null and s.boost_until > v_a then
      v_boost := greatest(0, extract(epoch from least(v_b, s.boost_until) - v_a));
    end if;
    s.valuation := s.valuation + v_rate * extract(epoch from v_b - v_a) + v_rate * 4 * v_boost;
    v_a := v_b;
  end loop;
  s.settled_at := ts;
  return s;
end;
$$;

-- preço do próximo contrato: 30 min da produção atual × 1,5^(contratos ATIVOS que você fez) × 2 com Abrir capital
create or replace function public.idle_hire_price(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_rate(s) * 1800
       * power(1.5::double precision, (select count(*) from public.idle_contracts c
                                        where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()))
       * coalesce((select exp(sum(ln((e.sociais ->> 'contratoCustoMult')::double precision)))
                     from public.idle_cat_est e
                    where e.opcao = s.strategies[e.era - 1] and (e.sociais ->> 'contratoCustoMult') is not null), 1)
$$;

-- o próximo vencimento que mexe na taxa da pessoa (null = nenhum contrato ativo)
create or replace function public.idle_next_change(s public.idle_state)
returns timestamptz language sql stable set search_path = public as $$
  select min(c.ends_at) from public.idle_contracts c
   where (c.employer_id = s.user_id or c.employee_id = s.user_id) and c.ends_at > now()
$$;

-- trava várias linhas sempre na ordem de user_id: dois fellas se contratando ao mesmo tempo não esperam um pelo
-- outro em círculo
create or replace function public.idle_lock_all(p_users uuid[])
returns void language plpgsql volatile set search_path = public as $$
declare u uuid;
begin
  for u in select distinct x from unnest(p_users) x where x is not null order by 1 loop
    perform public.idle_lock(u);
  end loop;
end;
$$;

-- contratar um amigo que já abriu a empresa: 7 dias, um contrato ativo por par (A→B), sem demissão, cargo sorteado
create or replace function public.idle_hire(p_user uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  s       public.idle_state;
  o       public.idle_state;
  v_era   int;
  v_preco double precision;
  v_cargo text;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_user = v_me then
    raise exception 'idle_hire_self' using errcode = 'P0001';
  end if;
  if p_user is null or not exists (select 1 from public.profiles where id = p_user and is_member) then
    raise exception 'idle_hire_not_open' using errcode = 'P0001';
  end if;
  perform public.idle_lock_all(array[v_me, p_user]);
  select * into s from public.idle_state where user_id = v_me;
  select * into o from public.idle_state where user_id = p_user;
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if not o.started then
    raise exception 'idle_hire_not_open' using errcode = 'P0001';
  end if;
  v_era := public.idle_era(s.generators);
  if v_era >= 2 and s.strategies[v_era - 1] < 0 then
    raise exception 'idle_strategy_pending' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.idle_contracts c
              where c.employer_id = v_me and c.employee_id = p_user and c.ends_at > now()) then
    raise exception 'idle_hire_twice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_preco := public.idle_hire_price(s);
  if v_preco > s.valuation then
    raise exception 'idle_cant_afford' using errcode = 'P0001';
  end if;
  s.valuation := greatest(s.valuation - v_preco, 0);
  perform public.idle_save(public.idle_settle(o)); -- o contratado rende até agora com a regra antiga
  select k.nome into v_cargo from public.idle_cat_cargo k order by random() limit 1;
  insert into public.idle_contracts (employer_id, employee_id, cargo, created_at, ends_at)
  values (v_me, p_user, coalesce(v_cargo, 'freela'), now(), now() + interval '7 days');
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

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
  if s.strategies[p_era - 1] >= 0 then
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
  s.strategies[p_era - 1] := p_opcao;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_employee_mult(uuid) from public, anon, authenticated;
revoke all on function public.idle_social_mult(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_rate_at(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_rate(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_hire_price(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_next_change(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_lock_all(uuid[]) from public, anon, authenticated;
revoke all on function public.idle_hire(uuid) from public, anon;
grant execute on function public.idle_hire(uuid) to authenticated;
revoke all on function public.idle_pick_strategy(int, int) from public, anon;
grant execute on function public.idle_pick_strategy(int, int) to authenticated;
