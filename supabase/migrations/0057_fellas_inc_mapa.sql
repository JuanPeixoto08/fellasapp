-- fellasapp: Fellas Inc., Mapa do rolê, a moldura (spec 2026-10-12-fellas-inc-mapa-do-role-design.md).
-- Os lugares de verdade (nome, frase, ícone, mapa, posição) NÃO estão aqui: entram por um SQL fora do repositório.
-- Depende da 0056 (estratégias Marca forte/Monopólio e as conquistas mapa_*).

-- ===== catálogo (igual a games/idle/mapa.ts; teste de paridade em idleMapa.test.ts) =====
create table if not exists public.idle_cat_place (
  id int primary key, faixa text not null, horas double precision not null, era int not null, lote int not null,
  lancado boolean not null, custo_base double precision not null, moeda text, numero text
);
create table if not exists public.idle_cat_place_marco (
  id int primary key, lugar int not null, tipo text not null check (tipo in ('nivel', 'lendario', 'fas', 'volume')),
  valor double precision, bonus double precision not null
);
create table if not exists public.idle_cat_place_desafio (
  id int primary key, lugar int not null, tipo text not null, valor double precision, texto text not null,
  premio text not null check (premio in ('horas', 'legado', 'investidor')), premio_valor double precision not null
);
alter table public.idle_cat_place enable row level security;
alter table public.idle_cat_place_marco enable row level security;
alter table public.idle_cat_place_desafio enable row level security;
revoke all on public.idle_cat_place, public.idle_cat_place_marco, public.idle_cat_place_desafio from anon, authenticated;
delete from public.idle_cat_place where true;
delete from public.idle_cat_place_marco where true;
insert into public.idle_cat_place (id, faixa, horas, era, lote, lancado, custo_base, moeda, numero) values
  (1, 'barato', 2, 2, 2, false, 100, null, null),
  (2, 'barato', 2, 2, 2, false, 100, null, null),
  (3, 'barato', 2, 2, 1, true, 100, 'cupom', 'pct'),
  (4, 'medio', 6, 3, 1, true, 150, 'ficha', 'nota'),
  (5, 'medio', 6, 3, 2, false, 150, null, null),
  (6, 'medio', 6, 3, 3, false, 150, null, null),
  (7, 'caro', 16, 4, 1, true, 250, 'gorjeta', 'estrelas'),
  (8, 'caro', 16, 4, 3, false, 250, null, null),
  (9, 'caro', 16, 4, 3, false, 250, null, null);
insert into public.idle_cat_place_marco (id, lugar, tipo, valor, bonus) values
  (31, 3, 'nivel', 5, 0.02), (32, 3, 'nivel', 10, 0.02), (33, 3, 'nivel', 15, 0.03), (34, 3, 'nivel', 20, 0.03),
  (35, 3, 'nivel', 25, 0.04), (36, 3, 'lendario', null, 0.03), (37, 3, 'fas', 10000, 0.03), (38, 3, 'volume', 50, 0.02),
  (41, 4, 'nivel', 5, 0.02), (42, 4, 'nivel', 10, 0.02), (43, 4, 'nivel', 15, 0.03), (44, 4, 'nivel', 20, 0.03),
  (45, 4, 'nivel', 25, 0.04), (46, 4, 'lendario', null, 0.03), (47, 4, 'fas', 5000, 0.03), (48, 4, 'volume', 30, 0.02),
  (71, 7, 'nivel', 5, 0.02), (72, 7, 'nivel', 10, 0.02), (73, 7, 'nivel', 15, 0.03), (74, 7, 'nivel', 20, 0.03),
  (75, 7, 'nivel', 25, 0.04), (76, 7, 'lendario', null, 0.03), (77, 7, 'fas', 2000, 0.03), (78, 7, 'volume', 100, 0.02);

-- ===== privados (só membros; carregados fora do repositório) =====
create table if not exists public.idle_places (
  id int primary key check (id between 1 and 9), nome text not null, frase text not null default '',
  icone text, x int not null, y int not null
);
create table if not exists public.idle_map (id int primary key default 1 check (id = 1), png text not null);
alter table public.idle_places enable row level security;
alter table public.idle_map enable row level security;
revoke all on public.idle_places, public.idle_map from anon, authenticated;
grant select on public.idle_places, public.idle_map to authenticated;
drop policy if exists "idle_places_select_members" on public.idle_places;
create policy "idle_places_select_members" on public.idle_places for select to authenticated using (public.is_member());
drop policy if exists "idle_map_select_members" on public.idle_map;
create policy "idle_map_select_members" on public.idle_map for select to authenticated using (public.is_member());

