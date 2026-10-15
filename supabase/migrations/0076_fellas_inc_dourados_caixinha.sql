-- fellasapp: Fellas Inc., dourados novos e oportunidades novas na Caixinha (15/10, entrega 5 do plano das eras 6–12).
-- Quatro dourados novos (Trend do TikTok, Bombou no LinkedIn, Pix errado, Tigrinho), o Combo e os dourados garantidos;
-- cinco tipos novos na Caixinha (Chamar um dourado, Cupom de primeira compra, Adubo de farmácia, Cashback, Informação
-- privilegiada) e o Espiar da Bolsa. A sorte é a de dourados.ts e oportunidades.ts (semente id + segundo/janela); o banco
-- confere e paga. Spec: docs/superpowers/specs/2026-10-15-fellas-inc-dourados-caixinha-design.md. Idempotente.

-- ===== parte A: a sorte =====
-- a 3ª mistura do segundo s (igual a dourados.ts h3): o tipo e os sorteios dos dourados novos saem dela
create or replace function public.idle_dourado_h3(u uuid, s bigint)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  p constant numeric := 2147483647;
  k constant numeric := 1013904223;
  h numeric;
begin
  h := mod(s::numeric * s * 48271 + s::numeric * 16807 + public.idle_opp_seed(u)::numeric * 69621 + 12345, p);
  h := mod(h * h + k, p);
  return mod(h * h + k, p);
end;
$$;
revoke all on function public.idle_dourado_h3(uuid, bigint) from public, anon, authenticated;

-- o tipo do segundo s (o da 0051) com a roda de 8 (igual a tipoDourado): dupla 0–1, Viralizou 2–14, Promoção 15–32,
-- Investidor 33–57, Trend 58–69, LinkedIn 70–81, Pix 82–91, Tigrinho 92–99
create or replace function public.idle_dourado_tipo(u uuid, s bigint)
returns int language sql immutable set search_path = public as $$
  select case when x.r < 2 then 3 when x.r < 15 then 2 when x.r < 33 then 1 when x.r < 58 then 0
              when x.r < 70 then 4 when x.r < 82 then 5 when x.r < 92 then 6 else 7 end
    from (select mod(public.idle_dourado_h3(u, s), 100)::int as r) x
$$;
revoke all on function public.idle_dourado_tipo(uuid, bigint) from public, anon, authenticated;

-- um sorteio de 0 a n − 1 do segundo s com o "sal" de cada uso (igual a sorteioDourado): 4242 Tigrinho, 5151 LinkedIn,
-- 6161 Pix (7373, a frase do LinkedIn, é só da página)
create or replace function public.idle_dourado_sorteio(u uuid, s bigint, sal int, n int)
returns int language sql immutable set search_path = public as $$
  select mod(mod((x.h + sal) * (x.h + sal) + 1013904223, 2147483647), n)::int from (select public.idle_dourado_h3(u, s) as h) x
$$;
revoke all on function public.idle_dourado_sorteio(uuid, bigint, int, int) from public, anon, authenticated;

-- o tipo de um dourado garantido (Pix devolvido, Chamar): a roda sem Pix e sem Tigrinho (sobrando 6 ou 7: Investidor)
create or replace function public.idle_dourado_tipo_garantido(u uuid, s bigint)
returns int language sql immutable set search_path = public as $$
  select case when x.t >= 6 then 0 else x.t end from (select public.idle_dourado_tipo(u, s) as t) x
$$;
revoke all on function public.idle_dourado_tipo_garantido(uuid, bigint) from public, anon, authenticated;

-- Pix devolvido no segundo s: o segundo do garantido em dobro, de 20 a 120 s depois (igual a segundoPix)
create or replace function public.idle_dourado_pix_seg(u uuid, s bigint)
returns bigint language sql immutable set search_path = public as $$
  select s + 20 + public.idle_dourado_sorteio(u, s, 6161, 101)
$$;
revoke all on function public.idle_dourado_pix_seg(uuid, bigint) from public, anon, authenticated;

-- Tigrinho depois das 3 grátis do dia: paga 3 em cada 10 (igual a tigrePaga)
create or replace function public.idle_dourado_tigre_paga(u uuid, s bigint)
returns boolean language sql immutable set search_path = public as $$
  select public.idle_dourado_sorteio(u, s, 4242, 100) < 30
$$;
revoke all on function public.idle_dourado_tigre_paga(uuid, bigint) from public, anon, authenticated;

-- a faixa do MC V.V no segundo seg (a da 0051): nunca Tigrinho (o 7 vira Investidor)
create or replace function public.idle_conv_faixa(s public.idle_state, seg bigint)
returns int language plpgsql immutable set search_path = public as $$
declare
  p     double precision := public.idle_conv_peso(s, 9);
  d     timestamptz := public.idle_conv_desde(s, 9);
  ds    bigint;
  passo bigint;
  t     int;
begin
  if p <= 0 or d is null then
    return null;
  end if;
  ds := floor(extract(epoch from d))::bigint;
  passo := round(7200 / p)::bigint;
  if seg - ds < passo or mod(seg - ds, passo) <> 0
     or public.idle_horta_sorte(s.user_id, 50, ds + (seg - ds) / passo, 9) < 0.25 then
    return null;
  end if;
  t := public.idle_dourado_tipo(s.user_id, seg);
  return case when t = 7 then 0 else t end;
end;
$$;
revoke all on function public.idle_conv_faixa(public.idle_state, bigint) from public, anon, authenticated;

-- o tipo da janela w (o da 0049): antes do corte (2987010 = 17/10/2026 0h de Brasília; igual a OPP_CORTE, acertado no
-- dia do db push) os 3 de sempre (% 3); depois, a roda de 8 (% 100): 0–17 · 18–33 · 34–49 · 50–59 · 60–71 · 72–80 ·
-- 81–90 · 91–99
create or replace function public.idle_opp_kind(u uuid, w bigint)
returns int language sql immutable set search_path = public as $$
  select case when w < 2987010 then mod(x.h2, 3)::int
              else (case when mod(x.h2, 100) < 18 then 0 when mod(x.h2, 100) < 34 then 1 when mod(x.h2, 100) < 50 then 2
                         when mod(x.h2, 100) < 60 then 3 when mod(x.h2, 100) < 72 then 4 when mod(x.h2, 100) < 81 then 5
                         when mod(x.h2, 100) < 91 then 6 else 7 end) end
    from (select mod(z.v * z.v + 1013904223, 2147483647) as h2 from (select public.idle_opp_sorte(u, w) as v) z) x
$$;
revoke all on function public.idle_opp_kind(uuid, bigint) from public, anon, authenticated;

-- quanto cada gerador rende em t, com todos os multiplicadores da produção (a conta da idle_rate_at da 0066, gerador por
-- gerador): a soma é a produção; o LinkedIn sorteia entre os que mais rendem
create or replace function public.idle_gen_rendas(s public.idle_state, t timestamptz)
returns table (gen int, renda double precision) language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), glob as (
    select coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
         * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
         * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
              * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
         * public.idle_social_mult(s, t)
         * public.idle_bonus_mult(s)
         * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
         * public.idle_conv_prod(s, t)
         * public.idle_place_mult(s) as g
  )
  select c.id,
         c.renda * s.generators[c.id]
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1)
         * case when c.id = 11 then public.idle_conv_food(s, t) else 1 end
         * glob.g
    from public.idle_cat_gen c cross join glob
