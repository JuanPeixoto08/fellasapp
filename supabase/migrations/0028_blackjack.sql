-- fellasapp: Blackjack dos Fellas Games. Idempotente. Depende da 0027 (carteira e ganchos).
-- Regras: 6 baralhos embaralhados a cada mão; banca para em 17 (inclusive macio); natural paga 3:2; dobrar só
-- com 2 cartas; dividir par de mesmo valor uma vez (ases: uma carta cada); sem seguro nem desistir.
-- O sapato e a carta virada da banca ficam em bj_secrets, que ninguém lê: só as funções.
-- Cartas: smallint 0–51; rank = c % 13 (0 Ás, 1–9 = 2–10, 10 J, 11 Q, 12 K); naipe = c / 13 (♠ ♥ ♦ ♣).

create or replace function public.bj_card_value(c smallint)
returns int language sql immutable as $$
  select case when c % 13 = 0 then 1 when c % 13 >= 9 then 10 else c % 13 + 1 end
$$;

create or replace function public.bj_is_soft(cards smallint[])
returns boolean language sql immutable as $$
  select coalesce(bool_or(c % 13 = 0), false) and coalesce(sum(public.bj_card_value(c)), 0) + 10 <= 21
    from unnest(cards) c
$$;

create or replace function public.bj_hand_total(cards smallint[])
returns int language sql immutable as $$
  select (coalesce(sum(public.bj_card_value(c)), 0) + case when public.bj_is_soft(cards) then 10 else 0 end)::int
    from unnest(cards) c
$$;

create or replace function public.bj_shuffle()
returns smallint[] language sql volatile as $$
  select array_agg((g % 52)::smallint order by gen_random_uuid()) from generate_series(0, 311) g
$$;

create or replace function public.bj_cards(j jsonb)
returns smallint[] language sql immutable as $$
  select coalesce(array_agg(x::smallint order by o), '{}') from jsonb_array_elements_text(j) with ordinality e(x, o)
$$;

create or replace function public.bj_new_hand(cards smallint[], bet int, from_split_aces boolean)
returns jsonb language sql immutable as $$
  select jsonb_build_object('cards', to_jsonb(cards), 'bet', bet, 'doubled', false,
    'from_split_aces', from_split_aces, 'done', from_split_aces or public.bj_hand_total(cards) = 21, 'result', null)
$$;

create table if not exists public.bj_rounds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  week_start  date not null,
  status      text not null check (status in ('playing', 'done')),
  bet         int not null check (bet between 10 and 500),
  hands       jsonb not null,
  active      smallint not null default 0,
  dealer      smallint[] not null,
  payout      int not null default 0,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists bj_rounds_one_open on public.bj_rounds (user_id) where status = 'playing';

create table if not exists public.bj_secrets (
  round_id uuid primary key references public.bj_rounds (id) on delete cascade,
  shoe     smallint[] not null,
  hole     smallint not null
);

alter table public.bj_rounds  enable row level security;
alter table public.bj_secrets enable row level security; -- sem política: ninguém lê
revoke all on public.bj_rounds, public.bj_secrets from anon, authenticated;
grant select on public.bj_rounds to authenticated;
drop policy if exists "bj_rounds_select_own" on public.bj_rounds;
create policy "bj_rounds_select_own" on public.bj_rounds
  for select to authenticated using (user_id = auth.uid() and public.is_member());

create or replace function public.bj_state(r public.bj_rounds)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'status', r.status, 'bet', r.bet, 'hands', r.hands, 'active', r.active,
    'dealer', to_jsonb(r.dealer), 'dealer_total', public.bj_hand_total(r.dealer), 'payout', r.payout,
    'balance', (select balance from public.game_wallets where user_id = r.user_id),
    -- quebrou na mesa: a tela já sabe se dá pra pegar fiado sem perguntar de novo
    'can_fiado', (select (public.games_wallet_json(w) ->> 'can_fiado')::boolean
                    from public.game_wallets w where w.user_id = r.user_id))
$$;

-- revela, banca joga (se precisa), acerta cada mão, paga e fecha
create or replace function public.bj_finish(p_round uuid)
returns public.bj_rounds language plpgsql security definer set search_path = public as $$
declare
  r        public.bj_rounds;
  s        public.bj_secrets;
  v_hands  jsonb := '[]';
  h        jsonb;
  v_pt     int;
  v_dt     int;
  v_res    text;
  v_pay    int := 0;
  p_nat    boolean;
  d_nat    boolean;
  any_live boolean;
