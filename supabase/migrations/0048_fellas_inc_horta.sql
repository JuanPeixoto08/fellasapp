-- fellasapp: Fellas Inc., Horta do Food truck (minigame 2). Canteiros pela quantidade de Food truck (2×2 a 6×6; o
-- canteiro é linha × 6 + coluna); plantas crescem em tempo real, maduras dão bônus (produção, geradores, melhorias,
-- oportunidades), morrem de velhas. A cada passo de 5 min um canteiro vazio com duas vizinhas maduras do par certo pode
-- brotar uma espécie nova (5%); onde uma planta morreu de velha pode brotar o Morango com Pescoço (1%). O banco anda a
-- horta a cada chamada (idle_lock), no máximo 7 dias pra trás, com sorte de semente (jogador, canteiro, passo). Mesmo
-- catálogo de games/idle/horta.ts (teste de paridade). Vender a startup não mexe na horta. Idempotente.

-- ===== catálogo =====
create table if not exists public.idle_cat_horta (
  id            int primary key,
  nome          text not null,
  custo_s       double precision not null,
  amadurece_s   double precision not null,
  vida_s        double precision not null,
  producao      double precision not null,
  geradores     double precision not null,
  melhorias     double precision not null,
  oportunidades double precision not null,
  pai_a         int,
  pai_b         int,
  rara          boolean not null default false
);
alter table public.idle_cat_horta enable row level security;
revoke all on public.idle_cat_horta from anon, authenticated;
grant select on public.idle_cat_horta to authenticated;
drop policy if exists "idle_cat_horta_select_members" on public.idle_cat_horta;
create policy "idle_cat_horta_select_members" on public.idle_cat_horta for select to authenticated using (public.is_member());

insert into public.idle_cat_horta (id, nome, custo_s, amadurece_s, vida_s, producao, geradores, melhorias, oportunidades, pai_a, pai_b, rara) values
  (1, 'Pé de Pix', 600, 3600, 28800, 0.01, 0, 0, 0, null, null, false),
  (2, 'Couve do Coach', 600, 3600, 28800, 0, 0.01, 0, 0, null, null, false),
  (3, 'Mandioca Turbo', 1800, 10800, 43200, 0.03, 0, 0, 0, 1, 1, false),
  (4, 'Inhame do Primo Rico', 1800, 7200, 36000, 0, 0, 0, 0.05, 1, 2, false),
  (5, 'Coentro', 1800, 3600, 21600, -0.01, 0, 0.03, 0, 2, 2, false),
  (6, 'Abacate Proteico', 1800, 14400, 43200, 0.02, 0.02, 0, 0, 3, 4, false),
  (7, 'Quiabo Escorregadio', 1800, 21600, 57600, 0, 0.04, 0, 0, 6, 2, false),
  (8, 'Morango com Pescoço', 1800, 28800, 86400, 0.08, 0, 0, 0, null, null, true)
on conflict (id) do update set nome = excluded.nome, custo_s = excluded.custo_s, amadurece_s = excluded.amadurece_s,
  vida_s = excluded.vida_s, producao = excluded.producao, geradores = excluded.geradores, melhorias = excluded.melhorias,
  oportunidades = excluded.oportunidades, pai_a = excluded.pai_a, pai_b = excluded.pai_b, rara = excluded.rara;

-- ===== estado =====
-- uma linha por planta; `fim` = colhida/arrancada (a morte natural é inicio + amadurece + vida). Fica o histórico
-- até a conta passar dele (a produção da horta em cada instante sai daqui).
create table if not exists public.idle_horta_plantas (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  canteiro smallint not null check (canteiro between 0 and 35),
  especie  int not null,
  inicio   timestamptz not null,
  fim      timestamptz,
  origem   text not null default 'plantada' check (origem in ('plantada', 'cruzou', 'morango'))
);
create index if not exists idle_horta_plantas_user on public.idle_horta_plantas (user_id, canteiro);
alter table public.idle_horta_plantas enable row level security;
revoke all on public.idle_horta_plantas from anon, authenticated;

-- espécies descobertas (Pix e Couve valem desde o início, sem linha)
create table if not exists public.idle_horta_descobertas (
  user_id uuid not null references public.profiles (id) on delete cascade,
  especie int not null,
  primary key (user_id, especie)
);
alter table public.idle_horta_descobertas enable row level security;
revoke all on public.idle_horta_descobertas from anon, authenticated;

