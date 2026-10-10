-- fellasapp: Fellas Inc. sem reset. A empresa nunca zera sozinha (o reset é só dos jogos que valem crédito); recomeçar
-- vai ser escolha do jogador (prestígio, entrega futura). Segunda 00:00 de Brasília continua tendo a placa da semana e o
-- selo de unicórnio, mas como foto do placar: o 1º em R$/s leva o selo, ninguém perde nada.
-- Troca, com create or replace, as funções da 0034/0035 que zeravam ou filtravam pela semana. Idempotente.

-- foto da semana que acabou: grava a placa (pódio por R$/s, desempate pelo valuation à meia-noite) e passa o selo.
-- Roda pelo cron (segunda 00:02) ou por idle_lock se alguém jogar antes. Não apaga nada. Não mexe no troféu do cassino.
-- Selo só muda se a placa foi gravada agora: rodar de novo na mesma semana não troca nada.
create or replace function public.idle_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_new    date := public.games_week_start();
  v_old    date := public.games_week_start() - 7;
  v_podium jsonb;
  v_champ  uuid;
  v_gravou date;
begin
  perform pg_advisory_xact_lock(hashtext('fellas-inc-semana')); -- uma foto por vez
  if exists (select 1 from public.idle_weeks where week_start = v_old) then
    return;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'valuation', x.v, 'rate', x.rate, 'era', x.era,
                                               'strategies', to_jsonb(x.strategies)) order by x.rate desc, x.v desc), '[]')
    into v_podium
    from (select s.user_id,
                 (public.idle_settle(s, greatest(s.settled_at, v_new::timestamp at time zone 'America/Sao_Paulo'))).valuation as v,
                 public.idle_rate(s) as rate, public.idle_era(s.generators) as era, s.strategies
            from public.idle_state s
           where s.started and s.week_start < v_new
           order by 3 desc, 2 desc
           limit 3) x;
  if jsonb_array_length(v_podium) = 0 then
    return; -- ninguém jogava antes desta semana: sem placa
  end if;
  v_champ := (v_podium -> 0 ->> 'user_id')::uuid;
  insert into public.idle_weeks (week_start, unicorn_id, podium) values (v_old, v_champ, v_podium)
  on conflict (week_start) do nothing
  returning week_start into v_gravou;
  if v_gravou is not null then
    update public.profiles set badges = array_remove(badges, 'weekly_unicorn') where 'weekly_unicorn' = any (badges);
    if v_champ is not null then
      update public.profiles set badges = array_append(badges, 'weekly_unicorn') where id = v_champ;
    end if;
  end if;
end;
$$;

-- linha da pessoa, travada (uma só, pra sempre; week_start fica sendo a semana em que ela chegou).
-- Semana virou e o cron ainda não tirou a foto: tira antes (a foto não apaga nada, então não precisa de trava longa).
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
  return s;
end;
$$;

-- gravar o estado; as janelas de oportunidade já pegas só valem por 4h (24 janelas de 10 min): guarda só as recentes,
-- senão a lista cresceria pra sempre agora que nada zera
create or replace function public.idle_save(s public.idle_state)
returns void language sql volatile set search_path = public as $$
  update public.idle_state
     set started = s.started, valuation = s.valuation, generators = s.generators, upgrades = s.upgrades,
         strategies = s.strategies, boost_until = s.boost_until, half_price = s.half_price,
         opp_claimed = array(select w from unnest(s.opp_claimed) w
                              where w >= floor(extract(epoch from now()) / 600)::bigint - 30),
         opp_day = s.opp_day, opp_count = s.opp_count,
         settled_at = s.settled_at, updated_at = now()
   where user_id = s.user_id
$$;

-- placar: todo mundo que abriu a empresa (sem filtro de semana), por R$/s (como na 0035)
create or replace function public.idle_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'valuation', x.v, 'rate', x.rate, 'era', x.era,
                                                 'strategies', to_jsonb(x.strategies)) order by x.rate desc, x.v desc), '[]')
      from (select s.user_id, (public.idle_settle(s)).valuation as v, public.idle_rate(s) as rate,
                   public.idle_era(s.generators) as era, s.strategies
              from public.idle_state s
             where s.started) x);
end;
$$;

revoke all on function public.idle_weekly_reset() from public, anon, authenticated;
revoke all on function public.idle_lock(uuid) from public, anon, authenticated;
revoke all on function public.idle_save(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_board() from public, anon;
grant execute on function public.idle_board() to authenticated;
