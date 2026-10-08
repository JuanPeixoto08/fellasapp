-- fellasapp: Fellas Games — créditos semanais (de mentira), fiado, placar e troféu do campeão. Idempotente.
-- Todo mundo começa a semana com 1.000; sem dar pra apostar (menos de 10, a aposta mínima), fiado de +100 1x/dia.
-- Segunda 00:00 de Brasília o cron grava o pódio, passa o selo
-- weekly_champion para o campeão e volta todo mundo para 1.000. O app só lê; quem escreve são as funções.
-- Os jogos (0028 em diante) estendem os ganchos games_open_round / games_close_open_rounds.

create or replace function public.games_week_start(ts timestamptz default now())
returns date language sql stable as $$ select date_trunc('week', ts at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.games_today()
returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create table if not exists public.game_wallets (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  balance        int not null check (balance >= 0),
  week_start     date not null,
  fiado_count    int not null default 0,
  last_fiado_on  date,
  last_played_at timestamptz,
  updated_at     timestamptz not null default now()
);

create table if not exists public.game_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  delta      int not null,
  reason     text not null check (reason in ('start', 'bet', 'win', 'push', 'fiado', 'reset')),
  round_id   uuid,
  created_at timestamptz not null default now()
);
create index if not exists game_ledger_user_idx on public.game_ledger (user_id, created_at desc);

create table if not exists public.game_weeks (
  week_start  date primary key,
  champion_id uuid references public.profiles (id) on delete set null,
  podium      jsonb not null default '[]',
  closed_at   timestamptz not null default now()
);

alter table public.game_wallets enable row level security;
alter table public.game_ledger  enable row level security;
alter table public.game_weeks   enable row level security;
revoke all on public.game_wallets, public.game_ledger, public.game_weeks from anon, authenticated;
grant select on public.game_wallets, public.game_ledger, public.game_weeks to authenticated;

drop policy if exists "game_wallets_select_members" on public.game_wallets;
create policy "game_wallets_select_members" on public.game_wallets
  for select to authenticated using (public.is_member());
drop policy if exists "game_ledger_select_own" on public.game_ledger;
create policy "game_ledger_select_own" on public.game_ledger
  for select to authenticated using (user_id = auth.uid() and public.is_member());
drop policy if exists "game_weeks_select_members" on public.game_weeks;
create policy "game_weeks_select_members" on public.game_weeks
  for select to authenticated using (public.is_member());

-- ganchos dos jogos: a 0028 (blackjack) substitui
create or replace function public.games_open_round(p_user uuid)
returns uuid language sql stable security definer set search_path = public as $$ select null::uuid $$;
create or replace function public.games_close_open_rounds()
returns void language plpgsql security definer set search_path = public as $$ begin end $$;

-- cria a carteira (1.000, extrato "start") se não existe e devolve travada
create or replace function public.games_ensure_wallet(p_user uuid)
returns public.game_wallets language plpgsql security definer set search_path = public as $$
declare w public.game_wallets;
begin
  insert into public.game_wallets (user_id, balance, week_start)
  values (p_user, 1000, public.games_week_start())
  on conflict (user_id) do nothing;
  if found then
    insert into public.game_ledger (user_id, delta, reason) values (p_user, 1000, 'start');
  end if;
  select * into w from public.game_wallets where user_id = p_user for update;
  return w;
end;
$$;

