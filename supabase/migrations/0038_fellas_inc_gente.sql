-- fellasapp: Fellas Inc., entrega 2 (gente): personagem, contratos de 7 dias, a conta da produção com contratos (e
-- com os vencimentos no meio), placar com o "mais disputado" e a foto de segunda guardando ele. A Fellas Inc. não tem
-- reset (0036): nada aqui apaga estado, contrato ou personagem. As funções que mudam são trocadas com create or replace
-- a partir da versão mais nova (0034/0035/0036, já em produção). As mesmas contas existem em games/idle/economia.ts
-- (teste de paridade). Não toca nos créditos do cassino. Idempotente.

-- ===== personagem =====

create table if not exists public.idle_avatar (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  pele          smallint not null check (pele between 0 and 5),
  cabelo        smallint not null check (cabelo between 0 and 5),
  cor_cabelo    smallint not null check (cor_cabelo between 0 and 7),
  roupa         smallint not null check (roupa between 0 and 3),
  cor_roupa     smallint not null check (cor_roupa between 0 and 9),
  acessorio     smallint not null check (acessorio between 0 and 5),
  cor_acessorio smallint not null check (cor_acessorio between 0 and 9),
  updated_at    timestamptz not null default now()
);

alter table public.idle_avatar enable row level security;
revoke all on public.idle_avatar from anon, authenticated;
grant select on public.idle_avatar to authenticated;
drop policy if exists "idle_avatar_select_members" on public.idle_avatar;
create policy "idle_avatar_select_members" on public.idle_avatar for select to authenticated using (public.is_member());

-- o visual de alguém no formato do jogo (null = nunca salvou: a tela usa o fundador padrão)
create or replace function public.idle_avatar_json(u uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('pele', a.pele, 'cabelo', a.cabelo, 'cor_cabelo', a.cor_cabelo, 'roupa', a.roupa,
                            'cor_roupa', a.cor_roupa, 'acessorio', a.acessorio, 'cor_acessorio', a.cor_acessorio)
    from public.idle_avatar a
   where a.user_id = u
$$;

-- o estado que toda função do jogo devolve (o da 0034 + o personagem). plpgsql: as funções que ela chama podem vir
-- depois neste arquivo.
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', public.idle_rate(s), 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators), 'boost_until', s.boost_until,
    'half_price', s.half_price, 'opp_claimed', to_jsonb(s.opp_claimed),
    'opp_left', greatest(0, public.idle_opp_cap(s)
                             - case when s.opp_day = public.games_today() then s.opp_count else 0 end),
    'server_now', now(),
    'avatar', public.idle_avatar_json(s.user_id));
end;
$$;

-- "Bora" do editor: só o próprio, de graça, quantas vezes quiser. Fecha a conta (a tela ancora o número no estado
-- devolvido).
create or replace function public.idle_set_avatar(p_pele int, p_cabelo int, p_cor_cabelo int, p_roupa int,
                                                  p_cor_roupa int, p_acessorio int, p_cor_acessorio int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_pele is null or p_cabelo is null or p_cor_cabelo is null or p_roupa is null or p_cor_roupa is null
     or p_acessorio is null or p_cor_acessorio is null
     or p_pele not between 0 and 5 or p_cabelo not between 0 and 5 or p_cor_cabelo not between 0 and 7
     or p_roupa not between 0 and 3 or p_cor_roupa not between 0 and 9 or p_acessorio not between 0 and 5
     or p_cor_acessorio not between 0 and 9 then
    raise exception 'idle_bad_avatar' using errcode = 'P0001';
  end if;
  insert into public.idle_avatar (user_id, pele, cabelo, cor_cabelo, roupa, cor_roupa, acessorio, cor_acessorio)
  values (auth.uid(), p_pele, p_cabelo, p_cor_cabelo, p_roupa, p_cor_roupa, p_acessorio, p_cor_acessorio)
  on conflict (user_id) do update
    set pele = excluded.pele, cabelo = excluded.cabelo, cor_cabelo = excluded.cor_cabelo, roupa = excluded.roupa,
        cor_roupa = excluded.cor_roupa, acessorio = excluded.acessorio, cor_acessorio = excluded.cor_acessorio,
        updated_at = now();
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_avatar_json(uuid) from public, anon, authenticated;
revoke all on function public.idle_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_set_avatar(int, int, int, int, int, int, int) from public, anon;
grant execute on function public.idle_set_avatar(int, int, int, int, int, int, int) to authenticated;
