-- fellasapp: Fellas Inc., Mapa do rolê, a moldura (spec 2026-10-12-fellas-inc-mapa-do-role-design.md).
-- Os lugares de verdade (nome, frase, ícone, mapa, posição) NÃO estão aqui: entram por um SQL fora do repositório.
-- Depende da 0064 (estratégias Marca forte/Monopólio e as conquistas mapa_*).

-- ===== catálogo (igual a games/idle/mapa.ts; teste de paridade em idleMapa.test.ts) =====
create table if not exists public.idle_cat_place (
  id int primary key, faixa text not null, horas double precision not null, era int not null, lote int not null,
  lancado boolean not null, custo_base double precision not null, moeda text, numero text,
  moeda_inicial double precision not null default 0
);
-- (a tabela nasce aqui, na 0065 ainda não aplicada; moeda_inicial = a moeda com que o lugar abre)
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
insert into public.idle_cat_place (id, faixa, horas, era, lote, lancado, custo_base, moeda, numero, moeda_inicial) values
  (1, 'barato', 2, 2, 2, false, 100, null, null, 0),
  (2, 'barato', 2, 2, 2, false, 100, null, null, 0),
  (3, 'barato', 2, 2, 1, true, 100, 'cupom', 'pct', 108),
  (4, 'medio', 6, 3, 1, true, 150, 'ficha', 'nota', 0),
  (5, 'medio', 6, 3, 2, false, 150, null, null, 0),
  (6, 'medio', 6, 3, 3, false, 150, null, null, 0),
  (7, 'caro', 16, 4, 1, true, 250, 'gorjeta', 'estrelas', 0),
  (8, 'caro', 16, 4, 3, false, 250, null, null, 0),
  (9, 'caro', 16, 4, 3, false, 250, null, null, 0);
insert into public.idle_cat_place_marco (id, lugar, tipo, valor, bonus) values
  (31, 3, 'nivel', 5, 0.02), (32, 3, 'nivel', 10, 0.02), (33, 3, 'nivel', 15, 0.03), (34, 3, 'nivel', 20, 0.03),
  (35, 3, 'nivel', 25, 0.04), (36, 3, 'lendario', null, 0.03), (37, 3, 'fas', 100000, 0.03), (38, 3, 'volume', 50, 0.02),
  (41, 4, 'nivel', 5, 0.02), (42, 4, 'nivel', 10, 0.02), (43, 4, 'nivel', 15, 0.03), (44, 4, 'nivel', 20, 0.03),
  (45, 4, 'nivel', 25, 0.04), (46, 4, 'lendario', null, 0.03), (47, 4, 'fas', 300, 0.03), (48, 4, 'volume', 30, 0.02),
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
  -- o segundo critério de cada lugar (empate no número: maior desempate ganha; depois, quem fez antes)
  desempate double precision not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists idle_place_prod_rank on public.idle_place_prod (lugar, numero desc, desempate desc, criado_em, id);
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
declare
  s       public.idle_state;
  v_novos int[];
  antes   public.idle_state;
  v_conq  bigint;
  v_mudou boolean;
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
  -- o depois; salva de novo só se ele mexeu no s. estado_mudou = mexeu no s ou deu conquista (a resposta não traz o
  -- idle_json: a tela busca o estado da empresa de novo)
  antes := s;
  v_conq := (select count(*) from public.idle_conquistas c where c.user_id = s.user_id);
  s := public.idle_place_depois(s);
  v_mudou := s is distinct from antes;
  if v_mudou then
    perform public.idle_save(s);
  end if;
  v_mudou := v_mudou or (select count(*) from public.idle_conquistas c where c.user_id = s.user_id) <> v_conq;
  -- marcos que a mecânica alcançou desde a última vez (fechada a conta com a taxa de antes: o bônus vale daqui pra frente)
  v_novos := public.idle_place_marcos_todos(s.user_id);
  return public.idle_mapa_json(s) || jsonb_build_object('marcos_novos', to_jsonb(v_novos), 'estado_mudou', v_mudou);
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
  insert into public.idle_place_state (user_id, lugar, moeda) values (s.user_id, p_lugar, c.moeda_inicial);
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