$$;
revoke all on function public.idle_gen_rendas(public.idle_state, timestamptz) from public, anon, authenticated;

-- produção em t (a da 0066): a soma de idle_gen_rendas (o mesmo número)
create or replace function public.idle_rate_at(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  select coalesce(sum(r.renda), 0) from public.idle_gen_rendas(s, t) r
$$;
revoke all on function public.idle_rate_at(public.idle_state, timestamptz) from public, anon, authenticated;

-- Bombou no LinkedIn no segundo seg: o gerador sorteado entre os até 5 que mais rendem agora (>0; empate: o de id menor)
-- e a parte dele na soma (igual a escolhaLinkedin). Sem renda nenhuma: nenhuma linha.
create or replace function public.idle_linkedin(s public.idle_state, seg bigint)
returns table (gen int, f double precision) language sql stable set search_path = public as $$
  with r as (select x.gen, x.renda from public.idle_gen_rendas(s, now()) x where x.renda > 0),
       tot as (select sum(r.renda) as soma from r),
       top as (select r.gen, r.renda, (row_number() over (order by r.renda desc, r.gen) - 1)::int as i from r),
       n as (select count(*)::int as n from top where top.i < 5)
  select top.gen, top.renda / tot.soma from top, tot, n
   where n.n > 0 and top.i = public.idle_dourado_sorteio(s.user_id, seg, 5151, n.n)
$$;
revoke all on function public.idle_linkedin(public.idle_state, bigint) from public, anon, authenticated;

-- ===== parte B: o estado, a conta e a compra =====
alter table public.idle_state
  add column if not exists linkedin_ate  timestamptz,
  add column if not exists linkedin_gen  int,
  add column if not exists linkedin_mult double precision,
  add column if not exists combo_ate     timestamptz,
  add column if not exists combo_n       int not null default 0,
  add column if not exists combo_seg     bigint,
  add column if not exists garantidos    jsonb not null default '[]',
  add column if not exists tigre_dia     date,
  add column if not exists tigre_n       int not null default 0,
  add column if not exists chamados      int not null default 0,
  add column if not exists cupons        int not null default 0,
  add column if not exists cashback_ate  timestamptz,
  add column if not exists info_creditos int not null default 0,
  add column if not exists espiadas      jsonb not null default '{}',
  add column if not exists dourados_cont jsonb not null default '{}';

-- soma n no contador k (trend_max, pix_dev, tigre_perdeu, tigre_seq, combos, cupons, cashback)
create or replace function public.idle_cont_mais(c jsonb, k text, n double precision)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(c, '{}'::jsonb) || jsonb_build_object(k, coalesce((c ->> k)::double precision, 0) + n)
$$;
revoke all on function public.idle_cont_mais(jsonb, text, double precision) from public, anon, authenticated;

-- os garantidos que ainda valem: saem 60 s depois do segundo deles (a janela mais longa: 24 + 8 + 3 s). Usado por
-- idle_save e idle_json
create or replace function public.idle_garantidos_vivos(g jsonb)
returns jsonb language sql stable set search_path = public as $$
  select coalesce((select jsonb_agg(x order by (x ->> 'seg')::bigint) from jsonb_array_elements(coalesce(g, '[]'::jsonb)) x
                    where (x ->> 'seg')::bigint + 60 > extract(epoch from now())), '[]'::jsonb)
$$;
revoke all on function public.idle_garantidos_vivos(jsonb) from public, anon, authenticated;

-- as espiadas valem 2 h (a conquista Insider olha esse tempo; o humor muda em até 120 min). Usado por idle_save e idle_json
create or replace function public.idle_espiadas_vivas(e jsonb)
returns jsonb language sql stable set search_path = public as $$
  select coalesce((select jsonb_object_agg(x.k, x.v) from jsonb_each(coalesce(e, '{}'::jsonb)) x(k, v)
                    where (x.v ->> 'em')::timestamptz > now() - interval '2 hours'), '{}'::jsonb)
$$;
revoke all on function public.idle_espiadas_vivas(jsonb) from public, anon, authenticated;

-- quantas plantas estão crescendo (ainda não maduras, não colhidas) nos canteiros abertos do usuário. O Adubo de farmácia
-- precisa de uma; idle_json devolve como horta_crescendo
create or replace function public.idle_horta_crescendo(u uuid)
returns int language sql stable set search_path = public as $$
  select count(*)::int
    from public.idle_horta_plantas p
    join public.idle_cat_horta k on k.id = p.especie
    join public.idle_state s on s.user_id = p.user_id
   where p.user_id = u and p.fim is null and p.inicio <= now()
     and p.canteiro / 6 < public.idle_horta_lado(coalesce(s.generators[11], 0))
     and p.canteiro % 6 < public.idle_horta_lado(coalesce(s.generators[11], 0))
     and p.inicio + make_interval(secs => coalesce(p.amadurece_s, k.amadurece_s)) > now()
$$;
revoke all on function public.idle_horta_crescendo(uuid) from public, anon, authenticated;

-- fechar a conta (a da 0074) com o LinkedIn (1 + 29·f) e o Combo (×7)
create or replace function public.idle_settle(s public.idle_state, ts timestamptz default now())
returns public.idle_state language plpgsql stable set search_path = public as $$
declare
  v_fim  timestamptz;
  v_a    timestamptz;
  v_b    timestamptz;
  v_p    timestamptz;
  v_q    timestamptz;
  v_meio timestamptz;
  v_rate double precision;
  v_mult double precision;
  v_k    int;
  v_kb   int;
  v_dur  interval := make_interval(secs => 60 * public.idle_arv(s.user_id, 'dourado_duracao', 'max', 1)); -- Hype: o dobro
begin
  if not s.started or ts <= s.settled_at then
    s.settled_at := greatest(s.settled_at, ts);
    return s;
  end if;
  v_fim := ts; -- sem teto desde a 0061: o jogo fechado rende tudo
  v_a := s.settled_at;
  for v_b in
    select x from (select c.ends_at as x from public.idle_contracts c
                    where (c.employer_id = s.user_id or c.employee_id = s.user_id)
                      and c.ends_at > s.settled_at and c.ends_at < v_fim
                   union
                   select m from public.idle_horta_mudancas(s.user_id, s.settled_at, v_fim) m
                   union
                   select m from public.idle_conv_mudancas(s, s.settled_at, v_fim) m
                   union
                   select v_fim) y
     order by x
  loop
    v_rate := public.idle_rate_at(s, v_a);
    v_p := v_a;
    for v_q in
      select x from (select b as x from unnest(s.boost_ate) b where b > v_a and b < v_b
                     union select v - v_dur from unnest(s.viral_ate) v
                            where v - v_dur > v_a and v - v_dur < v_b
                     union select v from unnest(s.viral_ate) v where v > v_a and v < v_b
                     union select s.marmita_ate where s.marmita_ate > v_a and s.marmita_ate < v_b
                     union select s.linkedin_ate where s.linkedin_ate > v_a and s.linkedin_ate < v_b
                     union select s.combo_ate where s.combo_ate > v_a and s.combo_ate < v_b
                     union select v_b) y
       order by x
    loop
      v_meio := v_p + (v_q - v_p) / 2;
      v_k := (select count(*) from unnest(s.viral_ate) v where v - v_dur <= v_meio and v > v_meio);
      -- os ×5 da oportunidade no ar SOMAM (dois = ×10, três = ×15) e o total multiplica com os Viralizou (×10 cada, sem
      -- teto): dois ×5 com dois Viralizou = ×1.000. Todo ×5 começou antes de settled_at (pegar fecha a conta antes), então
      -- só o fim importa.
      v_kb := (select count(*) from unnest(s.boost_ate) b where b > v_meio);
      -- a Marmita da mãe (×3, 0074) multiplica por cima; começou antes de settled_at (pegar fecha a conta), só o fim importa
      v_mult := (case when v_kb > 0 then 5 * v_kb else 1 end) * 10 ^ v_k
                * (case when s.marmita_ate > v_meio then 3 else 1 end)
                -- LinkedIn e Combo (0076): começaram antes de settled_at (pegar fecha a conta), só o fim importa
                * (case when s.linkedin_ate > v_meio then coalesce(s.linkedin_mult, 1) else 1 end)
                * (case when s.combo_ate > v_meio then 7 else 1 end);
      s.valuation := s.valuation + v_rate * v_mult * extract(epoch from v_q - v_p);
      v_p := v_q;
    end loop;
    v_a := v_b;
  end loop;
  s.settled_at := ts;
  return s;
end;
$$;
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;

-- gravar o estado (o da 0074) com os campos novos da 0076
create or replace function public.idle_save(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
begin
  update public.idle_state
     set started = s.started, valuation = s.valuation, generators = s.generators, upgrades = s.upgrades,
         strategies = s.strategies,
         boost_ate = array(select b from unnest(s.boost_ate) b where b > now() order by b),
         boost_until = (select max(b) from unnest(s.boost_ate) b), meias = greatest(s.meias, 0), half_price = s.meias > 0,
         promo_ate = s.promo_ate, viral_ate = array(select v from unnest(s.viral_ate) v where v > now() order by v),
         marmita_ate = s.marmita_ate, upg_desc_ate = s.upg_desc_ate, eventos_era = coalesce(s.eventos_era, '{}'),
         linkedin_ate = s.linkedin_ate, linkedin_gen = s.linkedin_gen, linkedin_mult = s.linkedin_mult,
         combo_ate = s.combo_ate, combo_n = coalesce(s.combo_n, 0), combo_seg = s.combo_seg,
         garantidos = public.idle_garantidos_vivos(s.garantidos),
         tigre_dia = s.tigre_dia, tigre_n = coalesce(s.tigre_n, 0),
         chamados = least(3, greatest(coalesce(s.chamados, 0), 0)), cupons = greatest(coalesce(s.cupons, 0), 0),
         cashback_ate = s.cashback_ate, info_creditos = greatest(coalesce(s.info_creditos, 0), 0),
         espiadas = public.idle_espiadas_vivas(s.espiadas),
         dourados_cont = coalesce(s.dourados_cont, '{}'::jsonb),
         opp_claimed = array(select w from unnest(s.opp_claimed) w
                              where w >= floor(extract(epoch from now()) / 600)::bigint - 60),
         opp_day = s.opp_day, opp_count = s.opp_count,
         settled_at = s.settled_at, updated_at = now(),
         prestige_earned = s.prestige_earned, prestige_spent = s.prestige_spent, prestige_count = s.prestige_count,
         upg_total = s.upg_total, opp_total = s.opp_total, hire_total = s.hire_total, hired_total = s.hired_total,
         est_usadas = array(select distinct x from unnest(s.est_usadas || public.idle_est_codigos(s.strategies)) x order by x),
         opp_recent = s.opp_recent
   where user_id = s.user_id;
  perform public.idle_check_conquistas(s.user_id);
  -- o recorde depois das conquistas novas (o F$/s que a tela mostra já conta com elas)
  update public.idle_state set best_rate = greatest(best_rate, s.best_rate, public.idle_rate(s)) where user_id = s.user_id;
end;
$$;
revoke all on function public.idle_save(public.idle_state) from public, anon, authenticated;

-- comprar (o da 0074) com o Cupom de primeira compra e o Cashback
create or replace function public.idle_buy(p_kind text, p_id int, p_qty int default 1)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  g      public.idle_cat_gen;
  u      public.idle_cat_upg;
  v_era  int;
  v_cm   double precision;
  v_n    int;
  v_k    int;
  v_preco double precision;
  v_meia boolean := false;
  v_promo boolean;
  v_cmg   double precision;
  v_hb    record;
  v_cupom boolean := false;
  v_cmc   double precision;
  v_cash  double precision := 0;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_era := public.idle_era(s.generators);
  if v_era >= 2 and s.strategies[v_era - 1] < 0 then
    raise exception 'idle_strategy_pending' using errcode = 'P0001';
  end if;
  v_cm := public.idle_cost_mult(s);
  -- 1 s de folga: a página troca os preços no passo de 1 s; quem clicou vendo metade paga metade
  v_promo := s.promo_ate is not null and s.promo_ate > now() - interval '1 second';
  if v_promo then
    v_cm := v_cm / 2; -- Promoção relâmpago: tudo pela metade (preço, 10 e Máx)
  end if;
  -- a horta: geradores e melhorias mais baratos (cada desconto com teto de 50%)
  select * into v_hb from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now());
  v_cmg := v_cm * (1 - v_hb.geradores) * (1 - 0.10 * public.idle_conv_peso(s, 6)); -- Gabe Newell
  -- Cupom de primeira compra (0076): gerador 25% mais barato (no 1, no 10 e no Máx), sem Promoção (desconto de compra
  -- até 50%); a meia-preço também guarda o cupom (abaixo)
  v_cupom := coalesce(s.cupons, 0) > 0 and not v_promo;
  v_cmc := v_cmg * (case when v_cupom then 0.75 else 1 end);

  if p_kind = 'gerador' then
    select * into g from public.idle_cat_gen where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id > 1 and s.generators[p_id - 1] < 1 then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_n := s.generators[p_id];
    if p_qty = 0 then
      v_k := public.idle_max_qty(g.custo, v_n, s.valuation, v_cmc);
      if v_k < 1 then
        raise exception 'idle_cant_afford' using errcode = 'P0001';
      end if;
    elsif p_qty in (1, 10) then
      v_k := p_qty;
    else
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    v_preco := public.idle_price(g.custo, v_n, v_k, v_cmc);
    if s.meias > 0 and v_k = 1 and not v_promo then -- desconto máximo 50%: com a Promoção a meia-preço fica guardada
      v_preco := public.idle_price(g.custo, v_n, 1, v_cmg) / 2; -- a meia sem o cupom; o cupom fica guardado (0076)
      v_meia := true;
      v_cupom := false;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.generators[p_id] := v_n + v_k;
    if p_qty = 0 then
      perform public.idle_ganhar(s.user_id, 'jaula', v_k);
    end if;
  elsif p_kind = 'melhoria' then
    v_cupom := false; -- melhoria não gasta cupom
    select * into u from public.idle_cat_upg where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id = any (s.upgrades) then
      raise exception 'idle_owned' using errcode = 'P0001';
    end if;
    if not public.idle_upg_unlocked(u, s.generators) then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_preco := u.preco * v_cm * (1 - v_hb.melhorias) * (1 + 0.10 * public.idle_conv_peso(s, 1)) -- Cristiano
               * (1 + 0.10 * public.idle_conv_peso(s, 10)) -- Toby Fox
               * (case when s.upg_desc_ate > now() - interval '1 second' then 0.75 else 1 end); -- Atualização instalada (0074)
    if s.meias > 0 and not v_promo then
      v_preco := v_preco / 2;
      v_meia := true;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.upgrades := array_append(s.upgrades, p_id);
    s.upg_total := s.upg_total + 1;
  else
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;

  if v_cupom then
    s.cupons := s.cupons - 1;
  end if;
  -- Cashback (0076): devolve 30% do preço final na hora; é devolução, passa do teto dos descontos (com Promoção: paga 35%).
  -- 1 s de folga, como a Promoção
  if s.cashback_ate > now() - interval '1 second' then
    v_cash := 0.3 * v_preco;
    s.valuation := s.valuation + v_cash;
    s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'cashback', v_cash);
    perform public.idle_ganhar(s.user_id, 'cashback', (s.dourados_cont ->> 'cashback')::double precision);
  end if;
  if v_meia then
    s.meias := s.meias - 1; -- gasta uma; as outras ficam pras próximas compras
  end if;
  s.valuation := greatest(s.valuation, 0);
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_buy(text, int, int) from public, anon;
grant execute on function public.idle_buy(text, int, int) to authenticated;

