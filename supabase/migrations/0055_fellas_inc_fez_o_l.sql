-- fellasapp: Fellas Inc., a conquista escondida "Fez o L" (107) ficou mais difícil: F$ 13 bi na mão e 130 estagiários
-- (gerador 7) ao mesmo tempo (era 50 estagiários). Quem tem a conquista sem cumprir a regra nova perde. O texto vem da
-- 0054 (catálogo). Idempotente.

-- conquistas: o tipo fez_o_l (igual à 0052 fora isso)
create or replace function public.idle_check_conquistas(p_user uuid)
returns int[] language plpgsql volatile set search_path = public as $$
declare
  s       public.idle_state;
  v_rate  double precision;
  v_era   int;
  v_novas int[];
  n       int;
begin
  select * into s from public.idle_state where user_id = p_user;
  if not found then
    return '{}';
  end if;
  v_rate := public.idle_rate(s);
  v_era := public.idle_era(s.generators);
  n := cardinality(s.opp_recent);
  with novas as (
    insert into public.idle_conquistas (user_id, conquista_id)
    select p_user, c.id
      from public.idle_cat_conquista c
     where case
             when exists (select 1 from public.idle_conquistas x where x.user_id = p_user and x.conquista_id = c.id) then false
             when c.tipo = 'gerador' then s.generators[c.alvo] >= c.valor
             when c.tipo = 'fez_o_l' then s.generators[c.alvo] >= c.valor and s.valuation >= 13e9
             when c.tipo = 'gerador_exato' then c.valor::int = any (s.generators)
             when c.tipo = 'taxa' then v_rate >= c.valor
             when c.tipo = 'era' then v_era >= c.valor
             when c.tipo = 'melhoria' then c.alvo = any (s.upgrades)
             when c.tipo = 'melhorias' then s.upg_total >= c.valor
             when c.tipo = 'oportunidades' then s.opp_total >= c.valor
             when c.tipo = 'vendas' then s.prestige_count >= c.valor
             when c.tipo = 'contratei' then s.hire_total >= c.valor
             when c.tipo = 'contratado' then s.hired_total >= c.valor
             -- as 3 opções de alguma era (era com opção desligada não conta)
             when c.tipo = 'estrategia_era' then exists (
               select 1 from public.idle_cat_est e group by e.era
               having count(*) = count(*) filter (where e.era * 10 + e.opcao = any (s.est_usadas)))
             -- todas as ligadas
             when c.tipo = 'estrategia_todas' then not exists (
               select 1 from public.idle_cat_est e where e.ativa and not (e.era * 10 + e.opcao = any (s.est_usadas)))
             -- 3 oportunidades em menos de c.valor segundos
             when c.tipo = 'brainrot' then n >= 3 and s.opp_recent[n] - s.opp_recent[n - 2] < make_interval(secs => c.valor)
             -- 1º no placar (F$/s), com mais alguém com empresa aberta e ninguém com mais
             when c.tipo = 'aura' then s.started and v_rate > 0
               and exists (select 1 from public.idle_state o where o.started and o.user_id <> p_user)
               and not exists (select 1 from public.idle_state o
                                where o.started and o.user_id <> p_user and public.idle_rate(o) >= v_rate)
             -- horta (0048)
             when c.tipo = 'horta_plantou' then s.horta_plantou >= c.valor
             when c.tipo = 'horta_colheu' then s.horta_colheu >= c.valor
             when c.tipo = 'horta_morreu' then s.horta_morreu >= c.valor
             when c.tipo = 'horta_morango' then s.horta_morangos >= 1
             when c.tipo = 'horta_colecao' then 2 + (select count(*) from public.idle_horta_descobertas d
                                                       where d.user_id = p_user and d.especie not in (1, 2)) >= c.valor
             -- convidados (0051)
             when c.tipo = 'conv_vistos' then cardinality(s.conv_vistos) >= c.valor
             when c.tipo = 'conv_fgc' then s.conv_fgc
             when c.tipo = 'conv_kojima' then public.idle_conv_peso(s, 5) > 0 and public.idle_conv_desde(s, 5) <= now() - interval '24 hours'
             when c.tipo = 'conv_derrubada' then public.idle_conv_derrubadas(s, now()) >= c.valor
             when c.tipo = 'conv_toby' then public.idle_conv_peso(s, 10) > 0 and public.idle_conv_desde(s, 10) <= now() - interval '20 hours'
             else false
           end
    on conflict do nothing
    returning conquista_id
  )
  select coalesce(array_agg(conquista_id order by conquista_id), '{}') into v_novas from novas;
  return v_novas;
end;
$$;

-- quem tem o Fez o L sem os F$ 13 bi e os 130 estagiários perde
delete from public.idle_conquistas c
 using public.idle_state s
 where c.conquista_id = 107 and s.user_id = c.user_id
   and not (coalesce(s.generators[7], 0) >= 130 and s.valuation >= 13e9);
delete from public.idle_conquistas c
 where c.conquista_id = 107 and not exists (select 1 from public.idle_state s where s.user_id = c.user_id);
