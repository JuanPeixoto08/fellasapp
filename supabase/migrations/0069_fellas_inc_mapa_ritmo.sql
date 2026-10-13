-- fellasapp: Fellas Inc., Mapa do rolê, o ritmo de "tenta outra combinação" (spec 2026-10-12-fellas-inc-mapa-do-role-design.md
-- §4.4 e §5.4). Depende da 0067 (camisetaria) e da 0068 (copão), já aplicadas: aqui só UPDATE com WHERE e funções
-- redefinidas (cópia exata da última versão + a mudança).
-- Parte A, a camisetaria em minutos: produção de 2, 5 ou 10 min (era 1, 2 ou 4 h) e venda de 30 min (era 12 h); sexta e
-- sábado das 18h às 2h continuam pesando 2×. A coleção que já rodava guarda os horários dela (a venda reparte-se até o
-- fim_em de cada uma). Constantes de novo na simulação (camisetariaSim.test.ts): o lote cresce 1,32 por nível (era 1,35),
-- o nível da camisetaria custa 450 × 1,55^(nível−1) (era 100) e o marco de fãs pede 115 mil (era 100 mil).
-- Parte B, provar o copão: idle_cup_provar põe a receita na boca da galera sem ir pro cardápio (de graça, 6 por 24 h); a
-- nota sai em 5 min e o idle_cup_depois anota o caderninho (pares e "aguenta"). Pódio, volume, desafios e conquistas
-- continuam só da noite. As vendas do copão seguem à noite.

-- ===== parte A: a camisetaria em minutos =====

-- as constantes (iguais a games/idle/camisetaria.ts e mapa.ts; paridade em idleCamisetaria.test.ts e idleMapa.test.ts)
update public.idle_tee_const set cresce = 1.32 where id = 1;
update public.idle_cat_place set custo_base = 450 where id = 3;
update public.idle_cat_place_marco set valor = 115000 where id = 37;

-- quanto do total já vendeu em p_t: reparte entre o pronto e o fim da coleção na proporção do peso (t preso entre os dois);
-- o fim é o da coleção (as de antes da 0069 vendem as 12 h delas). vendidoAte do TS com fimMs.
create or replace function public.idle_tee_vendido_ate(p_total double precision, p_pronta timestamptz, p_fim timestamptz,
                                                       p_t timestamptz)
returns double precision language sql immutable set search_path = public as $$
  select p_total * public.idle_tee_peso(p_pronta, least(greatest(p_t, p_pronta), p_fim))
       / public.idle_tee_peso(p_pronta, p_fim)
$$;

-- a de 3 argumentos (vendidoAte sem fimMs): a venda de uma coleção nova, 30 min
create or replace function public.idle_tee_vendido_ate(p_total double precision, p_pronta timestamptz, p_t timestamptz)
returns double precision language sql immutable set search_path = public as $$
  select public.idle_tee_vendido_ate(p_total, p_pronta, p_pronta + interval '30 minutes', p_t)
$$;

-- ===== lançar uma coleção (cópia da 0067 com a produção em minutos e a venda de 30 min) =====
-- Uma por vez (em produção ou à venda). Calcula tudo agora (notas, média, procura, %, rótulo, peça × tema, o tema da semana)
-- e grava; a tela só mostra o resultado quando fica pronta. "O fornecedor fia": sem cupom pro lote pequeno da peça, o lote
-- pequeno sai de graça, no máximo uma vez a cada 24 h (podeFiar).
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
          public.idle_tee_procura(st.nivel, p_peca, st.fas, v_notas), public.idle_tee_pct_procura(st.nivel, p_peca, st.fas, v_notas),
          now(), v_pronta, v_pronta + interval '30 minutes', v_fiado);
  update public.idle_place_state set moeda = moeda - v_custo where user_id = s.user_id and lugar = 3;
  -- "Lança 3 coleções na semana" paga no lançamento (a nova já conta); o depois confere de novo e não paga duas vezes
  select count(*) into v_sem from public.idle_tee_colecoes c
   where c.user_id = s.user_id and c.criada_em >= (public.games_week_start()::timestamp at time zone 'America/Sao_Paulo');
  s := public.idle_place_desafio(s, 3, 'tee_colecoes', v_sem);
  return public.idle_place_responder(s, 3);
end;
$$;

-- anda a venda até agora (cópia da 0067; a venda reparte-se até o fim_em da coleção, não mais 12 h fixas). Só mexe nos
-- cupons e nos fãs do lugar e no vendido da coleção; marcos, conquistas, pódio, caderninho e desafio ficam pro
-- idle_tee_depois. A coleção vende até o fim dela mesmo sem a pessoa passar (visto_em não conta aqui). Encerrada: parou na
-- hora (o encerrar andou até ela) e os fãs do excesso não vêm. No fim da venda: vendido = min(procura, estoque) exato, os
-- fãs do excesso e o saldão do estoque que sobrou (50% do custo, como no encerrar; lote fiado: nada) entram uma vez
-- (fas_excesso_pago) e a coleção sai da conta.
create or replace function public.idle_tee_avancar(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
declare
  c       public.idle_tee_colecoes;
  v_novo  double precision;
  v_moeda double precision := 0;
  v_fas   double precision := 0;
begin
  for c in select * from public.idle_tee_colecoes x
            where x.user_id = s.user_id and x.encerrada_em is null and not x.fas_excesso_pago and x.pronta_em <= now()
            order by x.pronta_em, x.id
            for update loop
    v_novo := public.idle_tee_vendido_ate(least(c.procura, c.pecas::double precision), c.pronta_em, c.fim_em, now());
    v_moeda := v_moeda + (v_novo - c.vendido) * public.idle_tee_preco_peca(c.peca);
    if now() >= c.fim_em then
      v_fas := v_fas + public.idle_tee_fas_excesso(c.procura, c.pecas, c.nivel);
      v_moeda := v_moeda + public.idle_tee_saldao(c.custo, c.pecas, v_novo, c.fiado);
    end if;
    update public.idle_tee_colecoes set vendido = v_novo, fas_excesso_pago = (now() >= c.fim_em) where id = c.id;
  end loop;
  if v_moeda <> 0 or v_fas <> 0 then
    update public.idle_place_state set moeda = moeda + v_moeda, fas = fas + v_fas where user_id = s.user_id and lugar = 3;
  end if;
end;
$$;

revoke all on function public.idle_tee_vendido_ate(double precision, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_tee_vendido_ate(double precision, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_tee_lancar(int, int, int, int, int, int, int, int, text) from public, anon;
grant execute on function public.idle_tee_lancar(int, int, int, int, int, int, int, int, text) to authenticated;
revoke all on function public.idle_tee_avancar(public.idle_state) from public, anon, authenticated;