-- vender a startup (o da 0074) zerando os bônus novos
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
  s.boost_ate := '{}';
  s.meias := 0;
  s.promo_ate := null;
  s.viral_ate := '{}';
  s.marmita_ate := null;  -- os bônus de tempo dos eventos de era zeram; os contadores (eventos_era) ficam
  s.upg_desc_ate := null;
  -- 0076: os bônus e os estoques dos dourados e da Caixinha zeram; os contadores e o Tigrinho do dia (tigre_dia/tigre_n)
  -- ficam (vender não dá 3 jogadas grátis de novo)
  s.linkedin_ate := null;
  s.linkedin_gen := null;
  s.linkedin_mult := null;
  s.combo_ate := null;
  s.combo_n := 0;
  s.combo_seg := null;
  s.garantidos := '[]';
  s.chamados := 0;
  s.cupons := 0;
  s.cashback_ate := null;
  s.info_creditos := 0;
  s.espiadas := '{}';
  s.opp_count := 0; -- a cota do dia recomeça com a empresa nova (as janelas já pegas continuam pegas)
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_prestige() from public, anon;
grant execute on function public.idle_prestige() to authenticated;

-- o estado que toda função devolve (o da 0074) + os campos da 0076
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_rate double precision := public.idle_rate(s);
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', v_rate, 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators),
    'boosts', to_jsonb(array(select b from unnest(s.boost_ate) b where b > now() order by b)),
    'boost_until', (select max(b) from unnest(s.boost_ate) b where b > now()), -- a página velha lê só este
    'meias', s.meias, 'half_price', s.meias > 0, 'opp_claimed', to_jsonb(s.opp_claimed),
    'promo_ate', case when s.promo_ate > now() then s.promo_ate end,
    'viral', to_jsonb(array(select v from unnest(s.viral_ate) v where v > now() order by v)),
    'marmita_ate', case when s.marmita_ate > now() then s.marmita_ate end,
    'upg_desc_ate', case when s.upg_desc_ate > now() then s.upg_desc_ate end,
    'eventos_era', coalesce(s.eventos_era, '{}'::jsonb),
    'convidados', public.idle_conv_json(s),
    'horta_bonus', (select to_jsonb(b) from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b),
    'opp_left', greatest(0, public.idle_opp_cap(s)
                             - case when s.opp_day = public.games_today() then s.opp_count else 0 end),
    'server_now', now(),
    'avatar', public.idle_avatar_json(s.user_id),
    'equipe', coalesce((select jsonb_agg(jsonb_build_object('user_id', c.employee_id, 'cargo', c.cargo,
                                                            'avatar', public.idle_avatar_json(c.employee_id), 'ate', c.ends_at)
                                         order by c.created_at desc, c.id desc)
                          from public.idle_contracts c
                         where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()), '[]'::jsonb),
    'chefes', coalesce((select jsonb_agg(jsonb_build_object('user_id', c.employer_id, 'cargo', c.cargo,
                                                            'mult', public.idle_employee_mult(c.employer_id), 'ate', c.ends_at)
                                         order by c.created_at desc, c.id desc)
                          from public.idle_contracts c
                         where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now()), '[]'::jsonb),
    'social', jsonb_build_object(
      'contratei', (select count(*) from public.idle_contracts c
                     where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()),
      'empregos', coalesce((select jsonb_agg(public.idle_employee_mult(c.employer_id) order by c.created_at desc, c.id desc)
                              from public.idle_contracts c
                             where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now()), '[]'::jsonb)),
    'hire_price', public.idle_hire_price(s),
    'muda_em', public.idle_next_change(s),
    'bonus', jsonb_build_object(
      'arvore', coalesce((select jsonb_agg(a.no_id order by a.no_id) from public.idle_arvore a where a.user_id = s.user_id), '[]'::jsonb),
      'conquistas', (select count(*) from public.idle_conquistas c where c.user_id = s.user_id)),
    'pontos', s.prestige_earned - s.prestige_spent,
    'pontos_vida', s.prestige_earned,
    'vendas', s.prestige_count,
    'recorde', greatest(s.best_rate, v_rate),
    'pontos_venda', case when s.started then greatest(0, public.idle_prestige_total(v_rate) - s.prestige_earned) else 0 end,
    'conquistas', coalesce((select jsonb_agg(jsonb_build_object('id', c.conquista_id, 'em', c.ganhou_em)
                                             order by c.ganhou_em, c.conquista_id)
                              from public.idle_conquistas c where c.user_id = s.user_id), '[]'::jsonb),
    'novas', coalesce((select jsonb_agg(c.conquista_id order by c.conquista_id)
                         from public.idle_conquistas c where c.user_id = s.user_id and c.ganhou_em = now()), '[]'::jsonb),
    'mapa_mult', public.idle_place_mult(s),
    'mapa_abertos', (select count(*) from public.idle_place_state st where st.user_id = s.user_id),
    'descobertas', coalesce((select jsonb_agg(d.id order by d.id)
                               from (select distinct c.conquista_id as id
                                       from public.idle_conquistas c
                                       join public.idle_cat_conquista k on k.id = c.conquista_id
                                      where k.escondida) d), '[]'::jsonb))
  || jsonb_build_object(
    -- 0076 (num 2º objeto: o 1º já está perto do limite de 100 argumentos de função)
    'linkedin_ate', case when s.linkedin_ate > now() then s.linkedin_ate end,
    'linkedin_gen', case when s.linkedin_ate > now() then s.linkedin_gen end,
    'linkedin_mult', case when s.linkedin_ate > now() then s.linkedin_mult end,
    'combo_ate', case when s.combo_ate > now() then s.combo_ate end,
    'combo_n', coalesce(s.combo_n, 0),
    'combo_seg', s.combo_seg,
    'garantidos', public.idle_garantidos_vivos(s.garantidos),
    'tigre_n', case when s.tigre_dia = public.games_today() then coalesce(s.tigre_n, 0) else 0 end,
    'tigre_dia', s.tigre_dia,
    'chamados', coalesce(s.chamados, 0),
    'cupons', coalesce(s.cupons, 0),
    'cashback_ate', case when s.cashback_ate > now() then s.cashback_ate end,
    'info_creditos', coalesce(s.info_creditos, 0),
    'espiadas', public.idle_espiadas_vivas(s.espiadas),
    'dourados_cont', coalesce(s.dourados_cont, '{}'::jsonb),
    'horta_crescendo', public.idle_horta_crescendo(s.user_id));
