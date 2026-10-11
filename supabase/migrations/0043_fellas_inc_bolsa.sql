-- Fellas Inc.: a Bolsa da Faria Lima (minigame 1). Spec: docs/superpowers/specs/2026-10-11-fellas-inc-bolsa-design.md.
-- Preço em segundos de produção (em F$ = valor × idle_rate). Um tick = 1 minuto, o mesmo mercado para o grupo todo.

-- ---------- catálogo (igual a games/idle/bolsaMotor.ts EMPRESAS_BOLSA; o teste compara) ----------
create table if not exists public.idle_cat_bolsa (
  id      int primary key,
  codigo  text not null,
  nome    text not null,
  gerador int not null,
  repouso double precision not null,
  vol     double precision not null,
  pesos   double precision[] not null,
  quebra  double precision not null
);
alter table public.idle_cat_bolsa enable row level security;
revoke all on public.idle_cat_bolsa from anon, authenticated;
grant select on public.idle_cat_bolsa to authenticated;
drop policy if exists "idle_cat_bolsa_select_members" on public.idle_cat_bolsa;
create policy "idle_cat_bolsa_select_members" on public.idle_cat_bolsa for select to authenticated using (public.is_member());

insert into public.idle_cat_bolsa (id, codigo, nome, gerador, repouso, vol, pesos, quebra) values
  (1, 'PSTL', 'Pastel do Zé', 11, 30, 0.6, '{30,30,15,10,5,10}', 0.03),
  (2, 'ACAI', 'Açaí Gourmet', 14, 120, 0.5, '{35,30,15,8,4,8}', 0.03),
  (3, 'COCH', 'Coach Quântico', 16, 50, 1.2, '{10,15,10,30,25,10}', 0.15),
  (4, 'PRMO', 'Cripto do Primo', 19, 20, 1.6, '{5,10,10,15,15,45}', 0.15),
  (5, 'JEGU', 'Uber de Jegue', 15, 8, 1.2, '{15,15,20,10,15,25}', 0.15),
  (6, 'MEME', 'NFT de Meme', 6, 5, 1.6, '{5,10,10,15,15,45}', 0.15),
  (7, 'IRMA', 'Funerária 1 Irmão', 20, 80, 0.3, '{70,10,10,4,3,3}', 0.03),
  (8, 'SIMA', 'Mecânica Simas', 8, 40, 1.0, '{20,20,20,15,15,10}', 0.06)
on conflict (id) do update set codigo = excluded.codigo, nome = excluded.nome, gerador = excluded.gerador, repouso = excluded.repouso,
  vol = excluded.vol, pesos = excluded.pesos, quebra = excluded.quebra;

-- ---------- estado do mercado (uma linha por empresa) ----------
create table if not exists public.idle_bolsa_mercado (
  empresa   int primary key references public.idle_cat_bolsa (id),
  tick      bigint not null,
  valor     double precision not null,
  delta     double precision not null,
  humor     int not null,
  humor_ate bigint not null,
  geracao   int not null default 0,
  rj_ate    bigint
);
alter table public.idle_bolsa_mercado enable row level security;
revoke all on public.idle_bolsa_mercado from anon, authenticated;

-- ---------- o passo (puro: os sorteios entram como argumento; igual a bolsaMotor.ts) ----------
create or replace function public.idle_bolsa_normal(a double precision, b double precision)
returns double precision language sql immutable set search_path = public as $$
  select sqrt(-2 * ln(1 - a)) * cos(2 * pi() * b)
$$;

create or replace function public.idle_bolsa_humor(p double precision[], u double precision)
returns int language plpgsql immutable set search_path = public as $$
declare
  v_total double precision := 0;
  v_x     double precision;
  i       int;
begin
  for i in 1 .. array_length(p, 1) loop
    v_total := v_total + p[i];
  end loop;
  v_x := u * v_total;
  for i in 1 .. array_length(p, 1) loop
    if v_x < p[i] then
      return i - 1;
    end if;
    v_x := v_x - p[i];
  end loop;
  return array_length(p, 1) - 1;
end;
$$;

-- u: [n1a, n1b, n2a, n2b, humor, duração, quebra], uniformes em [0,1)
create or replace function public.idle_bolsa_tick(m public.idle_bolsa_mercado, c public.idle_cat_bolsa, t bigint, u double precision[])
returns public.idle_bolsa_mercado language plpgsql immutable set search_path = public as $$
declare
  v_humor int := m.humor;
  v_ate   bigint := m.humor_ate;
  v_emp   double precision;
  v_d     double precision;
  v_v     double precision;
  v_n1    double precision;
  v_n2    double precision;
