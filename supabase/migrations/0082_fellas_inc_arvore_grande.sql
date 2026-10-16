-- fellasapp: Fellas Inc., a árvore grande (16/10, entrega 6 antecipada). A árvore passa de 31 pra 120 nós (catálogo na
-- 0081, gerada): os nós 6–10 dos ramos de hoje, Bolsa, PPP, Mapa e Espaço, 9 pontes e 10 infinitos. Aqui: a maior era
-- alcançada (não zera na venda), o nível dos infinitos, a compra com portões e a ponte de dois pedidos (parte A); a soma
-- de produção, o Espaço e o legado na conta (parte B); Recomeço, Oportunidades, Gente e Horta (parte C); Bolsa e PPP
-- (parte D); Mapa, Camisetaria, Copão e os eventos do Espaço (parte E). As contas são as de games/idle/economia.ts e
-- dos minigames (paridade em games/test/idleArvoreGrande.test.ts). Spec:
-- docs/superpowers/specs/2026-10-15-fellas-inc-arvore-grande-design.md. Idempotente.

-- ===== parte A: a maior era, o nível dos infinitos, a compra e os efeitos =====
alter table public.idle_state add column if not exists era_max int not null default 1;
-- espiada grátis da Bolsa (parte D): o dia de Brasília e quantas já usou nele (a venda não zera, como o Tigrinho do dia)
alter table public.idle_state add column if not exists info_gratis_dia date, add column if not exists info_gratis_n int not null default 0;
alter table public.idle_arvore add column if not exists nivel int not null default 1;
alter table public.idle_arvore drop constraint if exists idle_arvore_nivel_check;
alter table public.idle_arvore add constraint idle_arvore_nivel_check check (nivel >= 1);

-- backfill: a era de agora, ou a das conquistas de era de quem já vendeu (39–42 = eras 2–5; 43, o 1º Foguete = 5;
-- 140–145, ter 100 dos geradores 31–36 = era 6; 146–151, dos 37–42 = era 7);
-- nunca baixa (sem conquista de era = só a era de agora; nada de chute)
with alvo as (
  select s.user_id,
         greatest(public.idle_era(s.generators),
                  coalesce(max(case c.conquista_id when 39 then 2 when 40 then 3 when 41 then 4 when 42 then 5 when 43 then 5
                                                   when 140 then 6 when 141 then 6 when 142 then 6 when 143 then 6 when 144 then 6 when 145 then 6
                                                   when 146 then 7 when 147 then 7 when 148 then 7 when 149 then 7 when 150 then 7 when 151 then 7 end), 1)) as e
    from public.idle_state s
    left join public.idle_conquistas c on c.user_id = s.user_id and c.conquista_id in (39, 40, 41, 42, 43, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151)
   group by s.user_id, s.generators
)
update public.idle_state s set era_max = a.e from alvo a where a.user_id = s.user_id and s.era_max < a.e;

-- o valor dos nós de um tipo (a da 0041) contando o nível: no 'mult', valor^nível; na soma, valor × nível; 'max' e
-- 'min' não olham o nível (os infinitos são de mult ou de soma). Igual a economia.ts efeitosArvore.
create or replace function public.idle_arv(u uuid, p_tipo text, p_agg text, p_padrao double precision)
returns double precision language sql stable set search_path = public as $$
  select case p_agg
           when 'mult' then coalesce(exp(sum(a.nivel * ln(c.valor))), p_padrao)
           when 'max' then greatest(p_padrao, max(c.valor))
           when 'min' then least(p_padrao, min(c.valor))
           else coalesce(sum(c.valor * a.nivel), p_padrao)
         end
    from public.idle_arvore a
    join public.idle_cat_no c on c.id = a.no_id
   where a.user_id = u and c.tipo = p_tipo
$$;
revoke all on function public.idle_arv(uuid, text, text, double precision) from public, anon, authenticated;

-- tudo que a árvore de alguém faz (a da 0061 + os tipos da árvore grande), com os nomes de economia.ts efeitosArvore
-- (paridade). Dois objetos: um jsonb_build_object aceita no máximo 100 argumentos.
create or replace function public.idle_arvore_efeitos(u uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'producao', public.idle_arv(u, 'producao', 'mult', 1),
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
    'manterGerais', public.idle_arv(u, 'manter_gerais', 'max', 0) > 0,
    'douradoFreq', public.idle_arv(u, 'dourado_freq', 'max', 1),
    'douradoTela', public.idle_arv(u, 'dourado_tela', 'max', 12),
    'douradoInvestidor', public.idle_arv(u, 'dourado_investidor', 'mult', 1),
    'douradoDuracao', public.idle_arv(u, 'dourado_duracao', 'max', 1),
    'hortaAmadurece', public.idle_arv(u, 'horta_amadurece', 'min', 1),
    'hortaVida', public.idle_arv(u, 'horta_vida', 'max', 1),
    'hortaCruza', public.idle_arv(u, 'horta_cruza', 'max', 1),
    'hortaMult', public.idle_arv(u, 'horta_mult', 'max', 1),
    'morangoChance', public.idle_arv(u, 'morango_chance', 'max', 1))
  || jsonb_build_object(
    'producaoSoma', 1 + public.idle_arv(u, 'producao_soma', 'soma', 0),
    'inicioEras', public.idle_arv(u, 'inicio_eras', 'max', 0),
    'inicioMult', public.idle_arv(u, 'inicio_mult', 'mult', 1),
    'oppFs', 1 + public.idle_arv(u, 'opp_fs', 'soma', 0),
    'contratoDesconto', public.idle_arv(u, 'contrato_desconto', 'soma', 0),
    'hortaSoma', 1 + public.idle_arv(u, 'horta_soma', 'soma', 0),
    'bolsaCorretagem', public.idle_arv(u, 'bolsa_corretagem', 'min', 1),
    'bolsaLimite', public.idle_arv(u, 'bolsa_limite', 'soma', 0),
    'bolsaLimiteMult', public.idle_arv(u, 'bolsa_limite_mult', 'max', 1),
    'bolsaLimiteSoma', 1 + public.idle_arv(u, 'bolsa_limite_soma', 'soma', 0),
    'bolsaEspiadas', public.idle_arv(u, 'bolsa_espiadas', 'soma', 0),
    'bolsaEscritorio', public.idle_arv(u, 'bolsa_escritorio', 'max', 1),
    'convRecarga', public.idle_arv(u, 'conv_recarga', 'max', 1),
    'convTrocas', public.idle_arv(u, 'conv_trocas', 'soma', 0),
    'convCadeira2', public.idle_arv(u, 'conv_cadeira2', 'max', 0.5),
    'convCadeira3', public.idle_arv(u, 'conv_cadeira3', 'max', 0.25),
    'convQueda', public.idle_arv(u, 'conv_queda', 'min', 0.25),
    'convEfeito', public.idle_arv(u, 'conv_efeito', 'soma', 0),
    'mapaAbrir', public.idle_arv(u, 'mapa_abrir', 'min', 1),
    'mapaNivel', public.idle_arv(u, 'mapa_nivel', 'min', 1),
    'marcosMult', public.idle_arv(u, 'marcos_mult', 'max', 1),
    'marcosSoma', 1 + public.idle_arv(u, 'marcos_soma', 'soma', 0),
    'teePublico', public.idle_arv(u, 'tee_publico', 'max', 1),
    'teeTempo', public.idle_arv(u, 'tee_tempo', 'min', 1),
    'copaoMult', public.idle_arv(u, 'copao_mult', 'max', 1),
    'lixoMin', public.idle_arv(u, 'lixo_min', 'max', 10),
    'silverMin', public.idle_arv(u, 'silver_min', 'max', 2),
    'silverMult', public.idle_arv(u, 'silver_mult', 'max', 4),
    'legadoMult', public.idle_arv(u, 'legado_mult', 'max', 1),
    'espaco', 1 + public.idle_arv(u, 'espaco_soma', 'soma', 0),
    'eraFreq', public.idle_arv(u, 'era_freq', 'max', 1),
    'eraJanela', public.idle_arv(u, 'era_janela', 'max', 1))
$$;
revoke all on function public.idle_arvore_efeitos(uuid) from public, anon, authenticated;