end;
$$;

revoke all on function public.idle_json(public.idle_state) from public, anon, authenticated;

-- ===== parte C: pegar o dourado, o Combo e o Chamar =====
-- o Combo quebrou entre o último pego (de) e o atual (ate)? Um segundo no meio com dourado da sorte (não Tigrinho), não
-- pego e com a janela já passada (igual a combo.ts comboAgora). `peso` = Gemaplys + a frequência da árvore − 1; `tela` =
-- quanto fica na tela (s). Os garantidos não estão na sorte: perder um não quebra.
create or replace function public.idle_combo_quebrou(s public.idle_state, de bigint, ate bigint, peso double precision, tela double precision)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1
      from generate_series(de + 1, ate - 1) x
      cross join lateral (select coalesce(public.idle_dourado(s.user_id, x, peso), public.idle_conv_faixa(s, x)) as tipo) d
     where d.tipo is not null and d.tipo <> 7
       and now() > to_timestamp(x) + make_interval(secs => tela + case when d.tipo in (4, 6) then 8 else 0 end + 3)
       and not exists (select 1 from public.idle_dourados_pegos p where p.user_id = s.user_id and p.seg = x))
$$;
revoke all on function public.idle_combo_quebrou(public.idle_state, bigint, bigint, double precision, double precision) from public, anon, authenticated;