-- ===== estado (só pelas funções) =====
create table if not exists public.idle_place_state (
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  lugar int not null, aberto_em timestamptz not null default now(),
  moeda double precision not null default 0, nivel int not null default 1 check (nivel between 1 and 25),
  fas double precision not null default 0, volume int not null default 0, lendario boolean not null default false,
  marcos int[] not null default '{}', avancado_em timestamptz not null default now(),
  primary key (user_id, lugar)
);
create table if not exists public.idle_place_prod (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  lugar int not null, nome text not null, partes int[] not null, numero double precision not null,
  criado_em timestamptz not null default now()
);
create index if not exists idle_place_prod_rank on public.idle_place_prod (lugar, numero desc, criado_em, id);
create table if not exists public.idle_place_notes (
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  lugar int not null, tipo text not null, a int not null, b int not null default 0, rotulo int not null,
  primary key (user_id, lugar, tipo, a, b)
);
create table if not exists public.idle_place_challenges (
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  lugar int not null, week_start date not null, desafio int not null, primary key (user_id, lugar, week_start)
);
create table if not exists public.idle_place_weeks (
  week_start date not null, lugar int not null, dono_id uuid, numero double precision, primary key (week_start, lugar)
);
alter table public.idle_place_state enable row level security;
alter table public.idle_place_prod enable row level security;
alter table public.idle_place_notes enable row level security;
alter table public.idle_place_challenges enable row level security;
alter table public.idle_place_weeks enable row level security;
revoke all on public.idle_place_state, public.idle_place_prod, public.idle_place_notes, public.idle_place_challenges,
  public.idle_place_weeks from anon, authenticated;
alter table public.idle_state add column if not exists visto_em timestamptz;

-- provisória: a parte B troca pela de verdade
create or replace function public.idle_place_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$ select 1::double precision $$;

-- quantos lugares abertos e o JSON do mapa (pinos). Sem linha em idle_state: tudo fechado.
create or replace function public.idle_mapa_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'mapa', (select m.png from public.idle_map m where m.id = 1),
    'lugares', (select jsonb_agg(jsonb_build_object(
        'id', c.id, 'faixa', c.faixa, 'lote', c.lote, 'lancado', c.lancado, 'horas', c.horas, 'era', c.era,
        'moeda', c.moeda, 'numero', c.numero,
        'preco', case when s.started then c.horas * 3600 * public.idle_rate(s) else 0 end,
        'nome', p.nome, 'frase', p.frase, 'icone', p.icone, 'x', p.x, 'y', p.y,
        'aberto', st.lugar is not null, 'nivel', st.nivel, 'moeda_qtd', st.moeda, 'fas', st.fas,
        'dono', (select jsonb_build_object('user_id', w.dono_id, 'avatar', public.idle_avatar_json(w.dono_id))
                   from public.idle_place_weeks w
                  where w.lugar = c.id and w.week_start = public.games_week_start() - 7 and w.dono_id is not null))
        order by c.id)
      from public.idle_cat_place c
      left join public.idle_places p on p.id = c.id
      left join public.idle_place_state st on st.user_id = s.user_id and st.lugar = c.id),
    'mult', public.idle_place_mult(s))
$$;

create or replace function public.idle_mapa()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into s from public.idle_state where user_id = auth.uid();
  if not found or not s.started then
    s.user_id := auth.uid(); -- sem empresa: pinos fechados, preço 0
    return public.idle_mapa_json(s);
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  return public.idle_mapa_json(s);
end;
$$;

create or replace function public.idle_place_abrir(p_lugar int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  c       public.idle_cat_place;
  v_preco double precision;
  v_n     int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into c from public.idle_cat_place where id = p_lugar;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if not c.lancado or public.idle_era(s.generators) < c.era then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.idle_place_state where user_id = s.user_id and lugar = p_lugar) then
    raise exception 'idle_lugar_aberto' using errcode = 'P0001';
  end if;
  v_preco := c.horas * 3600 * public.idle_rate(s);
  if v_preco <= 0 or s.valuation < v_preco then
    raise exception 'idle_cant_afford' using errcode = 'P0001';
  end if;
  s.valuation := s.valuation - v_preco;
  perform public.idle_save(s);
  insert into public.idle_place_state (user_id, lugar) values (s.user_id, p_lugar);
  select count(*) into v_n from public.idle_place_state where user_id = s.user_id;
  perform public.idle_ganhar(s.user_id, 'mapa_abriu', v_n);
  return public.idle_json(s) || jsonb_build_object('mapa', public.idle_mapa_json(s));
