-- Fellas Inc., copão: sem limite de provas (era 6 por 24 h; o erro idle_cup_provas não é mais levantado). idle_cup_provar perde a checagem do limite e o idle_cup_json
-- devolve provas_max = null (sem limite); o resto é igual à 0069.

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
  v_av := public.idle_cup_avaliar(p_base, p_mistura, p_extra, p_tamanho, p_forca, p_preco, public.games_week_start());
  insert into public.idle_cup_provas (user_id, base, mistura, extra, tamanho, forca, preco, nota, sabor, cb, moda, aguenta, rotulos,
                                      criado_em, pronta_em)
  values (s.user_id, p_base, p_mistura, p_extra, p_tamanho, p_forca, p_preco, v_av[8], v_av[4], v_av[5], v_av[6], v_av[7],
          array[v_av[1], v_av[2], v_av[3]], now(), now() + interval '5 minutes');
  return public.idle_place_responder(s, 4);
end;
$$;

create or replace function public.idle_cup_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'moda', jsonb_build_object('base', public.idle_cup_moda_base(public.games_week_start()),
                               'mistura', public.idle_cup_moda_mistura(public.games_week_start())),
    'dj', (select e.dj from public.idle_cup_estado e where e.user_id = s.user_id),
    'vagas', public.idle_cup_vagas(st.nivel),
    'cardapio', coalesce((select jsonb_agg(public.idle_cup_copao_json(c, c.revelado)
                                           || jsonb_build_object('vendido_hoje', k.vendidos, 'fichas_hoje', k.fichas)
                                           order by c.entrou_em, c.id)
                            from public.idle_cup_copoes c
                            left join public.idle_cup_noite_copoes k
                              on k.user_id = c.user_id and k.copao = c.id and k.inicio = public.idle_cup_noite_de(now())
                           where c.user_id = s.user_id and c.saiu_em is null), '[]'::jsonb),
    'hoje', (select jsonb_build_object('inicio', h.ini, 'fim', h.ini + interval '8 hours', 'sexta', public.idle_cup_eh_sexta(h.ini),
                                       'aberta', coalesce(n.aberta, now() <= h.ini), 'dj', n.dj,
                                       'vendido_ate_agora', coalesce(n.vendas, 0), 'fichas_ate_agora', coalesce(n.fichas, 0))
               from (select public.idle_cup_noite_de(now()) as ini) h
               left join public.idle_cup_noites n on n.user_id = s.user_id and n.inicio = h.ini),
    'ultima_noite', (select jsonb_build_object(
                         'inicio', n.inicio, 'fim', n.inicio + interval '8 hours', 'sexta', n.sexta, 'dj', n.dj,
                         'vendas', n.vendas, 'fichas', n.fichas, 'pt', n.pt, 'galera_delta', n.galera_delta,
                         'chat_seed', public.idle_cup_noite_idx(n.inicio),
                         -- os copões da noite que saíram antes da nota (não aparecem, mas as vendas da noite contam as deles)
                         'saiu_antes', (select count(*)::int
                                          from public.idle_cup_noite_copoes x join public.idle_cup_copoes c on c.id = x.copao
                                         where x.user_id = n.user_id and x.inicio = n.inicio and not c.revelado),
                         'copoes', coalesce((select jsonb_agg(jsonb_build_object(
                                                 'id', c.id, 'nome', c.nome, 'base', c.base, 'mistura', c.mistura, 'extra', c.extra,
                                                 'tamanho', c.tamanho, 'forca', c.forca, 'preco', c.preco, 'nota', c.nota,
                                                 'vendidos', x.vendidos, 'fichas', x.fichas, 'pt', x.pt)
                                               order by c.entrou_em, c.id)
                                              from public.idle_cup_noite_copoes x join public.idle_cup_copoes c on c.id = x.copao
                                             where x.user_id = n.user_id and x.inicio = n.inicio and c.revelado), '[]'::jsonb))
                       from public.idle_cup_noites n
                      where n.user_id = s.user_id and n.aberta and n.fechada
                      order by n.inicio desc
                      limit 1),
    'noite_fechada', (select jsonb_build_object('inicio', n.inicio, 'fim', n.inicio + interval '8 hours')
                        from public.idle_cup_noites n
                       where n.user_id = s.user_id and not n.aberta and n.fechada
                         and n.inicio > coalesce((select max(m.inicio) from public.idle_cup_noites m
                                                   where m.user_id = s.user_id and m.aberta and m.fechada), '-infinity')
                       order by n.inicio desc
                       limit 1),
    'historico', coalesce((select jsonb_agg(jsonb_build_object(
                               'id', h.id, 'nome', h.nome, 'base', h.base, 'mistura', h.mistura, 'extra', h.extra, 'tamanho', h.tamanho,
                               'forca', h.forca, 'preco', h.preco, 'nota', h.nota, 'sabor', h.sabor, 'cb', h.cb, 'moda', h.moda,
                               'aguenta', h.aguenta, 'primeira_noite', h.primeira_noite, 'saiu_em', h.saiu_em, 'noites', h.noites,
                               'vendido', h.vendido, 'fichas', h.fichas)
                             order by h.primeira_noite desc, h.id desc)
                             from (select * from public.idle_cup_copoes c
                                    where c.user_id = s.user_id and c.revelado
                                    order by c.primeira_noite desc, c.id desc limit 10) h), '[]'::jsonb),
    'provas', coalesce((select jsonb_agg(jsonb_build_object(
                            'id', p.id, 'base', p.base, 'mistura', p.mistura, 'extra', p.extra, 'tamanho', p.tamanho,
                            'forca', p.forca, 'preco', p.preco, 'criado_em', p.criado_em, 'pronta_em', p.pronta_em,
                            'pronta', now() >= p.pronta_em,
                            'nota', case when now() >= p.pronta_em then p.nota end,
                            'sabor', case when now() >= p.pronta_em then p.sabor end,
                            'cb', case when now() >= p.pronta_em then p.cb end,
                            'moda', case when now() >= p.pronta_em then p.moda end,
                            'aguenta', case when now() >= p.pronta_em then p.aguenta end,
                            'rotulos', case when now() >= p.pronta_em then to_jsonb(p.rotulos) end)
                          order by p.criado_em desc, p.id desc)
                          from (select * from public.idle_cup_provas x
                                 where x.user_id = s.user_id
                                 order by x.criado_em desc, x.id desc limit 10) p), '[]'::jsonb),
    'provas_hoje', (select count(*)::int from public.idle_cup_provas x
                     where x.user_id = s.user_id and x.criado_em > now() - interval '24 hours'),
    'provas_max', null)
  from public.idle_place_state st
  where st.user_id = s.user_id and st.lugar = 4
$$;

revoke all on function public.idle_cup_provar(int, int, int, int, int, int) from public, anon;
grant execute on function public.idle_cup_provar(int, int, int, int, int, int) to authenticated;
revoke all on function public.idle_cup_json(public.idle_state) from public, anon, authenticated;
