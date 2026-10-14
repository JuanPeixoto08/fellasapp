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

-- ===== parte B: provar o copão =====

-- As provas (só pelas funções): a receita, a nota e as partes calculadas na hora (as mesmas regras de pôr no cardápio, com a
-- moda da semana da prova), pronta 5 min depois. revelada = o idle_cup_depois já anotou o caderninho (uma vez).
create table if not exists public.idle_cup_provas (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  base int not null, mistura int not null, extra int not null, tamanho int not null,
  forca int not null check (forca between 1 and 10), preco int not null,
  nota int not null, sabor int not null, cb int not null, moda int not null, aguenta int not null, rotulos int[] not null,
  criado_em timestamptz not null default now(), pronta_em timestamptz not null, revelada boolean not null default false
);
create index if not exists idle_cup_provas_user on public.idle_cup_provas (user_id, criado_em desc, id desc);
alter table public.idle_cup_provas enable row level security;
revoke all on public.idle_cup_provas from anon, authenticated;

-- Prova uma receita (de graça): a galera prova sem ela ir pro cardápio. Mesmas recusas de pôr no cardápio (lugar aberto,
-- opções liberadas, força e preço válidos); no máximo 6 nas últimas 24 h (idle_cup_provas). Não precisa de vaga nem de
-- nome, e pode ser igual a um copão do cardápio. A nota sai em 5 min (o idle_cup_depois anota o caderninho).
create or replace function public.idle_cup_provar(p_base int, p_mistura int, p_extra int, p_tamanho int, p_forca int, p_preco int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s    public.idle_state;
  st   public.idle_place_state;
  v_av int[];
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  select * into st from public.idle_place_state where user_id = s.user_id and lugar = 4 for update;
  if not found then
    raise exception 'idle_lugar_fechado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.idle_cup_cat_base where id = p_base)
     or not exists (select 1 from public.idle_cup_cat_mistura where id = p_mistura)
     or not exists (select 1 from public.idle_cup_cat_extra where id = p_extra)
     or not exists (select 1 from public.idle_cup_cat_tamanho where id = p_tamanho) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if not (public.idle_cup_liberado('base', p_base, st.nivel) and public.idle_cup_liberado('mistura', p_mistura, st.nivel)
          and public.idle_cup_liberado('extra', p_extra, st.nivel) and public.idle_cup_liberado('tamanho', p_tamanho, st.nivel)) then
    raise exception 'idle_cup_trancado' using errcode = 'P0001';
  end if;
  if p_forca is null or p_forca not between 1 and 10 then
    raise exception 'idle_cup_forca' using errcode = 'P0001';
  end if;
  if p_preco is null or not public.idle_cup_preco_valido(p_base, p_tamanho, p_forca, p_preco) then
    raise exception 'idle_cup_preco' using errcode = 'P0001';
  end if;
  if (select count(*) from public.idle_cup_provas p where p.user_id = s.user_id and p.criado_em > now() - interval '24 hours') >= 6 then
    raise exception 'idle_cup_provas' using errcode = 'P0001';
  end if;
  v_av := public.idle_cup_avaliar(p_base, p_mistura, p_extra, p_tamanho, p_forca, p_preco, public.games_week_start());
  insert into public.idle_cup_provas (user_id, base, mistura, extra, tamanho, forca, preco, nota, sabor, cb, moda, aguenta, rotulos,
                                      criado_em, pronta_em)
  values (s.user_id, p_base, p_mistura, p_extra, p_tamanho, p_forca, p_preco, v_av[8], v_av[4], v_av[5], v_av[6], v_av[7],
          array[v_av[1], v_av[2], v_av[3]], now(), now() + interval '5 minutes');
  return public.idle_place_responder(s, 4);
end;
$$;

-- ===== o depois do copão (cópia da 0068 + as provas) =====
-- Depois da conta fechada e salva, na ordem em que aconteceu (uma marca por linha: rodar de novo não paga de novo):
-- * (0069) prova pronta e ainda não revelada: revelada; caderninho (os 3 pares com o rótulo e o "aguenta" da base na força),
--   igual a um copão revelado. Sem pódio, sem volume, sem desafios e sem conquistas (isso continua só da noite). As notas
--   do caderninho não dependem da ordem (o mesmo par e a mesma força dão sempre o mesmo valor);
-- * copão que vendeu uma noite aberta inteira (a primeira noite aberta dele fechou com ele no cardápio; o que saiu antes
--   nunca é revelado e não conta): revelado; pódio e placar com a hora do fim dessa noite; caderninho (os 3 pares com o
--   rótulo e o "aguenta" da base na força); volume + 1; lendário com nota 900+; conquista da nota; desafios da nota, do
--   sabor, da moda e do "aguenta";
-- * noite aberta que fechou: conferida; conquista do PT; desafios da galera ganha, do cardápio cheio (a menor nota), da
--   galera ganha com o cardápio cheio e do copão 700+ sem PT na semana (a maior nota do cardápio, se nenhuma noite da
--   semana deu PT até ela). Cheio = o cardápio do início da noite ocupava as vagas; a menor e a maior nota só olham os
--   copões que contam (revelados: o que saiu antes de vender uma noite inteira não mostra a nota, nem aqui);
-- * e o que vale assim que acontece, nesta semana (segunda 0h de Brasília): o balde posto no cardápio, as noites que o
--   bar abriu com copão no cardápio e a sexta que abriu com o DJ que combina com 2 copões do cardápio dela (sem esperar a
--   noite acabar: a de domingo acaba na semana seguinte).
-- Devolve o s (o prêmio do desafio mexe no valuation; quem chama salva).
create or replace function public.idle_cup_depois(s public.idle_state)
returns public.idle_state language plpgsql volatile set search_path = public as $$
declare
  e         record;
  c         public.idle_cup_copoes;
  n         public.idle_cup_noites;
  p         public.idle_cup_provas;
  v_semana  timestamptz := public.games_week_start()::timestamp at time zone 'America/Sao_Paulo';
  v_qtd     int;
  v_menor   int;
  v_maior   int;
  v_combina int;
  v_cheio   boolean;
  v_noites  int;
  v_pt_sem  boolean;
begin
  -- 0069: as provas prontas, na ordem em que ficaram prontas, só anotam o caderninho (uma vez: revelada)
  for p in select * from public.idle_cup_provas x
            where x.user_id = s.user_id and not x.revelada and x.pronta_em <= now()
            order by x.pronta_em, x.id
            for update loop
    update public.idle_cup_provas set revelada = true where id = p.id;
    perform public.idle_place_nota(s.user_id, 4, 'par', p.base * 100 + p.mistura, 0, p.rotulos[1]);
    perform public.idle_place_nota(s.user_id, 4, 'par', 10000 + p.base * 100 + p.extra, 0, p.rotulos[2]);
    perform public.idle_place_nota(s.user_id, 4, 'par', 20000 + p.mistura * 100 + p.extra, 0, p.rotulos[3]);
    perform public.idle_place_nota(s.user_id, 4, 'aguenta', p.base, p.forca, p.aguenta);
  end loop;
  for e in select x.quando, x.copao, x.inicio
             from (select min(m.inicio) + interval '8 hours' as quando, k.id as copao, null::timestamptz as inicio
                     from public.idle_cup_copoes k
                     join public.idle_cup_noite_copoes j on j.copao = k.id
                     join public.idle_cup_noites m on m.user_id = j.user_id and m.inicio = j.inicio
                    where k.user_id = s.user_id and not k.revelado and m.aberta and m.fechada
                      and (k.saiu_em is null or k.saiu_em >= m.inicio + interval '8 hours')
                    group by k.id
                   union all
                   select m.inicio + interval '8 hours', null::bigint, m.inicio
                     from public.idle_cup_noites m
                    where m.user_id = s.user_id and m.aberta and m.fechada and not m.conferida) x
            order by x.quando, x.inicio nulls first, x.copao loop
    if e.copao is not null then
      update public.idle_cup_copoes set revelado = true where id = e.copao and not revelado returning * into c;
      continue when not found;
      perform public.idle_place_registrar(s.user_id, 4, c.nome, array[c.base, c.mistura, c.extra, c.tamanho, c.forca], c.nota,
                                          e.quando, 0);
      perform public.idle_place_nota(s.user_id, 4, 'par', c.base * 100 + c.mistura, 0, c.rot_bm);
      perform public.idle_place_nota(s.user_id, 4, 'par', 10000 + c.base * 100 + c.extra, 0, c.rot_be);
      perform public.idle_place_nota(s.user_id, 4, 'par', 20000 + c.mistura * 100 + c.extra, 0, c.rot_me);
      perform public.idle_place_nota(s.user_id, 4, 'aguenta', c.base, c.forca, c.aguenta);
      update public.idle_place_state set volume = volume + 1, lendario = lendario or c.nota >= 900
       where user_id = s.user_id and lugar = 4;
      perform public.idle_ganhar(s.user_id, 'cup_nota', c.nota);
      s := public.idle_place_desafio(s, 4, 'cup_nota', c.nota);
      s := public.idle_place_desafio(s, 4, 'cup_sabor', c.sabor);
      s := public.idle_place_desafio(s, 4, 'cup_moda', c.moda);
      s := public.idle_place_desafio(s, 4, 'cup_aguenta', c.aguenta);
    else
      update public.idle_cup_noites set conferida = true
       where user_id = s.user_id and inicio = e.inicio and not conferida returning * into n;
      continue when not found;
      select count(*)::int, min(k2.nota) filter (where k2.revelado), max(k2.nota) filter (where k2.revelado)
        into v_qtd, v_menor, v_maior
        from public.idle_cup_noite_copoes k join public.idle_cup_copoes k2 on k2.id = k.copao
       where k.user_id = s.user_id and k.inicio = n.inicio;
      v_cheio := v_qtd > 0 and v_qtd >= n.vagas;
      v_pt_sem := n.pt or exists (select 1 from public.idle_cup_noites m
                                   where m.user_id = s.user_id and m.aberta and m.fechada and m.pt
                                     and m.inicio >= v_semana and m.inicio <= n.inicio);
      if n.pt then
        perform public.idle_ganhar(s.user_id, 'cup_pt');
      end if;
      s := public.idle_place_desafio(s, 4, 'cup_galera', case when n.galera_delta > 0 then 1 else 0 end);
      s := public.idle_place_desafio(s, 4, 'cup_cardapio', case when v_cheio then v_menor end);
      s := public.idle_place_desafio(s, 4, 'cup_galera_cheio', case when v_cheio and n.galera_delta > 0 then 1 else 0 end);
      s := public.idle_place_desafio(s, 4, 'cup_sem_pt', case when not v_pt_sem then v_maior end);
    end if;
  end loop;
  s := public.idle_place_desafio(s, 4, 'cup_balde',
         case when exists (select 1 from public.idle_cup_copoes k
                            where k.user_id = s.user_id and k.tamanho = 3 and k.entrou_em >= v_semana) then 1 else 0 end);
  -- as noites que já começaram nesta semana (a linha só existe depois do início)
  select count(*)::int into v_noites from public.idle_cup_noites m
   where m.user_id = s.user_id and m.aberta and m.inicio >= v_semana
     and exists (select 1 from public.idle_cup_noite_copoes k where k.user_id = m.user_id and k.inicio = m.inicio);
  s := public.idle_place_desafio(s, 4, 'cup_noites', v_noites);
  select coalesce(max(x.q), 0) into v_combina
    from (select count(*) as q
            from public.idle_cup_noites m
            join public.idle_cup_cat_dj d on d.id = m.dj
            join public.idle_cup_noite_copoes k on k.user_id = m.user_id and k.inicio = m.inicio
            join public.idle_cup_copoes k2 on k2.id = k.copao
           where m.user_id = s.user_id and m.aberta and m.sexta and m.inicio >= v_semana and k2.base = any (d.bases)
           group by m.inicio) x;
  s := public.idle_place_desafio(s, 4, 'cup_sexta', case when v_combina >= 2 then 1 else 0 end);
  return s;
end;
$$;

-- ===== o JSON do copão (cópia da 0068 + as provas; estável: só lê) =====
-- moda = o copão da moda desta semana; dj = o escolhido; vagas = as do nível; cardapio = os copões no cardápio (na ordem em
-- que entraram; vendido_hoje/fichas_hoje = o que ele já vendeu na noite de hoje, null se não está nela); hoje = a noite em
-- andamento ou a próxima (aberta: a linha da noite diz; a que ainda não começou abre, a pessoa está aqui; a parte B grava a
-- linha assim que a noite passa do início, então às 18h em ponto ainda vale "abre"; vendido/fichas até agora = o que a
-- parte B já contou, com os copões que já saíram); ultima_noite = a última noite aberta que fechou, com o que cada copão
-- revelado fez (quem saiu antes do fim da primeira noite não aparece: a nota dele nunca sai) e a semente do chat (o número
-- da noite): a tela mostra o que aconteceu com a pessoa longe; noite_fechada = a última noite que fechou sem ninguém abrir
-- o bar, se é mais nova que a ultima_noite (null se não); historico = os últimos 10 revelados (mesmo os que já saíram).
-- (0069) provas = as últimas 10 provas, a mais nova primeiro (a receita sempre; a nota, as partes e os rótulos só quando
-- fica pronta); provas_hoje = as feitas nas últimas 24 h; provas_max = 6.
-- Lugar fechado: null.
create or replace function public.idle_cup_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'moda', jsonb_build_object('base', public.idle_cup_moda_base(public.games_week_start()),
                               'mistura', public.idle_cup_moda_mistura(public.games_week_start())),
    'dj', (select e.dj from public.idle_cup_estado e where e.user_id = s.user_id),
    'vagas', public.idle_cup_vagas(st.nivel),
    'cardapio', coalesce((select jsonb_agg(public.idle_cup_copao_json(c, c.revelado)
                                           || jsonb_build_object('vendido_hoje', k.vendidos, 'fichas_hoje', k.fichas)
                                           order by c.entrou_em, c.id)
                            from public.idle_cup_copoes c
                            left join public.idle_cup_noite_copoes k
                              on k.user_id = c.user_id and k.copao = c.id and k.inicio = public.idle_cup_noite_de(now())
                           where c.user_id = s.user_id and c.saiu_em is null), '[]'::jsonb),
    'hoje', (select jsonb_build_object('inicio', h.ini, 'fim', h.ini + interval '8 hours', 'sexta', public.idle_cup_eh_sexta(h.ini),
                                       'aberta', coalesce(n.aberta, now() <= h.ini), 'dj', n.dj,
                                       'vendido_ate_agora', coalesce(n.vendas, 0), 'fichas_ate_agora', coalesce(n.fichas, 0))
               from (select public.idle_cup_noite_de(now()) as ini) h
               left join public.idle_cup_noites n on n.user_id = s.user_id and n.inicio = h.ini),
    'ultima_noite', (select jsonb_build_object(
                         'inicio', n.inicio, 'fim', n.inicio + interval '8 hours', 'sexta', n.sexta, 'dj', n.dj,
                         'vendas', n.vendas, 'fichas', n.fichas, 'pt', n.pt, 'galera_delta', n.galera_delta,
                         'chat_seed', public.idle_cup_noite_idx(n.inicio),
                         -- os copões da noite que saíram antes da nota (não aparecem, mas as vendas da noite contam as deles)
                         'saiu_antes', (select count(*)::int
                                          from public.idle_cup_noite_copoes x join public.idle_cup_copoes c on c.id = x.copao
                                         where x.user_id = n.user_id and x.inicio = n.inicio and not c.revelado),
                         'copoes', coalesce((select jsonb_agg(jsonb_build_object(
                                                 'id', c.id, 'nome', c.nome, 'base', c.base, 'mistura', c.mistura, 'extra', c.extra,
                                                 'tamanho', c.tamanho, 'forca', c.forca, 'preco', c.preco, 'nota', c.nota,
                                                 'vendidos', x.vendidos, 'fichas', x.fichas, 'pt', x.pt)
                                               order by c.entrou_em, c.id)
                                              from public.idle_cup_noite_copoes x join public.idle_cup_copoes c on c.id = x.copao
                                             where x.user_id = n.user_id and x.inicio = n.inicio and c.revelado), '[]'::jsonb))
                       from public.idle_cup_noites n
                      where n.user_id = s.user_id and n.aberta and n.fechada
                      order by n.inicio desc
                      limit 1),
    'noite_fechada', (select jsonb_build_object('inicio', n.inicio, 'fim', n.inicio + interval '8 hours')
                        from public.idle_cup_noites n
                       where n.user_id = s.user_id and not n.aberta and n.fechada
                         and n.inicio > coalesce((select max(m.inicio) from public.idle_cup_noites m
                                                   where m.user_id = s.user_id and m.aberta and m.fechada), '-infinity')
                       order by n.inicio desc
                       limit 1),
    'historico', coalesce((select jsonb_agg(jsonb_build_object(
                               'id', h.id, 'nome', h.nome, 'base', h.base, 'mistura', h.mistura, 'extra', h.extra, 'tamanho', h.tamanho,
                               'forca', h.forca, 'preco', h.preco, 'nota', h.nota, 'sabor', h.sabor, 'cb', h.cb, 'moda', h.moda,
                               'aguenta', h.aguenta, 'primeira_noite', h.primeira_noite, 'saiu_em', h.saiu_em, 'noites', h.noites,
                               'vendido', h.vendido, 'fichas', h.fichas)
                             order by h.primeira_noite desc, h.id desc)
                             from (select * from public.idle_cup_copoes c
                                    where c.user_id = s.user_id and c.revelado
                                    order by c.primeira_noite desc, c.id desc limit 10) h), '[]'::jsonb),
    'provas', coalesce((select jsonb_agg(jsonb_build_object(
                            'id', p.id, 'base', p.base, 'mistura', p.mistura, 'extra', p.extra, 'tamanho', p.tamanho,
                            'forca', p.forca, 'preco', p.preco, 'criado_em', p.criado_em, 'pronta_em', p.pronta_em,
                            'pronta', now() >= p.pronta_em,
                            'nota', case when now() >= p.pronta_em then p.nota end,
                            'sabor', case when now() >= p.pronta_em then p.sabor end,
                            'cb', case when now() >= p.pronta_em then p.cb end,
                            'moda', case when now() >= p.pronta_em then p.moda end,
                            'aguenta', case when now() >= p.pronta_em then p.aguenta end,
                            'rotulos', case when now() >= p.pronta_em then to_jsonb(p.rotulos) end)
                          order by p.criado_em desc, p.id desc)
                          from (select * from public.idle_cup_provas x
                                 where x.user_id = s.user_id
                                 order by x.criado_em desc, x.id desc limit 10) p), '[]'::jsonb),
    'provas_hoje', (select count(*)::int from public.idle_cup_provas x
                     where x.user_id = s.user_id and x.criado_em > now() - interval '24 hours'),
    'provas_max', 6)
  from public.idle_place_state st
  where st.user_id = s.user_id and st.lugar = 4
$$;

revoke all on function public.idle_cup_provar(int, int, int, int, int, int) from public, anon;
grant execute on function public.idle_cup_provar(int, int, int, int, int, int) to authenticated;
revoke all on function public.idle_cup_depois(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_cup_json(public.idle_state) from public, anon, authenticated;