begin
  m.tick := t;
  if m.rj_ate is not null then
    m.valor := c.repouso;
    m.delta := 0;
    m.humor := 0;
    if t >= m.rj_ate then
      m.rj_ate := null;
      m.humor_ate := t;
    end if;
    return m;
  end if;
  if t >= v_ate then
    v_humor := public.idle_bolsa_humor(c.pesos, u[5]);
    v_ate := t + 10 + floor(u[6] * 111)::bigint;
  end if;
  v_n1 := public.idle_bolsa_normal(u[1], u[2]);
  v_n2 := public.idle_bolsa_normal(u[3], u[4]);
  -- constantes calibradas pela simulação de 30 dias (games/idle/bolsaMotor.ts EMPURRAO, MALUCA, RUIDO, DECAI, VOLTA)
  v_emp := case v_humor when 0 then 0 when 1 then 0.00015 when 2 then -0.00015 when 3 then 0.0008 when 4 then -0.0008 else v_n2 * 0.015 end;
  v_d := greatest(-0.08, least(0.08, m.delta * 0.9 + v_emp * c.vol + v_n1 * 0.002 * c.vol));
  v_v := greatest(m.valor * (1 + v_d) + (c.repouso - m.valor) * 0.003, 0.05 * c.repouso);
  if v_v < 0.15 * c.repouso and u[7] < c.quebra then
    m.valor := c.repouso;
    m.delta := 0;
    m.humor := 0;
    m.humor_ate := t + 10;
    m.geracao := m.geracao + 1;
    m.rj_ate := t + 10;
    return m;
  end if;
  m.valor := v_v;
  m.delta := v_d;
  m.humor := v_humor;
  m.humor_ate := v_ate;
  return m;
end;
$$;

revoke all on function public.idle_bolsa_normal(double precision, double precision) from public, anon, authenticated;
revoke all on function public.idle_bolsa_humor(double precision[], double precision) from public, anon, authenticated;
revoke all on function public.idle_bolsa_tick(public.idle_bolsa_mercado, public.idle_cat_bolsa, bigint, double precision[]) from public, anon, authenticated;

-- ---------- histórico (7 dias) ----------
create table if not exists public.idle_bolsa_precos (
  tick    bigint not null,
  empresa int not null references public.idle_cat_bolsa (id),
  valor   double precision not null,
  primary key (tick, empresa)
);
alter table public.idle_bolsa_precos enable row level security;
revoke all on public.idle_bolsa_precos from anon, authenticated;

create or replace function public.idle_bolsa_agora()
returns bigint language sql stable set search_path = public as $$
  select floor(extract(epoch from now()) / 60)::bigint
$$;

