-- Fellas Inc.: as melhorias da Bolsa (Corretor e Escritório) passam a custar o preço que a tela mostra: segundos × a
-- produção sem os convidados (idle_rate_bolsa, a mesma das ações). Antes cobrava com os convidados e o botão ficava
-- aceso com F$ que não pagava ("Valuation não cobre essa compra").

create or replace function public.idle_bolsa_melhorar_em(p_user uuid, p_tipo text, p_nivel int, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  n       public.idle_bolsa_nivel;
  v_atual int;
  v_custo double precision;
begin
  if p_tipo not in ('corretor', 'escritorio') then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_lock(p_user);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if coalesce(s.generators[19], 0) < 1 then
    raise exception 'idle_bolsa_fechada' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  insert into public.idle_bolsa_nivel (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into n from public.idle_bolsa_nivel where user_id = p_user for update;
  v_atual := case p_tipo when 'corretor' then n.corretor else n.escritorio end;
  if p_nivel is distinct from v_atual + 1 or p_nivel > 5 then
    raise exception 'idle_bolsa_nivel' using errcode = 'P0001';
  end if;
  v_custo := public.idle_bolsa_custo(p_tipo, p_nivel) * public.idle_rate_bolsa(s); -- sem os convidados (ver idle_rate_bolsa)
  if v_custo <= 0 or v_custo > s.valuation then
    raise exception 'idle_cant_afford' using errcode = 'P0001';
  end if;
  s.valuation := greatest(s.valuation - v_custo, 0);
  if p_tipo = 'corretor' then
    update public.idle_bolsa_nivel set corretor = p_nivel where user_id = p_user;
  else
    update public.idle_bolsa_nivel set escritorio = p_nivel where user_id = p_user;
  end if;
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('bolsa', public.idle_bolsa_estado(p_user, p_agora));
end;
$$;
revoke all on function public.idle_bolsa_melhorar_em(uuid, text, int, bigint) from public, anon, authenticated;