begin
  select * into r from public.bj_rounds where id = p_round for update;
  -- já fechada (o reset e a jogada podem chegar juntos): não revela de novo nem paga outra vez
  if r.status <> 'playing' then
    return r;
  end if;
  select * into s from public.bj_secrets where round_id = p_round for update;
  r.dealer := r.dealer || s.hole;
  d_nat := public.bj_hand_total(r.dealer) = 21;
  p_nat := jsonb_array_length(r.hands) = 1
           and jsonb_array_length(r.hands -> 0 -> 'cards') = 2
           and public.bj_hand_total(public.bj_cards(r.hands -> 0 -> 'cards')) = 21;
  select bool_or(public.bj_hand_total(public.bj_cards(x -> 'cards')) <= 21) into any_live
    from jsonb_array_elements(r.hands) x;

  if not d_nat and not p_nat and any_live then
    while public.bj_hand_total(r.dealer) < 17 loop
      r.dealer := r.dealer || s.shoe[1];
      s.shoe := s.shoe[2:];
    end loop;
  end if;
  v_dt := public.bj_hand_total(r.dealer);

  for h in select x from jsonb_array_elements(r.hands) x loop
    v_pt := public.bj_hand_total(public.bj_cards(h -> 'cards'));
    if v_pt > 21 then v_res := 'bust';
    elsif p_nat and d_nat then v_res := 'push';
    elsif p_nat then v_res := 'blackjack';
    elsif d_nat then v_res := 'lose';
    elsif v_dt > 21 or v_pt > v_dt then v_res := 'win';
    elsif v_pt = v_dt then v_res := 'push';
    else v_res := 'lose';
    end if;
    v_pay := v_pay + case v_res
      when 'blackjack' then (h ->> 'bet')::int + (h ->> 'bet')::int * 3 / 2
      when 'win' then (h ->> 'bet')::int * 2
      when 'push' then (h ->> 'bet')::int
      else 0 end;
    v_hands := v_hands || jsonb_build_array(h || jsonb_build_object('done', true, 'result', v_res));
  end loop;

  if v_pay > 0 then
    perform public.games_move(r.user_id, v_pay,
      case when v_hands @> '[{"result":"win"}]' or v_hands @> '[{"result":"blackjack"}]' then 'win' else 'push' end,
      r.id);
  end if;
  update public.game_wallets set last_played_at = now() where user_id = r.user_id;
  update public.bj_secrets set shoe = s.shoe where round_id = r.id;
  update public.bj_rounds
     set status = 'done', hands = v_hands, dealer = r.dealer, payout = v_pay, finished_at = now()
   where id = r.id
  returning * into r;
  return r;
end;
$$;

