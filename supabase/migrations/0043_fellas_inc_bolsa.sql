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