-- comprar um nó (o da 0041) com a árvore grande: o que ele pede (o anterior do ramo e, na ponte, o 2º nó 5), os
-- portões (idle_gate: vendas da startup e a maior era alcançada, a de agora contando), os pontos livres e sem repetir;
-- o infinito que você já tem sobe um nível pelo preço round(custo · cresce^nível de agora) (a conta é em double e só
-- vira inteiro depois de caber nos pontos: nível 100 não estoura). Fecha a conta antes. Dá pra comprar com a empresa
-- fechada.
create or replace function public.idle_buy_node(p_no int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  n       public.idle_cat_no;
  v_nivel int;
  v_preco double precision;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  select * into n from public.idle_cat_no where id = p_no;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  select a.nivel into v_nivel from public.idle_arvore a where a.user_id = s.user_id and a.no_id = p_no;
  if v_nivel is not null and n.cresce is null then
    raise exception 'idle_node_owned' using errcode = 'P0001';
  end if;
  if (n.requer is not null
      and not exists (select 1 from public.idle_arvore a where a.user_id = s.user_id and a.no_id = n.requer))
     or (n.requer2 is not null
      and not exists (select 1 from public.idle_arvore a where a.user_id = s.user_id and a.no_id = n.requer2)) then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if (n.req_vendas is not null and s.prestige_count < n.req_vendas)
     or (n.req_era is not null and greatest(s.era_max, public.idle_era(s.generators)) < n.req_era) then
    raise exception 'idle_gate' using errcode = 'P0001';
  end if;
  v_preco := case when n.cresce is null then n.custo
                  else round(n.custo * power(n.cresce, coalesce(v_nivel, 0)::double precision)) end;
  if v_preco > s.prestige_earned - s.prestige_spent then
    raise exception 'idle_points_low' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s); -- o tempo até agora rende sem o nó
  insert into public.idle_arvore (user_id, no_id) values (s.user_id, p_no)
  on conflict (user_id, no_id) do update set nivel = public.idle_arvore.nivel + 1, comprado_em = now();
  s.prestige_spent := s.prestige_spent + v_preco::int;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_buy_node(int) from public, anon;
grant execute on function public.idle_buy_node(int) to authenticated;

-- gravar o estado (o da 0078) com a maior era (nunca baixa) e a espiada grátis do dia (0082)
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
         era_max = greatest(era_max, coalesce(s.era_max, 1), public.idle_era(s.generators)),
         info_gratis_dia = s.info_gratis_dia, info_gratis_n = greatest(coalesce(s.info_gratis_n, 0), 0),
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

-- o estado que toda função devolve (o da 0078) + o nível dos infinitos (no bonus) e a maior era (no 2º objeto) (0082)
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
      'conquistas', (select count(*) from public.idle_conquistas c where c.user_id = s.user_id),
      'niveis', coalesce((select jsonb_object_agg(a.no_id::text, a.nivel)
                            from public.idle_arvore a join public.idle_cat_no c on c.id = a.no_id
                           where a.user_id = s.user_id and c.cresce is not null), '{}'::jsonb)),
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
    'silver_ate', case when s.silver_ate > now() then s.silver_ate end,
    'era_max', greatest(s.era_max, public.idle_era(s.generators)));
end;
$$;

-- ===== parte B: a soma de produção, o Espaço (eras 6+) e o legado na conta =====
-- nós de produção de hoje × a soma da árvore grande (1 + Σ valor × nível) × (1 + 1% por conquista) (a da 0041 + 0082;
-- igual a economia.ts multBonus)
create or replace function public.idle_bonus_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_arv(s.user_id, 'producao', 'mult', 1)
       * (1 + public.idle_arv(s.user_id, 'producao_soma', 'soma', 0))
       * (1 + 0.01::double precision * (select count(*) from public.idle_conquistas c where c.user_id = s.user_id))
$$;
revoke all on function public.idle_bonus_mult(public.idle_state) from public, anon, authenticated;

-- quanto cada gerador rende em t (a da 0079, CTEs materializados) com a árvore grande (0082): o Espaço multiplica os
-- geradores das eras 6+ (1 + Σ valor × nível) e o ×legado (o maior comprado) multiplica o p de todos os legados. Igual a
-- economia.ts fatores/multLegado.
create or replace function public.idle_gen_rendas(s public.idle_state, t timestamptz)
returns table (gen int, renda double precision) language sql stable set search_path = public as $$
  with est as materialized (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), glob as materialized (
    select coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
         * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
         * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
              * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
         * public.idle_social_mult(s, t)
         * public.idle_bonus_mult(s)
         * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
         * public.idle_conv_prod(s, t)
         * public.idle_place_mult(s) as g
  ), arv as materialized (
    -- árvore grande (0082): o Espaço (só nos geradores das eras 6+) e o ×legado
    select 1 + public.idle_arv(s.user_id, 'espaco_soma', 'soma', 0) as espaco,
           public.idle_arv(s.user_id, 'legado_mult', 'max', 1) as leg
  ), leg as materialized (
    select u.alvo_era as era,
           1 + (select a.leg from arv a) * sum(u.por_unidade * (select coalesce(sum(coalesce(s.generators[g.id], 0)), 0)
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
         * case when c.era >= 6 then (select a.espaco from arv a) else 1 end
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1)
         * case when c.id = 11 then public.idle_conv_food(s, t) else 1 end
         * glob.g
    from public.idle_cat_gen c cross join glob
$$;
revoke all on function public.idle_gen_rendas(public.idle_state, timestamptz) from public, anon, authenticated;

-- ===== parte C: Recomeço, Oportunidades, Gente e Horta =====

-- "Abrir CNPJ" (o da 0041) com a árvore grande (0082): F$ inicial × o Abrir outra startup (10^nível) e 1 de cada gerador
-- das eras 1 a N (Material escolar = 1; Kit primeiro emprego / Mochilão / Nepo baby = 2, 3, 4). Igual a economia.ts abertura.
create or replace function public.idle_start()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
  g int;
  v_eras int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if s.started then
    raise exception 'idle_started' using errcode = 'P0001';
  end if;
  s.started := true;
  s.valuation := greatest(10, public.idle_arv(s.user_id, 'inicio_valuation', 'max', 10)) * public.idle_arv(s.user_id, 'inicio_mult', 'mult', 1);
  s.generators[1] := greatest(1, public.idle_arv(s.user_id, 'inicio_notebooks', 'max', 1))::int;
  v_eras := greatest(case when public.idle_arv(s.user_id, 'inicio_era1', 'max', 0) > 0 then 1 else 0 end,
                     public.idle_arv(s.user_id, 'inicio_eras', 'max', 0)::int);
  for g in select c.id from public.idle_cat_gen c where c.era <= v_eras loop
    s.generators[g] := greatest(coalesce(s.generators[g], 0), 1);
  end loop;
  s.settled_at := now();
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_buy_node(int) from public, anon;
grant execute on function public.idle_buy_node(int) to authenticated;
revoke all on function public.idle_start() from public, anon;
grant execute on function public.idle_start() to authenticated;


-- preço do próximo contrato (o da 0041) com o Happy hour da firma (0082): o desconto da Gente × (1 − 2% por nível), nunca abaixo de 10% (igual a economia.ts precoContrato)
create or replace function public.idle_hire_price(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_rate(s) * 1800
       * power(1.5::double precision, (select count(*) from public.idle_contracts c
                                        where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()))
       * coalesce((select exp(sum(ln((e.sociais ->> 'contratoCustoMult')::double precision)))
                     from public.idle_cat_est e
                    where e.opcao = s.strategies[e.era - 1] and (e.sociais ->> 'contratoCustoMult') is not null), 1)
       * greatest(0.1, public.idle_arv(s.user_id, 'contrato_preco', 'min', 1)
                       * (1 - public.idle_arv(s.user_id, 'contrato_desconto', 'soma', 0)))
$$;
revoke all on function public.idle_hire_price(public.idle_state) from public, anon, authenticated;

-- pegar oportunidade (a da 0076) com os 5 tipos novos (0076); o Cliente fiel (0082) faz a de F$ render +2% por nível
create or replace function public.idle_claim_opportunity(p_window bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_mult double precision;
  v_rate double precision;
  v_n    int;
  v_tipo int;
  v_lado int;
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
  v_n := greatest(1, round(v_mult))::int; -- "rendem o dobro": o ×5 e a metade contam como v_n pegas
  v_tipo := public.idle_opp_kind(s.user_id, p_window);
  v_lado := public.idle_horta_lado(coalesce(s.generators[11], 0));
  -- quem ainda não tem: o Adubo sem Horta (ou sem planta crescendo) e a Informação sem Bolsa pagam os 15 min (o tipo 0) no
  -- lugar; quem decide é a hora do clique
  if (v_tipo = 5 and public.idle_horta_crescendo(s.user_id) = 0)
     or (v_tipo = 7 and coalesce(s.generators[19], 0) < 1) then
    v_tipo := 0;
  end if;
  case v_tipo
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, v_lado, now()) b))
                               * (1 + public.idle_arv(s.user_id, 'opp_fs', 'soma', 0));
    -- cada ×5 conta sozinho e dura 1 minuto; com "rendem o dobro" entram v_n de uma vez (2: ×25)
    when 1 then s.boost_ate := array(select b from unnest(s.boost_ate) b where b > now())
                               || array_fill(now() + interval '1 minute', array[v_n]);
    when 2 then s.meias := s.meias + v_n; -- cada uma guardada vale uma compra; com o dobro, guarda duas
    when 3 then s.chamados := least(3, coalesce(s.chamados, 0) + v_n); -- Chamar um dourado: no máximo 3 (o que passa se perde)
    when 4 then -- Cupom de primeira compra: 10 compras de gerador 25% mais baratas (20 no dobro)
      s.cupons := coalesce(s.cupons, 0) + 10 * v_n;
      s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'cupons', 1);
      perform public.idle_ganhar(s.user_id, 'cupons', (s.dourados_cont ->> 'cupons')::double precision);
    when 5 then -- Adubo de farmácia: as v_n plantas crescendo mais perto de ficar maduras amadurecem agora (a conta já fechou)
      update public.idle_horta_plantas p set amadurece_s = extract(epoch from now() - p.inicio)
       where p.id in (select p2.id from public.idle_horta_plantas p2 join public.idle_cat_horta k on k.id = p2.especie
                       where p2.user_id = s.user_id and p2.fim is null and p2.inicio <= now()
                         and p2.canteiro / 6 < v_lado and p2.canteiro % 6 < v_lado
                         and p2.inicio + make_interval(secs => coalesce(p2.amadurece_s, k.amadurece_s)) > now()
                       order by p2.inicio + make_interval(secs => coalesce(p2.amadurece_s, k.amadurece_s)), p2.id
                       limit v_n);
    when 6 then -- Cashback: 30% de volta em toda compra por 2 min (4 no dobro), somando no fim do que já tem
      s.cashback_ate := greatest(coalesce(s.cashback_ate, now()), now()) + make_interval(secs => 120 * v_n);
    else -- Informação privilegiada: créditos de Espiar na Bolsa
      s.info_creditos := coalesce(s.info_creditos, 0) + v_n;
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
revoke all on function public.idle_claim_opportunity(bigint) from public, anon;
grant execute on function public.idle_claim_opportunity(bigint) to authenticated;

