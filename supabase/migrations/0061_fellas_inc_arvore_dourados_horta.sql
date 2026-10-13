-- Fellas Inc.: a árvore sem o ramo Tempo (13/10). O jogo fechado rende sem limite; o ramo 4 virou Dourados e o 6 é a
-- Horta (catálogo na 0060). Aqui só as funções que mudam, a partir das versões da 0051/0052.

-- tudo que a árvore de alguém faz (igual a economia.ts efeitosArvore; teste de paridade). Sem tetoS desde a 0061.
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
$$;
revoke all on function public.idle_arvore_efeitos(uuid) from public, anon, authenticated;

-- fechar a conta (a da 0051) sem o teto do jogo fechado; o Viralizou dura 60 s × o Hype. O nó só muda depois de pegar
-- o evento, e aí settled_at já passou do começo dele: nada muda pra trás.
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
  v_dur  interval := make_interval(secs => 60 * public.idle_arv(s.user_id, 'dourado_duracao', 'max', 1)); -- Hype: o dobro
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
      select x from (select s.boost_until as x where s.boost_until > v_a and s.boost_until < v_b
                     union select v - v_dur from unnest(s.viral_ate) v
                            where v - v_dur > v_a and v - v_dur < v_b
                     union select v from unnest(s.viral_ate) v where v > v_a and v < v_b
                     union select v_b) y
       order by x
    loop
      v_meio := v_p + (v_q - v_p) / 2;
      v_k := (select count(*) from unnest(s.viral_ate) v where v - v_dur <= v_meio and v > v_meio);
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
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;

-- pegar evento (o da 0051) com o ramo Dourados: mais eventos, mais tempo na tela, Investidor anjo e Hype
create or replace function public.idle_dourado_pegar(p_seg bigint, p_lado int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_me   uuid := auth.uid();
  v_tipo int;
  v_ini  timestamptz;
  v_freq double precision := public.idle_arv(auth.uid(), 'dourado_freq', 'max', 1);    -- Pé de coelho / Dia de sorte
  v_tela double precision := public.idle_arv(auth.uid(), 'dourado_tela', 'max', 12);   -- Olho de lince: 24 s
  v_dur  double precision := public.idle_arv(auth.uid(), 'dourado_duracao', 'max', 1); -- Hype: o dobro
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  -- segundo longe de agora (ou nulo) nem chega no to_timestamp (um valor absurdo daria erro de data)
  if p_seg is null or abs(p_seg - extract(epoch from now())) > 60 then
    raise exception 'idle_dourado_gone' using errcode = 'P0001';
  end if;
  -- a frequência da árvore entra como peso a mais no extra do Gemaplys (igual a convidados.ts eventoEm)
  v_tipo := coalesce(public.idle_dourado(v_me, p_seg, public.idle_conv_peso(s, 3) + v_freq - 1), public.idle_conv_faixa(s, p_seg));
  v_ini := to_timestamp(p_seg);
  -- na tela: base × (1 − gema/2); o banco aceita 3 s a mais (rede)
  if v_tipo is null or now() < v_ini - interval '2 seconds'
     or now() > v_ini + make_interval(secs => v_tela * (1 - public.idle_conv_peso(s, 3) / 2) + 3) then
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
    when 0 then s.valuation := s.valuation + public.idle_rate(s) * 1200 * public.idle_arv(v_me, 'dourado_investidor', 'mult', 1)
                * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b));
    when 1 then s.promo_ate := greatest(coalesce(s.promo_ate, now()), now() + make_interval(secs => 30 * v_dur));
    else s.viral_ate := array(select v from unnest(s.viral_ate) v where v > now()) || (now() + make_interval(secs => 60 * v_dur));
  end case;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_dourado_pegar(bigint, int) from public, anon;
grant execute on function public.idle_dourado_pegar(bigint, int) to authenticated;