-- idle_place_marcos de cada lugar aberto, em ordem (idle_lugar e idle_mapa: depois de fechar a conta e salvar)
create or replace function public.idle_place_marcos_todos(p_user uuid)
returns int[] language plpgsql volatile set search_path = public as $$
declare
  v_lugar int;
  v_novos int[] := '{}';
begin
  for v_lugar in select st.lugar from public.idle_place_state st where st.user_id = p_user order by st.lugar loop
    v_novos := v_novos || public.idle_place_marcos(p_user, v_lugar);
  end loop;
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

-- o estado que toda função devolve (o da 0062) + o multiplicador do Mapa do rolê (a página multiplica o "cada" e a caixinha)
-- e quantos lugares a pessoa tem abertos (a porta do Mapa não fica trancada pra quem vendeu a startup e tem lugar)
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
                                      where k.escondida) d), '[]'::jsonb));
end;
$$;

revoke all on function public.idle_place_mult(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_place_marcos(uuid, int) from public, anon, authenticated;
revoke all on function public.idle_place_marcos_todos(uuid) from public, anon, authenticated;
revoke all on function public.idle_lugar_json(public.idle_state, int) from public, anon, authenticated;
revoke all on function public.idle_rate_at(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_place_nivel(int) from public, anon;
grant execute on function public.idle_place_nivel(int) to authenticated;

-- ===== parte C: produções, pódio, placar da semana, desafio, caderninho, foto de segunda =====

-- nome que a pessoa dá à produção: sem espaço nas pontas, de 1 a 30 letras (emoji conta 1), sem quebra de linha, nem as do
-- Unicode (U+0085, U+2028, U+2029) (igual a nomeValido)
create or replace function public.idle_place_nome(p_nome text)
returns text language plpgsql immutable set search_path = public as $$
declare v text := btrim(coalesce(p_nome, ''));
begin
  if char_length(v) < 1 or char_length(v) > 30 or v ~ '[\r\n\u0085\u2028\u2029]' then
    raise exception 'idle_lugar_nome' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- pódio de sempre: os 3 melhores, uma vez por pessoa (a melhor dela); empate no número: maior desempate; depois, quem fez
-- antes (criado_em, id)
create or replace function public.idle_place_podio(p_lugar int)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'user_id', x.user_id, 'nome', x.nome, 'partes', to_jsonb(x.partes),
                                               'numero', x.numero, 'criado_em', x.criado_em,
                                               'avatar', public.idle_avatar_json(x.user_id))
                            order by x.numero desc, x.desempate desc, x.criado_em, x.id), '[]'::jsonb)
    from (select * from (select distinct on (p.user_id) p.*
                           from public.idle_place_prod p where p.lugar = p_lugar
                          order by p.user_id, p.numero desc, p.desempate desc, p.criado_em, p.id) melhor
           order by melhor.numero desc, melhor.desempate desc, melhor.criado_em, melhor.id
           limit 3) x
$$;

-- placar da semana (de segunda 0h a segunda 0h de Brasília): igual ao pódio, só com o que foi feito na semana
create or replace function public.idle_place_semana(p_lugar int, p_semana date default public.games_week_start())
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'numero', x.numero,
                                               'avatar', public.idle_avatar_json(x.user_id))
                            order by x.numero desc, x.desempate desc, x.criado_em, x.id), '[]'::jsonb)
    from (select * from (select distinct on (p.user_id) p.*
                           from public.idle_place_prod p
                          where p.lugar = p_lugar
                            and p.criado_em >= (p_semana::timestamp at time zone 'America/Sao_Paulo')
                            and p.criado_em < ((p_semana + 7)::timestamp at time zone 'America/Sao_Paulo')
                          order by p.user_id, p.numero desc, p.desempate desc, p.criado_em, p.id) melhor
           order by melhor.numero desc, melhor.desempate desc, melhor.criado_em, melhor.id
           limit 3) x
$$;