-- gera os minutos que faltam até p_agora (no máximo 1 dia), com trava: duas chamadas juntas não geram o mesmo minuto
create or replace function public.idle_bolsa_avancar_ate(p_agora bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  c   public.idle_cat_bolsa;
  m   public.idle_bolsa_mercado;
  v_t bigint;
begin
  perform pg_advisory_xact_lock(hashtext('fellas-inc-bolsa'));
  for c in select * from public.idle_cat_bolsa order by id loop
    select * into m from public.idle_bolsa_mercado where empresa = c.id;
    if not found then
      insert into public.idle_bolsa_mercado (empresa, tick, valor, delta, humor, humor_ate, geracao, rj_ate)
      values (c.id, p_agora, c.repouso, 0, 0, p_agora, 0, null);
      insert into public.idle_bolsa_precos (tick, empresa, valor) values (p_agora, c.id, c.repouso)
      on conflict (tick, empresa) do nothing;
      continue;
    end if;
    v_t := greatest(m.tick, p_agora - 1440);
    while v_t < p_agora loop
      v_t := v_t + 1;
      m := public.idle_bolsa_tick(m, c, v_t, array[random(), random(), random(), random(), random(), random(), random()]);
      insert into public.idle_bolsa_precos (tick, empresa, valor) values (v_t, c.id, m.valor)
      on conflict (tick, empresa) do update set valor = excluded.valor;
    end loop;
    update public.idle_bolsa_mercado
       set tick = greatest(m.tick, tick), valor = m.valor, delta = m.delta, humor = m.humor, humor_ate = m.humor_ate,
           geracao = m.geracao, rj_ate = m.rj_ate
     where empresa = c.id;
  end loop;
  delete from public.idle_bolsa_precos where tick < p_agora - 10080;
end;
$$;

create or replace function public.idle_bolsa_avancar()
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare
  v_agora bigint := public.idle_bolsa_agora();
begin
  perform public.idle_bolsa_avancar_ate(v_agora);
  return v_agora;
end;
$$;

revoke all on function public.idle_bolsa_agora() from public, anon, authenticated;
revoke all on function public.idle_bolsa_avancar_ate(bigint) from public, anon, authenticated;
revoke all on function public.idle_bolsa_avancar() from public, anon, authenticated;

-- ---------- carteira ----------
create table if not exists public.idle_bolsa_carteira (
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  empresa int not null references public.idle_cat_bolsa (id),
  qtd     int not null check (qtd >= 0),
  custo   double precision not null check (custo >= 0),
  geracao int not null,
  primary key (user_id, empresa)
);
alter table public.idle_bolsa_carteira enable row level security;
revoke all on public.idle_bolsa_carteira from anon, authenticated;

-- ---------- melhorias da Bolsa (níveis 0..5; ficam na venda da startup) ----------
create table if not exists public.idle_bolsa_nivel (
  user_id    uuid primary key references public.idle_state (user_id) on delete cascade,
  corretor   int not null default 0 check (corretor between 0 and 5),
  escritorio int not null default 0 check (escritorio between 0 and 5)
);
alter table public.idle_bolsa_nivel enable row level security;
revoke all on public.idle_bolsa_nivel from anon, authenticated;

-- iguais a games/idle/bolsaMotor.ts MELHORIAS_BOLSA
create or replace function public.idle_bolsa_corretagem(n int)
returns double precision language sql immutable set search_path = public as $$
  select (array[0.05, 0.04, 0.03, 0.02, 0.01, 0.005]::double precision[])[n + 1]
$$;
create or replace function public.idle_bolsa_escritorio(n int)
returns int language sql immutable set search_path = public as $$
  select (array[0, 25, 50, 100, 200, 400])[n + 1]
$$;
-- custo do nível n (1..5) em segundos de produção
create or replace function public.idle_bolsa_custo(p_tipo text, n int)
returns double precision language sql immutable set search_path = public as $$
  select case p_tipo
    when 'corretor' then (array[1800, 3600, 7200, 14400, 28800]::double precision[])[n]
    else (array[3600, 7200, 14400, 28800, 57600]::double precision[])[n]
  end
$$;
revoke all on function public.idle_bolsa_corretagem(int) from public, anon, authenticated;
revoke all on function public.idle_bolsa_escritorio(int) from public, anon, authenticated;
revoke all on function public.idle_bolsa_custo(text, int) from public, anon, authenticated;

-- o que a página precisa: mercado, histórico da hora, carteira; ações de geração antiga (empresa quebrou) saem da
-- carteira e voltam uma vez em viraram_po
create or replace function public.idle_bolsa_estado(p_user uuid, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_po   jsonb;
  v_tr   int := 0;
  v_corr int := 0;
  v_esc  int := 0;
begin
  select * into s from public.idle_state where user_id = p_user;
  if found then
    v_tr := coalesce(s.generators[19], 0);
  end if;
  select coalesce(max(n.corretor), 0), coalesce(max(n.escritorio), 0) into v_corr, v_esc
    from public.idle_bolsa_nivel n where n.user_id = p_user;
  with po as (
    delete from public.idle_bolsa_carteira k
     using public.idle_bolsa_mercado m
     where k.user_id = p_user and m.empresa = k.empresa and k.geracao < m.geracao
    returning k.empresa, k.qtd
  )
  select coalesce(jsonb_agg(jsonb_build_object('empresa', empresa, 'qtd', qtd) order by empresa) filter (where qtd > 0), '[]'::jsonb)
    into v_po from po;
  return jsonb_build_object(
    'tick', p_agora,
    'vira_em_ms', greatest(0, (p_agora + 1) * 60000 - floor(extract(epoch from now()) * 1000)::bigint),
    'r', case when s.user_id is null then 0 else public.idle_rate(s) end,
    'aberta', v_tr >= 1 and coalesce(s.started, false),
    'corretor', v_corr,
    'escritorio', v_esc,
    'corretagem', public.idle_bolsa_corretagem(v_corr),
    'empresas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.empresa, 'valor', m.valor,
        'limite', 100 + coalesce(s.generators[c.gerador], 0) + public.idle_bolsa_escritorio(v_esc),
        'risco', m.rj_ate is null and m.valor < 0.15 * c.repouso,
        'rj_ate', m.rj_ate,
        'historico', (select coalesce(jsonb_agg(p.valor order by p.tick), '[]'::jsonb) from public.idle_bolsa_precos p
                       where p.empresa = m.empresa and p.tick > p_agora - 60 and p.tick <= p_agora)
      ) order by m.empresa), '[]'::jsonb)
      from public.idle_bolsa_mercado m join public.idle_cat_bolsa c on c.id = m.empresa),
    'carteira', (
      select coalesce(jsonb_agg(jsonb_build_object('empresa', k.empresa, 'qtd', k.qtd, 'custo', k.custo) order by k.empresa), '[]'::jsonb)
        from public.idle_bolsa_carteira k where k.user_id = p_user and k.qtd > 0),
    'viraram_po', v_po);
