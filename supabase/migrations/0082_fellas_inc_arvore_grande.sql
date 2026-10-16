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

-- backfill: a era de agora, ou a das conquistas de era de quem já vendeu (39–42 = eras 2–5; 43, o 1º Foguete = 5);
-- nunca baixa (sem conquista de era = so a era de agora; nada de chute)
with alvo as (
  select s.user_id,
         greatest(public.idle_era(s.generators),
                  coalesce(max(case c.conquista_id when 39 then 2 when 40 then 3 when 41 then 4 when 42 then 5 when 43 then 5 end), 1)) as e
    from public.idle_state s
    left join public.idle_conquistas c on c.user_id = s.user_id and c.conquista_id in (39, 40, 41, 42, 43)
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
