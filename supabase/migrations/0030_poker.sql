-- fellasapp: Fellas Games — Poker (No-Limit Texas Hold'em ao vivo, uma mesa de 6). Idempotente.
-- Depende da 0027–0029. Toda regra mora aqui: a tela só pede jogadas e mostra o retrato público da mesa
-- (poker_tables.state), que o Realtime entrega a todos. As cartas de cada um ficam em poker_secrets (sem
-- política: ninguém lê). Também: o placar soma as fichas da mesa, o fiado espera levantar, e o reset de segunda
-- trava as carteiras, anula a mão aberta e levanta todo mundo antes de zerar (M2 da revisão do projeto 1).
-- Ordem das travas em todo lugar: poker_tables → game_wallets → bj_rounds.

-- ===== Avaliador de mãos =====
-- carta 0–51: rank = c % 13 (0 = A), naipe = c / 13. Valor: 2..10, J = 11, Q = 12, K = 13, A = 14.
create or replace function public.poker_value(c smallint)
returns int language sql immutable as $$ select case when c % 13 = 0 then 14 else c % 13 + 1 end $$;

-- 5 cartas → array comparável: categoria e desempates (maior primeiro).
-- 8 straight flush [8, alta] · 7 quadra [7, q, kicker] · 6 full [6, trinca, par] · 5 flush [5, 5 valores]
-- 4 sequência [4, alta] · 3 trinca [3, t, k, k] · 2 dois pares [2, alto, baixo, k] · 1 par [1, p, k, k, k]
-- 0 carta alta [0, 5 valores]. A-2-3-4-5 é a menor sequência (alta = 5); sem volta Q-K-A-2-3.
create or replace function public.poker_rank5(p smallint[])
returns int[] language plpgsql immutable as $$
declare
  v_vals   int[];
  v_flush  boolean;
  v_high   int;
  v_groups int[];
  v_counts int[];
begin
  select array_agg(public.poker_value(c) order by public.poker_value(c) desc) into v_vals from unnest(p) c;
  select count(distinct c / 13) = 1 into v_flush from unnest(p) c;
  if (select count(distinct v) from unnest(v_vals) v) = 5 then
    if v_vals[1] - v_vals[5] = 4 then
      v_high := v_vals[1];
    elsif v_vals = array[14, 5, 4, 3, 2] then
      v_high := 5;
    end if;
  end if;
  select array_agg(v order by n desc, v desc), array_agg(n order by n desc, v desc)
    into v_groups, v_counts
    from (select v, count(*)::int as n from unnest(v_vals) v group by v) g;

  if v_high is not null and v_flush then return array[8, v_high]; end if;
  if v_counts[1] = 4 then return array[7] || v_groups; end if;
  if v_counts[1] = 3 and v_counts[2] = 2 then return array[6] || v_groups; end if;
  if v_flush then return array[5] || v_vals; end if;
  if v_high is not null then return array[4, v_high]; end if;
  if v_counts[1] = 3 then return array[3] || v_groups; end if;
  if v_counts[1] = 2 and v_counts[2] = 2 then return array[2] || v_groups; end if;
  if v_counts[1] = 2 then return array[1] || v_groups; end if;
  return array[0] || v_vals;
end;
$$;

-- melhor mão de 5 entre 5 a 7 cartas (no showdown: 2 da mão + 5 da mesa = 21 combinações)
create or replace function public.poker_rank(p smallint[])
returns int[] language sql immutable as $$
  select max(public.poker_rank5(array[p[a], p[b], p[c], p[d], p[e]]))
    from generate_series(1, cardinality(p)) a
    join generate_series(1, cardinality(p)) b on b > a
    join generate_series(1, cardinality(p)) c on c > b
    join generate_series(1, cardinality(p)) d on d > c
    join generate_series(1, cardinality(p)) e on e > d
$$;

create or replace function public.poker_card_name(v int)
returns text language sql immutable as $$
  select case v when 11 then 'J' when 12 then 'Q' when 13 then 'K' when 14 then 'A' else v::text end
$$;

create or replace function public.poker_rank_name(r int[])
returns text language sql immutable as $$
  select case r[1]
    when 8 then case when r[2] = 14 then 'Royal flush' else 'Straight flush' end
    when 7 then 'Quadra de ' || public.poker_card_name(r[2])
    when 6 then 'Full house, ' || public.poker_card_name(r[2]) || ' e ' || public.poker_card_name(r[3])
    when 5 then 'Flush'
    when 4 then 'Sequência até o ' || public.poker_card_name(r[2])
    when 3 then 'Trinca de ' || public.poker_card_name(r[2])
    when 2 then 'Dois pares, ' || public.poker_card_name(r[2]) || ' e ' || public.poker_card_name(r[3])
    when 1 then 'Par de ' || public.poker_card_name(r[2])
    else 'Carta alta ' || public.poker_card_name(r[2])
  end
$$;

revoke all on function public.poker_value(smallint) from public, anon, authenticated;
revoke all on function public.poker_rank5(smallint[]) from public, anon, authenticated;
revoke all on function public.poker_rank(smallint[]) from public, anon, authenticated;
revoke all on function public.poker_card_name(int) from public, anon, authenticated;
revoke all on function public.poker_rank_name(int[]) from public, anon, authenticated;

-- ===== Tabelas =====
-- a mesa (uma linha só) e o retrato público que o Realtime entrega
create table if not exists public.poker_tables (
  id           smallint primary key default 1 check (id = 1),
  small_blind  int not null default 5,
  big_blind    int not null default 10,
  min_buyin    int not null default 200,
  max_buyin    int not null default 500,
  seq          bigint not null default 0,
  hand_no      int not null default 0,
  last_bb_seat smallint,
  next_hand_at timestamptz,
  state        jsonb not null default '{}',
  updated_at   timestamptz not null default now()
);
insert into public.poker_tables (id) values (1) on conflict (id) do nothing;

-- os 6 lugares: as fichas da mesa existem aqui
create table if not exists public.poker_seats (
  seat       smallint primary key check (seat between 0 and 5),
  user_id    uuid not null unique references public.profiles (id) on delete cascade,
  stack      int not null check (stack >= 0),
  status     text not null default 'playing' check (status in ('playing', 'away')),
  wait_bb    boolean not null default true,
  leaving    boolean not null default false,
  timeouts   smallint not null default 0,
  away_since timestamptz,
  busted_at  timestamptz,
  sat_at     timestamptz not null default now()
);

-- mãos: só o que é público (cartas abertas da mesa e as mostradas)
create table if not exists public.poker_hands (
  id          uuid primary key default gen_random_uuid(),
  hand_no     int not null,
  status      text not null default 'betting' check (status in ('betting', 'done', 'void')),
  street      text not null default 'preflop' check (street in ('preflop', 'flop', 'turn', 'river', 'showdown')),
  button      smallint not null,
  sb_seat     smallint not null,
  bb_seat     smallint not null,
  board       smallint[] not null default '{}',
  -- lugar → { user_id, bet (na rodada), total (na mão), folded, all_in, acted, capped, last, timed_out }
  players     jsonb not null,
  current_bet int not null default 0,
  last_raise  int not null default 0,
  to_act      smallint,
  action_no   int not null default 0,
  deadline    timestamptz,
  runout      boolean not null default false,
  results     jsonb,
  shown       jsonb not null default '{}',
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create unique index if not exists poker_hands_one_open on public.poker_hands (status) where status = 'betting';
create index if not exists poker_hands_recent on public.poker_hands (hand_no desc);

-- baralho e cartas de cada um: ninguém lê (sem política); some quando a mão seguinte começa
create table if not exists public.poker_secrets (
  hand_id uuid primary key references public.poker_hands (id) on delete cascade,
  deck    smallint[] not null,
  holes   jsonb not null
);

-- anti-rathole: com quanto cada um levantou
create table if not exists public.poker_leaves (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stack   int not null,
  left_at timestamptz not null default now()
);

alter table public.poker_tables  enable row level security;
alter table public.poker_seats   enable row level security;
alter table public.poker_hands   enable row level security;
alter table public.poker_secrets enable row level security;
alter table public.poker_leaves  enable row level security;
revoke all on public.poker_tables, public.poker_seats, public.poker_hands, public.poker_secrets, public.poker_leaves
  from anon, authenticated;
grant select on public.poker_tables, public.poker_seats, public.poker_hands to authenticated;

drop policy if exists "poker_tables_select_members" on public.poker_tables;
create policy "poker_tables_select_members" on public.poker_tables
  for select to authenticated using (public.is_member());
drop policy if exists "poker_seats_select_members" on public.poker_seats;
create policy "poker_seats_select_members" on public.poker_seats
  for select to authenticated using (public.is_member());
drop policy if exists "poker_hands_select_members" on public.poker_hands;
create policy "poker_hands_select_members" on public.poker_hands
  for select to authenticated using (public.is_member());

-- entrada e saída da mesa no extrato
alter table public.game_ledger drop constraint if exists game_ledger_reason_check;
alter table public.game_ledger add constraint game_ledger_reason_check
  check (reason in ('start', 'bet', 'win', 'push', 'fiado', 'reset', 'buyin', 'cashout'));

-- o retrato da mesa vai pelo Realtime (como as tabelas da 0021)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poker_tables') then
    alter publication supabase_realtime add table public.poker_tables;
  end if;
end $$;

-- ===== Peças internas =====
-- domingo 23:55 em diante (Brasília): nenhuma mão nova até o reset da meia-noite
create or replace function public.poker_closed(ts timestamptz default now())
returns boolean language sql stable as $$
  select extract(isodow from ts at time zone 'America/Sao_Paulo') = 7
     and (ts at time zone 'America/Sao_Paulo')::time >= time '23:55'
$$;

create or replace function public.poker_shuffle()
returns smallint[] language sql volatile as $$
  select array_agg(c::smallint order by gen_random_uuid()) from generate_series(0, 51) c
$$;

-- próximo lugar do conjunto no sentido horário (número maior; dá a volta)
create or replace function public.poker_next(p_from smallint, p_set smallint[])
returns smallint language sql immutable as $$
  select coalesce((select min(s) from unnest(p_set) s where s > coalesce(p_from, -1)),
                  (select min(s) from unnest(p_set) s))
$$;

create or replace function public.poker_prev(p_from smallint, p_set smallint[])
returns smallint language sql immutable as $$
  select coalesce((select max(s) from unnest(p_set) s where s < p_from),
                  (select max(s) from unnest(p_set) s))
$$;

-- muda campos de um jogador da mão
create or replace function public.poker_patch(p_hand uuid, p_seat smallint, p_patch jsonb)
returns void language sql security definer set search_path = public as $$
  update public.poker_hands
     set players = jsonb_set(players, array[p_seat::text], (players -> p_seat::text) || p_patch)
   where id = p_hand
$$;

-- fichas do lugar para a aposta da rodada (quem zera fica all-in)
create or replace function public.poker_put(p_hand uuid, p_seat smallint, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_left int;
  p      jsonb;
begin
  update public.poker_seats set stack = stack - p_amount where seat = p_seat returning stack into v_left;
  select players -> p_seat::text into p from public.poker_hands where id = p_hand;
  perform public.poker_patch(p_hand, p_seat, jsonb_build_object(
    'bet', (p ->> 'bet')::int + p_amount,
    'total', (p ->> 'total')::int + p_amount,
    'all_in', v_left = 0));
end;
$$;

-- retrato público: refeito no fim de toda mudança (mesma transação); o Realtime entrega a linha
create or replace function public.poker_snapshot()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.poker_tables;
  h public.poker_hands;
  v jsonb;
begin
  update public.poker_tables set seq = seq + 1 where id = 1 returning * into t;
  select * into h from public.poker_hands order by hand_no desc limit 1;
  v := jsonb_build_object(
    'seq', t.seq,
    'server_now', now(),
    'closed', public.poker_closed(now()),
    'next_hand_at', t.next_hand_at,
    'blinds', jsonb_build_array(t.small_blind, t.big_blind),
    'buyin', jsonb_build_array(t.min_buyin, t.max_buyin),
    'seats', coalesce((select jsonb_agg(jsonb_build_object(
        'seat', s.seat, 'user_id', s.user_id, 'stack', s.stack, 'status', s.status, 'wait_bb', s.wait_bb,
        'leaving', s.leaving, 'busted', s.busted_at is not null) order by s.seat)
      from public.poker_seats s), '[]'),
    'hand', case when h.id is null then null else jsonb_build_object(
        'id', h.id, 'no', h.hand_no, 'status', h.status, 'street', h.street, 'board', to_jsonb(h.board),
        'players', h.players,
        'pot', (select coalesce(sum((e.value ->> 'total')::int), 0) from jsonb_each(h.players) e),
        'current_bet', h.current_bet,
        'min_raise_to', h.current_bet + greatest(h.last_raise, t.big_blind),
        'to_act', h.to_act, 'action_no', h.action_no, 'deadline', h.deadline,
        'button', h.button, 'sb', h.sb_seat, 'bb', h.bb_seat, 'runout', h.runout,
        'results', h.results, 'shown', h.shown) end);
  update public.poker_tables set state = v, updated_at = now() where id = 1;
  return v;
end;
$$;

-- levanta o lugar: fichas para a carteira; p_track grava a saída (anti-rathole). O reset não grava.
create or replace function public.poker_stand(p_seat smallint, p_track boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare s public.poker_seats;
begin
  delete from public.poker_seats where seat = p_seat returning * into s;
  if s.user_id is null then
    return;
  end if;
  if s.stack > 0 then
    perform public.games_ensure_wallet(s.user_id);
    perform public.games_move(s.user_id, s.stack, 'cashout');
  end if;
  if p_track then
    insert into public.poker_leaves (user_id, stack, left_at) values (s.user_id, s.stack, now())
    on conflict (user_id) do update set stack = excluded.stack, left_at = excluded.left_at;
  end if;
end;
$$;

-- começa uma mão se der (Task 3 troca este corpo pelo de verdade)
create or replace function public.poker_maybe_start()
returns void language plpgsql security definer set search_path = public as $$
begin
end;
$$;

-- ===== Funções do app: mesa =====
-- o retrato atual, com a hora de agora e o mínimo do anti-rathole de quem pergunta
create or replace function public.poker_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  l public.poker_leaves;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select state into v from public.poker_tables where id = 1;
  select * into l from public.poker_leaves where user_id = auth.uid() and left_at > now() - interval '30 minutes';
  return v || jsonb_build_object(
    'server_now', now(),
    'me', jsonb_build_object('rathole_min', case when l.user_id is null then null else greatest(l.stack, 200) end));
end;
$$;

create or replace function public.poker_sit(p_seat int, p_buyin int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t     public.poker_tables;
  l     public.poker_leaves;
  v_min int;
  v_max int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into t from public.poker_tables where id = 1 for update;
  if p_seat is null or p_seat < 0 or p_seat > 5 then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.poker_seats where user_id = auth.uid()) then
    raise exception 'already_seated' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.poker_seats where seat = p_seat) then
    raise exception 'seat_taken' using errcode = 'P0001';
  end if;
  -- levantou há menos de 30 min: volta com pelo menos o que levou (pode passar de 500; o valor exato vale)
  select * into l from public.poker_leaves where user_id = auth.uid() and left_at > now() - interval '30 minutes';
  v_min := greatest(t.min_buyin, coalesce(l.stack, 0));
  v_max := greatest(t.max_buyin, v_min);
  if p_buyin is null or p_buyin > v_max or (p_buyin % 10 <> 0 and p_buyin <> v_min) then
    raise exception 'buyin_out_of_range' using errcode = 'P0001';
  end if;
  if p_buyin < v_min then
    if v_min > t.min_buyin then
      raise exception 'rathole_min' using errcode = 'P0001';
    end if;
    raise exception 'buyin_out_of_range' using errcode = 'P0001';
  end if;
  perform public.games_ensure_wallet(auth.uid());
  perform public.games_move(auth.uid(), -p_buyin, 'buyin');
  delete from public.poker_leaves where user_id = auth.uid();
  insert into public.poker_seats (seat, user_id, stack) values (p_seat, auth.uid(), p_buyin);
  perform public.poker_maybe_start();
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;

-- levanta já, ou (na mão) "sai ao fim da mão": corre quando a vez chegar; all-in fica até o fim
create or replace function public.poker_leave()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.poker_seats;
  h public.poker_hands;
  p jsonb;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform 1 from public.poker_tables where id = 1 for update;
  select * into s from public.poker_seats where user_id = auth.uid();
  if s.user_id is null then
    raise exception 'not_seated' using errcode = 'P0001';
  end if;
  select * into h from public.poker_hands where status = 'betting';
  p := h.players -> s.seat::text;
  if p is not null and (p ->> 'user_id')::uuid = s.user_id and not (p ->> 'folded')::boolean then
    update public.poker_seats set leaving = true where seat = s.seat;
    if h.to_act = s.seat and not (p ->> 'all_in')::boolean then
      perform public.poker_apply(h.id, s.seat, 'fold');
      perform public.poker_advance(h.id);
    end if;
  else
    perform public.poker_stand(s.seat, true);
  end if;
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;

-- volta do ausente: entra quando a cega grande chegar nele
create or replace function public.poker_back()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform 1 from public.poker_tables where id = 1 for update;
  if not exists (select 1 from public.poker_seats where user_id = auth.uid()) then
    raise exception 'not_seated' using errcode = 'P0001';
  end if;
  update public.poker_seats set status = 'playing', wait_bb = true, timeouts = 0, away_since = null
   where user_id = auth.uid() and status = 'away';
  perform public.poker_maybe_start();
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;

-- completa as fichas fora da mão (quem já correu também pode), até 500 na mesa
create or replace function public.poker_rebuy(p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.poker_tables;
  s public.poker_seats;
  p jsonb;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into t from public.poker_tables where id = 1 for update;
  select * into s from public.poker_seats where user_id = auth.uid();
  if s.user_id is null then
    raise exception 'not_seated' using errcode = 'P0001';
  end if;
  select players -> s.seat::text into p from public.poker_hands where status = 'betting';
  if p is not null and (p ->> 'user_id')::uuid = s.user_id and not (p ->> 'folded')::boolean then
    raise exception 'rebuy_in_hand' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount % 10 <> 0 or s.stack + p_amount > t.max_buyin then
    raise exception 'rebuy_out_of_range' using errcode = 'P0001';
  end if;
  perform public.games_ensure_wallet(s.user_id);
  perform public.games_move(s.user_id, -p_amount, 'buyin');
  update public.poker_seats set stack = stack + p_amount, busted_at = null where seat = s.seat;
  perform public.poker_maybe_start();
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;

-- ===== Carteira, fiado e placar (0027 ajustada) =====
-- a carteira mostra as fichas na mesa; o fiado espera levantar
create or replace function public.games_wallet_json(w public.game_wallets)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_open  uuid := public.games_open_round(w.user_id);
  v_stack int := (select stack from public.poker_seats where user_id = w.user_id);
begin
  return jsonb_build_object(
    'balance', w.balance,
    'fiado_count', w.fiado_count,
    'can_fiado', w.balance < 10 and v_open is null and v_stack is null
                 and w.last_fiado_on is distinct from public.games_today(),
    'open_round_id', v_open,
    'seated_stack', v_stack,
    'week_start', w.week_start);
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
  if exists (select 1 from public.poker_seats where user_id = w.user_id) then
    raise exception 'fiado_seated' using errcode = 'P0001';
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

-- placar da semana: carteira + fichas na mesa; só quem jogou; ordem do placar
create or replace function public.games_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', w.user_id, 'balance', w.balance + coalesce(s.stack, 0),
                                        'fiado_count', w.fiado_count)
                     order by w.balance + coalesce(s.stack, 0) desc, w.fiado_count asc, w.last_played_at asc)
      from public.game_wallets w
      left join public.poker_seats s on s.user_id = w.user_id
     where w.last_played_at is not null), '[]');
