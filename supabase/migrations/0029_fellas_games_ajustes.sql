-- fellasapp: ajustes dos Fellas Games depois da revisão (08/10). Idempotente. Depende da 0027 e da 0028.
-- 1. Aposta só em múltiplos de 10 (o 3:2 do blackjack sempre fecha em crédito inteiro).
-- 2. Mão fechada apaga o próprio sapato (bj_secrets) em vez de guardar ~310 cartas para sempre; limpa as antigas.
-- 3. Funções que só fazem conta ficam fechadas como as outras: só as funções do banco as usam.
-- Se a 0027 ou a 0028 forem coladas de novo no SQL editor, rode esta depois delas.

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
  if p_bet is null or p_bet < 10 or p_bet > 500 or p_bet % 10 <> 0 then
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
  delete from public.bj_secrets where round_id = r.id; -- mão fechada não precisa mais do sapato
  update public.bj_rounds
     set status = 'done', hands = v_hands, dealer = r.dealer, payout = v_pay, finished_at = now()
   where id = r.id
  returning * into r;
  return r;
end;
$$;

delete from public.bj_secrets s using public.bj_rounds r where r.id = s.round_id and r.status = 'done';

revoke all on function public.bj_card_value(smallint) from public, anon, authenticated;
revoke all on function public.bj_is_soft(smallint[]) from public, anon, authenticated;
revoke all on function public.bj_hand_total(smallint[]) from public, anon, authenticated;
revoke all on function public.bj_cards(jsonb) from public, anon, authenticated;
revoke all on function public.bj_new_hand(smallint[], int, boolean) from public, anon, authenticated;
revoke all on function public.games_today() from public, anon, authenticated;
revoke all on function public.games_week_start(timestamptz) from public, anon, authenticated;
