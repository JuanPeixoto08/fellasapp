-- Fellas Inc.: "rendem o dobro" conta como 2 pegas e a era 6 no placar (13/10, pedido do Juan).
-- Com o Viralizar (era 3) ou a Xepa da feira, pegar um "Produção ×5" põe dois ×5 de 1 minuto de uma vez (×25) e pegar
-- uma "Próxima compra pela metade" guarda duas (com os dois, 4). Antes o dobro só esticava o ×5 pra 2 minutos e não
-- mudava nada na metade. O placar diz quem tem o gerador 30 (orbita): a página mostra "Era 6 · Em órbita", a cena 6;
-- no jogo continua a era 5.

-- pegar oportunidade (a da 0062)
create or replace function public.idle_claim_opportunity(p_window bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_mult double precision;
  v_rate double precision;
  v_n    int;
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
  v_n := greatest(1, round(v_mult))::int; -- "rendem o dobro": o ×5 e a metade contam como v_n pegas
  case public.idle_opp_kind(s.user_id, p_window)
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b));
    -- cada ×5 conta sozinho e dura 1 minuto; com "rendem o dobro" entram v_n de uma vez (2: ×25)
    when 1 then s.boost_ate := array(select b from unnest(s.boost_ate) b where b > now())
                               || array_fill(now() + interval '1 minute', array[v_n]);
    else s.meias := s.meias + v_n; -- cada uma guardada vale uma compra; com o dobro, guarda duas
  end case;
  s.opp_claimed := array_append(s.opp_claimed, p_window);
  s.opp_count := s.opp_count + 1;
  perform public.idle_ganhar(s.user_id, 'opp_dia', s.opp_count); -- "Receba!": 15 num dia
  s.opp_total := s.opp_total + 1;
  s.opp_recent := array_append(s.opp_recent, now());
  s.opp_recent := s.opp_recent[greatest(1, cardinality(s.opp_recent) - 2):];
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_claim_opportunity(bigint) from public, anon;
grant execute on function public.idle_claim_opportunity(bigint) to authenticated;

-- o placar (o da 0041) com quem está em órbita
create or replace function public.idle_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mais uuid;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  v_mais := public.idle_most_hired(public.games_week_start());
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', x.user_id, 'valuation', x.v, 'rate', x.rate, 'era', x.era, 'strategies', to_jsonb(x.strategies),
             'avatar', public.idle_avatar_json(x.user_id), 'hired_count', x.n, 'by_me', x.by_me,
             'most_hired', coalesce(x.user_id = v_mais, false), 'pontos', x.pontos, 'conquistas', x.nc,
             'orbita', x.orbita)
             order by x.rate desc, x.v desc, x.user_id), '[]'::jsonb)
      from (select s.user_id, (public.idle_settle(s)).valuation as v, public.idle_rate(s) as rate,
                   public.idle_era(s.generators) as era, coalesce(s.generators[30], 0) > 0 as orbita,
                   s.strategies, s.prestige_earned as pontos,
                   (select count(*) from public.idle_conquistas c where c.user_id = s.user_id)::int as nc,
                   (select count(*) from public.idle_contracts c
                     where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now())::int as n,
                   exists (select 1 from public.idle_contracts c
                            where c.employer_id = auth.uid() and c.employee_id = s.user_id
                              and c.created_at <= now() and c.ends_at > now()) as by_me
              from public.idle_state s
             where s.started) x);
end;
$$;
revoke all on function public.idle_board() from public, anon;
grant execute on function public.idle_board() to authenticated;