drop function if exists public.idle_dourado_pegar(bigint, int);
-- pegar o dourado do segundo p_seg (o da 0061) com os quatro novos, os garantidos e o Combo. p_lado: o lado da dupla, ou a
-- escolha do Pix (0 ficar, 1 devolver); p_moedas: as moedinhas do Trend (a página conta; o banco aceita 0 a 20).
-- Devolve o estado + "dourado": {tipo, lado, ganho, dobro, moedas, gen, mult, garantido_seg, tigre, combo}.
create or replace function public.idle_dourado_pegar(p_seg bigint, p_lado int, p_moedas int default 0)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s        public.idle_state;
  v_me     uuid := auth.uid();
  v_tipo   int;
  v_ini    timestamptz;
  v_freq   double precision := public.idle_arv(auth.uid(), 'dourado_freq', 'max', 1);    -- Pé de coelho / Dia de sorte
  v_tela   double precision := public.idle_arv(auth.uid(), 'dourado_tela', 'max', 12);   -- Olho de lince: 24 s
  v_dur    double precision := public.idle_arv(auth.uid(), 'dourado_duracao', 'max', 1); -- Hype: o dobro
  v_gema   double precision;
  v_g      jsonb;
  v_dobro  boolean := false;
  v_d      double precision;
  v_rate   double precision;
  v_ganho  double precision := 0;
  v_moedas int := 0;
  v_gen    int;
  v_f      double precision;
  v_gseg   bigint;
  v_tigre  jsonb;
  v_gratis boolean;
  v_pagou  boolean;
  v_perdeu double precision := 0;
  v_combo  boolean := false;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  -- segundo longe de agora (ou nulo) nem chega no to_timestamp (um valor absurdo daria erro de data)
  if p_seg is null or abs(p_seg - extract(epoch from now())) > 60 then
    raise exception 'idle_dourado_gone' using errcode = 'P0001';
  end if;
  v_gema := public.idle_conv_peso(s, 3);
  -- garantido (Pix devolvido, Chamar) primeiro: o tipo e o dobro vêm da lista; senão a sorte e a faixa do MC V.V
  select g into v_g from jsonb_array_elements(public.idle_garantidos_vivos(s.garantidos)) g where (g ->> 'seg')::bigint = p_seg limit 1;
  if v_g is not null then
    v_tipo := (v_g ->> 'tipo')::int;
    v_dobro := coalesce((v_g ->> 'dobro')::boolean, false);
  else
    -- a frequência da árvore entra como peso a mais no extra do Gemaplys (igual a convidados.ts eventoDaSorte)
    v_tipo := coalesce(public.idle_dourado(v_me, p_seg, v_gema + v_freq - 1), public.idle_conv_faixa(s, p_seg));
  end if;
  v_d := case when v_dobro then 2 else 1 end;
  v_ini := to_timestamp(p_seg);
  -- na tela: base × (1 − gema/2); o Trend (a chuva) e o Pix (a escolha) têm 8 s a mais; o banco aceita 3 s a mais (rede)
  if v_tipo is null or now() < v_ini - interval '2 seconds'
     or now() > v_ini + make_interval(secs => v_tela * (1 - v_gema / 2) + case when v_tipo in (4, 6) then 8 else 0 end + 3) then
    raise exception 'idle_dourado_gone' using errcode = 'P0001';
  end if;
  if p_lado is null or p_lado not in (0, 1) or (p_lado = 1 and v_tipo not in (3, 6)) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  delete from public.idle_dourados_pegos where user_id = v_me and pegou_em < now() - interval '1 hour';
  -- o Pix grava sempre o lado 0: ficar e devolver são o mesmo Pix (paga uma vez)
  insert into public.idle_dourados_pegos (user_id, seg, lado)
  values (v_me, p_seg, case when v_tipo = 6 then 0 else p_lado end) on conflict do nothing;
  if not found then
    raise exception 'idle_dourado_pego' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_rate := public.idle_rate(s);
  case v_tipo
    when 0 then -- Investidor apressado: 20 min (× Investidor anjo × horta; 2× no dobro)
      v_ganho := v_rate * 1200 * v_d * public.idle_arv(v_me, 'dourado_investidor', 'mult', 1)
                 * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b));
    when 1 then -- Promoção relâmpago: 30 s × Hype (o dobro dura 2×)
      s.promo_ate := greatest(coalesce(s.promo_ate, now()), now() + make_interval(secs => 30 * v_dur * v_d));
    when 2, 3 then -- Viralizou (e cada lado da dupla); no dobro, um 2º fim logo depois do 1º (×10 por 2 min)
      s.viral_ate := array(select v from unnest(s.viral_ate) v where v > now()) || (now() + make_interval(secs => 60 * v_dur))
                     || case when v_dobro then array[now() + make_interval(secs => 120 * v_dur)] else '{}'::timestamptz[] end;
    when 4 then -- Trend do TikTok: 1 min de produção por moedinha (2 no dobro), até 20
      v_moedas := least(20, greatest(0, coalesce(p_moedas, 0)));
      v_ganho := v_rate * 60 * v_moedas * v_d;
      s.dourados_cont := coalesce(s.dourados_cont, '{}'::jsonb)
                         || jsonb_build_object('trend_max', greatest(coalesce((s.dourados_cont ->> 'trend_max')::int, 0), v_moedas));
      perform public.idle_ganhar(v_me, 'trend_max', v_moedas);
    when 5 then -- Bombou no LinkedIn: um dos 5 que mais produzem ×30 por 1 min (× Hype × dobro), congelado agora; o novo substitui
      select l.gen, l.f into v_gen, v_f from public.idle_linkedin(s, p_seg) l;
      s.linkedin_gen := v_gen;
      s.linkedin_mult := 1 + 29 * coalesce(v_f, 0);
      s.linkedin_ate := now() + make_interval(secs => 60 * v_dur * v_d);
    when 6 then -- Pix errado: ficar (30 min) ou devolver (um garantido em dobro de 20 a 120 s depois)
      if p_lado = 0 then
        v_ganho := v_rate * 1800;
      else
        v_gseg := public.idle_dourado_pix_seg(v_me, p_seg);
        s.garantidos := coalesce(s.garantidos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'seg', v_gseg, 'tipo', public.idle_dourado_tipo_garantido(v_me, v_gseg), 'dobro', true));
        s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'pix_dev', 1);
        perform public.idle_ganhar(v_me, 'pix_dev', (s.dourados_cont ->> 'pix_dev')::double precision);
      end if;
    else -- Tigrinho: as 3 primeiras do dia pagam; depois a casa paga 3 em cada 10 (30 min) e come 15 min (nunca abaixo de zero)
      if s.tigre_dia is distinct from public.games_today() then
        s.tigre_dia := public.games_today();
        s.tigre_n := 0;
      end if;
      s.tigre_n := coalesce(s.tigre_n, 0) + 1;
      v_gratis := s.tigre_n <= 3;
      v_pagou := v_gratis or public.idle_dourado_tigre_paga(v_me, p_seg);
      if v_pagou then
        v_ganho := v_rate * 1800;
        if not v_gratis then -- O tigre tá pagando: vitórias seguidas depois das grátis
          s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'tigre_seq', 1);
          perform public.idle_ganhar(v_me, 'tigre_seq', (s.dourados_cont ->> 'tigre_seq')::double precision);
        end if;
      else
        v_perdeu := least(greatest(s.valuation, 0), v_rate * 900);
        s.valuation := s.valuation - v_perdeu;
        s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'tigre_perdeu', 1) || jsonb_build_object('tigre_seq', 0);
        perform public.idle_ganhar(v_me, 'tigre_perdeu', (s.dourados_cont ->> 'tigre_perdeu')::double precision);
      end if;
      v_tigre := jsonb_build_object('pagou', v_pagou, 'gratis', v_gratis, 'perdeu', v_perdeu, 'n', s.tigre_n);
  end case;
  s.valuation := s.valuation + v_ganho;
  -- o garantido sai da lista quando pego (a dupla, depois dos dois lados)
  if v_g is not null
     and (v_tipo <> 3 or (select count(*) from public.idle_dourados_pegos p where p.user_id = v_me and p.seg = p_seg) >= 2) then
    s.garantidos := coalesce((select jsonb_agg(g) from jsonb_array_elements(s.garantidos) g where (g ->> 'seg')::bigint <> p_seg), '[]'::jsonb);
  end if;
  -- Combo: 3 pegos seguidos sem nenhum sumir no meio = ×7 por 1 min (× Hype). A dupla conta uma vez: se o outro lado do
  -- mesmo segundo já foi pego (mesmo com outro dourado no meio), este não soma nem quebra; o último pego de mais de 30 min
  -- atrás (ou nenhum) zera
  if (select count(*) from public.idle_dourados_pegos p where p.user_id = v_me and p.seg = p_seg) < 2 then
    if s.combo_seg is null or s.combo_seg < p_seg - 1800
       or (p_seg > s.combo_seg and public.idle_combo_quebrou(s, s.combo_seg, p_seg, v_gema + v_freq - 1, v_tela * (1 - v_gema / 2))) then
      s.combo_n := 0;
    end if;
    s.combo_n := coalesce(s.combo_n, 0) + 1;
    s.combo_seg := greatest(coalesce(s.combo_seg, p_seg), p_seg);
    if s.combo_n >= 3 then
      s.combo_ate := greatest(coalesce(s.combo_ate, now()), now()) + make_interval(secs => 60 * v_dur);
      s.combo_n := 0;
      v_combo := true;
      s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'combos', 1);
      perform public.idle_ganhar(v_me, 'combos', (s.dourados_cont ->> 'combos')::double precision);
    end if;
  end if;
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('dourado', jsonb_build_object(
    'tipo', v_tipo, 'lado', p_lado, 'ganho', v_ganho, 'dobro', v_dobro, 'moedas', v_moedas, 'gen', v_gen,
    'mult', case when v_tipo = 5 then s.linkedin_mult end, 'garantido_seg', v_gseg, 'tigre', v_tigre, 'combo', v_combo));
