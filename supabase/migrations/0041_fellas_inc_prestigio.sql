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

-- o valor dos nós de um tipo que alguém comprou, juntados por p_agg ('mult', 'max', 'min' ou 'soma'); sem nó desse
-- tipo, p_padrao (igual a economia.ts efeitosArvore). Cada nó conta uma vez (a chave primária de idle_arvore).
create or replace function public.idle_arv(u uuid, p_tipo text, p_agg text, p_padrao double precision)
returns double precision language sql stable set search_path = public as $$
  select coalesce(case p_agg
                    when 'mult' then exp(sum(ln(c.valor)))
                    when 'max' then max(c.valor)
                    when 'min' then min(c.valor)
                    else sum(c.valor)
                  end, p_padrao)
    from public.idle_arvore a
    join public.idle_cat_no c on c.id = a.no_id
   where a.user_id = u and c.tipo = p_tipo
$$;

-- tudo que a árvore de alguém faz, com os nomes de economia.ts efeitosArvore (teste de paridade). Os padrões são os de
-- economia.ts: teto 8h (TETO_SEGUNDOS), caixinha 3 e validade 4h (CAIXA_PADRAO), +0 por dia (o 10 de LIMITE_DIA está em
-- idle_opp_cap).
create or replace function public.idle_arvore_efeitos(u uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'producao', public.idle_arv(u, 'producao', 'mult', 1),
    'tetoS', 3600 * public.idle_arv(u, 'teto', 'max', 8),
    'caixinha', public.idle_arv(u, 'caixinha', 'max', 3),
    'validadeS', 3600 * public.idle_arv(u, 'validade', 'max', 4),
    'oppExtra', public.idle_arv(u, 'opp_extra', 'soma', 0),
    'oppBonus', public.idle_arv(u, 'opp_bonus', 'mult', 1),
    'contratoPreco', least(1, public.idle_arv(u, 'contrato_preco', 'min', 1)),
    'porContratado', greatest(0.1, public.idle_arv(u, 'por_contratado', 'max', 0.1)),
    'contratoDias', greatest(7, public.idle_arv(u, 'contrato_dias', 'max', 7)),
    'empregoMult', greatest(1, public.idle_arv(u, 'emprego_mult', 'max', 1)),
    'inicioValuation', greatest(10, public.idle_arv(u, 'inicio_valuation', 'max', 10)),
    'inicioNotebooks', greatest(1, public.idle_arv(u, 'inicio_notebooks', 'max', 1)),
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
  if r is null or r <= 0 or r = 'Infinity'::double precision then
    return 0;
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

-- caixinha (a da 0034) com a árvore: guarda as `caixinha` mais recentes (3 sem o ramo Oportunidades) que têm menos de
-- `validade` (4h) e são desta semana; só depois tira as pegas (igual a oportunidades.ts pendentes)
create or replace function public.idle_opp_list(s public.idle_state, ts timestamptz default now())
returns bigint[] language sql stable set search_path = public as $$
  with v as (
    select make_interval(secs => 3600 * public.idle_arv(s.user_id, 'validade', 'max', 4)) as validade
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
       * least(1, public.idle_arv(s.user_id, 'contrato_preco', 'min', 1))
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