end;
$$;

revoke all on function public.poker_closed(timestamptz) from public, anon, authenticated;
revoke all on function public.poker_shuffle() from public, anon, authenticated;
revoke all on function public.poker_next(smallint, smallint[]) from public, anon, authenticated;
revoke all on function public.poker_prev(smallint, smallint[]) from public, anon, authenticated;
revoke all on function public.poker_patch(uuid, smallint, jsonb) from public, anon, authenticated;
revoke all on function public.poker_put(uuid, smallint, int) from public, anon, authenticated;
revoke all on function public.poker_snapshot() from public, anon, authenticated;
revoke all on function public.poker_stand(smallint, boolean) from public, anon, authenticated;
revoke all on function public.poker_maybe_start() from public, anon, authenticated;
revoke all on function public.poker_state() from public, anon;
revoke all on function public.poker_sit(int, int) from public, anon;
revoke all on function public.poker_leave() from public, anon;
revoke all on function public.poker_back() from public, anon;
revoke all on function public.poker_rebuy(int) from public, anon;
revoke all on function public.games_board() from public, anon;
grant execute on function public.poker_state() to authenticated;
grant execute on function public.poker_sit(int, int) to authenticated;
grant execute on function public.poker_leave() to authenticated;
grant execute on function public.poker_back() to authenticated;
grant execute on function public.poker_rebuy(int) to authenticated;
grant execute on function public.games_board() to authenticated;

-- primeiro retrato (a mesa vazia)
select public.poker_snapshot();