alter table public.idle_state
  add column if not exists horta_passo   bigint,
  add column if not exists horta_plantou int not null default 0,
  add column if not exists horta_colheu  int not null default 0,
  add column if not exists horta_morreu  int not null default 0,
  -- Morangos que brotaram (a conquista escondida sai em idle_check_conquistas, depois da conta fechada)
  add column if not exists horta_morangos int not null default 0;

-- ===== contas =====
-- lado da grade pelos Food trucks (gerador 11): 0, 2, 3, 4, 5, 6
create or replace function public.idle_horta_lado(n int)
returns int language sql immutable as $$
  select case when n >= 200 then 6 when n >= 100 then 5 when n >= 50 then 4 when n >= 25 then 3 when n >= 1 then 2 else 0 end
$$;

-- a morte natural de uma planta
create or replace function public.idle_horta_morte(p public.idle_horta_plantas)
returns timestamptz language sql stable set search_path = public as $$
  select p.inicio + make_interval(secs => k.amadurece_s + k.vida_s) from public.idle_cat_horta k where k.id = p.especie
$$;

-- bônus das plantas maduras destrancadas em t (descontos com teto de 50%); igual a horta.ts bonusHorta
create or replace function public.idle_horta_bonus(u uuid, lado int, t timestamptz)
returns table (producao double precision, geradores double precision, melhorias double precision, oportunidades double precision)
language sql stable set search_path = public as $$
  select coalesce(sum(k.producao), 0), least(0.5, coalesce(sum(k.geradores), 0)), least(0.5, coalesce(sum(k.melhorias), 0)),
         coalesce(sum(k.oportunidades), 0)
    from public.idle_horta_plantas p
    join public.idle_cat_horta k on k.id = p.especie
   where p.user_id = u and p.canteiro / 6 < lado and p.canteiro % 6 < lado
     and p.inicio + make_interval(secs => k.amadurece_s) <= t
     and t < least(coalesce(p.fim, 'infinity'), p.inicio + make_interval(secs => k.amadurece_s + k.vida_s))
$$;

-- instantes em (de, ate) em que o bônus da horta muda (uma planta amadurece ou acaba): a conta vira neles
create or replace function public.idle_horta_mudancas(u uuid, de timestamptz, ate timestamptz)
returns setof timestamptz language sql stable set search_path = public as $$
  select x from (
    select p.inicio + make_interval(secs => k.amadurece_s) as x
      from public.idle_horta_plantas p join public.idle_cat_horta k on k.id = p.especie where p.user_id = u
    union
    select least(coalesce(p.fim, 'infinity'), p.inicio + make_interval(secs => k.amadurece_s + k.vida_s))
      from public.idle_horta_plantas p join public.idle_cat_horta k on k.id = p.especie where p.user_id = u
  ) y where x > de and x < ate
$$;

-- sorte do canteiro c no passo t (k separa os sorteios do mesmo passo): número em [0, 1)
create or replace function public.idle_horta_sorte(u uuid, c int, t bigint, k int)
returns double precision language sql immutable set search_path = public as $$
  select (mod(power(mod(t::numeric * t * 48271 + t::numeric * 16807 + public.idle_opp_seed(u)::numeric * 69621
                        + c * 1013 + k * 7919 + 12345, 2147483647), 2) + 1013904223, 2147483647) / 2147483647)::double precision
$$;

alter table public.idle_state add column if not exists horta_visto timestamptz;

-- a planta que ocupa o canteiro agora (null = vazio)
create or replace function public.idle_horta_ocupante(u uuid, c int)
returns public.idle_horta_plantas language sql stable set search_path = public as $$
  select p.* from public.idle_horta_plantas p
   where p.user_id = u and p.canteiro = c and p.inicio <= now() and p.fim is null and public.idle_horta_morte(p) > now()
   order by p.inicio desc limit 1
$$;