-- mexe no saldo com extrato; nunca deixa negativo
create or replace function public.games_move(p_user uuid, p_delta int, p_reason text, p_round uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  update public.game_wallets set balance = balance + p_delta, updated_at = now()
   where user_id = p_user and balance + p_delta >= 0
  returning balance into v_balance;
  if not found then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
  insert into public.game_ledger (user_id, delta, reason, round_id) values (p_user, p_delta, p_reason, p_round);
  return v_balance;
end;
$$;

create or replace function public.games_wallet_json(w public.game_wallets)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_open uuid := public.games_open_round(w.user_id);
begin
  return jsonb_build_object(
    'balance', w.balance,
    'fiado_count', w.fiado_count,
    'can_fiado', w.balance < 10 and v_open is null and w.last_fiado_on is distinct from public.games_today(),
    'open_round_id', v_open,
    'week_start', w.week_start);
end;
$$;

create or replace function public.games_wallet()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return public.games_wallet_json(public.games_ensure_wallet(auth.uid()));
end;
$$;

create or replace function public.games_fiado()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare w public.game_wallets;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  w := public.games_ensure_wallet(auth.uid());
  -- abaixo da aposta mínima (o troco de um blackjack pode deixar 5) já conta como quebrado
  if w.balance >= 10 then
    raise exception 'fiado_not_broke' using errcode = 'P0001';
  end if;
  if public.games_open_round(w.user_id) is not null then
    raise exception 'fiado_open_round' using errcode = 'P0001';
  end if;
  if w.last_fiado_on = public.games_today() then
    raise exception 'fiado_today' using errcode = 'P0001';
  end if;
  perform public.games_move(w.user_id, 100, 'fiado');
  update public.game_wallets
     set fiado_count = fiado_count + 1, last_fiado_on = public.games_today()
   where user_id = w.user_id
  returning * into w;
  return public.games_wallet_json(w);
end;
$$;

-- segunda 00:00 (Brasília): fecha mãos, grava pódio, passa o troféu, volta todo mundo pra 1.000
create or replace function public.games_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_new    date := public.games_week_start();
  v_old    date;
  v_podium jsonb;
  v_champ  uuid;
begin
  -- só quem ficou na semana velha: quem criou a carteira já na semana nova (antes do cron) não conta nem zera
  select max(week_start) into v_old from public.game_wallets where week_start < v_new;
  if v_old is null then
    return;
  end if;

  perform public.games_close_open_rounds();

  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'balance', balance, 'fiado_count', fiado_count)
                            order by balance desc, fiado_count asc, last_played_at asc), '[]')
    into v_podium
    from (select * from public.game_wallets
           where last_played_at is not null and week_start < v_new
           order by balance desc, fiado_count asc, last_played_at asc
           limit 3) top;
  v_champ := (v_podium -> 0 ->> 'user_id')::uuid;

  insert into public.game_weeks (week_start, champion_id, podium)
  values (v_old, v_champ, v_podium)
  on conflict (week_start) do nothing;

  update public.profiles set badges = array_remove(badges, 'weekly_champion') where 'weekly_champion' = any (badges);
  if v_champ is not null then
    update public.profiles set badges = array_append(badges, 'weekly_champion') where id = v_champ;
  end if;

  insert into public.game_ledger (user_id, delta, reason)
  select user_id, 1000 - balance, 'reset' from public.game_wallets where balance <> 1000 and week_start < v_new;
  update public.game_wallets
     set balance = 1000, week_start = v_new, fiado_count = 0, last_fiado_on = null,
         last_played_at = null, updated_at = now()
   where week_start < v_new;
end;
$$;

revoke all on function public.games_open_round(uuid) from public, anon, authenticated;
revoke all on function public.games_close_open_rounds() from public, anon, authenticated;
revoke all on function public.games_ensure_wallet(uuid) from public, anon, authenticated;
revoke all on function public.games_move(uuid, int, text, uuid) from public, anon, authenticated;
revoke all on function public.games_wallet_json(public.game_wallets) from public, anon, authenticated;
revoke all on function public.games_weekly_reset() from public, anon, authenticated;
revoke all on function public.games_wallet() from public, anon;
revoke all on function public.games_fiado() from public, anon;
grant execute on function public.games_wallet() to authenticated;
grant execute on function public.games_fiado() to authenticated;

select cron.schedule('fellas-games-reset', '0 3 * * 1', $$select public.games_weekly_reset()$$);
