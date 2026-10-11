-- fellasapp: Fellas Inc., entrega 3 (prestígio e conquistas). "Vender a startup" troca a empresa por pontos de
-- prestígio, que se gastam numa árvore de habilidades (os nós comprados é que dão efeito, pra sempre); as conquistas
-- dão +1% cada, pra sempre. A Fellas Inc. continua sem reset (0036): só o jogador zera a própria empresa, vendendo;
-- nada aqui apaga estado, contrato, ponto, nó ou conquista. As funções que mudam são trocadas com create or replace a
-- partir da versão mais nova (0034, 0036 ou 0038, já em produção). As contas existem iguais em games/idle/economia.ts
-- e oportunidades.ts (teste de paridade). Depende da 0040 (catálogo das conquistas e da árvore). Não toca nos créditos
-- do cassino. Idempotente.

-- ===== o que fica pra sempre (a venda não zera) =====

alter table public.idle_state
  add column if not exists prestige_earned int not null default 0 check (prestige_earned >= 0),
  add column if not exists prestige_spent  int not null default 0 check (prestige_spent >= 0),
  add column if not exists prestige_count  int not null default 0,
  add column if not exists best_rate       double precision not null default 0,
  add column if not exists upg_total       int not null default 0,
  add column if not exists opp_total       int not null default 0,
  add column if not exists hire_total      int not null default 0,
  add column if not exists hired_total     int not null default 0,
  add column if not exists est_usadas      int[] not null default '{}',
  add column if not exists opp_recent      timestamptz[] not null default '{}';

-- sem chave estrangeira pro catálogo: a migração do catálogo apaga e regrava idle_cat_conquista
create table if not exists public.idle_conquistas (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  conquista_id int not null,
  ganhou_em    timestamptz not null default now(),
  primary key (user_id, conquista_id)
);

alter table public.idle_conquistas enable row level security;
revoke all on public.idle_conquistas from anon, authenticated;
grant select on public.idle_conquistas to authenticated;
drop policy if exists "idle_conquistas_select_members" on public.idle_conquistas;
create policy "idle_conquistas_select_members" on public.idle_conquistas for select to authenticated using (public.is_member());

-- os nós da árvore que cada um comprou (sem chave estrangeira pro catálogo, pelo mesmo motivo)
create table if not exists public.idle_arvore (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  no_id       int not null,
  comprado_em timestamptz not null default now(),
  primary key (user_id, no_id)
);

alter table public.idle_arvore enable row level security;
revoke all on public.idle_arvore from anon, authenticated;
grant select on public.idle_arvore to authenticated;
drop policy if exists "idle_arvore_select_members" on public.idle_arvore;
create policy "idle_arvore_select_members" on public.idle_arvore for select to authenticated using (public.is_member());

-- ===== a conta com a árvore e as conquistas =====

-- as estratégias escolhidas agora, como códigos era·10 + opção (a 2 da era 4 = 42)
create or replace function public.idle_est_codigos(p smallint[])
returns int[] language sql immutable as $$
  select coalesce(array_agg((k + 1) * 10 + p[k] order by k), '{}') from generate_subscripts(p, 1) k where p[k] >= 0
$$;

-- o valor dos nós de um tipo que alguém comprou, juntados por p_agg ('mult', 'max', 'min' ou 'soma') já com o padrão
-- dentro: 'max' e 'min' nunca passam de p_padrao pro lado errado e sem nó desse tipo sai p_padrao (igual a economia.ts
-- efeitosArvore). Cada nó conta uma vez (a chave primária de idle_arvore).
create or replace function public.idle_arv(u uuid, p_tipo text, p_agg text, p_padrao double precision)
returns double precision language sql stable set search_path = public as $$
  select case p_agg
           when 'mult' then coalesce(exp(sum(ln(c.valor))), p_padrao)
           when 'max' then greatest(p_padrao, max(c.valor))
           when 'min' then least(p_padrao, min(c.valor))
           else coalesce(sum(c.valor), p_padrao)
         end
    from public.idle_arvore a
    join public.idle_cat_no c on c.id = a.no_id
   where a.user_id = u and c.tipo = p_tipo
$$;