-- grava a produção; se entrou no pódio de sempre, "Tá no pódio". Devolve o id. p_quando = quando ela aconteceu (resultado
-- que só aparece depois entra na semana em que saiu); p_desempate = o segundo critério do lugar (empate no número).
create or replace function public.idle_place_registrar(p_user uuid, p_lugar int, p_nome text, p_partes int[], p_numero double precision,
                                                       p_quando timestamptz default now(), p_desempate double precision default 0)
returns bigint language plpgsql volatile set search_path = public as $$
declare v_id bigint;
begin
  insert into public.idle_place_prod (user_id, lugar, nome, partes, numero, desempate, criado_em)
  values (p_user, p_lugar, public.idle_place_nome(p_nome), p_partes, p_numero, coalesce(p_desempate, 0), coalesce(p_quando, now()))
  returning id into v_id;
  if exists (select 1 from jsonb_array_elements(public.idle_place_podio(p_lugar)) e where (e ->> 'id')::bigint = v_id) then
    perform public.idle_ganhar(p_user, 'mapa_podio');
  end if;
  return v_id;
end;
$$;

-- sorteio da semana (igual a semanaIdx de games/idle/mapa.ts; teste de paridade com valores fixos): h = semana × 2654435761
-- + lugar × 2246822519 + sal × 3266489917 (mod 2³²) e o índice sai dos bits altos, ⌊h·n / 2³²⌋ (os baixos andavam juntos)
create or replace function public.idle_place_semana_idx(p_lugar int, p_sal int, p_n int, p_semana date default public.games_week_start())
returns int language sql immutable set search_path = public as $$
  select ((((((p_semana - date '2026-01-05') / 7)::bigint * 2654435761 + p_lugar::bigint * 2246822519 + p_sal::bigint * 3266489917)
             % 4294967296 + 4294967296) % 4294967296) * greatest(p_n, 1)::bigint / 4294967296)::int
$$;

-- o desafio desta semana do lugar (linha toda nula se o lugar não tem desafios)
create or replace function public.idle_place_desafio_da_semana(p_lugar int)
returns public.idle_cat_place_desafio language sql stable set search_path = public as $$
  select d.* from public.idle_cat_place_desafio d
   where d.lugar = p_lugar
   order by d.id
  offset public.idle_place_semana_idx(p_lugar, 0, (select count(*)::int from public.idle_cat_place_desafio x where x.lugar = p_lugar))
   limit 1
$$;

-- prestige_spent negativo = pontos ganhos em desafio (o prêmio legado). Fica a trava de não gastar mais do que ganhou
-- (idle_state_prestige_spent_le_earned); sai só a de não ficar abaixo de zero (a da 0041).
alter table public.idle_state drop constraint if exists idle_state_prestige_spent_check;

-- paga o prêmio do desafio da semana se é desse tipo, o valor alcança e ainda não foi feito. Não salva: quem chama salva.
create or replace function public.idle_place_desafio(s public.idle_state, p_lugar int, p_tipo text, p_valor double precision)
returns public.idle_state language plpgsql volatile set search_path = public as $$
declare d public.idle_cat_place_desafio;
begin
  d := public.idle_place_desafio_da_semana(p_lugar);
  if d.id is null or d.tipo <> p_tipo or (d.valor is not null and coalesce(p_valor, -1e308) < d.valor) then
    return s;
  end if;
  insert into public.idle_place_challenges (user_id, lugar, week_start, desafio)
  values (s.user_id, p_lugar, public.games_week_start(), d.id)
  on conflict do nothing;
  if not found then
    return s; -- já fez nesta semana
  end if;
  if d.premio = 'horas' then
    s.valuation := s.valuation + d.premio_valor * 3600 * public.idle_rate(s);
  elsif d.premio = 'investidor' then
    s.valuation := s.valuation + 1200 * public.idle_rate(s);
  else -- legado: pontos pra gastar na árvore, sem mexer no que a próxima venda rende
    s.prestige_spent := s.prestige_spent - d.premio_valor::int;
  end if;
  return s;
end;
$$;