end;
$$;
revoke all on function public.idle_dourado_pegar(bigint, int, int) from public, anon;
grant execute on function public.idle_dourado_pegar(bigint, int, int) to authenticated;

-- Chamar um dourado (guardado pela Caixinha): gasta 1 e põe um garantido no segundo seguinte (a roda sem Pix nem
-- Tigrinho, sem dobro); dois no mesmo segundo: o 2º vai pro seguinte
create or replace function public.idle_dourado_chamar()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s     public.idle_state;
  v_me  uuid := auth.uid();
  v_seg bigint := floor(extract(epoch from now()))::bigint + 1;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if coalesce(s.chamados, 0) < 1 then
    raise exception 'idle_chamar_vazio' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  while exists (select 1 from jsonb_array_elements(coalesce(s.garantidos, '[]'::jsonb)) g where (g ->> 'seg')::bigint = v_seg) loop
    v_seg := v_seg + 1;
  end loop;
  s.chamados := s.chamados - 1;
  s.garantidos := coalesce(s.garantidos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'seg', v_seg, 'tipo', public.idle_dourado_tipo_garantido(v_me, v_seg), 'dobro', false));
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_dourado_chamar() from public, anon;
grant execute on function public.idle_dourado_chamar() to authenticated;

-- ===== Parte D: a Caixinha nova e o Espiar da Bolsa =====

