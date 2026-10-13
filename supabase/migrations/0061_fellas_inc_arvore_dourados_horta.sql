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

-- ===== ramo Horta =====
-- bônus das plantas maduras (o da 0051) × o Agrotóxico liberado (horta_mult), lido aqui dentro pra nenhum dos que
-- chamam mudar; os descontos seguem até 50% depois de multiplicar. Sem planta: uma linha de zeros (o left join).
create or replace function public.idle_horta_bonus(u uuid, lado int, t timestamptz)
returns table (producao double precision, geradores double precision, melhorias double precision, oportunidades double precision)
language sql stable set search_path = public as $$
  with m as (select public.idle_arv(u, 'horta_mult', 'max', 1) as m)
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

-- plantar (o da 0051) com a Borra de café (amadurece) e o Regador automático (vida) gravados na planta, junto do Terry
create or replace function public.idle_horta_plantar(p_canteiro int, p_especie int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  v_me    uuid := auth.uid();
  k       public.idle_cat_horta;
  v_preco double precision;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if not public.idle_horta_canteiro_ok(s, p_canteiro) then
    raise exception 'idle_horta_trancado' using errcode = 'P0001';
  end if;
  select * into k from public.idle_cat_horta where id = p_especie;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if p_especie not in (1, 2) and not exists (select 1 from public.idle_horta_descobertas d where d.user_id = v_me and d.especie = p_especie) then
    raise exception 'idle_horta_semente' using errcode = 'P0001';
  end if;
  if (public.idle_horta_ocupante(v_me, p_canteiro)).id is not null then
    raise exception 'idle_horta_ocupado' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_preco := k.custo_s * public.idle_rate(s) * (1 + 0.5 * public.idle_conv_peso(s, 8)); -- Viniccius13: sementes 50% mais caras
  if v_preco > s.valuation then
    raise exception 'idle_cant_afford' using errcode = 'P0001';
  end if;
  s.valuation := s.valuation - v_preco;
  insert into public.idle_horta_plantas (user_id, canteiro, especie, inicio, amadurece_s, vida_s)
  values (v_me, p_canteiro, p_especie, now(),
          k.amadurece_s * (1 - 0.30 * public.idle_conv_peso(s, 7)) * public.idle_arv(v_me, 'horta_amadurece', 'min', 1),
          k.vida_s * (1 - 0.20 * public.idle_conv_peso(s, 7)) * public.idle_arv(v_me, 'horta_vida', 'max', 1));
  update public.idle_state set horta_plantou = horta_plantou + 1 where user_id = v_me;
  if p_especie = 1 then
    perform public.idle_ganhar(v_me, 'horta_pix');
  end if;
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('horta', public.idle_horta_json(s));
end;
$$;
revoke all on function public.idle_horta_plantar(int, int) from public, anon;
grant execute on function public.idle_horta_plantar(int, int) to authenticated;

-- andar a horta (o da 0051) com a árvore: tempos de quem brota, Abelha influencer (cruzamento) e Morango do amor
create or replace function public.idle_horta_avancar(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
declare
  v_agora  bigint := floor(extract(epoch from now()) / 300)::bigint;
  v_lado   int := public.idle_horta_lado(coalesce(s.generators[11], 0));
  v_de     bigint;
  t        bigint;
  v_t      timestamptz;
  pl       record;
  a_can    int[] := '{}';
  a_esp    int[] := '{}';
  a_ini    timestamptz[] := '{}';
  a_mad    timestamptz[] := '{}';
  a_fim    timestamptz[] := '{}';
  a_nat    boolean[] := '{}';
  r_id     int[];
  r_a      int[];
  r_b      int[];
  ocup     boolean[];
  madura   int[];
  morta    boolean[];
  algo     boolean;
  i        int;
  j        int;
  c        int;
  lin      int;
  col      int;
  viz      int;
  dx       int;
  dy       int;
  na       int;
  nb       int;
  cand     int[];
  v_esp    int;
  k        public.idle_cat_horta;
  v_morreu int := 0;
  v_morangos int := 0;
  -- Terry: amadurece 30% mais rápido e vive 20% menos; a árvore: Borra de café e Regador automático
  v_ta     double precision := (1 - 0.30 * public.idle_conv_peso(s, 7)) * public.idle_arv(s.user_id, 'horta_amadurece', 'min', 1);
  v_tv     double precision := (1 - 0.20 * public.idle_conv_peso(s, 7)) * public.idle_arv(s.user_id, 'horta_vida', 'max', 1);
  v_cruza  double precision := public.idle_arv(s.user_id, 'horta_cruza', 'max', 1);     -- Abelha influencer: 2×
  v_moran  double precision := public.idle_arv(s.user_id, 'morango_chance', 'max', 1);  -- Morango do amor: 5×
begin
  -- mortes naturais desde a última vez (conquista "Planta de plástico era melhor")
  if s.horta_visto is not null then
    select count(*) into v_morreu from public.idle_horta_plantas p
     where p.user_id = s.user_id and p.fim is null
       and public.idle_horta_morte(p) > s.horta_visto and public.idle_horta_morte(p) <= now();
  end if;
  if s.horta_passo is not null and v_lado > 0 and s.horta_passo < v_agora then
    v_de := greatest(s.horta_passo + 1, v_agora - 2015);
    select array_agg(x.id order by x.id), array_agg(x.pai_a order by x.id), array_agg(x.pai_b order by x.id)
      into r_id, r_a, r_b from public.idle_cat_horta x where x.pai_a is not null;
    for pl in
      select p.canteiro, p.especie, p.inicio, p.inicio + make_interval(secs => coalesce(p.amadurece_s, q.amadurece_s)) as mad,
             least(coalesce(p.fim, 'infinity'), p.inicio + make_interval(secs => coalesce(p.amadurece_s, q.amadurece_s) + coalesce(p.vida_s, q.vida_s))) as fim,
             p.fim is null as nat
        from public.idle_horta_plantas p join public.idle_cat_horta q on q.id = p.especie
       where p.user_id = s.user_id
         and least(coalesce(p.fim, 'infinity'), p.inicio + make_interval(secs => coalesce(p.amadurece_s, q.amadurece_s) + coalesce(p.vida_s, q.vida_s)))
             > to_timestamp(v_de * 300) - interval '6 hours'
    loop
      a_can := a_can || pl.canteiro::int;
      a_esp := a_esp || pl.especie;
      a_ini := a_ini || pl.inicio;
      a_mad := a_mad || pl.mad;
      a_fim := a_fim || pl.fim;
      a_nat := a_nat || pl.nat;
    end loop;
    for t in v_de .. v_agora loop
      v_t := to_timestamp(t * 300);
      ocup := array_fill(false, array[36]);
      madura := array_fill(0, array[36]);
      morta := array_fill(false, array[36]);
      algo := false;
      for i in 1 .. coalesce(cardinality(a_can), 0) loop
        if a_ini[i] <= v_t and v_t < a_fim[i] then
          ocup[a_can[i] + 1] := true;
          if a_mad[i] <= v_t then
            madura[a_can[i] + 1] := a_esp[i];
            algo := true;
          end if;
        elsif a_nat[i] and a_fim[i] <= v_t and a_fim[i] > v_t - interval '6 hours' then
          morta[a_can[i] + 1] := true;
          algo := true;
        end if;
      end loop;
      continue when not algo;
      for c in 0 .. 35 loop
        lin := c / 6;
        col := c % 6;
        continue when lin >= v_lado or col >= v_lado or ocup[c + 1];
        cand := '{}';
        for j in 1 .. coalesce(cardinality(r_id), 0) loop
          na := 0;
          nb := 0;
          for dy in -1 .. 1 loop
            for dx in -1 .. 1 loop
              continue when (dx = 0 and dy = 0) or lin + dy < 0 or col + dx < 0 or lin + dy >= v_lado or col + dx >= v_lado;
              viz := (lin + dy) * 6 + col + dx;
              if madura[viz + 1] = r_a[j] then
                na := na + 1;
              end if;
              if madura[viz + 1] = r_b[j] then
                nb := nb + 1;
              end if;
            end loop;
          end loop;
          if (r_a[j] = r_b[j] and na >= 2) or (r_a[j] <> r_b[j] and na >= 1 and nb >= 1) then
            cand := cand || r_id[j];
          end if;
        end loop;
        v_esp := null;
        if cardinality(cand) > 0 and public.idle_horta_sorte(s.user_id, c, t, 1) < 0.05 * (1 + public.idle_conv_peso(s, 8)) * v_cruza then -- Viniccius13: 2×
          v_esp := cand[1 + floor(public.idle_horta_sorte(s.user_id, c, t, 2) * cardinality(cand))::int];
        elsif morta[c + 1] and public.idle_horta_sorte(s.user_id, c, t, 3) < 0.001 * v_moran then -- 0,1% por passo: ~7% das mortes (decisão do Juan)
          v_esp := 8;
        end if;
        if v_esp is not null then
          select * into k from public.idle_cat_horta where id = v_esp;
          insert into public.idle_horta_plantas (user_id, canteiro, especie, inicio, origem, amadurece_s, vida_s)
          values (s.user_id, c, v_esp, v_t, case when v_esp = 8 then 'morango' else 'cruzou' end, k.amadurece_s * v_ta, k.vida_s * v_tv);
          a_can := a_can || c;
          a_esp := a_esp || v_esp;
          a_ini := a_ini || v_t;
          a_mad := a_mad || (v_t + make_interval(secs => k.amadurece_s * v_ta));
          a_fim := a_fim || (v_t + make_interval(secs => k.amadurece_s * v_ta + k.vida_s * v_tv));
          a_nat := a_nat || true;
          ocup[c + 1] := true;
          if v_esp = 8 then
            v_morangos := v_morangos + 1; -- a conquista não sai aqui: a conta ainda não fechou
          end if;
        end if;
      end loop;
    end loop;
  end if;
  update public.idle_state
     set horta_passo = v_agora, horta_visto = now(), horta_morreu = horta_morreu + v_morreu, horta_morangos = horta_morangos + v_morangos
   where user_id = s.user_id;
  -- o histórico que a conta já passou (e mais de 1 dia de idade) sai
  delete from public.idle_horta_plantas p
   where p.user_id = s.user_id
     and least(coalesce(p.fim, 'infinity'), public.idle_horta_morte(p)) < least(s.settled_at, now() - interval '1 day');
end;
$$;
revoke all on function public.idle_horta_avancar(public.idle_state) from public, anon, authenticated;
