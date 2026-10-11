-- fellasapp: Fellas Inc., vender a startup não encerra mais os contratos que você fez (pedido do Juan, 11/10: o
-- contrato foi pago por tempo). Eles seguem até vencer, como os que te fizeram. E devolve os contratos cortados pelas
-- vendas de antes desta migração: voltam ao fim original (início + 7 dias), com a conta dos envolvidos fechada antes
-- (o tempo cortado não é pago de volta). Idempotente.

-- vender a startup (a da 0045) sem encerrar os contratos
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
  -- os contratos (os que você fez e os que te fizeram) seguem até vencer: foram pagos por tempo (0046)
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
  s.promo_ate := null;
  s.viral_ate := '{}';
  s.opp_count := 0; -- a cota do dia recomeça com a empresa nova (as janelas já pegas continuam pegas)
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- devolve os contratos cortados por vendas (vencidos antes dos 7 dias, com o fim original ainda no futuro), um por
-- dupla (o mais recente) e só se a dupla não tem contrato ativo; fecha antes a conta de quem está neles. Devolve
-- quantos voltaram. Só a migração chama.
create or replace function public.idle_devolver_contratos_cortados()
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  v_ids bigint[];
  s     public.idle_state;
begin
  select coalesce(array_agg(x.id), '{}') into v_ids
    from (select distinct on (c.employer_id, c.employee_id) c.id, c.employer_id, c.employee_id
            from public.idle_contracts c
           where c.ends_at <= now()
             and c.ends_at < c.created_at + interval '7 days' - interval '1 minute'
             and c.created_at + interval '7 days' > now()
           order by c.employer_id, c.employee_id, c.created_at desc) x
   where not exists (select 1 from public.idle_contracts a
                      where a.employer_id = x.employer_id and a.employee_id = x.employee_id and a.ends_at > now());
  if cardinality(v_ids) = 0 then
    return 0;
  end if;
  for s in
    select st.* from public.idle_state st
     where st.user_id in (select employer_id from public.idle_contracts where id = any (v_ids)
                          union select employee_id from public.idle_contracts where id = any (v_ids))
     order by st.user_id
       for update
  loop
    perform public.idle_save(public.idle_settle(s));
  end loop;
  update public.idle_contracts set ends_at = created_at + interval '7 days' where id = any (v_ids);
  return cardinality(v_ids);
end;
$$;
revoke all on function public.idle_devolver_contratos_cortados() from public, anon, authenticated;

select public.idle_devolver_contratos_cortados();