-- pegar oportunidade (a da 0063) com os 5 tipos novos (0076)
create or replace function public.idle_claim_opportunity(p_window bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_mult double precision;
  v_rate double precision;
  v_n    int;
  v_tipo int;
  v_lado int;
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
  v_tipo := public.idle_opp_kind(s.user_id, p_window);
  v_lado := public.idle_horta_lado(coalesce(s.generators[11], 0));
  -- quem ainda não tem: o Adubo sem Horta (ou sem planta crescendo) e a Informação sem Bolsa pagam os 15 min (o tipo 0) no
  -- lugar; quem decide é a hora do clique
  if (v_tipo = 5 and public.idle_horta_crescendo(s.user_id) = 0)
     or (v_tipo = 7 and coalesce(s.generators[19], 0) < 1) then
    v_tipo := 0;
  end if;
  case v_tipo
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, v_lado, now()) b));
    -- cada ×5 conta sozinho e dura 1 minuto; com "rendem o dobro" entram v_n de uma vez (2: ×25)
    when 1 then s.boost_ate := array(select b from unnest(s.boost_ate) b where b > now())
                               || array_fill(now() + interval '1 minute', array[v_n]);
    when 2 then s.meias := s.meias + v_n; -- cada uma guardada vale uma compra; com o dobro, guarda duas
    when 3 then s.chamados := least(3, coalesce(s.chamados, 0) + v_n); -- Chamar um dourado: no máximo 3 (o que passa se perde)
    when 4 then -- Cupom de primeira compra: 10 compras de gerador 25% mais baratas (20 no dobro)
      s.cupons := coalesce(s.cupons, 0) + 10 * v_n;
      s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'cupons', 1);
      perform public.idle_ganhar(s.user_id, 'cupons', (s.dourados_cont ->> 'cupons')::double precision);
    when 5 then -- Adubo de farmácia: as v_n plantas crescendo mais perto de ficar maduras amadurecem agora (a conta já fechou)
      update public.idle_horta_plantas p set amadurece_s = extract(epoch from now() - p.inicio)
       where p.id in (select p2.id from public.idle_horta_plantas p2 join public.idle_cat_horta k on k.id = p2.especie
                       where p2.user_id = s.user_id and p2.fim is null and p2.inicio <= now()
                         and p2.canteiro / 6 < v_lado and p2.canteiro % 6 < v_lado
                         and p2.inicio + make_interval(secs => coalesce(p2.amadurece_s, k.amadurece_s)) > now()
                       order by p2.inicio + make_interval(secs => coalesce(p2.amadurece_s, k.amadurece_s)), p2.id
                       limit v_n);
    when 6 then -- Cashback: 30% de volta em toda compra por 2 min (4 no dobro), somando no fim do que já tem
      s.cashback_ate := greatest(coalesce(s.cashback_ate, now()), now()) + make_interval(secs => 120 * v_n);
    else -- Informação privilegiada: créditos de Espiar na Bolsa
      s.info_creditos := coalesce(s.info_creditos, 0) + v_n;
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

-- a empresa m está espiada agora? (o humor espiado vale até ele virar: o mesmo humor_ate de quando espiou, sem RJ)
create or replace function public.idle_bolsa_espiada(s public.idle_state, m public.idle_bolsa_mercado, p_agora bigint)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(m.rj_ate is null and m.humor_ate > p_agora
                  and (s.espiadas -> m.empresa::text ->> 'ate_tick')::bigint = m.humor_ate, false)
$$;
revoke all on function public.idle_bolsa_espiada(public.idle_state, public.idle_bolsa_mercado, bigint) from public, anon, authenticated;

-- Espiar (Informação privilegiada): gasta 1 crédito e mostra o humor da empresa e em quantos minutos ele muda, até virar
create or replace function public.idle_bolsa_espiar_em(p_user uuid, p_empresa int, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
  m public.idle_bolsa_mercado;
begin
  s := public.idle_lock(p_user);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if coalesce(s.generators[19], 0) < 1 then
    raise exception 'idle_bolsa_fechada' using errcode = 'P0001';
  end if;
  select * into m from public.idle_bolsa_mercado where empresa = p_empresa;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if m.rj_ate is not null then
    raise exception 'idle_bolsa_rj' using errcode = 'P0001';
  end if;
  if public.idle_bolsa_espiada(s, m, p_agora) then
    raise exception 'idle_info_ja' using errcode = 'P0001';
  end if;
  if coalesce(s.info_creditos, 0) < 1 then
    raise exception 'idle_info_sem_credito' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  s.info_creditos := s.info_creditos - 1;
  s.espiadas := coalesce(s.espiadas, '{}'::jsonb)
                || jsonb_build_object(p_empresa::text, jsonb_build_object('ate_tick', m.humor_ate, 'em', now()));
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('bolsa', public.idle_bolsa_estado(p_user, p_agora));
end;
$$;
revoke all on function public.idle_bolsa_espiar_em(uuid, int, bigint) from public, anon, authenticated;

create or replace function public.idle_bolsa_espiar(p_empresa int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return public.idle_bolsa_espiar_em(auth.uid(), p_empresa, public.idle_bolsa_avancar());
end;
$$;
revoke all on function public.idle_bolsa_espiar(int) from public, anon;
grant execute on function public.idle_bolsa_espiar(int) to authenticated;

-- o que a Bolsa mostra (o da 0051) + os créditos de Espiar e o humor espiado (com "muda em", 0076)
create or replace function public.idle_bolsa_estado(p_user uuid, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_po   jsonb;
  v_tr   int := 0;
  v_corr int := 0;
  v_esc  int := 0;
  v_vs   boolean := false;
  v_fgc  boolean := false;
begin
  select * into s from public.idle_state where user_id = p_user;
  if found then
    v_tr := coalesce(s.generators[19], 0);
    v_vs := public.idle_conv_peso(s, 11) > 0;
  end if;
  select coalesce(max(n.corretor), 0), coalesce(max(n.escritorio), 0) into v_corr, v_esc
    from public.idle_bolsa_nivel n where n.user_id = p_user;
  with po as (
    delete from public.idle_bolsa_carteira k
     using public.idle_bolsa_mercado m
     where k.user_id = p_user and m.empresa = k.empresa and k.geracao < m.geracao
    returning k.empresa, k.qtd, k.alavanca
  )
  select coalesce(jsonb_agg(jsonb_build_object('empresa', empresa, 'qtd', qtd) order by empresa) filter (where qtd > 0), '[]'::jsonb),
         coalesce(bool_or(alavanca > 1 and qtd > 0), false)
    into v_po, v_fgc from po;
  if v_fgc then -- lote do Vorcaro virou pó: a conquista sai na próxima conta fechada (aqui pode não ter trava)
    update public.idle_state set conv_fgc = true where user_id = p_user;
  end if;
  return jsonb_build_object(
    'tick', p_agora,
    'vira_em_ms', greatest(0, (p_agora + 1) * 60000 - floor(extract(epoch from now()) * 1000)::bigint),
    'r', case when s.user_id is null then 0 else public.idle_rate_bolsa(s) end, -- sem os convidados (ver idle_rate_bolsa)
    'aberta', v_tr >= 1 and coalesce(s.started, false),
    'corretor', v_corr,
    'escritorio', v_esc,
    'corretagem', public.idle_bolsa_corretagem(v_corr),
    'info_creditos', coalesce(s.info_creditos, 0),
    'empresas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.empresa, 'valor', m.valor,
        'limite', 100 + coalesce(s.generators[c.gerador], 0) + public.idle_bolsa_escritorio(v_esc),
        'risco', m.rj_ate is null and m.valor < 0.15 * c.repouso,
        'rj_ate', m.rj_ate,
        'humor', case when v_vs or public.idle_bolsa_espiada(s, m, p_agora) then m.humor end, -- VSauce sentado ou espiada
        'espiada', public.idle_bolsa_espiada(s, m, p_agora),
        'muda_em', case when public.idle_bolsa_espiada(s, m, p_agora) then greatest(1, m.humor_ate - p_agora) end,
        'historico', (select coalesce(jsonb_agg(p.valor order by p.tick), '[]'::jsonb) from public.idle_bolsa_precos p
                       where p.empresa = m.empresa and p.tick > p_agora - 60 and p.tick <= p_agora)
      ) order by m.empresa), '[]'::jsonb)
      from public.idle_bolsa_mercado m join public.idle_cat_bolsa c on c.id = m.empresa),
    'carteira', (
      select coalesce(jsonb_agg(jsonb_build_object('empresa', k.empresa, 'qtd', k.qtd, 'custo', k.custo, 'alavanca', k.alavanca)
                            order by k.empresa, k.alavanca), '[]'::jsonb)
        from public.idle_bolsa_carteira k where k.user_id = p_user and k.qtd > 0),
    'viraram_po', v_po);