-- chamam mudar; os descontos seguem até 50% depois de multiplicar. Sem planta: uma linha de zeros (o left join).
-- × (1 + 5% por nível do Adubo orgânico premium, 0082)
create or replace function public.idle_horta_bonus(u uuid, lado int, t timestamptz)
returns table (producao double precision, geradores double precision, melhorias double precision, oportunidades double precision)
language sql stable set search_path = public as $$
  with m as (select public.idle_arv(u, 'horta_mult', 'max', 1) * (1 + public.idle_arv(u, 'horta_soma', 'soma', 0)) as m)
  select coalesce(sum(k.producao), 0) * m.m, least(0.5, coalesce(sum(k.geradores), 0) * m.m),
         least(0.5, coalesce(sum(k.melhorias), 0) * m.m), coalesce(sum(k.oportunidades), 0) * m.m
    from m
    left join (public.idle_horta_plantas p join public.idle_cat_horta k on k.id = p.especie)
      on p.user_id = u and p.canteiro / 6 < lado and p.canteiro % 6 < lado
     and p.inicio + make_interval(secs => coalesce(p.amadurece_s, k.amadurece_s)) <= t
     and t < least(coalesce(p.fim, 'infinity'), p.inicio + make_interval(secs => coalesce(p.amadurece_s, k.amadurece_s) + coalesce(p.vida_s, k.vida_s)))
   group by m.m
$$;
revoke all on function public.idle_horta_bonus(uuid, int, timestamptz) from public, anon, authenticated;

-- ===== parte D: Bolsa e PPP Podcast =====
-- a corretagem da Bolsa com a árvore: a do Corretor × o menor fator comprado (0,8 → 0,5 → 0,25)
create or replace function public.idle_bolsa_taxa(u uuid, p_corr int)
returns double precision language sql stable set search_path = public as $$
  select public.idle_bolsa_corretagem(p_corr) * public.idle_arv(u, 'bolsa_corretagem', 'min', 1)
$$;
revoke all on function public.idle_bolsa_taxa(uuid, int) from public, anon, authenticated;

-- o limite de ações de uma empresa (o da 0076 com a árvore): (100 + o gerador dela + o Escritório × o da árvore + os
-- "+N" dos nós) × o Lobo de Wall Street × (1 + 5% por nível do Fundo de índice), pra baixo
create or replace function public.idle_bolsa_limite(s public.idle_state, p_gerador int, p_esc int)
returns int language sql stable set search_path = public as $$
  select floor((100 + coalesce(s.generators[p_gerador], 0)
                + public.idle_bolsa_escritorio(p_esc) * public.idle_arv(s.user_id, 'bolsa_escritorio', 'max', 1)
                + public.idle_arv(s.user_id, 'bolsa_limite', 'soma', 0))
               * public.idle_arv(s.user_id, 'bolsa_limite_mult', 'max', 1)
               * (1 + public.idle_arv(s.user_id, 'bolsa_limite_soma', 'soma', 0)))::int
$$;
revoke all on function public.idle_bolsa_limite(public.idle_state, int, int) from public, anon, authenticated;

-- quantas espiadas grátis ainda tem hoje (dia de Brasília, o corte da Caixinha): as da árvore − as usadas hoje
create or replace function public.idle_bolsa_gratis(s public.idle_state)
returns int language sql stable set search_path = public as $$
  select greatest(0, public.idle_arv(s.user_id, 'bolsa_espiadas', 'soma', 0)::int
                     - case when s.info_gratis_dia = public.games_today() then coalesce(s.info_gratis_n, 0) else 0 end)
$$;
revoke all on function public.idle_bolsa_gratis(public.idle_state) from public, anon, authenticated;

-- o que a Bolsa mostra (o da 0076) com a árvore grande (0082): corretagem e limite com os nós, o gerador de cada limite e as espiadas grátis de hoje
create or replace function public.idle_bolsa_estado(p_user uuid, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_po   jsonb;
  v_tr   int := 0;
  v_corr int := 0;
  v_esc  int := 0;
  v_vs   boolean := false;
  v_fgc  boolean := false;
begin
  select * into s from public.idle_state where user_id = p_user;
  if found then
    v_tr := coalesce(s.generators[19], 0);
    v_vs := public.idle_conv_peso(s, 11) > 0;
  end if;
  select coalesce(max(n.corretor), 0), coalesce(max(n.escritorio), 0) into v_corr, v_esc
    from public.idle_bolsa_nivel n where n.user_id = p_user;
  with po as (
    delete from public.idle_bolsa_carteira k
     using public.idle_bolsa_mercado m
     where k.user_id = p_user and m.empresa = k.empresa and k.geracao < m.geracao
    returning k.empresa, k.qtd, k.alavanca
  )
  select coalesce(jsonb_agg(jsonb_build_object('empresa', empresa, 'qtd', qtd) order by empresa) filter (where qtd > 0), '[]'::jsonb),
         coalesce(bool_or(alavanca > 1 and qtd > 0), false)
    into v_po, v_fgc from po;
  if v_fgc then -- lote do Vorcaro virou pó: a conquista sai na próxima conta fechada (aqui pode não ter trava)
    update public.idle_state set conv_fgc = true where user_id = p_user;
  end if;
  return jsonb_build_object(
    'tick', p_agora,
    'vira_em_ms', greatest(0, (p_agora + 1) * 60000 - floor(extract(epoch from now()) * 1000)::bigint),
    'r', case when s.user_id is null then 0 else public.idle_rate_bolsa(s) end, -- sem os convidados (ver idle_rate_bolsa)
    'aberta', v_tr >= 1 and coalesce(s.started, false),
    'corretor', v_corr,
    'escritorio', v_esc,
    'corretagem', public.idle_bolsa_taxa(p_user, v_corr),
    'info_creditos', coalesce(s.info_creditos, 0),
    'info_gratis', case when s.user_id is null then 0 else public.idle_bolsa_gratis(s) end,
    'empresas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.empresa, 'valor', m.valor,
        'limite', public.idle_bolsa_limite(s, c.gerador, v_esc),
        'limite_gen', coalesce(s.generators[c.gerador], 0),
        'risco', m.rj_ate is null and m.valor < 0.15 * c.repouso,
        'rj_ate', m.rj_ate,
        'humor', case when v_vs or public.idle_bolsa_espiada(s, m, p_agora) then m.humor end, -- VSauce sentado ou espiada
        'espiada', public.idle_bolsa_espiada(s, m, p_agora),
        'muda_em', case when public.idle_bolsa_espiada(s, m, p_agora) then greatest(1, m.humor_ate - p_agora) end,
        'historico', (select coalesce(jsonb_agg(p.valor order by p.tick), '[]'::jsonb) from public.idle_bolsa_precos p
                       where p.empresa = m.empresa and p.tick > p_agora - 60 and p.tick <= p_agora)
      ) order by m.empresa), '[]'::jsonb)
      from public.idle_bolsa_mercado m join public.idle_cat_bolsa c on c.id = m.empresa),
    'carteira', (
      select coalesce(jsonb_agg(jsonb_build_object('empresa', k.empresa, 'qtd', k.qtd, 'custo', k.custo, 'alavanca', k.alavanca)
                            order by k.empresa, k.alavanca), '[]'::jsonb)
        from public.idle_bolsa_carteira k where k.user_id = p_user and k.qtd > 0),
    'viraram_po', v_po);