-- tudo que a árvore de alguém faz, com os nomes de economia.ts efeitosArvore (teste de paridade). Os padrões são os de
-- economia.ts: teto 8h (TETO_SEGUNDOS), caixinha 3 (CAIXA_PADRAO), 10 s na cena (OPP_SEGUNDOS_PADRAO), +0 por dia
-- (o 10 de LIMITE_DIA está em idle_opp_cap).
create or replace function public.idle_arvore_efeitos(u uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'producao', public.idle_arv(u, 'producao', 'mult', 1),
    'tetoS', 3600 * public.idle_arv(u, 'teto', 'max', 8),
    'caixinha', public.idle_arv(u, 'caixinha', 'max', 3),
    'oppSegundos', public.idle_arv(u, 'segundos', 'max', 10),
    'oppExtra', public.idle_arv(u, 'opp_extra', 'soma', 0),
    'oppBonus', public.idle_arv(u, 'opp_bonus', 'mult', 1),
    'contratoPreco', public.idle_arv(u, 'contrato_preco', 'min', 1),
    'porContratado', public.idle_arv(u, 'por_contratado', 'max', 0.1),
    'contratoDias', public.idle_arv(u, 'contrato_dias', 'max', 7),
    'empregoMult', public.idle_arv(u, 'emprego_mult', 'max', 1),
    'inicioValuation', public.idle_arv(u, 'inicio_valuation', 'max', 10),
    'inicioNotebooks', public.idle_arv(u, 'inicio_notebooks', 'max', 1),
    'inicioEra1', public.idle_arv(u, 'inicio_era1', 'max', 0) > 0,
    'manterGerais', public.idle_arv(u, 'manter_gerais', 'max', 0) > 0)
$$;

-- nós de produção da árvore × (1 + 1% por conquista) (igual a economia.ts multBonus)
create or replace function public.idle_bonus_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_arv(s.user_id, 'producao', 'mult', 1)
       * (1 + 0.01::double precision * (select count(*) from public.idle_conquistas c where c.user_id = s.user_id))
$$;

-- produção por segundo em t (a da 0038 × árvore e conquistas; igual a economia.ts taxa)
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
       * public.idle_bonus_mult(s)
$$;

-- pontos de prestígio que um F$/s vale: floor(cbrt(r / K)), K = 1e6 (games/idle/simulacao.test.ts). Exato nos cubos
-- (sem erro de arredondamento do cbrt) e sem divisão na conferência (n³·K <= r), igual a economia.ts pontosTotais.
create or replace function public.idle_prestige_total(r double precision)
returns int language plpgsql immutable as $$
declare
  n int;
begin
  -- nulo, NaN, Infinity, zero e negativo não valem nada; de 1e9 pontos pra cima (r finito) trava (cabe em int), como
  -- economia.ts pontosTotais
  if r is null or r = 'NaN'::double precision or r = 'Infinity'::double precision or r <= 0 then
    return 0;
  end if;
  if r >= 1e33 then
    return 1000000000;
  end if;
  n := floor(cbrt(r / 1e6))::int;
  while n > 0 and n::double precision ^ 3 * 1e6 > r loop
    n := n - 1;
  end loop;
  while (n + 1)::double precision ^ 3 * 1e6 <= r loop
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- multiplicador dos contratos ativos em t (o da 0038 + a árvore: o nó Aniversariante do mês paga 15% por contratado, como a
-- Cultura de startup, sem somar; o nó Passe de craque dobra o que cada empresa que te contratou rende pra você; o piso
-- de freela não muda). Igual a economia.ts multContratos.
create or replace function public.idle_social_mult(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.sociais from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  )
  select 1 + coalesce((select exp(sum(ln((x.sociais ->> 'contratoEfeitoMult')::double precision))) from est x
                        where (x.sociais ->> 'contratoEfeitoMult') is not null), 1)
           * (greatest(coalesce((select max((x.sociais ->> 'porContratado')::double precision) from est x
                                  where (x.sociais ->> 'porContratado') is not null), 0.1),
                       public.idle_arv(s.user_id, 'por_contratado', 'max', 0.1))
                * (select count(*) from public.idle_contracts c
                    where c.employer_id = s.user_id and c.created_at <= t and c.ends_at > t)
              + coalesce((select sum(0.02 * public.idle_employee_mult(c.employer_id)
                                     * public.idle_arv(s.user_id, 'emprego_mult', 'max', 1))
                            from public.idle_contracts c
                           where c.employee_id = s.user_id and c.created_at <= t and c.ends_at > t), 0.02))
