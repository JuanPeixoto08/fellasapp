-- fellasapp: Fellas Inc., conta do banco mais rápida (15/10, depois das eras 6–7). idle_gen_rendas devolve uma linha por
-- gerador (42) e o Postgres embutia os CTEs (estratégias, multiplicadores gerais e legado) em cada linha: a parte geral
-- (social, horta, convidados, lugares…) rodava 42 vezes por chamada. Medido em produção: ~65 ms → ~8 ms por conta. Com
-- "materialized" cada CTE roda uma vez por chamada; o resultado é o mesmo (conferido em produção, diferença 0). Idempotente.

-- quanto cada gerador rende em t (a da 0078), com os CTEs materializados
create or replace function public.idle_gen_rendas(s public.idle_state, t timestamptz)
returns table (gen int, renda double precision) language sql stable set search_path = public as $$
  with est as materialized (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), glob as materialized (
    select coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
         * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
         * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
              * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
         * public.idle_social_mult(s, t)
         * public.idle_bonus_mult(s)
         * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
         * public.idle_conv_prod(s, t)
         * public.idle_place_mult(s) as g
  ), leg as materialized (
    select u.alvo_era as era,
           1 + sum(u.por_unidade * (select coalesce(sum(coalesce(s.generators[g.id], 0)), 0)
                                      from public.idle_cat_gen g where g.era = u.fonte_era)) as m
      from public.idle_cat_upg u
     where u.tipo = 'legado' and u.id = any (s.upgrades)
     group by u.alvo_era
  )
  select c.id,
         c.renda * coalesce(s.generators[c.id], 0)
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select leg.m from leg where leg.era = c.era), 1)
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1)
         * case when c.id = 11 then public.idle_conv_food(s, t) else 1 end
         * glob.g
    from public.idle_cat_gen c cross join glob
$$;
revoke all on function public.idle_gen_rendas(public.idle_state, timestamptz) from public, anon, authenticated;