end;
$$;
revoke all on function public.idle_bolsa_estado(uuid, bigint) from public, anon, authenticated;

-- negociar (o da 0051) + a Insider (shh) na venda (0076); corretagem e limite com a árvore (0082)
create or replace function public.idle_bolsa_negociar_em(
  p_user uuid, p_empresa int, p_lado text, p_qtd int, p_tick bigint, p_agora bigint, p_lote double precision default 1)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s        public.idle_state;
  c        public.idle_cat_bolsa;
  m        public.idle_bolsa_mercado;
  k        public.idle_bolsa_carteira;
  v_tem    int := 0;
  v_total  int := 0;
  v_custo  double precision := 0;
  v_r      double precision;
  v_preco  double precision;
  v_cabe   int;
  v_n      int;
  v_corr   int := 0;
  v_esc    int := 0;
  v_fee    double precision;
  v_lote   double precision;
  v_compra double precision;
  v_por    double precision;
begin
  if p_tick is distinct from p_agora then
    raise exception 'idle_bolsa_preco_mudou' using errcode = 'P0001';
  end if;
  if p_lado not in ('comprar', 'vender') or p_qtd not in (0, 1, 10) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  select * into c from public.idle_cat_bolsa where id = p_empresa;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_lock(p_user);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if coalesce(s.generators[19], 0) < 1 then
    raise exception 'idle_bolsa_fechada' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  select * into m from public.idle_bolsa_mercado where empresa = p_empresa;
  if m.rj_ate is not null then
    raise exception 'idle_bolsa_rj' using errcode = 'P0001';
  end if;
  -- comprar: o lote é o do Vorcaro agora (1 + peso; 1 sem ele); vender: o lote pedido
  v_lote := case when p_lado = 'comprar' then 1 + public.idle_conv_peso(s, 2) else coalesce(p_lote, 1) end;
  select * into k from public.idle_bolsa_carteira
   where user_id = p_user and empresa = p_empresa and alavanca = v_lote for update;
  if found and k.geracao = m.geracao then
    v_tem := k.qtd;
    v_custo := k.custo;
  elsif found and k.alavanca > 1 and k.qtd > 0 then
    perform public.idle_ganhar(p_user, 'conv_fgc'); -- o lote antigo virou pó (a conta já fechou acima)
  end if;
  select coalesce(sum(x.qtd), 0) into v_total from public.idle_bolsa_carteira x
   where x.user_id = p_user and x.empresa = p_empresa and x.geracao = m.geracao;
  select coalesce(max(n.corretor), 0), coalesce(max(n.escritorio), 0) into v_corr, v_esc
    from public.idle_bolsa_nivel n where n.user_id = p_user;
  v_fee := 1 + public.idle_bolsa_taxa(p_user, v_corr);
  v_r := public.idle_rate_bolsa(s); -- sem os convidados (ver idle_rate_bolsa)
  v_preco := m.valor * v_r;

  if p_lado = 'comprar' then
    v_cabe := public.idle_bolsa_limite(s, c.gerador, v_esc) - v_total;
    if v_cabe <= 0 or (p_qtd > 0 and p_qtd > v_cabe) then
      raise exception 'idle_bolsa_limite' using errcode = 'P0001';
    end if;
    if p_qtd = 0 then
      v_n := least(v_cabe, floor(s.valuation / (v_preco * v_fee))::int);
    else
      v_n := p_qtd;
    end if;
    if v_preco <= 0 or v_n < 1 or v_n * v_preco * v_fee > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := greatest(s.valuation - v_n * v_preco * v_fee, 0);
    insert into public.idle_bolsa_carteira (user_id, empresa, alavanca, qtd, custo, geracao)
    values (p_user, p_empresa, v_lote, v_tem + v_n, v_custo + v_n * m.valor * v_fee, m.geracao)
    on conflict (user_id, empresa, alavanca) do update set qtd = excluded.qtd, custo = excluded.custo, geracao = excluded.geracao;
  else
    if v_tem < 1 then
      raise exception 'idle_bolsa_sem_acoes' using errcode = 'P0001';
    end if;
    v_n := case when p_qtd = 0 then v_tem else least(p_qtd, v_tem) end;
    if v_lote = 1 then
      s.valuation := s.valuation + v_n * v_preco;
    else
      -- lote alavancado: a diferença do preço pago (com a corretagem) conta `alavanca` vezes; perdeu tudo = pó
      v_compra := v_custo / v_tem;
      v_por := greatest(0, v_compra + v_lote * (m.valor - v_compra));
      s.valuation := s.valuation + v_n * v_por * v_r;
      if v_por = 0 then
        perform public.idle_ganhar(p_user, 'conv_fgc');
      end if;
    end if;
    -- Insider (shh), escondida (0076): vendeu com 100% de lucro (o preço da venda, por ação, no mínimo o dobro do que pagou
    -- com a corretagem) uma ação de empresa espiada nas últimas 2 h
    if (case when v_lote = 1 then m.valor else v_por end) >= 2 * (v_custo / v_tem)
       and (s.espiadas -> p_empresa::text ->> 'em')::timestamptz >= now() - interval '2 hours' then
      perform public.idle_ganhar(p_user, 'insider', 1);
    end if;
    update public.idle_bolsa_carteira
       set qtd = v_tem - v_n, custo = v_custo * (v_tem - v_n) / v_tem, geracao = m.geracao
     where user_id = p_user and empresa = p_empresa and alavanca = v_lote;
  end if;

  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('bolsa', public.idle_bolsa_estado(p_user, p_agora));
end;
$$;
revoke all on function public.idle_bolsa_negociar_em(uuid, int, text, int, bigint, bigint, double precision) from public, anon, authenticated;

