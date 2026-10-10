-- fellasapp: Fellas Inc., placar por R$/s. idle_board devolve também `rate` (produção por segundo sem o boost ×5 das
-- oportunidades) e ordena por ela; o empate fica com o maior valuation. O unicórnio da semana continua sendo o maior
-- valuation (idle_weekly_reset não muda). Idempotente.

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
             where s.week_start = public.games_week_start() and s.started) x);
end;
$$;

revoke all on function public.idle_board() from public, anon;
grant execute on function public.idle_board() to authenticated;