$$;

-- fecha a conta até ts (a da 0038), com o teto do offline da árvore (8h sem o ramo Tempo; igual a economia.ts
-- acumularTrechos)
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

-- caixinha (a da 0034) com a árvore: guarda as `caixinha` mais recentes (3 sem o ramo Oportunidades) que têm menos de 4h
-- (VALIDADE_S) e são desta semana; só depois tira as pegas (igual a oportunidades.ts pendentes)
create or replace function public.idle_opp_list(s public.idle_state, ts timestamptz default now())
returns bigint[] language sql stable set search_path = public as $$
  with v as (
    select make_interval(secs => 4 * 3600) as validade
  )
  select coalesce(array_agg(w order by w desc), '{}') from (
    select w
      from v, generate_series(floor(extract(epoch from ts - v.validade) / 600)::bigint,
                              floor(extract(epoch from ts) / 600)::bigint) w
     where public.idle_opp_at(s.user_id, w) <= ts
       and public.idle_opp_at(s.user_id, w) >= ts - v.validade
       and public.idle_opp_at(s.user_id, w) >= (s.week_start::timestamp at time zone 'America/Sao_Paulo')
     order by w desc
     limit public.idle_arv(s.user_id, 'caixinha', 'max', 3)::int
  ) x
  where not coalesce(w = any (s.opp_claimed), false)
$$;

-- limite de oportunidades por dia (o da 0034) + o nó Relâmpago da Shopee
create or replace function public.idle_opp_cap(s public.idle_state)
returns int language sql stable set search_path = public as $$
  select 10 + coalesce((select sum(e.opp_extra)::int from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]), 0)
            + public.idle_arv(s.user_id, 'opp_extra', 'soma', 0)::int
$$;