-- anda a horta do último passo até agora (no máximo 7 dias): cruzamentos e Morango, passo a passo, com as plantas em
-- memória (as que brotam aqui entram na conta dos passos seguintes); conta as mortes naturais desde a última vez.
-- Roda em idle_lock (toda ação do jogo), antes da conta: a produção da horta em cada instante já sai certa.
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
      select p.canteiro, p.especie, p.inicio, p.inicio + make_interval(secs => q.amadurece_s) as mad,
             least(coalesce(p.fim, 'infinity'), p.inicio + make_interval(secs => q.amadurece_s + q.vida_s)) as fim,
             p.fim is null as nat
        from public.idle_horta_plantas p join public.idle_cat_horta q on q.id = p.especie
       where p.user_id = s.user_id
         and least(coalesce(p.fim, 'infinity'), p.inicio + make_interval(secs => q.amadurece_s + q.vida_s))
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
        if cardinality(cand) > 0 and public.idle_horta_sorte(s.user_id, c, t, 1) < 0.05 then
          v_esp := cand[1 + floor(public.idle_horta_sorte(s.user_id, c, t, 2) * cardinality(cand))::int];
        elsif morta[c + 1] and public.idle_horta_sorte(s.user_id, c, t, 3) < 0.01 then
          v_esp := 8;
        end if;
        if v_esp is not null then
          select * into k from public.idle_cat_horta where id = v_esp;
          insert into public.idle_horta_plantas (user_id, canteiro, especie, inicio, origem)
          values (s.user_id, c, v_esp, v_t, case when v_esp = 8 then 'morango' else 'cruzou' end);
          a_can := a_can || c;
          a_esp := a_esp || v_esp;
          a_ini := a_ini || v_t;
          a_mad := a_mad || (v_t + make_interval(secs => k.amadurece_s));
          a_fim := a_fim || (v_t + make_interval(secs => k.amadurece_s + k.vida_s));
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

-- o que a página mostra da horta: lado, quanto falta pro próximo, plantas vivas, descobertas, bônus agora
create or replace function public.idle_horta_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'lado', public.idle_horta_lado(coalesce(s.generators[11], 0)),
    'food_trucks', coalesce(s.generators[11], 0),
    'plantas', coalesce((select jsonb_agg(jsonb_build_object('canteiro', p.canteiro, 'especie', p.especie, 'inicio', p.inicio,
                                                             'origem', p.origem) order by p.canteiro)
                           from public.idle_horta_plantas p
                          where p.user_id = s.user_id and p.inicio <= now() and p.fim is null
                            and public.idle_horta_morte(p) > now()), '[]'::jsonb),
    'descobertas', (select jsonb_agg(x order by x) from (select 1 as x union select 2
                      union select d.especie from public.idle_horta_descobertas d where d.user_id = s.user_id) y),
    'bonus', (select to_jsonb(b) from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b),
    'server_now', now())
$$;

-- o próximo instante que muda a taxa (a da 0038: o fim de um contrato) + a horta: uma planta amadurecendo ou
-- acabando, ou o próximo passo de 5 min se um canteiro vazio pode brotar (a página recarrega nessa hora)
create or replace function public.idle_next_change(s public.idle_state)
returns timestamptz language plpgsql stable set search_path = public as $$
declare
  v_c    timestamptz;
  v_h    timestamptz;
  v_lado int := public.idle_horta_lado(coalesce(s.generators[11], 0));
begin
  select min(c.ends_at) into v_c from public.idle_contracts c
   where (c.employer_id = s.user_id or c.employee_id = s.user_id) and c.ends_at > now();
  if v_lado > 0 then
    select min(x) into v_h from public.idle_horta_mudancas(s.user_id, now(), 'infinity') x;
    if (select count(*) from public.idle_horta_plantas p
         where p.user_id = s.user_id and p.fim is null and public.idle_horta_morte(p) > now()) < v_lado * v_lado
       and ((select count(*) from public.idle_horta_plantas p join public.idle_cat_horta k on k.id = p.especie
              where p.user_id = s.user_id and p.fim is null and p.inicio + make_interval(secs => k.amadurece_s) <= now()
                and public.idle_horta_morte(p) > now()) >= 2
            or exists (select 1 from public.idle_horta_plantas p
                        where p.user_id = s.user_id and p.fim is null
                          and public.idle_horta_morte(p) between now() - interval '6 hours' and now())) then
      v_h := least(v_h, to_timestamp((floor(extract(epoch from now()) / 300) + 1) * 300));
    end if;
  end if;
  return least(v_c, v_h);
end;
$$;

-- ===== ações =====
create or replace function public.idle_horta()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  return public.idle_horta_json(s);
end;
$$;

-- confere o canteiro (0..35, destrancado no lado atual)
create or replace function public.idle_horta_canteiro_ok(s public.idle_state, c int)
returns boolean language sql stable set search_path = public as $$
  select c is not null and c between 0 and 35
     and c / 6 < public.idle_horta_lado(coalesce(s.generators[11], 0)) and c % 6 < public.idle_horta_lado(coalesce(s.generators[11], 0))
