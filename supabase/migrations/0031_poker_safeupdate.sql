-- fellasapp: Poker — DELETE com WHERE. Idempotente. Depende da 0030.
-- O Supabase liga o pg_safeupdate nas chamadas que vêm do app (PostgREST): DELETE/UPDATE sem WHERE dá erro, até dentro
-- de função. Na 0030 o começo da mão apagava as cartas da mão anterior com `delete from poker_secrets;` — então o
-- segundo fella a sentar (que começa a mão) recebia erro e não sentava. O reset tinha dois iguais (o cron não passa
-- pelo PostgREST, mas fica igual). Só muda o `where true`; o resto das funções é o da 0030.

-- começa uma mão se der: sem mão aberta, mesa aberta, pausa vencida e 2+ prontos
create or replace function public.poker_maybe_start()
returns void language plpgsql security definer set search_path = public as $$
declare
  t       public.poker_tables;
  v_ready smallint[];
  v_wait  smallint[];
  v_bb    smallint;
  v_sb    smallint;
  v_btn   smallint;
  v_cur   smallint;
  v_deck  smallint[];
  v_holes jsonb := '{}';
  v_pl    jsonb := '{}';
  v_hand  uuid;
  i       int;
begin
  select * into t from public.poker_tables where id = 1;
  if exists (select 1 from public.poker_hands where status = 'betting')
     or public.poker_closed(now())
     or (t.next_hand_at is not null and t.next_hand_at > now()) then
    return;
  end if;

  select coalesce(array_agg(seat order by seat) filter (where not wait_bb), '{}'),
         coalesce(array_agg(seat order by seat) filter (where wait_bb), '{}')
    into v_ready, v_wait
    from public.poker_seats
   where status = 'playing' and stack > 0 and not leaving;
  -- mesa parada: quem espera a cega grande entra já
  if cardinality(v_ready) < 2 then
    v_ready := array(select s from unnest(v_ready || v_wait) s order by s);
    v_wait := '{}';
  end if;
  if cardinality(v_ready) < 2 then
    return;
  end if;
  -- a cega grande anda para o próximo depois da última; quem espera e cai nela entra pagando
  v_bb := public.poker_next(t.last_bb_seat, array(select s from unnest(v_ready || v_wait) s order by s));
  if v_bb = any (v_wait) then
    v_ready := array(select s from unnest(v_ready || v_bb) s order by s);
  end if;
  if cardinality(v_ready) = 2 then
    v_sb := public.poker_next(v_bb, v_ready); -- heads-up: o botão é a cega pequena
    v_btn := v_sb;
  else
    v_sb := public.poker_prev(v_bb, v_ready);
    v_btn := public.poker_prev(v_sb, v_ready);
  end if;

  -- 2 cartas para cada um, a partir do primeiro à esquerda do botão
  v_deck := public.poker_shuffle();
  v_cur := v_btn;
  for i in 1 .. cardinality(v_ready) loop
    v_cur := public.poker_next(v_cur, v_ready);
    v_holes := v_holes || jsonb_build_object(v_cur::text, jsonb_build_array(v_deck[2 * i - 1], v_deck[2 * i]));
    v_pl := v_pl || jsonb_build_object(v_cur::text, jsonb_build_object(
      'user_id', (select user_id from public.poker_seats where seat = v_cur),
      'bet', 0, 'total', 0, 'folded', false, 'all_in', false, 'acted', false, 'capped', false,
      'last', null, 'timed_out', false));
  end loop;

  delete from public.poker_secrets where true; -- cartas da mão anterior: o "Mostrar" acabou
  insert into public.poker_hands (hand_no, button, sb_seat, bb_seat, players, current_bet, last_raise, to_act)
  values (t.hand_no + 1, v_btn, v_sb, v_bb, v_pl, 0, t.big_blind, v_bb)
  returning id into v_hand;
  insert into public.poker_secrets (hand_id, deck, holes) values (v_hand, v_deck, v_holes);
  update public.poker_seats set wait_bb = false where seat = any (v_ready);
  update public.poker_tables set hand_no = hand_no + 1, last_bb_seat = v_bb, next_hand_at = null where id = 1;
  update public.game_wallets set last_played_at = now()
   where user_id in (select user_id from public.poker_seats where seat = any (v_ready));

  -- cegas (quem não tem o bastante fica all-in com o que tem)
  perform public.poker_put(v_hand, v_sb, least(t.small_blind, (select stack from public.poker_seats where seat = v_sb)));
  perform public.poker_put(v_hand, v_bb, least(t.big_blind, (select stack from public.poker_seats where seat = v_bb)));
  perform public.poker_patch(v_hand, v_sb, '{"last": "sb"}');
  perform public.poker_patch(v_hand, v_bb, '{"last": "bb"}');
  update public.poker_hands set current_bet = t.big_blind where id = v_hand;
  -- a vez: o primeiro depois da cega grande (advance acha e joga sozinho por ausente/saindo)
  perform public.poker_advance(v_hand);
end;
$$;

-- gancho do reset: anula a mão de poker aberta, levanta todo mundo sem anti-rathole, fecha o Blackjack aberto
create or replace function public.games_close_open_rounds()
returns void language plpgsql security definer set search_path = public as $$
declare
  h      public.poker_hands;
  e      record;
  v_id   uuid;
  v_seat smallint;
  v_user uuid;
  v_back int;
begin
  select * into h from public.poker_hands where status = 'betting';
  if h.id is not null then
    for e in select key, value from jsonb_each(h.players) loop
      v_user := (e.value ->> 'user_id')::uuid;
      v_back := (e.value ->> 'total')::int;
      continue when v_back = 0;
      update public.poker_seats set stack = stack + v_back where seat = e.key::smallint and user_id = v_user;
      if not found then
        -- já tinha levantado (ausente de 10 min que tinha corrido): volta direto para a carteira
        perform public.games_ensure_wallet(v_user);
        perform public.games_move(v_user, v_back, 'cashout');
      end if;
    end loop;
    update public.poker_hands set status = 'void', to_act = null, deadline = null, ended_at = now() where id = h.id;
  end if;
  delete from public.poker_secrets where true;
  for v_seat in select seat from public.poker_seats loop
    perform public.poker_stand(v_seat, false);
  end loop;
  delete from public.poker_leaves where true;
  update public.poker_tables set next_hand_at = null where id = 1;
  perform public.poker_snapshot();

  for v_id in select id from public.bj_rounds where status = 'playing' loop
    perform public.bj_force_finish(v_id);
  end loop;
end;
$$;
