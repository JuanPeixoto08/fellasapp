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