-- caderninho: o rótulo que a pessoa deu (upsert)
create or replace function public.idle_place_nota(p_user uuid, p_lugar int, p_tipo text, p_a int, p_b int, p_rotulo int)
returns void language sql volatile set search_path = public as $$
  insert into public.idle_place_notes (user_id, lugar, tipo, a, b, rotulo) values (p_user, p_lugar, p_tipo, p_a, p_b, p_rotulo)
  on conflict (user_id, lugar, tipo, a, b) do update set rotulo = excluded.rotulo
$$;

-- ===== o contrato das partes 2 a 4 (camisetaria = tee/3, copão = cup/4, jantar = din/7; o mesmo em games/idle/mecanicas.ts) =====
-- * Cada lugar troca só os stubs dele: idle_<x>_avancar(s), idle_<x>_depois(s) e idle_<x>_json(s). Os despachantes abaixo
--   (idle_place_avancar, idle_place_depois e idle_place_mecanica_json) já chamam os nove e não mudam mais.
-- * O que precisa da conta fechada (registrar, caderninho, desafio, conquistas) vai no idle_<x>_depois, que devolve o s (o
--   prêmio de desafio mexe no valuation). O idle_<x>_depois é idempotente (uma marca por linha, ex.: revelada: rodar duas
--   vezes não paga duas vezes), trata os resultados na ordem em que aconteceram e registra cada um com p_quando = a hora
--   em que aconteceu (o que acabou longe da pessoa entra na semana certa).
-- * Quem roda o depois: idle_lugar e idle_mapa (salvam de novo só se o s mudou e devolvem estado_mudou, que faz a tela
--   buscar o estado da empresa) e as RPCs de mecânica, pelo idle_place_responder. idle_place_nivel e idle_place_abrir
--   não rodam o depois.
-- * RPC de mecânica (idle_tee_*, idle_cup_*, idle_din_*): trava + fecha a conta (idle_settle(idle_lock(auth.uid()))), salva
--   (idle_save), só então mexe no lugar e termina com `return public.idle_place_responder(s, p_lugar)` (o depois, o save,
--   os marcos de todos os lugares pelo idle_place_marcos_todos e a resposta padrão idle_json(s) || {lugar, marcos_novos}).
--   Grant só na RPC; tudo que é ajudante fica revogado de public, anon e authenticated (o regex de shared/api.ts é só
--   cosmético: quem protege é o revoke).
-- * O JSON da mecânica traz o último resultado que terminou (`ultima`, com tudo pra tela mostrar): o que ficou pronto e
--   acabou com a pessoa longe é mostrado na próxima visita (a revelação atrasada; a camisetaria é o exemplo).
-- * Erro novo: o código vai em games/shared/errors.ts (FROM_DB e ERROR_TEXT) e, se a tela precisa buscar o lugar de novo,
--   em RECARREGA_MAPA de games/idle/main.ts.
-- * idle_place_mecanica_json e os idle_<x>_json são estáveis: só leem, nunca escrevem (rodam dentro do idle_lugar_json).
-- * visto_em só é lido dentro de idle_<x>_avancar (null = a pessoa nunca passou). O s que chega é o de antes do idle_lock
--   marcar o visto_em de agora, então s.visto_em é a última visita antes desta.
-- * libera(n) (mecanicas.ts) = o que o nível n traz, sendo n o nível que se alcança (nivel + 1).
-- * idle_place_registrar, idle_place_desafio, idle_place_nota e idle_place_marcos só com o estado travado, a conta fechada e
--   salva antes. Marcos e conquistas nunca dentro do avancar (ele roda no meio do idle_lock).