end;
$$;
revoke all on function public.idle_bolsa_estado(uuid, bigint) from public, anon, authenticated;

-- negociar (o da 0051) + a Insider (shh) na venda (0076)
create or replace function public.idle_bolsa_negociar_em(
  p_user uuid, p_empresa int, p_lado text, p_qtd int, p_tick bigint, p_agora bigint, p_lote double precision default 1)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s        public.idle_state;
  c        public.idle_cat_bolsa;
  m        public.idle_bolsa_mercado;
  k        public.idle_bolsa_carteira;
  v_tem    int := 0;
  v_total  int := 0;
  v_custo  double precision := 0;
  v_r      double precision;
  v_preco  double precision;
  v_cabe   int;
  v_n      int;
  v_corr   int := 0;
  v_esc    int := 0;
  v_fee    double precision;
  v_lote   double precision;
  v_compra double precision;
  v_por    double precision;
begin
  if p_tick is distinct from p_agora then
    raise exception 'idle_bolsa_preco_mudou' using errcode = 'P0001';
  end if;
  if p_lado not in ('comprar', 'vender') or p_qtd not in (0, 1, 10) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  select * into c from public.idle_cat_bolsa where id = p_empresa;
  if not found then
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
  select * into m from public.idle_bolsa_mercado where empresa = p_empresa;
  if m.rj_ate is not null then
    raise exception 'idle_bolsa_rj' using errcode = 'P0001';
  end if;
  -- comprar: o lote é o do Vorcaro agora (1 + peso; 1 sem ele); vender: o lote pedido
  v_lote := case when p_lado = 'comprar' then 1 + public.idle_conv_peso(s, 2) else coalesce(p_lote, 1) end;
  select * into k from public.idle_bolsa_carteira
   where user_id = p_user and empresa = p_empresa and alavanca = v_lote for update;
  if found and k.geracao = m.geracao then
    v_tem := k.qtd;
    v_custo := k.custo;
  elsif found and k.alavanca > 1 and k.qtd > 0 then
    perform public.idle_ganhar(p_user, 'conv_fgc'); -- o lote antigo virou pó (a conta já fechou acima)
  end if;
  select coalesce(sum(x.qtd), 0) into v_total from public.idle_bolsa_carteira x
   where x.user_id = p_user and x.empresa = p_empresa and x.geracao = m.geracao;
  select coalesce(max(n.corretor), 0), coalesce(max(n.escritorio), 0) into v_corr, v_esc
    from public.idle_bolsa_nivel n where n.user_id = p_user;
  v_fee := 1 + public.idle_bolsa_corretagem(v_corr);
  v_r := public.idle_rate_bolsa(s); -- sem os convidados (ver idle_rate_bolsa)
  v_preco := m.valor * v_r;

  if p_lado = 'comprar' then
    v_cabe := 100 + coalesce(s.generators[c.gerador], 0) + public.idle_bolsa_escritorio(v_esc) - v_total;
    if v_cabe <= 0 or (p_qtd > 0 and p_qtd > v_cabe) then
      raise exception 'idle_bolsa_limite' using errcode = 'P0001';
    end if;
    if p_qtd = 0 then
      v_n := least(v_cabe, floor(s.valuation / (v_preco * v_fee))::int);
    else
      v_n := p_qtd;
    end if;
    if v_preco <= 0 or v_n < 1 or v_n * v_preco * v_fee > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := greatest(s.valuation - v_n * v_preco * v_fee, 0);
    insert into public.idle_bolsa_carteira (user_id, empresa, alavanca, qtd, custo, geracao)
    values (p_user, p_empresa, v_lote, v_tem + v_n, v_custo + v_n * m.valor * v_fee, m.geracao)
    on conflict (user_id, empresa, alavanca) do update set qtd = excluded.qtd, custo = excluded.custo, geracao = excluded.geracao;
  else
    if v_tem < 1 then
      raise exception 'idle_bolsa_sem_acoes' using errcode = 'P0001';
    end if;
    v_n := case when p_qtd = 0 then v_tem else least(p_qtd, v_tem) end;
    if v_lote = 1 then
      s.valuation := s.valuation + v_n * v_preco;
    else
      -- lote alavancado: a diferença do preço pago (com a corretagem) conta `alavanca` vezes; perdeu tudo = pó
      v_compra := v_custo / v_tem;
      v_por := greatest(0, v_compra + v_lote * (m.valor - v_compra));
      s.valuation := s.valuation + v_n * v_por * v_r;
      if v_por = 0 then
        perform public.idle_ganhar(p_user, 'conv_fgc');
      end if;
    end if;
    -- Insider (shh), escondida (0076): vendeu com 100% de lucro (o preço da venda, por ação, no mínimo o dobro do que pagou
    -- com a corretagem) uma ação de empresa espiada nas últimas 2 h
    if (case when v_lote = 1 then m.valor else v_por end) >= 2 * (v_custo / v_tem)
       and (s.espiadas -> p_empresa::text ->> 'em')::timestamptz >= now() - interval '2 hours' then
      perform public.idle_ganhar(p_user, 'insider', 1);
    end if;
    update public.idle_bolsa_carteira
       set qtd = v_tem - v_n, custo = v_custo * (v_tem - v_n) / v_tem, geracao = m.geracao
     where user_id = p_user and empresa = p_empresa and alavanca = v_lote;
  end if;

  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('bolsa', public.idle_bolsa_estado(p_user, p_agora));
end;
$$;
revoke all on function public.idle_bolsa_negociar_em(uuid, int, text, int, bigint, bigint, double precision) from public, anon, authenticated;