create or replace function public.bj_deal(p_bet int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  w      public.game_wallets;
  r      public.bj_rounds;
  v_shoe smallint[];
  v_p    smallint[];
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_bet is null or p_bet < 10 or p_bet > 500 then
    raise exception 'bet_out_of_range' using errcode = 'P0001';
  end if;
  w := public.games_ensure_wallet(auth.uid());
  if public.games_open_round(w.user_id) is not null then
    raise exception 'round_open' using errcode = 'P0001';
  end if;

  v_shoe := public.bj_shuffle();
  v_p := array[v_shoe[1], v_shoe[3]];
  insert into public.bj_rounds (user_id, week_start, status, bet, hands, active, dealer)
  values (w.user_id, w.week_start, 'playing', p_bet, jsonb_build_array(public.bj_new_hand(v_p, p_bet, false)), 0,
          array[v_shoe[2]])
  returning * into r;
  insert into public.bj_secrets (round_id, shoe, hole) values (r.id, v_shoe[5:], v_shoe[4]);
  perform public.games_move(w.user_id, -p_bet, 'bet', r.id); -- sem saldo: erro e tudo volta

  if public.bj_hand_total(array[v_shoe[2], v_shoe[4]]) = 21 or public.bj_hand_total(v_p) = 21 then
    r := public.bj_finish(r.id);
  end if;
  return public.bj_state(r);
end;
$$;

create or replace function public.bj_current()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.bj_rounds;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into r from public.bj_rounds where user_id = auth.uid() and status = 'playing';
  if not found then
    return null;
  end if;
  return public.bj_state(r);
end;
$$;

-- gancho da 0027: a mão aberta de blackjack conta como "mão aberta" (fiado, carteira)
create or replace function public.games_open_round(p_user uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.bj_rounds where user_id = p_user and status = 'playing'
$$;

revoke all on function public.bj_shuffle() from public, anon, authenticated;
revoke all on function public.bj_state(public.bj_rounds) from public, anon, authenticated;
revoke all on function public.bj_finish(uuid) from public, anon, authenticated;
revoke all on function public.games_open_round(uuid) from public, anon, authenticated;
revoke all on function public.bj_deal(int) from public, anon;
revoke all on function public.bj_current() from public, anon;
grant execute on function public.bj_deal(int) to authenticated;
grant execute on function public.bj_current() to authenticated;

-- uma jogada na mão ativa; quando todas ficam prontas, a banca joga e acerta
create or replace function public.bj_act(p_round uuid, p_action text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r       public.bj_rounds;
  s       public.bj_secrets;
  h       jsonb;
  v_cards smallint[];
  v_bet   int;
  v_aces  boolean;
  v_next  int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('hit', 'stand', 'double', 'split') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  select * into r from public.bj_rounds where id = p_round and user_id = auth.uid() for update;
  if not found then
    raise exception 'round_not_found' using errcode = 'P0001';
  end if;
  if r.status <> 'playing' then
    raise exception 'round_done' using errcode = 'P0001';
  end if;
  perform 1 from public.game_wallets where user_id = r.user_id for update;
  select * into s from public.bj_secrets where round_id = r.id for update;

  h := r.hands -> r.active;
  v_cards := public.bj_cards(h -> 'cards');
  v_bet := (h ->> 'bet')::int;

  if p_action = 'hit' then
    v_cards := v_cards || s.shoe[1];
    s.shoe := s.shoe[2:];
    h := h || jsonb_build_object('cards', to_jsonb(v_cards), 'done', public.bj_hand_total(v_cards) >= 21);
    r.hands := jsonb_set(r.hands, array[r.active::text], h);
  elsif p_action = 'stand' then
    r.hands := jsonb_set(r.hands, array[r.active::text], h || '{"done": true}');
  elsif p_action = 'double' then
    if array_length(v_cards, 1) <> 2 or (h ->> 'from_split_aces')::boolean then
      raise exception 'invalid_action' using errcode = 'P0001';
    end if;
    perform public.games_move(r.user_id, -v_bet, 'bet', r.id);
    v_cards := v_cards || s.shoe[1];
    s.shoe := s.shoe[2:];
    h := h || jsonb_build_object('cards', to_jsonb(v_cards), 'bet', v_bet * 2, 'doubled', true, 'done', true);
    r.hands := jsonb_set(r.hands, array[r.active::text], h);
  else -- split
    if jsonb_array_length(r.hands) <> 1 or array_length(v_cards, 1) <> 2
       or public.bj_card_value(v_cards[1]) <> public.bj_card_value(v_cards[2]) then
      raise exception 'invalid_action' using errcode = 'P0001';
    end if;
    perform public.games_move(r.user_id, -v_bet, 'bet', r.id);
    v_aces := v_cards[1] % 13 = 0;
    r.hands := jsonb_build_array(
      public.bj_new_hand(array[v_cards[1], s.shoe[1]], v_bet, v_aces),
      public.bj_new_hand(array[v_cards[2], s.shoe[2]], v_bet, v_aces));
    s.shoe := s.shoe[3:];
  end if;

  -- próxima mão não pronta; nenhuma → banca joga e acerta
  select min(o - 1) into v_next
    from jsonb_array_elements(r.hands) with ordinality e(x, o)
   where not (x ->> 'done')::boolean;
  update public.bj_secrets set shoe = s.shoe where round_id = r.id;
  update public.bj_rounds set hands = r.hands, active = coalesce(v_next, active) where id = r.id
  returning * into r;
  if v_next is null then
    r := public.bj_finish(r.id);
  end if;
  return public.bj_state(r);
end;
$$;

-- reset/encerramento: todas as mãos abertas param, banca joga e acerta
create or replace function public.bj_force_finish(p_round uuid)
returns public.bj_rounds language plpgsql security definer set search_path = public as $$
begin
  update public.bj_rounds
     set hands = (select jsonb_agg(x || '{"done": true}' order by o) from jsonb_array_elements(hands) with ordinality e(x, o))
   where id = p_round and status = 'playing';
  return public.bj_finish(p_round);
end;
$$;

-- gancho da 0027: o reset fecha as mãos abertas antes de zerar
create or replace function public.games_close_open_rounds()
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  for v_id in select id from public.bj_rounds where status = 'playing' loop
    perform public.bj_force_finish(v_id);
  end loop;
end;
$$;

revoke all on function public.bj_force_finish(uuid) from public, anon, authenticated;
revoke all on function public.games_close_open_rounds() from public, anon, authenticated;
revoke all on function public.bj_act(uuid, text) from public, anon;
grant execute on function public.bj_act(uuid, text) to authenticated;