-- Espiar (o da 0076): a grátis do dia (árvore grande, 0082) vai antes do crédito
create or replace function public.idle_bolsa_espiar_em(p_user uuid, p_empresa int, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
  m public.idle_bolsa_mercado;
  v_gratis int;
begin
  s := public.idle_lock(p_user);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if coalesce(s.generators[19], 0) < 1 then
    raise exception 'idle_bolsa_fechada' using errcode = 'P0001';
  end if;
  select * into m from public.idle_bolsa_mercado where empresa = p_empresa;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if m.rj_ate is not null then
    raise exception 'idle_bolsa_rj' using errcode = 'P0001';
  end if;
  if public.idle_bolsa_espiada(s, m, p_agora) then
    raise exception 'idle_info_ja' using errcode = 'P0001';
  end if;
  v_gratis := public.idle_bolsa_gratis(s);
  if v_gratis < 1 and coalesce(s.info_creditos, 0) < 1 then
    raise exception 'idle_info_sem_credito' using errcode = 'P0001';
  end if;
  -- o humor vira neste minuto (humor_ate = agora: a empresa acabou de sair da RJ, ou o mercado acabou de nascer): a
  -- espiada não valeria nada, então não gasta o crédito
  if m.humor_ate <= p_agora then
    raise exception 'idle_info_vira' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  if v_gratis >= 1 then -- a grátis do dia primeiro (Grupo de sinais no Telegram, Analista do YouTube)
    if s.info_gratis_dia is distinct from public.games_today() then
      s.info_gratis_dia := public.games_today();
      s.info_gratis_n := 0;
    end if;
    s.info_gratis_n := coalesce(s.info_gratis_n, 0) + 1;
  else
    s.info_creditos := s.info_creditos - 1;
  end if;
  s.espiadas := coalesce(s.espiadas, '{}'::jsonb)
                || jsonb_build_object(p_empresa::text, jsonb_build_object('ate_tick', m.humor_ate, 'em', now()));
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('bolsa', public.idle_bolsa_estado(p_user, p_agora));
end;
$$;
revoke all on function public.idle_bolsa_espiar_em(uuid, int, bigint) from public, anon, authenticated;

-- PPP Podcast com a árvore: quantas trocas cabem (3 + Mesa de som + Pauta roubada), quanto cada uma leva pra voltar (1 h ÷
-- o Microfone de lapela/o Produtor), a chance de a faixa do MC V.V cair (25% → 15% → 5%) e o +% dos bônus de produção
create or replace function public.idle_conv_trocas_max(u uuid)
returns int language sql stable set search_path = public as $$
  select 3 + public.idle_arv(u, 'conv_trocas', 'soma', 0)::int
$$;
create or replace function public.idle_conv_recarga_s(u uuid)
returns double precision language sql stable set search_path = public as $$
  select 3600 / public.idle_arv(u, 'conv_recarga', 'max', 1)
$$;
create or replace function public.idle_conv_queda(u uuid)
returns double precision language sql stable set search_path = public as $$
  select public.idle_arv(u, 'conv_queda', 'min', 0.25)
$$;
create or replace function public.idle_conv_efeito(u uuid)
returns double precision language sql stable set search_path = public as $$
  select public.idle_arv(u, 'conv_efeito', 'soma', 0)
$$;
revoke all on function public.idle_conv_trocas_max(uuid) from public, anon, authenticated;
revoke all on function public.idle_conv_recarga_s(uuid) from public, anon, authenticated;
revoke all on function public.idle_conv_queda(uuid) from public, anon, authenticated;
revoke all on function public.idle_conv_efeito(uuid) from public, anon, authenticated;

-- peso do convidado c (o da 0051) com a Cadeira gamer (meio 0,75) e o Sofá (canto 0,5); lê a árvore: stable
create or replace function public.idle_conv_peso(s public.idle_state, c int)
returns double precision language sql stable set search_path = public as $$
  select coalesce((select case when i = 1 and coalesce(s.generators[13], 0) >= 1 then 1.0
                               when i = 2 and coalesce(s.generators[13], 0) >= 25 then public.idle_arv(s.user_id, 'conv_cadeira2', 'max', 0.5)
                               when i = 3 and coalesce(s.generators[13], 0) >= 50 then public.idle_arv(s.user_id, 'conv_cadeira3', 'max', 0.25)
                               else 0 end
                     from generate_subscripts(s.conv_cadeira, 1) i where s.conv_cadeira[i] = c limit 1), 0)
$$;

-- trocas em t (o da 0051) com a árvore: as gastas voltam uma a cada idle_conv_recarga_s, até idle_conv_trocas_max
create or replace function public.idle_conv_trocas(s public.idle_state, t timestamptz)
returns int language sql stable set search_path = public as $$
  with k as (select public.idle_conv_trocas_max(s.user_id) as mx, public.idle_conv_recarga_s(s.user_id) as rs)
  select case when s.conv_trocas >= k.mx or s.conv_trocas_t is null then k.mx
              else least(k.mx, s.conv_trocas + greatest(0, floor(extract(epoch from t - s.conv_trocas_t) / k.rs))::int) end
    from k
$$;

-- multiplicador da produção em t (o da 0052) com o efeito da árvore nos bônus de produção (o +15% do Cristiano, a subida
-- do Kojima, o +2%/h do Toby); os de baixa (Luva, VSauce, o −10% do Kojima, a derrubada) não mudam. Igual a
-- convidados.ts multProducao
create or replace function public.idle_conv_prod(s public.idle_state, t timestamptz)
returns double precision language plpgsql stable set search_path = public as $$
declare
  pk double precision := public.idle_conv_peso(s, 5);
  pt double precision := public.idle_conv_peso(s, 10);
  pm double precision := public.idle_conv_peso(s, 9);
  e  double precision := public.idle_conv_efeito(s.user_id);
  m  double precision;
begin
  m := (1 + 0.15 * public.idle_conv_peso(s, 1) * (1 + e)) * (1 - 0.05 * public.idle_conv_peso(s, 4)) * (1 - 0.05 * public.idle_conv_peso(s, 11));
  if pk > 0 then
    m := m * (1 + pk * (-0.10 + 0.50 * least(24, greatest(0, floor(extract(epoch from t - public.idle_conv_desde(s, 5)) / 3600))) / 24 * (1 + e)));
  end if;
  if pt > 0 then
    m := m * (1 + pt * 0.02 * least(20, greatest(0, floor(extract(epoch from t - public.idle_conv_desde(s, 10)) / 3600))) * (1 + e));
  end if;
  if pm > 0 and public.idle_conv_derrubada_ate(s, t) is not null then
    m := m * (1 - 0.10 * pm);
  end if;
  return m;
end;
$$;

-- os efeitos agora (o da 0051) + o que a árvore muda nas cadeiras e nas trocas (a página só mostra)
create or replace function public.idle_conv_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'cadeira', to_jsonb(s.conv_cadeira),
    'desde', to_jsonb(s.conv_desde),
    'trocas', s.conv_trocas,
    'trocas_t', s.conv_trocas_t,
    'ppp', coalesce(s.generators[13], 0),
    'derrubada_ate', public.idle_conv_derrubada_ate(s, now()),
    'trocas_max', public.idle_conv_trocas_max(s.user_id),
    'recarga_s', public.idle_conv_recarga_s(s.user_id),
    'pesos', jsonb_build_array(1, public.idle_arv(s.user_id, 'conv_cadeira2', 'max', 0.5), public.idle_arv(s.user_id, 'conv_cadeira3', 'max', 0.25)),
    'queda', public.idle_conv_queda(s.user_id),
    'efeito', public.idle_conv_efeito(s.user_id))
$$;

-- MC V.V: se t está numa derrubada (30 min depois de uma faixa derrubada), o fim dela; senão null. Faixa k a cada
-- 2 h / peso desde que sentou; 25% derrubada (sorte de idle_horta_sorte com canteiro 50, passo desde + k, sorteio 9) (0082: a chance da árvore)
create or replace function public.idle_conv_derrubada_ate(s public.idle_state, t timestamptz)
returns timestamptz language plpgsql stable set search_path = public as $$
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
     and public.idle_horta_sorte(s.user_id, 50, floor(extract(epoch from d))::bigint + k, 9) < public.idle_conv_queda(s.user_id) then
    return ini + interval '30 minutes';
  end if;
  return null;
end;
$$;

-- quantas faixas do MC V.V foram derrubadas desde que ele sentou (conquista "Sample não liberado") (0082: a chance da árvore)
create or replace function public.idle_conv_derrubadas(s public.idle_state, t timestamptz)
returns int language plpgsql stable set search_path = public as $$
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
    if public.idle_horta_sorte(s.user_id, 50, floor(extract(epoch from d))::bigint + k, 9) < public.idle_conv_queda(s.user_id) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- instantes em (de, ate) em que a produção dos convidados muda: degraus do Kojima (24) e do Toby (20), início e fim
-- das derrubadas do MC V.V (a conta vira neles) (0082: a chance da árvore)
create or replace function public.idle_conv_mudancas(s public.idle_state, de timestamptz, ate timestamptz)
returns setof timestamptz language plpgsql stable set search_path = public as $$
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
      if public.idle_horta_sorte(s.user_id, 50, floor(extract(epoch from d))::bigint + k, 9) < public.idle_conv_queda(s.user_id) then
        ini := d + make_interval(secs => k * passo);
        return query select x from (values (ini), (ini + interval '30 minutes')) v(x) where x > de and x < ate;
      end if;
    end loop;
  end if;
end;
$$;

-- a faixa do MC V.V no segundo seg (a da 0051): nunca Tigrinho (o 7 vira Investidor) (0082: a chance da árvore)
create or replace function public.idle_conv_faixa(s public.idle_state, seg bigint)
returns int language plpgsql stable set search_path = public as $$
declare
  p     double precision := public.idle_conv_peso(s, 9);
  d     timestamptz := public.idle_conv_desde(s, 9);
  ds    bigint;
  passo bigint;
  t     int;
begin
  if p <= 0 or d is null then
    return null;
  end if;
  ds := floor(extract(epoch from d))::bigint;
  passo := round(7200 / p)::bigint;
  if seg - ds < passo or mod(seg - ds, passo) <> 0
     or public.idle_horta_sorte(s.user_id, 50, ds + (seg - ds) / passo, 9) < public.idle_conv_queda(s.user_id) then
    return null;
  end if;
  t := public.idle_dourado_tipo(s.user_id, seg);
  return case when t = 7 then 0 else t end;
end;
$$;
revoke all on function public.idle_conv_faixa(public.idle_state, bigint) from public, anon, authenticated;