end;
$$;

create or replace function public.idle_bolsa_negociar_em(
  p_user uuid, p_empresa int, p_lado text, p_qtd int, p_tick bigint, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s        public.idle_state;
  c        public.idle_cat_bolsa;
  m        public.idle_bolsa_mercado;
  k        public.idle_bolsa_carteira;
  v_tem    int := 0;
  v_custo  double precision := 0;
  v_r      double precision;
  v_preco  double precision;
  v_cabe   int;
  v_n      int;
  v_corr   int := 0;
  v_esc    int := 0;
  v_fee    double precision;
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
  select * into k from public.idle_bolsa_carteira where user_id = p_user and empresa = p_empresa for update;
  if found and k.geracao = m.geracao then
    v_tem := k.qtd;
    v_custo := k.custo;
  end if;
  select coalesce(max(n.corretor), 0), coalesce(max(n.escritorio), 0) into v_corr, v_esc
    from public.idle_bolsa_nivel n where n.user_id = p_user;
  v_fee := 1 + public.idle_bolsa_corretagem(v_corr);
  v_r := public.idle_rate(s);
  v_preco := m.valor * v_r;

  if p_lado = 'comprar' then
    v_cabe := 100 + coalesce(s.generators[c.gerador], 0) + public.idle_bolsa_escritorio(v_esc) - v_tem;
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
    insert into public.idle_bolsa_carteira (user_id, empresa, qtd, custo, geracao)
    values (p_user, p_empresa, v_tem + v_n, v_custo + v_n * m.valor * v_fee, m.geracao)
    on conflict (user_id, empresa) do update set qtd = excluded.qtd, custo = excluded.custo, geracao = excluded.geracao;
  else
    if v_tem < 1 then
      raise exception 'idle_bolsa_sem_acoes' using errcode = 'P0001';
    end if;
    v_n := case when p_qtd = 0 then v_tem else least(p_qtd, v_tem) end;
    s.valuation := s.valuation + v_n * v_preco;
    update public.idle_bolsa_carteira
       set qtd = v_tem - v_n, custo = v_custo * (v_tem - v_n) / v_tem, geracao = m.geracao
     where user_id = p_user and empresa = p_empresa;
  end if;

  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('bolsa', public.idle_bolsa_estado(p_user, p_agora));
end;
$$;

create or replace function public.idle_bolsa()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return public.idle_bolsa_estado(auth.uid(), public.idle_bolsa_avancar());
end;
$$;

create or replace function public.idle_bolsa_negociar(p_empresa int, p_lado text, p_qtd int, p_tick bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return public.idle_bolsa_negociar_em(auth.uid(), p_empresa, p_lado, p_qtd, p_tick, public.idle_bolsa_avancar());
end;
$$;

revoke all on function public.idle_bolsa_estado(uuid, bigint) from public, anon, authenticated;
revoke all on function public.idle_bolsa_negociar_em(uuid, int, text, int, bigint, bigint) from public, anon, authenticated;
revoke all on function public.idle_bolsa() from public, anon;
grant execute on function public.idle_bolsa() to authenticated;
revoke all on function public.idle_bolsa_negociar(int, text, int, bigint) from public, anon;
grant execute on function public.idle_bolsa_negociar(int, text, int, bigint) to authenticated;
