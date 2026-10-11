-- fellasapp: Fellas Inc., vender a startup reabre a cota de oportunidades do dia (antes ela continuava gasta e a empresa
-- nova esperava até o dia seguinte). Não vira brecha: só dá pra vender batendo o próprio recorde de pontos, e as janelas
-- já pegas continuam em opp_claimed (a mesma oportunidade não paga duas vezes). Idempotente.

create or replace function public.idle_prestige()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  v_me    uuid := auth.uid();
  v_rate  double precision;
  v_total int;
  v_ganho int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform public.idle_fechar_equipe(v_me); -- trava você e a equipe (na ordem de user_id) e fecha a conta deles
  select * into s from public.idle_state where user_id = v_me;
  if not found or not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_rate := public.idle_rate(s);
  v_total := public.idle_prestige_total(v_rate);
  v_ganho := v_total - s.prestige_earned;
  if v_ganho < 1 then
    raise exception 'idle_prestige_low' using errcode = 'P0001';
  end if;
  -- created_at < now(): um contrato criado neste mesmo instante não pode vencer antes de começar (check da tabela)
  update public.idle_contracts set ends_at = now()
   where employer_id = v_me and ends_at > now() and created_at < now();
  if v_ganho = 1 then
    perform public.idle_ganhar(v_me, 'aura_negativa');
  end if;
  if s.hire_total = 0 then
    perform public.idle_ganhar(v_me, 'sigma');
  end if;
  s.best_rate := greatest(s.best_rate, v_rate);
  s.prestige_earned := v_total;
  s.prestige_count := s.prestige_count + 1;
  s.started := false;
  s.valuation := 0;
  s.generators := array_fill(0, array[30]);
  s.upgrades := case when public.idle_arv(v_me, 'manter_gerais', 'max', 0) > 0
                     then array(select u from unnest(s.upgrades) u
                                 where u in (select g.id from public.idle_cat_upg g where g.tipo = 'geral'))
                     else '{}' end;
  s.strategies := '{-1,-1,-1,-1}';
  s.boost_until := null;
  s.half_price := false;
  s.opp_count := 0; -- a cota do dia recomeça com a empresa nova (as janelas já pegas continuam pegas)
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_prestige() from public, anon;
grant execute on function public.idle_prestige() to authenticated;