-- sentar (o da 0051) com as trocas e a recarga da árvore (0082)
create or replace function public.idle_conv_sentar(p_cadeira int, p_convidado int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s     public.idle_state;
  v_me  uuid := auth.uid();
  v_n   int;
  v_k   int;
  v_i   int := p_cadeira + 1;
  v_ppp int;
  v_rs   double precision;
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
    s := public.idle_settle(s); -- fecha a conta antes: a conquista nova só vale dali pra frente
    perform public.idle_save(s);
    perform public.idle_ganhar(v_me, 'conv_mesma');
    return public.idle_json(s) || jsonb_build_object('mesma_pessoa', true);
  end if;
  v_n := public.idle_conv_trocas(s, now());
  v_rs := public.idle_conv_recarga_s(v_me); -- 0082: a recarga da árvore
  if v_n < 1 then
    raise exception 'idle_conv_sem_troca' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  if v_n >= public.idle_conv_trocas_max(v_me) then
    s.conv_trocas := v_n - 1;
    s.conv_trocas_t := now();
  else
    v_k := greatest(0, floor(extract(epoch from now() - s.conv_trocas_t) / v_rs))::int;
    s.conv_trocas := v_n - 1;
    s.conv_trocas_t := s.conv_trocas_t + make_interval(secs => v_k * v_rs);
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
revoke all on function public.idle_conv_sentar(int, int) from public, anon;
grant execute on function public.idle_conv_sentar(int, int) to authenticated;


-- ===== parte E: Mapa do rolê, Camisetaria, Copão e os eventos do Espaço =====

-- quantos lugares abertos e o JSON do mapa (pinos). Sem linha em idle_state: tudo fechado. (0082: a árvore grande)
create or replace function public.idle_mapa_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'mapa', (select m.png from public.idle_map m where m.id = 1),
    'lugares', (select jsonb_agg(jsonb_build_object(
        'id', c.id, 'faixa', c.faixa, 'lote', c.lote, 'lancado', c.lancado, 'horas', c.horas * public.idle_arv(s.user_id, 'mapa_abrir', 'min', 1), 'era', c.era,
        'moeda', c.moeda, 'numero', c.numero,
        'preco', case when s.started then c.horas * 3600 * public.idle_rate(s) * public.idle_arv(s.user_id, 'mapa_abrir', 'min', 1) else 0 end,
        -- lugar em breve não conta o que é: sem nome, frase nem ícone (só a posição do pino)
        'nome', case when c.lancado then p.nome end, 'frase', case when c.lancado then p.frase end,
        'icone', case when c.lancado then p.icone end, 'x', p.x, 'y', p.y,
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
revoke all on function public.idle_mapa_json(public.idle_state) from public, anon, authenticated;

-- abrir um lugar do mapa, com o desconto da árvore (0082: a árvore grande)
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
  v_preco := c.horas * 3600 * public.idle_rate(s) * public.idle_arv(s.user_id, 'mapa_abrir', 'min', 1);
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
revoke all on function public.idle_place_abrir(int) from public, anon;
grant execute on function public.idle_place_abrir(int) to authenticated;

-- o mult dos lugares: marcos × Monopólio × a árvore (0082: a árvore grande)
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
         * public.idle_arv(s.user_id, 'marcos_mult', 'max', 1) * (1 + public.idle_arv(s.user_id, 'marcos_soma', 'soma', 0))
       + coalesce((select sum((x.sociais ->> 'porLugar')::double precision) from est x
                    where (x.sociais ->> 'porLugar') is not null), 0)
         * (select count(*) from public.idle_place_state st where st.user_id = s.user_id)
$$;
revoke all on function public.idle_place_mult(public.idle_state) from public, anon, authenticated;

-- subir o nível do lugar, com o desconto da árvore (0082: a árvore grande)
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
  v_custo := c.custo_base * power(1.55, st.nivel - 1) * public.idle_arv(s.user_id, 'mapa_nivel', 'min', 1);
  if st.moeda < v_custo then
    raise exception 'idle_lugar_moeda' using errcode = 'P0001';
  end if;
  perform public.idle_save(s);
  update public.idle_place_state set moeda = moeda - v_custo, nivel = nivel + 1 where user_id = s.user_id and lugar = p_lugar;
  v_novos := public.idle_place_marcos(s.user_id, p_lugar);
  return public.idle_json(s) || jsonb_build_object('lugar', public.idle_lugar_json(s, p_lugar), 'marcos_novos', to_jsonb(v_novos));
end;
$$;
revoke all on function public.idle_place_nivel(int) from public, anon;
grant execute on function public.idle_place_nivel(int) to authenticated;

-- a tela do lugar (substitui a provisória da parte B) (0082: a árvore grande)
create or replace function public.idle_lugar_json(s public.idle_state, p_lugar int)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'moeda_nome', c.moeda, 'numero', c.numero, 'lancado', c.lancado,
    'nome', case when c.lancado then p.nome end, 'frase', case when c.lancado then p.frase end,
    'icone', case when c.lancado then p.icone end,
    'aberto', st.lugar is not null, 'nivel', st.nivel, 'moeda', st.moeda, 'fas', st.fas, 'volume', st.volume,
    'lendario', st.lendario, 'marcos', to_jsonb(coalesce(st.marcos, '{}')),
    'preco_nivel', case when st.nivel < 25 then c.custo_base * power(1.55, st.nivel - 1) * public.idle_arv(s.user_id, 'mapa_nivel', 'min', 1) end,
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
    'venda_min', 30 * public.idle_arv(s.user_id, 'tee_tempo', 'min', 1),
    'copao_mult', public.idle_arv(s.user_id, 'copao_mult', 'max', 1),
    'server_now', now())
  from public.idle_cat_place c
  left join public.idle_places p on p.id = c.id
  left join public.idle_place_state st on st.user_id = s.user_id and st.lugar = c.id
  where c.id = p_lugar
$$;
revoke all on function public.idle_lugar_json(public.idle_state, int) from public, anon, authenticated;

-- Uma por vez (em produção ou à venda). Calcula tudo agora (notas, média, procura, %, rótulo, peça × tema, o tema da semana)
-- e grava; a tela só mostra o resultado quando fica pronta. "O fornecedor fia": sem cupom pro lote pequeno da peça, o lote
-- pequeno sai de graça, no máximo uma vez a cada 24 h (podeFiar). (0082: a árvore grande)
create or replace function public.idle_tee_lancar(p_tema int, p_estilo int, p_peca int, p_cor int, p_arte int, p_tecido int,
                                                  p_div int, p_lote int, p_nome text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s           public.idle_state;
  st          public.idle_place_state;
  v_nome      text;
  v_custo     double precision;
  v_fiado     boolean := false;
  v_ult_fiado timestamptz;
  v_sem       int;
  v_id        bigint;
  v_tend      int;
  v_ult_t     int[];
  v_ult_e     int[];
  v_notas     int[];
  v_pronta    timestamptz;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  select * into st from public.idle_place_state where user_id = s.user_id and lugar = 3 for update;
  if not found then
    raise exception 'idle_lugar_fechado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.idle_tee_colecoes c
              where c.user_id = s.user_id and c.encerrada_em is null and now() < c.fim_em) then
    raise exception 'idle_tee_ocupada' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.idle_tee_cat_tema where id = p_tema)
     or not exists (select 1 from public.idle_tee_cat_estilo where id = p_estilo)
     or not exists (select 1 from public.idle_tee_cat_peca where id = p_peca)
     or not exists (select 1 from public.idle_tee_cat_cor where id = p_cor) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if not (public.idle_tee_liberado('tema', p_tema, st.nivel) and public.idle_tee_liberado('estilo', p_estilo, st.nivel)
          and public.idle_tee_liberado('peca', p_peca, st.nivel) and public.idle_tee_liberado('cor', p_cor, st.nivel)) then
    raise exception 'idle_tee_trancado' using errcode = 'P0001';
  end if;
  if p_arte is null or p_tecido is null or p_div is null or least(p_arte, p_tecido, p_div) < 0
     or greatest(p_arte, p_tecido, p_div) > 10 or p_arte + p_tecido + p_div <> 10 then
    raise exception 'idle_tee_foco' using errcode = 'P0001';
  end if;
  if p_lote is null or p_lote not between 0 and 2 then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  v_nome := public.idle_place_nome(p_nome);
  v_custo := public.idle_tee_custo_lote(p_peca, st.nivel, p_lote);
  if st.moeda < v_custo then
    -- sem coleção ativa (conferido acima) e sem cupom pro lote pequeno desta peça: o pequeno sai fiado, 1 vez a cada 24 h
    select max(c.criada_em) into v_ult_fiado from public.idle_tee_colecoes c where c.user_id = s.user_id and c.fiado;
    if p_lote = 0 and (v_ult_fiado is null or now() - v_ult_fiado >= interval '24 hours') then
      v_fiado := true;
      v_custo := 0;
    else
      raise exception 'idle_lugar_moeda' using errcode = 'P0001';
    end if;
  end if;

  -- o id entra na sorte das notas: pega antes de gravar (uma linha só, tudo calculado)
  v_id := nextval(pg_get_serial_sequence('public.idle_tee_colecoes', 'id'));
  v_tend := public.idle_tee_tendencia(public.games_week_start());
  select coalesce(array_agg(u.tema order by u.criada_em desc, u.id desc), '{}'),
         coalesce(array_agg(u.estilo order by u.criada_em desc, u.id desc), '{}')
    into v_ult_t, v_ult_e
    from (select c.tema, c.estilo, c.criada_em, c.id from public.idle_tee_colecoes c
           where c.user_id = s.user_id order by c.criada_em desc, c.id desc limit 3) u;
  v_notas := public.idle_tee_notas(v_id, p_tema, p_estilo, p_peca, p_cor, p_arte, p_tecido, p_div, v_tend, v_ult_t, v_ult_e);
  -- 0069: a produção em minutos (producaoMs) e a venda de 30 min (VENDA_MS)
  v_pronta := now() + make_interval(mins => (array[2, 5, 10])[p_lote + 1]);
  insert into public.idle_tee_colecoes (id, user_id, nome, tema, estilo, peca, cor, arte, tecido, div, lote, nivel, pecas, custo,
                                        tendencia, rotulo, peca_tema, notas, media, procura, pct, criada_em, pronta_em, fim_em, fiado)
  overriding system value
  values (v_id, s.user_id, v_nome, p_tema, p_estilo, p_peca, p_cor, p_arte, p_tecido, p_div, p_lote, st.nivel,
          public.idle_tee_pecas_lote(st.nivel, p_lote), v_custo, v_tend, public.idle_tee_rotulo(p_tema, p_estilo),
          public.idle_tee_peca_tema(p_peca, p_tema), v_notas,
          (v_notas[1] + v_notas[2] + v_notas[3] + v_notas[4])::double precision / 4,
          public.idle_tee_procura(st.nivel, p_peca, st.fas, v_notas) * public.idle_arv(s.user_id, 'tee_publico', 'max', 1), public.idle_tee_pct_procura(st.nivel, p_peca, st.fas, v_notas),
          now(), v_pronta, v_pronta + make_interval(secs => 1800 * public.idle_arv(s.user_id, 'tee_tempo', 'min', 1)), v_fiado);
  update public.idle_place_state set moeda = moeda - v_custo where user_id = s.user_id and lugar = 3;
  -- "Lança 3 coleções na semana" paga no lançamento (a nova já conta); o depois confere de novo e não paga duas vezes
  select count(*) into v_sem from public.idle_tee_colecoes c
   where c.user_id = s.user_id and c.criada_em >= (public.games_week_start()::timestamp at time zone 'America/Sao_Paulo');
  s := public.idle_place_desafio(s, 3, 'tee_colecoes', v_sem);
  return public.idle_place_responder(s, 3);
end;
$$;
revoke all on function public.idle_tee_lancar(int, int, int, int, int, int, int, int, text) from public, anon;
grant execute on function public.idle_tee_lancar(int, int, int, int, int, int, int, int, text) to authenticated;

-- Anda uma noite até agora: cada copão do cardápio dela vendeu o proporcional do total até min(agora, fim, saiu_em)
-- (vendidoNaNoite do TS); as fichas (vendidos × lucro de cada venda; pode ser negativo) entram na moeda do lugar, pela
-- diferença do que já tinha entrado. No fim da noite, uma vez (fechada): o PT de quem saiu com menos de 1 h de noite não
-- conta (ptConta do TS: apaga); a galera (galeraNoite do TS com a galera e o nível gravados no início da noite e as notas
-- do cardápio; −15% uma vez só, por mais copões em PT) e noites += 1 de cada copão do cardápio. Noite que ninguém abriu:
-- só fecha. Nada de marcos, conquistas, pódio, caderninho ou desafio aqui (isso é do idle_cup_depois). (0082: a árvore grande)
create or replace function public.idle_cup_noite_andar(p_user uuid, p_inicio timestamptz)
returns void language plpgsql volatile set search_path = public as $$
declare
  n       public.idle_cup_noites;
  x       record;
  v_v     double precision;
  v_f     double precision;
  v_dv    double precision := 0;
  v_df    double precision := 0;
  v_notas int[];
  v_pt    boolean := false;
  v_g     double precision;
  v_cm    double precision := public.idle_arv(p_user, 'copao_mult', 'max', 1); -- Open bar / After (0082): as fichas
begin
  select * into n from public.idle_cup_noites where user_id = p_user and inicio = p_inicio for update;
  if not found or n.fechada then
    return;
  end if;
  if n.aberta then
    for x in select k.copao, k.total, k.vendidos, k.fichas, c.saiu_em,
                    public.idle_cup_lucro_venda(c.base, c.tamanho, c.forca, c.preco) as lucro
               from public.idle_cup_noite_copoes k join public.idle_cup_copoes c on c.id = k.copao
              where k.user_id = p_user and k.inicio = p_inicio
              order by c.entrou_em, c.id loop
      v_v := public.idle_cup_vendido_noite(x.total, p_inicio, least(now(), coalesce(x.saiu_em, now())));
      v_f := v_v * x.lucro * v_cm;
      if v_v <> x.vendidos or v_f <> x.fichas then
        update public.idle_cup_noite_copoes set vendidos = v_v, fichas = v_f
         where user_id = p_user and inicio = p_inicio and copao = x.copao;
        update public.idle_cup_copoes set vendido = vendido + (v_v - x.vendidos), fichas = fichas + (v_f - x.fichas)
         where id = x.copao;
        v_dv := v_dv + (v_v - x.vendidos);
        v_df := v_df + (v_f - x.fichas);
      end if;
    end loop;
    if v_dv <> 0 or v_df <> 0 then
      update public.idle_cup_noites set vendas = vendas + v_dv, fichas = fichas + v_df where user_id = p_user and inicio = p_inicio;
      update public.idle_place_state set moeda = moeda + v_df where user_id = p_user and lugar = 4;
    end if;
  end if;
  if now() < p_inicio + interval '8 hours' then
    return;
  end if;
  if n.aberta then
    update public.idle_cup_noite_copoes k set pt = false
      from public.idle_cup_copoes c
     where k.user_id = p_user and k.inicio = p_inicio and k.pt and c.id = k.copao
       and c.saiu_em < p_inicio + interval '1 hour';
    select coalesce(array_agg(c.nota order by c.entrou_em, c.id), '{}'), coalesce(bool_or(k.pt), false)
      into v_notas, v_pt
      from public.idle_cup_noite_copoes k join public.idle_cup_copoes c on c.id = k.copao
     where k.user_id = p_user and k.inicio = p_inicio;
    v_g := public.idle_cup_galera_noite(n.galera, n.nivel, v_notas, v_pt);
    update public.idle_place_state set fas = v_g where user_id = p_user and lugar = 4;
    update public.idle_cup_copoes c set noites = c.noites + 1
      from public.idle_cup_noite_copoes k
     where k.user_id = p_user and k.inicio = p_inicio and c.id = k.copao;
    update public.idle_cup_noites set fechada = true, pt = v_pt, galera_delta = v_g - n.galera
     where user_id = p_user and inicio = p_inicio;
  else
    update public.idle_cup_noites set fechada = true where user_id = p_user and inicio = p_inicio;
  end if;
end;
$$;
revoke all on function public.idle_cup_noite_andar(uuid, timestamptz) from public, anon, authenticated;

-- o evento do segundo s pra quem está na era `era` (a da 0074, agora de 1 a 7; acima de 7 conta como 7), ou null. O da
-- era atual pesa 3, os antigos 1 (igual a eventoEraEm)
-- 0082: o TARS (Espaço 5) dá uma 2ª chance de 1 em 3600 por 0,5 de frequência a mais no mesmo número (igual a eventoEraEm).
create or replace function public.idle_evento_era(u uuid, s bigint, era int)
returns int language plpgsql stable set search_path = public as $$
declare
  p   constant numeric := 2147483647;
  k   constant numeric := 1013904223;
  h   numeric;
  v_ate int := greatest(1, least(era, 7));
  r   int;
  v_f double precision;
  v_m numeric;
  e   int;
begin
  h := mod(s::numeric * s * 16807 + s::numeric * 69621 + public.idle_opp_seed(u)::numeric * 48271 + 4242, p);
  h := mod(h * h + k, p);
  if mod(h, 1800) <> 0 then
    v_m := mod(mod((h + 777) * (h + 777) + k, p), 3600);
    if v_m >= 100 then
      return null; -- saída barata: a árvore nunca dá mais que 100 em 3600 (freq até 51×), então não precisa ler os nós
    end if;
    v_f := public.idle_arv(u, 'era_freq', 'max', 1);
    if v_f <= 1 or v_m >= round(2 * (v_f - 1)) then
      return null;
    end if;
  end if;
  r := mod(mod(h * h + k, p), v_ate - 1 + 3)::int;
  for e in 1 .. v_ate loop
    r := r - case when e = v_ate then 3 else 1 end;
    if r < 0 then
      return e;
    end if;
  end loop;
  return v_ate;
end;
$$;
revoke all on function public.idle_evento_era(uuid, bigint, int) from public, anon, authenticated;

-- 0082 (árvore grande): o Lixo vale lixo_min de produção por destroço, o Silver dura silver_min, e as janelas × era_janela (o segundo pode estar até 120 s longe).
drop function if exists public.idle_evento_pegar(bigint, int);
create or replace function public.idle_evento_pegar(p_seg bigint, p_gols int default 0, p_tipo int default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  v_me    uuid := auth.uid();
  v_era   int;
  v_tipo  int;
  v_ini   timestamptz;
  v_rate  double precision;
  v_ganho double precision := 0;
  v_premio int;
  v_gols  int := 0;
  v_chave text;
  v_n     int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  -- segundo longe de agora (ou nulo) nem chega no to_timestamp (um valor absurdo daria erro de data)
  if p_seg is null or abs(p_seg - extract(epoch from now())) > 120 then
    raise exception 'idle_evento_gone' using errcode = 'P0001';
  end if;
  v_era := public.idle_era(s.generators);
  v_tipo := public.idle_evento_era(v_me, p_seg, v_era);
  if p_tipo is not null and p_tipo is distinct from v_tipo then
    if v_era > 1 and p_tipo = public.idle_evento_era(v_me, p_seg, v_era - 1) then
      v_tipo := p_tipo; -- a página mostrou com a era anterior
    else
      raise exception 'idle_evento_gone' using errcode = 'P0001';
    end if;
  end if;
  v_ini := to_timestamp(p_seg);
  -- na tela: 8 / 12 / 12 / 5 / 30 / 10 / 8 s (igual a JANELA_EVENTO_S); o banco aceita 3 s a mais (rede)
  if v_tipo is null or now() < v_ini - interval '2 seconds'
     or now() > v_ini + make_interval(secs => (array[8, 12, 12, 5, 30, 10, 8])[v_tipo] * public.idle_arv(v_me, 'era_janela', 'max', 1) + 3) then
    raise exception 'idle_evento_gone' using errcode = 'P0001';
  end if;
  delete from public.idle_eventos_pegos where user_id = v_me and pegou_em < now() - interval '1 hour';
  insert into public.idle_eventos_pegos (user_id, seg) values (v_me, p_seg) on conflict do nothing;
  if not found then
    raise exception 'idle_evento_pego' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_rate := public.idle_rate(s);
  case v_tipo
    when 1 then -- Desce pra almoçar!: Marmita da mãe, ×3 por 3 min (outra soma no fim)
      s.marmita_ate := greatest(coalesce(s.marmita_ate, now()), now()) + interval '3 minutes';
    when 2 then -- Pacote da Shopee
      v_premio := public.idle_evento_shopee(v_me, p_seg);
      if v_premio = 0 then
        v_ganho := v_rate * 3600 * 0.8; -- Taxa das blusinhas: −20%
      elsif v_premio = 1 then
        s.promo_ate := greatest(coalesce(s.promo_ate, now()), now() + interval '1 minute');
      else
        s.boost_ate := array(select b from unnest(s.boost_ate) b where b > now()) || (now() + interval '2 minutes');
      end if;
    when 3 then -- Reunião que podia ser um e-mail: o tempo que você ia perder
      v_ganho := v_rate * 1800;
    when 4 then -- Tela azul: Atualização instalada, melhorias −25% por 2 min
      s.upg_desc_ate := greatest(coalesce(s.upg_desc_ate, now()), now()) + interval '2 minutes';
    when 5 then -- Jogo do Brasil: 5 min de produção por gol, até 7
      v_gols := least(greatest(coalesce(p_gols, 0), 0), 7);
      v_ganho := v_rate * 300 * v_gols;
    when 6 then -- Lixo espacial: lixo_min (10 sem a árvore) de produção por destroço desviado, até 3
      v_gols := least(greatest(coalesce(p_gols, 0), 0), 3);
      v_ganho := v_rate * 60 * public.idle_arv(v_me, 'lixo_min', 'max', 10) * v_gols;
    else -- Houston, temos um problema: Silver tape, produção × silver_mult por silver_min (×4 por 2 min sem a árvore; outro com um valendo soma no fim)
      s.silver_ate := greatest(coalesce(s.silver_ate, now()), now()) + make_interval(secs => 60 * public.idle_arv(v_me, 'silver_min', 'max', 2));
  end case;
  s.valuation := s.valuation + v_ganho;
  v_chave := (array['mae', 'shopee', 'call', 'tela', 'jogos', 'lixo', 'houston'])[v_tipo];
  v_n := coalesce((s.eventos_era ->> v_chave)::int, 0) + 1;
  s.eventos_era := coalesce(s.eventos_era, '{}'::jsonb) || jsonb_build_object(v_chave, v_n);
  perform public.idle_ganhar(v_me, (array['evt_mae', 'evt_shopee', 'evt_call', 'evt_tela', 'evt_gols', 'evt_lixo', 'evt_houston'])[v_tipo],
                             case when v_tipo in (5, 6) then v_gols else v_n end);
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('evento', jsonb_build_object(
    'tipo', v_tipo, 'premio', v_premio, 'ganho', v_ganho, 'gols', v_gols));
end;
$$;
revoke all on function public.idle_evento_pegar(bigint, int, int) from public, anon;
grant execute on function public.idle_evento_pegar(bigint, int, int) to authenticated;

-- fechar a conta (a da 0076) com o Silver tape do Houston (×4, 0078), como a Marmita: multiplica por cima, só o fim importa; o Silver tape × o da árvore (Fita prateada ×5, 0082)
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
  v_kb   int;
  v_dur  interval := make_interval(secs => 60 * public.idle_arv(s.user_id, 'dourado_duracao', 'max', 1)); -- Hype: o dobro
  v_silver double precision := public.idle_arv(s.user_id, 'silver_mult', 'max', 4);
begin
  if not s.started or ts <= s.settled_at then
    s.settled_at := greatest(s.settled_at, ts);
    return s;
  end if;
  v_fim := ts; -- sem teto desde a 0061: o jogo fechado rende tudo
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
      select x from (select b as x from unnest(s.boost_ate) b where b > v_a and b < v_b
                     union select v - v_dur from unnest(s.viral_ate) v
                            where v - v_dur > v_a and v - v_dur < v_b
                     union select v from unnest(s.viral_ate) v where v > v_a and v < v_b
                     union select s.marmita_ate where s.marmita_ate > v_a and s.marmita_ate < v_b
                     union select s.linkedin_ate where s.linkedin_ate > v_a and s.linkedin_ate < v_b
                     union select s.combo_ate where s.combo_ate > v_a and s.combo_ate < v_b
                     union select s.silver_ate where s.silver_ate > v_a and s.silver_ate < v_b
                     union select v_b) y
       order by x
    loop
      v_meio := v_p + (v_q - v_p) / 2;
      v_k := (select count(*) from unnest(s.viral_ate) v where v - v_dur <= v_meio and v > v_meio);
      -- os ×5 da oportunidade no ar SOMAM (dois = ×10, três = ×15) e o total multiplica com os Viralizou (×10 cada, sem
      -- teto): dois ×5 com dois Viralizou = ×1.000. Todo ×5 começou antes de settled_at (pegar fecha a conta antes), então
      -- só o fim importa.
      v_kb := (select count(*) from unnest(s.boost_ate) b where b > v_meio);
      -- a Marmita da mãe (×3, 0074) multiplica por cima; começou antes de settled_at (pegar fecha a conta), só o fim importa
      v_mult := (case when v_kb > 0 then 5 * v_kb else 1 end) * 10 ^ v_k
                * (case when s.marmita_ate > v_meio then 3 else 1 end)
                -- LinkedIn e Combo (0076): começaram antes de settled_at (pegar fecha a conta), só o fim importa
                * (case when s.linkedin_ate > v_meio then coalesce(s.linkedin_mult, 1) else 1 end)
                * (case when s.combo_ate > v_meio then 7 else 1 end)
                -- Silver tape do Houston (0078): começou antes de settled_at (pegar fecha a conta), só o fim importa
                * (case when s.silver_ate > v_meio then v_silver else 1 end);
      s.valuation := s.valuation + v_rate * v_mult * extract(epoch from v_q - v_p);
      v_p := v_q;
    end loop;
    v_a := v_b;
  end loop;
  s.settled_at := ts;
  return s;
end;
$$;
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;