-- stubs de cada lugar (as partes 2 a 4 trocam pelo de verdade): andar até agora e o JSON da mecânica
create or replace function public.idle_tee_avancar(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$ begin return; end; $$;
create or replace function public.idle_cup_avancar(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$ begin return; end; $$;
create or replace function public.idle_din_avancar(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$ begin return; end; $$;
-- o que precisa da conta fechada (registrar, caderninho, desafio, conquistas): devolve o s (o prêmio de desafio mexe no valuation)
create or replace function public.idle_tee_depois(s public.idle_state)
returns public.idle_state language plpgsql volatile set search_path = public as $$ begin return s; end; $$;
create or replace function public.idle_cup_depois(s public.idle_state)
returns public.idle_state language plpgsql volatile set search_path = public as $$ begin return s; end; $$;
create or replace function public.idle_din_depois(s public.idle_state)
returns public.idle_state language plpgsql volatile set search_path = public as $$ begin return s; end; $$;
create or replace function public.idle_tee_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$ select null::jsonb $$;
create or replace function public.idle_cup_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$ select null::jsonb $$;
create or replace function public.idle_din_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$ select null::jsonb $$;

-- anda os lugares abertos até agora: o de cada lugar só se ele está aberto para a pessoa
create or replace function public.idle_place_avancar(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
begin
  if exists (select 1 from public.idle_place_state where user_id = s.user_id and lugar = 3) then
    perform public.idle_tee_avancar(s);
  end if;
  if exists (select 1 from public.idle_place_state where user_id = s.user_id and lugar = 4) then
    perform public.idle_cup_avancar(s);
  end if;
  if exists (select 1 from public.idle_place_state where user_id = s.user_id and lugar = 7) then
    perform public.idle_din_avancar(s);
  end if;
  update public.idle_place_state set avancado_em = now() where user_id = s.user_id and avancado_em < now();
end;
$$;

-- depois da conta fechada e salva: o "depois" de cada lugar aberto (devolve o s; o prêmio de desafio mexe no valuation)
create or replace function public.idle_place_depois(s public.idle_state)
returns public.idle_state language plpgsql volatile set search_path = public as $$
begin
  if exists (select 1 from public.idle_place_state where user_id = s.user_id and lugar = 3) then
    s := public.idle_tee_depois(s);
  end if;
  if exists (select 1 from public.idle_place_state where user_id = s.user_id and lugar = 4) then
    s := public.idle_cup_depois(s);
  end if;
  if exists (select 1 from public.idle_place_state where user_id = s.user_id and lugar = 7) then
    s := public.idle_din_depois(s);
  end if;
  return s;
end;
$$;

-- o JSON da mecânica de cada lugar (depois dos stubs: função sql confere as chamadas quando é criada)
create or replace function public.idle_place_mecanica_json(s public.idle_state, p_lugar int)
returns jsonb language sql stable set search_path = public as $$
  select case p_lugar
           when 3 then public.idle_tee_json(s)
           when 4 then public.idle_cup_json(s)
           when 7 then public.idle_din_json(s)
         end
$$;

-- a tela do lugar (substitui a provisória da parte B)
create or replace function public.idle_lugar_json(s public.idle_state, p_lugar int)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'moeda_nome', c.moeda, 'numero', c.numero, 'lancado', c.lancado,
    'nome', p.nome, 'frase', p.frase, 'icone', p.icone,
    'aberto', st.lugar is not null, 'nivel', st.nivel, 'moeda', st.moeda, 'fas', st.fas, 'volume', st.volume,
    'lendario', st.lendario, 'marcos', to_jsonb(coalesce(st.marcos, '{}')),
    'preco_nivel', case when st.nivel < 25 then c.custo_base * power(1.55, st.nivel - 1) end,
    'desafio', (select jsonb_build_object('id', d.id, 'texto', d.texto, 'premio', d.premio, 'premio_valor', d.premio_valor,
                                          'feito', exists (select 1 from public.idle_place_challenges ch
                                                            where ch.user_id = s.user_id and ch.lugar = c.id
                                                              and ch.week_start = public.games_week_start()))
                  from public.idle_place_desafio_da_semana(c.id) d where d.id is not null),
    'podio', public.idle_place_podio(c.id),
    'semana', public.idle_place_semana(c.id),
    'dono', (select jsonb_build_object('user_id', w.dono_id, 'numero', w.numero, 'avatar', public.idle_avatar_json(w.dono_id))
               from public.idle_place_weeks w
              where w.lugar = c.id and w.week_start = public.games_week_start() - 7 and w.dono_id is not null),
    'caderninho', coalesce((select jsonb_agg(jsonb_build_object('tipo', n.tipo, 'a', n.a, 'b', n.b, 'rotulo', n.rotulo)
                                             order by n.tipo, n.a, n.b)
                              from public.idle_place_notes n where n.user_id = s.user_id and n.lugar = c.id), '[]'::jsonb),
    'mecanica', public.idle_place_mecanica_json(s, c.id),
    'server_now', now())
  from public.idle_cat_place c
  left join public.idle_places p on p.id = c.id
  left join public.idle_place_state st on st.user_id = s.user_id and st.lugar = c.id
  where c.id = p_lugar
$$;

-- fim de toda RPC de mecânica: roda o depois, salva e devolve a resposta padrão
create or replace function public.idle_place_responder(s public.idle_state, p_lugar int)
returns jsonb language plpgsql volatile set search_path = public as $$
declare
  v int[];
begin
  s := public.idle_place_depois(s);
  perform public.idle_save(s);
  v := public.idle_place_marcos_todos(s.user_id);
  return public.idle_json(s) || jsonb_build_object('lugar', public.idle_lugar_json(s, p_lugar), 'marcos_novos', to_jsonb(v));
end;
$$;

create or replace function public.idle_lugar(p_lugar int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  v_novos int[];
  antes   public.idle_state;
  v_conq  bigint;
  v_mudou boolean;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if not exists (select 1 from public.idle_cat_place where id = p_lugar) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  -- o depois; salva de novo só se ele mexeu no s. estado_mudou = mexeu no s ou deu conquista (a resposta não traz o
  -- idle_json: a tela busca o estado da empresa de novo)
  antes := s;
  v_conq := (select count(*) from public.idle_conquistas c where c.user_id = s.user_id);
  s := public.idle_place_depois(s);
  v_mudou := s is distinct from antes;
  if v_mudou then
    perform public.idle_save(s);
  end if;
  v_mudou := v_mudou or (select count(*) from public.idle_conquistas c where c.user_id = s.user_id) <> v_conq;
  -- marcos que a mecânica alcançou desde a última vez (fechada a conta com a taxa de antes: o bônus vale daqui pra frente)
  v_novos := public.idle_place_marcos_todos(s.user_id);
  return public.idle_lugar_json(s, p_lugar) || jsonb_build_object('marcos_novos', to_jsonb(v_novos), 'estado_mudou', v_mudou);
end;
$$;

-- foto da semana que acabou (a da 0041) + o dono do pedaço de cada lugar do Mapa do rolê
create or replace function public.idle_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_new    date := public.games_week_start();
  v_old    date := public.games_week_start() - 7;
  v_podium jsonb;
  v_champ  uuid;
  v_gravou date;
  v_dono   uuid;
begin
  perform pg_advisory_xact_lock(hashtext('fellas-inc-semana')); -- uma foto por vez
  if exists (select 1 from public.idle_weeks where week_start = v_old) then
    return;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'valuation', x.v, 'rate', x.rate, 'era', x.era,
                                               'strategies', to_jsonb(x.strategies)) order by x.rate desc, x.v desc, x.user_id), '[]')
    into v_podium
    from (select s.user_id,
                 (public.idle_settle(s, greatest(s.settled_at, v_new::timestamp at time zone 'America/Sao_Paulo'))).valuation as v,
                 -- a taxa da meia-noite usa os geradores e estratégias de agora (só os contratos são os de 00:00)
                 public.idle_rate_at(s, v_new::timestamp at time zone 'America/Sao_Paulo') as rate,
                 public.idle_era(s.generators) as era, s.strategies
            from public.idle_state s
           where s.started and s.week_start < v_new
           order by 3 desc, 2 desc, 1
           limit 3) x;
  -- Mapa do rolê: o 1º da semana em cada lugar vira o dono do pedaço da semana seguinte (0065)
  insert into public.idle_place_weeks (week_start, lugar, dono_id, numero)
  select v_old, c.id, (sem.x -> 0 ->> 'user_id')::uuid, (sem.x -> 0 ->> 'numero')::double precision
    from public.idle_cat_place c
    cross join lateral (select public.idle_place_semana(c.id, v_old) as x) sem
   where jsonb_array_length(sem.x) > 0
  on conflict (week_start, lugar) do nothing;
  if jsonb_array_length(v_podium) = 0 then
    -- sem placa o idle_lock não refaz a foto: pode dar a conquista aqui
    for v_dono in select distinct w.dono_id from public.idle_place_weeks w
                   where w.week_start = v_old and w.dono_id is not null order by 1 loop
      perform public.idle_fechar_e_ganhar(v_dono, 'mapa_dono');
    end loop;
    return; -- ninguém jogava antes desta semana: sem placa
  end if;
  v_champ := (v_podium -> 0 ->> 'user_id')::uuid;
  insert into public.idle_weeks (week_start, unicorn_id, podium, most_hired_id)
  values (v_old, v_champ, v_podium, public.idle_most_hired(v_old))
  on conflict (week_start) do nothing
  returning week_start into v_gravou;
  if v_gravou is not null then
    update public.profiles set badges = array_remove(badges, 'weekly_unicorn') where 'weekly_unicorn' = any (badges);
    if v_champ is not null then
      update public.profiles set badges = array_append(badges, 'weekly_unicorn') where id = v_champ;
      perform public.idle_fechar_e_ganhar(v_champ, 'unicornio');
    end if;
  end if;
  -- depois da placa gravada (antes, o idle_lock do idle_fechar_e_ganhar refaria a foto: recursão)
  for v_dono in select distinct w.dono_id from public.idle_place_weeks w
                 where w.week_start = v_old and w.dono_id is not null order by 1 loop
    perform public.idle_fechar_e_ganhar(v_dono, 'mapa_dono');
  end loop;
end;
$$;

-- trava (a da 0048) + os lugares andam até agora + visto_em (as mecânicas sabem se a pessoa passou desde o último ciclo)
create or replace function public.idle_lock(p_user uuid)
returns public.idle_state language plpgsql volatile set search_path = public as $$
declare
  s public.idle_state;
begin
  if not exists (select 1 from public.idle_weeks where week_start = public.games_week_start() - 7)
     and exists (select 1 from public.idle_state where started and week_start < public.games_week_start()) then
    perform public.idle_weekly_reset();
  end if;
  insert into public.idle_state (user_id, week_start) values (p_user, public.games_week_start())
  on conflict (user_id) do update set user_id = excluded.user_id
  returning * into s;
  perform public.idle_horta_avancar(s); -- a horta anda até agora antes de qualquer conta
  perform public.idle_place_avancar(s); -- os lugares do Mapa do rolê andam até agora (0065)
  -- só quando é a própria pessoa (travada por outro ou pelo cron não conta); o s devolvido fica com o visto_em antigo
  update public.idle_state set visto_em = now() where user_id = p_user and p_user = auth.uid();
  return s;
end;
$$;

revoke all on function public.idle_place_nome(text) from public, anon, authenticated;
revoke all on function public.idle_place_podio(int) from public, anon, authenticated;
revoke all on function public.idle_place_semana(int, date) from public, anon, authenticated;
revoke all on function public.idle_place_registrar(uuid, int, text, int[], double precision, timestamptz, double precision)
  from public, anon, authenticated;
revoke all on function public.idle_place_semana_idx(int, int, int, date) from public, anon, authenticated;
revoke all on function public.idle_place_desafio_da_semana(int) from public, anon, authenticated;
revoke all on function public.idle_place_desafio(public.idle_state, int, text, double precision) from public, anon, authenticated;
revoke all on function public.idle_place_nota(uuid, int, text, int, int, int) from public, anon, authenticated;
revoke all on function public.idle_tee_depois(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_cup_depois(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_din_depois(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_place_depois(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_place_responder(public.idle_state, int) from public, anon, authenticated;
revoke all on function public.idle_tee_avancar(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_cup_avancar(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_din_avancar(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_tee_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_cup_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_din_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_place_avancar(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_place_mecanica_json(public.idle_state, int) from public, anon, authenticated;
revoke all on function public.idle_lugar_json(public.idle_state, int) from public, anon, authenticated;
revoke all on function public.idle_lugar(int) from public, anon;
grant execute on function public.idle_lugar(int) to authenticated;
revoke all on function public.idle_weekly_reset() from public, anon, authenticated;
revoke all on function public.idle_lock(uuid) from public, anon, authenticated;