$$;

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
  v_preco := k.custo_s * public.idle_rate(s);
  if v_preco > s.valuation then
    raise exception 'idle_cant_afford' using errcode = 'P0001';
  end if;
  s.valuation := s.valuation - v_preco;
  insert into public.idle_horta_plantas (user_id, canteiro, especie, inicio) values (v_me, p_canteiro, p_especie, now());
  update public.idle_state set horta_plantou = horta_plantou + 1 where user_id = v_me;
  if p_especie = 1 then
    perform public.idle_ganhar(v_me, 'horta_pix');
  end if;
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('horta', public.idle_horta_json(s));
end;
$$;

-- colher (só madura): esvazia, conta, e libera a semente da espécie se é nova
create or replace function public.idle_horta_colher(p_canteiro int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_me   uuid := auth.uid();
  p      public.idle_horta_plantas;
  k      public.idle_cat_horta;
  v_nova int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not public.idle_horta_canteiro_ok(s, p_canteiro) then
    raise exception 'idle_horta_trancado' using errcode = 'P0001';
  end if;
  p := public.idle_horta_ocupante(v_me, p_canteiro);
  if p.id is null then
    raise exception 'idle_horta_vazio' using errcode = 'P0001';
  end if;
  select * into k from public.idle_cat_horta where id = p.especie;
  if now() < p.inicio + make_interval(secs => k.amadurece_s) then
    raise exception 'idle_horta_verde' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  update public.idle_horta_plantas set fim = now() where id = p.id;
  update public.idle_state set horta_colheu = horta_colheu + 1 where user_id = v_me;
  if p.especie not in (1, 2) then
    insert into public.idle_horta_descobertas (user_id, especie) values (v_me, p.especie) on conflict do nothing;
    if found then
      v_nova := p.especie;
      if p.especie = 3 then
        perform public.idle_ganhar(v_me, 'horta_mandioca');
      elsif p.especie = 4 then
        perform public.idle_ganhar(v_me, 'horta_inhame');
      end if;
    end if;
  end if;
  if p.especie = 5 then
    perform public.idle_ganhar(v_me, 'horta_coentro');
  elsif p.especie = 6 then
    perform public.idle_ganhar(v_me, 'horta_abacate');
  end if;
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('horta', public.idle_horta_json(s), 'descobriu', v_nova);
end;
$$;

create or replace function public.idle_horta_arrancar(p_canteiro int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s    public.idle_state;
  v_me uuid := auth.uid();
  p    public.idle_horta_plantas;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not public.idle_horta_canteiro_ok(s, p_canteiro) then
    raise exception 'idle_horta_trancado' using errcode = 'P0001';
  end if;
  p := public.idle_horta_ocupante(v_me, p_canteiro);
  if p.id is null then
    raise exception 'idle_horta_vazio' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  update public.idle_horta_plantas set fim = now() where id = p.id;
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('horta', public.idle_horta_json(s));
end;
$$;

revoke all on function public.idle_horta_lado(int) from public, anon, authenticated;
revoke all on function public.idle_horta_morte(public.idle_horta_plantas) from public, anon, authenticated;
revoke all on function public.idle_horta_bonus(uuid, int, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_horta_mudancas(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_horta_sorte(uuid, int, bigint, int) from public, anon, authenticated;
revoke all on function public.idle_horta_ocupante(uuid, int) from public, anon, authenticated;
revoke all on function public.idle_horta_avancar(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_horta_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_horta_canteiro_ok(public.idle_state, int) from public, anon, authenticated;
revoke all on function public.idle_next_change(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_horta() from public, anon;
revoke all on function public.idle_horta_plantar(int, int) from public, anon;
revoke all on function public.idle_horta_colher(int) from public, anon;
revoke all on function public.idle_horta_arrancar(int) from public, anon;
grant execute on function public.idle_horta() to authenticated;
grant execute on function public.idle_horta_plantar(int, int) to authenticated;
grant execute on function public.idle_horta_colher(int) to authenticated;
grant execute on function public.idle_horta_arrancar(int) to authenticated;

-- ===== o resto do jogo com a horta =====
-- trava (a da 0036) + a horta anda até agora
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
  return s;
end;
$$;

-- produção em t (a da 0041) × a da horta
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
       * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
$$;

-- fecha a conta (a da 0045) + vira nos instantes em que a horta muda
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
                   select m from public.idle_horta_mudancas(s.user_id, s.settled_at, v_fim) m
                   union
                   select v_fim) y
     order by x
  loop
    v_rate := public.idle_rate_at(s, v_a);
    v_p := v_a;
    for v_q in
      select x from (select s.boost_until as x where s.boost_until > v_a and s.boost_until < v_b
                     union select v - interval '60 seconds' from unnest(s.viral_ate) v
                            where v - interval '60 seconds' > v_a and v - interval '60 seconds' < v_b
                     union select v from unnest(s.viral_ate) v where v > v_a and v < v_b
                     union select v_b) y
       order by x
    loop
      v_meio := v_p + (v_q - v_p) / 2;
      v_k := (select count(*) from unnest(s.viral_ate) v where v - interval '60 seconds' <= v_meio and v > v_meio);
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

-- comprar (a da 0045) + os descontos da horta
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
  v_promo boolean;
  v_cmg   double precision;
  v_hb    record;
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
  -- 1 s de folga: a página troca os preços no passo de 1 s; quem clicou vendo metade paga metade
  v_promo := s.promo_ate is not null and s.promo_ate > now() - interval '1 second';
  if v_promo then
    v_cm := v_cm / 2; -- Promoção relâmpago: tudo pela metade (preço, 10 e Máx)
  end if;
  -- a horta: geradores e melhorias mais baratos (cada desconto com teto de 50%)
  select * into v_hb from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now());
  v_cmg := v_cm * (1 - v_hb.geradores);

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
      v_k := public.idle_max_qty(g.custo, v_n, s.valuation, v_cmg);
      if v_k < 1 then
        raise exception 'idle_cant_afford' using errcode = 'P0001';
      end if;
    elsif p_qty in (1, 10) then
      v_k := p_qty;
    else
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    v_preco := public.idle_price(g.custo, v_n, v_k, v_cmg);
    if s.half_price and v_k = 1 and not v_promo then -- desconto máximo 50%: com a Promoção a meia-preço fica guardada
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
    v_preco := u.preco * v_cm * (1 - v_hb.melhorias);
    if s.half_price and not v_promo then
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

-- pegar oportunidade (a da 0041) + o bônus de oportunidades da horta no "15 minutos"
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
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b));
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

-- pegar evento (a da 0045) + o bônus de oportunidades da horta no Investidor
create or replace function public.idle_dourado_pegar(p_seg bigint, p_lado int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_me   uuid := auth.uid();
  v_tipo int;
  v_ini  timestamptz;
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
  v_tipo := public.idle_dourado(v_me, p_seg);
  v_ini := to_timestamp(p_seg);
  if v_tipo is null or now() < v_ini - interval '2 seconds' or now() > v_ini + interval '15 seconds' then
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
    when 0 then s.valuation := s.valuation + public.idle_rate(s) * 1200 * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b));
    when 1 then s.promo_ate := greatest(coalesce(s.promo_ate, now()), now() + interval '30 seconds');
    else s.viral_ate := array(select v from unnest(s.viral_ate) v where v > now()) || (now() + interval '60 seconds');
  end case;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- o estado (a da 0045) + os bônus da horta agora (a página aplica nos preços)
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_rate double precision := public.idle_rate(s);
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', v_rate, 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators), 'boost_until', s.boost_until,
    'half_price', s.half_price, 'opp_claimed', to_jsonb(s.opp_claimed),
    'promo_ate', case when s.promo_ate > now() then s.promo_ate end,
    'viral', to_jsonb(array(select v from unnest(s.viral_ate) v where v > now() order by v)),
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
    'descobertas', coalesce((select jsonb_agg(d.id order by d.id)
                               from (select distinct c.conquista_id as id
                                       from public.idle_conquistas c
                                       join public.idle_cat_conquista k on k.id = c.conquista_id
                                      where k.escondida) d), '[]'::jsonb));
end;
$$;

-- conquistas de estado (a da 0041) + as da horta
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
             -- horta (0048)
             when c.tipo = 'horta_plantou' then s.horta_plantou >= c.valor
             when c.tipo = 'horta_colheu' then s.horta_colheu >= c.valor
             when c.tipo = 'horta_morreu' then s.horta_morreu >= c.valor
             when c.tipo = 'horta_morango' then s.horta_morangos >= 1
             when c.tipo = 'horta_colecao' then 2 + (select count(*) from public.idle_horta_descobertas d
                                                       where d.user_id = p_user and d.especie not in (1, 2)) >= c.valor
             else false
           end
    on conflict do nothing
    returning conquista_id
  )
  select coalesce(array_agg(conquista_id order by conquista_id), '{}') into v_novas from novas;
  return v_novas;
end;
$$;
