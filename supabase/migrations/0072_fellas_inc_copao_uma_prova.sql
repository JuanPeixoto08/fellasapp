-- Fellas Inc., copão: uma prova por vez. Com uma prova ainda provando (pronta_em no futuro), Provar dá idle_cup_provas e não grava
-- nada; a nota continua saindo em 5 min e não tem limite no dia. O resto do idle_cup_provar é igual à 0070.

create or replace function public.idle_cup_provar(p_base int, p_mistura int, p_extra int, p_tamanho int, p_forca int, p_preco int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s    public.idle_state;
  st   public.idle_place_state;
  v_av int[];
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  select * into st from public.idle_place_state where user_id = s.user_id and lugar = 4 for update;
  if not found then
    raise exception 'idle_lugar_fechado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.idle_cup_cat_base where id = p_base)
     or not exists (select 1 from public.idle_cup_cat_mistura where id = p_mistura)
     or not exists (select 1 from public.idle_cup_cat_extra where id = p_extra)
     or not exists (select 1 from public.idle_cup_cat_tamanho where id = p_tamanho) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if not (public.idle_cup_liberado('base', p_base, st.nivel) and public.idle_cup_liberado('mistura', p_mistura, st.nivel)
          and public.idle_cup_liberado('extra', p_extra, st.nivel) and public.idle_cup_liberado('tamanho', p_tamanho, st.nivel)) then
    raise exception 'idle_cup_trancado' using errcode = 'P0001';
  end if;
  if p_forca is null or p_forca not between 1 and 10 then
    raise exception 'idle_cup_forca' using errcode = 'P0001';
  end if;
  if p_preco is null or not public.idle_cup_preco_valido(p_base, p_tamanho, p_forca, p_preco) then
    raise exception 'idle_cup_preco' using errcode = 'P0001';
  end if;
  -- uma por vez: a galera só prova a próxima depois que sai a nota da que está provando
  if exists (select 1 from public.idle_cup_provas where user_id = s.user_id and pronta_em > now()) then
    raise exception 'idle_cup_provas' using errcode = 'P0001';
  end if;
  v_av := public.idle_cup_avaliar(p_base, p_mistura, p_extra, p_tamanho, p_forca, p_preco, public.games_week_start());
  insert into public.idle_cup_provas (user_id, base, mistura, extra, tamanho, forca, preco, nota, sabor, cb, moda, aguenta, rotulos,
                                      criado_em, pronta_em)
  values (s.user_id, p_base, p_mistura, p_extra, p_tamanho, p_forca, p_preco, v_av[8], v_av[4], v_av[5], v_av[6], v_av[7],
          array[v_av[1], v_av[2], v_av[3]], now(), now() + interval '5 minutes');
  return public.idle_place_responder(s, 4);
end;
$$;
revoke all on function public.idle_cup_provar(int, int, int, int, int, int) from public, anon;
grant execute on function public.idle_cup_provar(int, int, int, int, int, int) to authenticated;