end;
$$;

revoke all on function public.idle_mapa_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_mapa() from public, anon;
grant execute on function public.idle_mapa() to authenticated;
revoke all on function public.idle_place_abrir(int) from public, anon;
grant execute on function public.idle_place_abrir(int) to authenticated;


-- ===== parte B: nível, marcos, produção da empresa =====

create or replace function public.idle_place_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.sociais from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  )
  select 1
       + coalesce((select sum(m.bonus) from public.idle_place_state st
                     join public.idle_cat_place_marco m on m.id = any (st.marcos)
                    where st.user_id = s.user_id), 0)
         * coalesce((select max((x.sociais ->> 'marcosMult')::double precision) from est x
                      where (x.sociais ->> 'marcosMult') is not null), 1)
       + coalesce((select sum((x.sociais ->> 'porLugar')::double precision) from est x
                    where (x.sociais ->> 'porLugar') is not null), 0)
         * (select count(*) from public.idle_place_state st where st.user_id = s.user_id)
$$;

create or replace function public.idle_place_marcos(p_user uuid, p_lugar int)
returns int[] language plpgsql volatile set search_path = public as $$
declare
  st      public.idle_place_state;
  v_novos int[];
begin
  select * into st from public.idle_place_state where user_id = p_user and lugar = p_lugar for update;
  if not found then
    return '{}';
  end if;
  select coalesce(array_agg(m.id order by m.id), '{}') into v_novos
    from public.idle_cat_place_marco m
   where m.lugar = p_lugar and not (m.id = any (st.marcos))
     and case m.tipo
           when 'nivel' then st.nivel >= m.valor
           when 'lendario' then st.lendario
           when 'fas' then st.fas >= m.valor
           when 'volume' then st.volume >= m.valor
           else false
         end;
  if cardinality(v_novos) > 0 then
    update public.idle_place_state set marcos = marcos || v_novos where user_id = p_user and lugar = p_lugar;
  end if;
  return v_novos;
end;
$$;

-- provisória: a parte C troca pela completa
create or replace function public.idle_lugar_json(s public.idle_state, p_lugar int)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', p_lugar, 'nivel', st.nivel, 'moeda', st.moeda, 'marcos', to_jsonb(st.marcos))
    from public.idle_place_state st where st.user_id = s.user_id and st.lugar = p_lugar
$$;

create or replace function public.idle_place_nivel(p_lugar int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  st      public.idle_place_state;
  c       public.idle_cat_place;
  v_custo double precision;
  v_novos int[];
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  select * into st from public.idle_place_state where user_id = s.user_id and lugar = p_lugar for update;
  if not found then
    raise exception 'idle_lugar_fechado' using errcode = 'P0001';
  end if;
  if st.nivel >= 25 then
    raise exception 'idle_lugar_nivel_max' using errcode = 'P0001';
  end if;
  select * into c from public.idle_cat_place where id = p_lugar;
  v_custo := c.custo_base * power(1.55, st.nivel - 1);
  if st.moeda < v_custo then
    raise exception 'idle_lugar_moeda' using errcode = 'P0001';
  end if;
  perform public.idle_save(s);
  update public.idle_place_state set moeda = moeda - v_custo, nivel = nivel + 1 where user_id = s.user_id and lugar = p_lugar;
  v_novos := public.idle_place_marcos(s.user_id, p_lugar);
  return public.idle_json(s) || jsonb_build_object('lugar', public.idle_lugar_json(s, p_lugar), 'marcos_novos', to_jsonb(v_novos));
end;
$$;

-- produção em t (a da 0051) × o bônus do Mapa do rolê
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
       * public.idle_place_mult(s)
$$;

revoke all on function public.idle_place_mult(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_place_marcos(uuid, int) from public, anon, authenticated;
revoke all on function public.idle_lugar_json(public.idle_state, int) from public, anon, authenticated;
revoke all on function public.idle_rate_at(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_place_nivel(int) from public, anon;
grant execute on function public.idle_place_nivel(int) to authenticated;