-- preço do próximo contrato (o da 0038) × o desconto da árvore (igual a economia.ts precoContrato)
create or replace function public.idle_hire_price(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_rate(s) * 1800
       * power(1.5::double precision, (select count(*) from public.idle_contracts c
                                        where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()))
       * coalesce((select exp(sum(ln((e.sociais ->> 'contratoCustoMult')::double precision)))
                     from public.idle_cat_est e
                    where e.opcao = s.strategies[e.era - 1] and (e.sociais ->> 'contratoCustoMult') is not null), 1)
       * public.idle_arv(s.user_id, 'contrato_preco', 'min', 1)
$$;

revoke all on function public.idle_est_codigos(smallint[]) from public, anon, authenticated;
revoke all on function public.idle_arv(uuid, text, text, double precision) from public, anon, authenticated;
revoke all on function public.idle_arvore_efeitos(uuid) from public, anon, authenticated;
revoke all on function public.idle_bonus_mult(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_social_mult(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_opp_list(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_opp_cap(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_hire_price(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_rate_at(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_prestige_total(double precision) from public, anon, authenticated;

-- ===== conquistas =====

-- conquistas de evento: quem viu o evento ganha as do tipo (com valor até p_valor, quando a conquista pede um)
create or replace function public.idle_ganhar(p_user uuid, p_tipo text, p_valor double precision default null)
returns void language sql volatile set search_path = public as $$
  insert into public.idle_conquistas (user_id, conquista_id)
  select p_user, c.id
    from public.idle_cat_conquista c
   where c.tipo = p_tipo
     and (c.valor is null or c.valor <= p_valor)
  on conflict do nothing
$$;

-- 3h da manhã em Brasília (conquista "3h06")
create or replace function public.idle_madrugada(ts timestamptz default now())
returns boolean language sql stable as $$
  select extract(hour from ts at time zone 'America/Sao_Paulo') = 3
$$;

-- confere as conquistas "de estado" de alguém e grava as novas (com a hora desta transação). Roda no idle_save, o
-- último passo de toda função que muda o jogo, sempre depois de fechar a conta: a conquista nova só vale dali pra
-- frente. Devolve as que ganhou agora.
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
             else false
           end
    on conflict do nothing
    returning conquista_id
  )
  select coalesce(array_agg(conquista_id order by conquista_id), '{}') into v_novas from novas;
  return v_novas;
end;
$$;

-- gravar o estado (o da 0036 + o que é permanente e as estratégias já usadas), conferir as conquistas e guardar o
-- recorde de F$/s. Toda função que muda o jogo termina aqui, depois de fechar a conta. As janelas de oportunidade já
-- pegas valem até 6h com a árvore: guarda as das últimas 10h.
create or replace function public.idle_save(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
begin
  update public.idle_state
     set started = s.started, valuation = s.valuation, generators = s.generators, upgrades = s.upgrades,
         strategies = s.strategies, boost_until = s.boost_until, half_price = s.half_price,
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

-- o estado que toda função do jogo devolve: o da 0038 + bônus (os nós comprados e quantas conquistas), pontos livres
-- e ganhos na vida, vendas, recorde de F$/s, quantos pontos a venda daria agora, suas conquistas, as ganhas nesta
-- chamada (a tela avisa) e as escondidas que alguém do grupo já tem (a tela mostra "???").
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_rate double precision := public.idle_rate(s);
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', v_rate, 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
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

revoke all on function public.idle_ganhar(uuid, text, double precision) from public, anon, authenticated;
revoke all on function public.idle_madrugada(timestamptz) from public, anon, authenticated;
revoke all on function public.idle_check_conquistas(uuid) from public, anon, authenticated;
revoke all on function public.idle_save(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_json(public.idle_state) from public, anon, authenticated;

-- ===== as funções que contam o que as conquistas pedem =====

-- abrir o jogo (a da 0034) + "3h06"
create or replace function public.idle_open()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  if public.idle_madrugada() then
    perform public.idle_ganhar(s.user_id, 'madrugada');
  end if;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- comprar (a da 0034) + conta as melhorias compradas e o "Tá saindo da jaula" (Máx com 100 ou mais)
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
    if s.half_price then
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

-- pegar oportunidade (a da 0034) + o bônus da árvore (Xepa da feira) + conta as pegas e guarda a hora das 3 últimas
-- ("Brainrot")
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
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult;
    when 1 then s.boost_until := greatest(now(), coalesce(s.boost_until, now())) + make_interval(secs => 60 * v_mult);
    else s.half_price := true;
  end case;
  s.opp_claimed := array_append(s.opp_claimed, p_window);
  s.opp_count := s.opp_count + 1;
  s.opp_total := s.opp_total + 1;
  s.opp_recent := array_append(s.opp_recent, now());
  s.opp_recent := s.opp_recent[greatest(1, cardinality(s.opp_recent) - 2):];
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- contratar (a da 0038) + o contrato dura 10 dias com o nó Carteira assinada de quem contrata + conta os contratos
-- dos dois lados
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
  o := public.idle_settle(o); -- o contratado rende até agora com a regra antiga
  o.hired_total := o.hired_total + 1;
  perform public.idle_save(o);
  select k.nome into v_cargo from public.idle_cat_cargo k order by random() limit 1;
  insert into public.idle_contracts (employer_id, employee_id, cargo, created_at, ends_at)
  values (v_me, p_user, coalesce(v_cargo, 'freela'), now(),
          now() + make_interval(days => greatest(7, public.idle_arv(v_me, 'contrato_dias', 'max', 7))::int));
  s.hire_total := s.hire_total + 1;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_open() from public, anon;
grant execute on function public.idle_open() to authenticated;
revoke all on function public.idle_buy(text, int, int) from public, anon;
grant execute on function public.idle_buy(text, int, int) to authenticated;
revoke all on function public.idle_claim_opportunity(bigint) from public, anon;
grant execute on function public.idle_claim_opportunity(bigint) to authenticated;
revoke all on function public.idle_hire(uuid) from public, anon;
grant execute on function public.idle_hire(uuid) to authenticated;

-- ===== a árvore e o "Abrir CNPJ" =====

-- comprar um nó: com pontos livres (ganhos na vida − gastos), o anterior do ramo comprado (o 1º de cada ramo pede a
-- raiz) e sem repetir. Fecha a conta antes (o nó pode mudar a taxa, o teto e a caixinha dali pra frente). Dá pra
-- comprar com a empresa fechada (entre a venda e o novo "Abrir CNPJ").
create or replace function public.idle_buy_node(p_no int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
  n public.idle_cat_no;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  select * into n from public.idle_cat_no where id = p_no;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.idle_arvore a where a.user_id = s.user_id and a.no_id = p_no) then
    raise exception 'idle_node_owned' using errcode = 'P0001';
  end if;
  if n.requer is not null
     and not exists (select 1 from public.idle_arvore a where a.user_id = s.user_id and a.no_id = n.requer) then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if s.prestige_earned - s.prestige_spent < n.custo then
    raise exception 'idle_points_low' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s); -- o tempo até agora rende sem o nó
  insert into public.idle_arvore (user_id, no_id) values (s.user_id, p_no);
  s.prestige_spent := s.prestige_spent + n.custo;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- "Abrir CNPJ" (o da 0034) com o ramo Recomeço: F$ 10 (F$ 1 mil, F$ 1 mi), 1 notebook (10), 1 de cada gerador da
-- era 1 (Material escolar completo). As melhorias gerais mantidas pela venda já estão no estado. Igual a economia.ts abertura.
create or replace function public.idle_start()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
  g int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if s.started then
    raise exception 'idle_started' using errcode = 'P0001';
  end if;
  s.started := true;
  s.valuation := greatest(10, public.idle_arv(s.user_id, 'inicio_valuation', 'max', 10));
  s.generators[1] := greatest(1, public.idle_arv(s.user_id, 'inicio_notebooks', 'max', 1))::int;
  if public.idle_arv(s.user_id, 'inicio_era1', 'max', 0) > 0 then
    for g in select c.id from public.idle_cat_gen c where c.era = 1 loop
      s.generators[g] := greatest(s.generators[g], 1);
    end loop;
  end if;
  s.settled_at := now();
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_buy_node(int) from public, anon;
grant execute on function public.idle_buy_node(int) to authenticated;
revoke all on function public.idle_start() from public, anon;
grant execute on function public.idle_start() to authenticated;

-- ===== vender a startup =====

-- fecha a conta de quem o dono contratou: os contratos ativos e os já vencidos cujo trecho ainda não foi fechado (a
-- estratégia atual do dono vale pra qualquer instante, então sem fechar antes a regra nova viraria retroativa). Trava o
-- dono e essa equipe na ordem de user_id (idle_lock_all). Devolve a equipe travada. Igual ao que idle_pick_strategy (0038) faz.
create or replace function public.idle_fechar_equipe(p_user uuid)
returns uuid[] language plpgsql volatile set search_path = public as $$
declare
  x      public.idle_state;
  v_team uuid[];
begin
  select coalesce(array_agg(distinct c.employee_id), '{}'::uuid[]) into v_team
    from public.idle_contracts c
    join public.idle_state es on es.user_id = c.employee_id
   where c.employer_id = p_user and c.ends_at > es.settled_at;
  perform public.idle_lock_all(array[p_user] || v_team);
  for x in select es.* from public.idle_state es where es.user_id = any (v_team) loop
    perform public.idle_save(public.idle_settle(x));
  end loop;
  return v_team;
end;
$$;

-- fecha a conta do jogador e dá as conquistas de evento do tipo (a conquista só vale dali pra frente, sem o +1% pra
-- trás). Trava só pela ordem de user_id (idle_lock_all). Não faz nada se ele já tem todas.
create or replace function public.idle_fechar_e_ganhar(p_user uuid, p_tipo text)
returns void language plpgsql volatile set search_path = public as $$
declare s public.idle_state;
begin
  if not exists (select 1 from public.idle_cat_conquista k
                  where k.tipo = p_tipo
                    and not exists (select 1 from public.idle_conquistas c where c.user_id = p_user and c.conquista_id = k.id)) then
    return;
  end if;
  perform public.idle_lock_all(array[p_user]);
  select * into s from public.idle_state where user_id = p_user;
  perform public.idle_save(public.idle_settle(s));
  perform public.idle_ganhar(p_user, p_tipo);
end;
$$;

-- troca a empresa por pontos: ganha a diferença entre os pontos que o F$/s de agora vale e os que você já ganhou na
-- vida (gastos ou não; pelo menos 1, senão idle_prestige_low). Fecha a conta; quem você contratou fecha a conta antes
-- (o que você paga a eles muda: suas estratégias zeram) e os contratos que você fez vencem agora (quem te contratou
-- continua). Zera valuation, geradores, melhorias (as gerais ficam com o nó Leva o crachá), estratégias, boost
-- e meia-preço e volta pro "Abrir CNPJ". Ficam pontos, nós, vendas, conquistas, personagem, contadores, o limite de
-- oportunidades do dia e o recorde de F$/s.
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
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_fechar_equipe(uuid) from public, anon, authenticated;
revoke all on function public.idle_fechar_e_ganhar(uuid, text) from public, anon, authenticated;
revoke all on function public.idle_prestige() from public, anon;
grant execute on function public.idle_prestige() to authenticated;

-- ===== placar e foto de segunda =====

-- placar (o da 0038) + pontos de prestígio ganhos na vida ("★ N") e quantas conquistas cada um tem
create or replace function public.idle_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mais uuid;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  v_mais := public.idle_most_hired(public.games_week_start());
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', x.user_id, 'valuation', x.v, 'rate', x.rate, 'era', x.era, 'strategies', to_jsonb(x.strategies),
             'avatar', public.idle_avatar_json(x.user_id), 'hired_count', x.n, 'by_me', x.by_me,
             'most_hired', coalesce(x.user_id = v_mais, false), 'pontos', x.pontos, 'conquistas', x.nc)
             order by x.rate desc, x.v desc, x.user_id), '[]'::jsonb)
      from (select s.user_id, (public.idle_settle(s)).valuation as v, public.idle_rate(s) as rate,
                   public.idle_era(s.generators) as era, s.strategies, s.prestige_earned as pontos,
                   (select count(*) from public.idle_conquistas c where c.user_id = s.user_id)::int as nc,
                   (select count(*) from public.idle_contracts c
                     where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now())::int as n,
                   exists (select 1 from public.idle_contracts c
                            where c.employer_id = auth.uid() and c.employee_id = s.user_id
                              and c.created_at <= now() and c.ends_at > now()) as by_me
              from public.idle_state s
             where s.started) x);
end;
$$;

-- foto da semana que acabou (a da 0038) + "Pai tá on" pro unicórnio: a conta dele fecha antes (a conquista só vale
-- dali pra frente). Nenhuma trava avulsa do campeão: ele é travado só por idle_lock_all, na ordem de user_id.
create or replace function public.idle_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_new    date := public.games_week_start();
  v_old    date := public.games_week_start() - 7;
  v_podium jsonb;
  v_champ  uuid;
  v_gravou date;
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
  if jsonb_array_length(v_podium) = 0 then
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
end;
$$;

revoke all on function public.idle_board() from public, anon;
grant execute on function public.idle_board() to authenticated;
revoke all on function public.idle_weekly_reset() from public, anon, authenticated;

-- ===== o que já aconteceu antes desta migração (rodar de novo não muda nada) =====

update public.idle_state set upg_total = cardinality(upgrades) where upg_total < cardinality(upgrades);
update public.idle_state s set hire_total = x.n
  from (select c.employer_id, count(*)::int as n from public.idle_contracts c group by c.employer_id) x
 where x.employer_id = s.user_id and s.hire_total < x.n;
update public.idle_state s set hired_total = x.n
  from (select c.employee_id, count(*)::int as n from public.idle_contracts c group by c.employee_id) x
 where x.employee_id = s.user_id and s.hired_total < x.n;
update public.idle_state set est_usadas = public.idle_est_codigos(strategies)
 where est_usadas = '{}' and cardinality(public.idle_est_codigos(strategies)) > 0;
-- quem já foi unicórnio ganha o "Pai tá on" (conta fechada antes, como na foto), em ordem de user_id
do $$
declare v_user uuid;
begin
  for v_user in select distinct w.unicorn_id from public.idle_weeks w
                 where w.unicorn_id is not null and exists (select 1 from public.idle_state st where st.user_id = w.unicorn_id)
                 order by 1 loop
    perform public.idle_fechar_e_ganhar(v_user, 'unicornio');
  end loop;
end;
$$;
