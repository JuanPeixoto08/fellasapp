-- fellasapp: Fellas Inc., Mapa do rolê, o copão (lugar 4; spec 2026-10-12-fellas-inc-mapa-do-role-design.md §5).
-- Parte A: o catálogo escondido, os desafios, o cardápio (pôr e tirar um copão), o DJ da sexta, as contas (espelho de
-- games/idle/copao.ts, com teste de paridade em games/test/idleCopao.test.ts) e o JSON da tela. A parte B troca
-- idle_cup_avancar e idle_cup_depois (as noites, as vendas, o PT, a galera, a revelação, o caderninho e os desafios).
-- Depende da 0057 (a moldura: idle_place_*, os stubs idle_cup_* e o contrato das partes 2 a 4).

-- ===== catálogo (igual a games/idle/copao.ts; escondido de quem joga: a tela usa o TS) =====
create table if not exists public.idle_cup_cat_base (
  id int primary key, nome text not null, sabores text[] not null, ponto int not null, custo double precision not null, nivel int not null
);
create table if not exists public.idle_cup_cat_mistura (id int primary key, nome text not null, sabores text[] not null, nivel int not null);
create table if not exists public.idle_cup_cat_extra (id int primary key, nome text not null, sabores text[] not null, nivel int not null);
create table if not exists public.idle_cup_cat_tamanho (
  id int primary key, nome text not null, doses int not null, ref int not null, nivel int not null
);
create table if not exists public.idle_cup_cat_dj (id int primary key, nome text not null, estilo text not null, bases int[] not null, nivel int not null);
-- a n-ésima vaga do cardápio chega no nível dado (as 3 primeiras já vêm no nível 1)
create table if not exists public.idle_cup_cat_vaga (vaga int primary key, nivel int not null);
create table if not exists public.idle_cup_cat_conflito (a text not null, b text not null, primary key (a, b));
-- as constantes ajustadas na simulação (copaoSim.test.ts) e os pontos de sabor por rótulo (péssima a ótima)
create table if not exists public.idle_cup_const (
  id int primary key default 1 check (id = 1), publico_base double precision not null, cresce double precision not null,
  elasticidade double precision not null, galera_teto double precision not null, pontos int[] not null
);
alter table public.idle_cup_cat_base enable row level security;
alter table public.idle_cup_cat_mistura enable row level security;
alter table public.idle_cup_cat_extra enable row level security;
alter table public.idle_cup_cat_tamanho enable row level security;
alter table public.idle_cup_cat_dj enable row level security;
alter table public.idle_cup_cat_vaga enable row level security;
alter table public.idle_cup_cat_conflito enable row level security;
alter table public.idle_cup_const enable row level security;
revoke all on public.idle_cup_cat_base, public.idle_cup_cat_mistura, public.idle_cup_cat_extra, public.idle_cup_cat_tamanho,
  public.idle_cup_cat_dj, public.idle_cup_cat_vaga, public.idle_cup_cat_conflito, public.idle_cup_const from anon, authenticated;

delete from public.idle_cup_cat_base where true;
delete from public.idle_cup_cat_mistura where true;
delete from public.idle_cup_cat_extra where true;
delete from public.idle_cup_cat_tamanho where true;
delete from public.idle_cup_cat_dj where true;
delete from public.idle_cup_cat_vaga where true;
delete from public.idle_cup_cat_conflito where true;
delete from public.idle_cup_const where true;
insert into public.idle_cup_cat_base (id, nome, sabores, ponto, custo, nivel) values
  (1, 'Vodka', '{neutro,forte}', 5, 2, 1),
  (2, 'Cachaça', '{forte,raiz}', 4, 1, 1),
  (3, 'Catuaba', '{doce,raiz}', 6, 1, 1),
  (4, 'Gin', '{herbal,citrico}', 5, 3, 2),
  (5, 'Rum', '{doce,tropical}', 5, 2, 4),
  (6, 'Whisky de posto', '{forte,amargo}', 4, 2, 6),
  (7, 'Tequila', '{citrico,forte}', 4, 3, 9),
  (8, 'Corote de pêssego', '{doce,frutado}', 7, 1, 11),
  (9, 'Licor de chocolate', '{doce,cremoso}', 6, 3, 13),
  (10, 'Saquê', '{neutro,leve}', 7, 3, 15),
  (11, 'Absinto', '{herbal,forte,amargo}', 3, 4, 17),
  (12, 'Vinho de garrafão', '{frutado,doce,raiz}', 6, 1, 19);
insert into public.idle_cup_cat_mistura (id, nome, sabores, nivel) values
  (1, 'Energético tradicional', '{doce,energia}', 1),
  (2, 'Refri de guaraná', '{doce,raiz}', 1),
  (3, 'Suco de laranja', '{citrico,frutado}', 1),
  (4, 'Refri de cola', '{doce,amargo}', 1),
  (5, 'Energético de melancia', '{frutado,energia}', 2),
  (6, 'Suco de maracujá', '{citrico,tropical}', 4),
  (7, 'Água tônica', '{amargo,leve}', 6),
  (8, 'Energético de açaí', '{frutado,energia,cremoso}', 8),
  (9, 'Refri de limão', '{citrico,leve}', 10),
  (10, 'Xarope de groselha', '{doce,frutado}', 12),
  (11, 'Chá gelado', '{herbal,leve}', 14),
  (12, 'Energético tropical', '{tropical,energia}', 16),
  (13, 'Isotônico', '{leve,neutro}', 18),
  (14, 'Leite condensado', '{cremoso,doce}', 19),
  (15, 'Energético sem açúcar', '{energia,leve}', 21);
insert into public.idle_cup_cat_extra (id, nome, sabores, nivel) values
  (1, 'Limão', '{citrico}', 1),
  (2, 'Gelo de coco', '{tropical,cremoso}', 1),
  (3, 'Morango', '{frutado,doce}', 1),
  (4, 'Maracujá', '{tropical,citrico}', 3),
  (5, 'Hortelã', '{herbal,leve}', 5),
  (6, 'Bala de goma', '{doce}', 7),
  (7, 'Abacaxi', '{tropical,frutado}', 9),
  (8, 'Canela', '{raiz,doce}', 11),
  (9, 'Pimenta', '{forte}', 14),
  (10, 'Sal na borda', '{salgado}', 16),
  (11, 'Açúcar na borda', '{doce}', 18),
  (12, 'Fruta vermelha', '{frutado}', 21);
insert into public.idle_cup_cat_tamanho (id, nome, doses, ref, nivel) values
  (1, 'Copo', 1, 8, 1),
  (2, 'Copão', 3, 22, 1),
  (3, 'Balde', 10, 60, 7);
insert into public.idle_cup_cat_dj (id, nome, estilo, bases, nivel) values
  (1, 'DJ Vaqueiro', 'piseiro', '{2,3,12}', 1),
  (2, 'DJ Ramemes', 'funk', '{1,6,8}', 1),
  (3, 'Neiff', 'brega-funk', '{8,3,9}', 3),
  (4, 'DJ Robson Caetano', 'eletrônica', '{1,4,11}', 5),
  (5, 'Ana Castela', 'sertanejo', '{6,2,7}', 8),
  (6, 'Kannário', 'pagodão', '{2,3,5}', 10),
  (7, 'Wesley Safadão', 'forró eletrônico', '{6,1,2}', 13),
  (8, 'Veigh', 'trap', '{4,7,9}', 15),
  (9, 'Ferrugem', 'pagode', '{5,2,10}', 17),
  (10, 'Jane Remover', 'shoegaze', '{11,10,12}', 20);
insert into public.idle_cup_cat_vaga (vaga, nivel) values (4, 12), (5, 20);
insert into public.idle_cup_cat_conflito (a, b) values
  ('cremoso', 'citrico'), ('herbal', 'doce'), ('energia', 'cremoso'), ('leve', 'forte'), ('salgado', 'doce');
insert into public.idle_cup_const (id, publico_base, cresce, elasticidade, galera_teto, pontos) values (1, 25, 1.25, 1.25, 3, '{0,40,75,105,133}');

-- os desafios da semana do copão (um por semana, sorteado pela moldura; pagos no idle_cup_depois da parte B)
delete from public.idle_cat_place_desafio where lugar = 4;
insert into public.idle_cat_place_desafio (id, lugar, tipo, valor, texto, premio, premio_valor) values
  (401, 4, 'cup_nota', 700, 'Copão com nota 700 ou mais', 'horas', 2),
  (402, 4, 'cup_sem_pt', 700, 'Copão nota 700+ e nenhuma noite de PT na semana', 'legado', 2),
  (403, 4, 'cup_galera', 1, 'Ganha galera numa noite', 'horas', 2),
  (404, 4, 'cup_sexta', 1, 'Abre o bar na sexta com o DJ que combina com 2 copões', 'investidor', 1),
  (405, 4, 'cup_cardapio', 600, 'Cardápio cheio com todas as notas 600 ou mais', 'legado', 3),
  (406, 4, 'cup_balde', 1, 'Bota um balde no cardápio', 'horas', 2),
  (407, 4, 'cup_sabor', 300, 'Copão com 300 ou mais de sabor', 'horas', 3),
  (408, 4, 'cup_moda', 150, 'Acerta o copão da moda em cheio', 'legado', 2),
  (409, 4, 'cup_noites', 5, 'Abre o bar 5 noites na semana', 'horas', 3),
  (410, 4, 'cup_aguenta', 199, 'Acerta a força no limite', 'investidor', 1),
  (411, 4, 'cup_fichas', 1, 'Fecha uma noite no lucro com o cardápio cheio', 'horas', 2),
  (412, 4, 'cup_nota', 850, 'Copão com nota 850 ou mais', 'legado', 3);

-- ===== o estado do bar (só pelas funções) =====
-- Os copões: tudo o que é determinístico sai na hora de pôr (rótulos, partes da nota, nota, chance de PT, com a moda da
-- semana em que entrou) e só aparece na tela a partir da primeira noite. primeira_noite = o início da primeira noite que
-- começa depois de entrar (às 18h em ponto conta a de agora); saiu_em = tirado do cardápio (null = está nele).
-- revelado, noites, vendido e fichas: a parte B (revelação no depois; noites no cardápio, copões vendidos e fichas no avancar).
create table if not exists public.idle_cup_copoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  nome text not null, base int not null, mistura int not null, extra int not null, tamanho int not null,
  forca int not null check (forca between 1 and 10), preco int not null, nivel int not null,
  nota int not null, sabor int not null, cb int not null, moda int not null, aguenta int not null,
  rot_bm int not null, rot_be int not null, rot_me int not null, chance_pt int not null,
  entrou_em timestamptz not null default now(), primeira_noite timestamptz not null, saiu_em timestamptz,
  revelado boolean not null default false, noites int not null default 0,
  vendido double precision not null default 0, fichas double precision not null default 0
);
create index if not exists idle_cup_copoes_user on public.idle_cup_copoes (user_id, entrou_em, id);
-- As noites do bar de cada pessoa (a parte B grava uma linha por noite, uma vez: a chave impede contar duas vezes).
-- aberta = a pessoa passou desde a noite anterior; dj = o escolhido quando a noite foi contada; vendas e fichas = o que a
-- noite já rendeu; fechada = o fim da noite já foi contado (galera, noites += 1), galera_delta = quanto a galera mudou;
-- vagas = as vagas do cardápio no início da noite (o "cardápio cheio" dos desafios); conferida = o idle_cup_depois já tratou
-- a noite fechada (conquista do PT e desafios: uma vez).
create table if not exists public.idle_cup_noites (
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  inicio timestamptz not null, aberta boolean not null, sexta boolean not null, dj int,
  vendas double precision not null default 0, fichas double precision not null default 0, pt boolean not null default false,
  galera_delta double precision not null default 0, fechada boolean not null default false,
  vagas int not null default 3, conferida boolean not null default false,
  primary key (user_id, inicio)
);
-- o que cada copão fez numa noite: total = o que ele venderia na noite inteira (fixado no início da noite), vendidos e
-- fichas = até agora (para em saiu_em), pt = deu PT nele
create table if not exists public.idle_cup_noite_copoes (
  user_id uuid not null, inicio timestamptz not null,
  copao bigint not null references public.idle_cup_copoes (id) on delete cascade,
  total double precision not null default 0, vendidos double precision not null default 0,
  fichas double precision not null default 0, pt boolean not null default false,
  primary key (user_id, inicio, copao),
  foreign key (user_id, inicio) references public.idle_cup_noites (user_id, inicio) on delete cascade
);
-- o DJ escolhido pra sexta (null = nenhum). As vagas não ficam aqui: saem do nível do lugar (idle_cup_vagas).
create table if not exists public.idle_cup_estado (
  user_id uuid primary key references public.idle_state (user_id) on delete cascade,
  dj int
);
alter table public.idle_cup_copoes enable row level security;
alter table public.idle_cup_noites enable row level security;
alter table public.idle_cup_noite_copoes enable row level security;
alter table public.idle_cup_estado enable row level security;
revoke all on public.idle_cup_copoes, public.idle_cup_noites, public.idle_cup_noite_copoes, public.idle_cup_estado from anon, authenticated;

-- ===== as contas (mesmos nomes de copao.ts em snake_case; paridade no teste) =====

-- o que o lugar libera no nível (tipo 'base', 'mistura', 'extra', 'tamanho' ou 'dj'); id que não existe: false
create or replace function public.idle_cup_liberado(p_tipo text, p_id int, p_nivel int)
returns boolean language sql stable set search_path = public as $$
  select coalesce(p_nivel >= case p_tipo
                                when 'base' then (select c.nivel from public.idle_cup_cat_base c where c.id = p_id)
                                when 'mistura' then (select c.nivel from public.idle_cup_cat_mistura c where c.id = p_id)
                                when 'extra' then (select c.nivel from public.idle_cup_cat_extra c where c.id = p_id)
                                when 'tamanho' then (select c.nivel from public.idle_cup_cat_tamanho c where c.id = p_id)
                                when 'dj' then (select c.nivel from public.idle_cup_cat_dj c where c.id = p_id)
                              end, false)
$$;

-- vagas no cardápio no nível: 3, mais as que já chegaram
create or replace function public.idle_cup_vagas(p_nivel int)
returns int language sql stable set search_path = public as $$
  select 3 + (select count(*)::int from public.idle_cup_cat_vaga v where v.nivel <= p_nivel)
$$;

-- dois ingredientes: 2 por sabor em comum, -2 por par em conflito e o empurrãozinho ((ia·31 + ib·17 + tipo·7) mod 3) − 1
-- (tipo 0 = base × mistura, 1 = base × extra, 2 = mistura × extra); rótulo 0 (péssima) a 4 (ótima)
create or replace function public.idle_cup_rotulo_par(p_a text[], p_b text[], p_ia int, p_ib int, p_tipo int)
returns int language sql stable set search_path = public as $$
  select case when x.s >= 3 then 4 when x.s = 2 then 3 when x.s >= 0 then 2 when x.s >= -2 then 1 else 0 end
    from (select 2 * (select count(*) from unnest(p_a) as a(v) where a.v = any (p_b))
               - 2 * (select count(*) from unnest(p_a) as a(v) cross join unnest(p_b) as b(v)
                       where exists (select 1 from public.idle_cup_cat_conflito k
                                      where (k.a = a.v and k.b = b.v) or (k.a = b.v and k.b = a.v)))
               + (((p_ia * 31 + p_ib * 17 + p_tipo * 7) % 3) - 1) as s) x
$$;

-- os três rótulos: {base × mistura, base × extra, mistura × extra}
create or replace function public.idle_cup_rotulos(p_base int, p_mistura int, p_extra int)
returns int[] language sql stable set search_path = public as $$
  select array[public.idle_cup_rotulo_par(b.sabores, m.sabores, b.id, m.id, 0),
               public.idle_cup_rotulo_par(b.sabores, e.sabores, b.id, e.id, 1),
               public.idle_cup_rotulo_par(m.sabores, e.sabores, m.id, e.id, 2)]
    from public.idle_cup_cat_base b, public.idle_cup_cat_mistura m, public.idle_cup_cat_extra e
   where b.id = p_base and m.id = p_mistura and e.id = p_extra
$$;

-- sabor (0–399): os pontos dos três rótulos
create or replace function public.idle_cup_sabor(p_base int, p_mistura int, p_extra int)
returns int language sql stable set search_path = public as $$
  select k.pontos[r[1] + 1] + k.pontos[r[2] + 1] + k.pontos[r[3] + 1]
    from public.idle_cup_const k, (select public.idle_cup_rotulos(p_base, p_mistura, p_extra) as r) x
$$;

-- preço de referência (fichas; decimal): ref do tamanho · (20 + força) / 20
create or replace function public.idle_cup_preco_ref(p_tamanho int, p_forca int)
returns double precision language sql stable set search_path = public as $$
  select (t.ref * (20 + p_forca))::double precision / 20 from public.idle_cup_cat_tamanho t where t.id = p_tamanho
$$;

-- preço válido: inteiro de ceil(0,5 · referência) a floor(2 · referência)
create or replace function public.idle_cup_preco_valido(p_tamanho int, p_forca int, p_preco int)
returns boolean language sql stable set search_path = public as $$
  select coalesce(p_preco >= ceil(0.5::double precision * x.r) and p_preco <= floor(2::double precision * x.r), false)
    from (select public.idle_cup_preco_ref(p_tamanho, p_forca) as r) x
$$;

-- custo-benefício (0–250) em inteiros, igual ao TS: D = ref · (20 + força), num = 4D − 40·preço, den = 3D;
-- 0 se num ≤ 0, 250 se num ≥ den, senão floor((500·num + den) / (2·den)) (num > 0: a divisão inteira já é o floor)
create or replace function public.idle_cup_custo_beneficio(p_tamanho int, p_forca int, p_preco int)
returns int language sql stable set search_path = public as $$
  select case when x.num <= 0 then 0 when x.num >= x.den then 250 else ((500 * x.num + x.den) / (2 * x.den))::int end
    from (select 4 * y.d - 40 * p_preco::bigint as num, 3 * y.d as den
            from (select t.ref::bigint * (20 + p_forca) as d from public.idle_cup_cat_tamanho t where t.id = p_tamanho) y) x
$$;

-- o copão da moda da semana (segunda de Brasília): a mesma base e a mesma mistura para todo mundo
create or replace function public.idle_cup_moda_base(p_semana date)
returns int language sql immutable set search_path = public as $$
  select 1 + public.idle_place_semana_idx(4, 1, 12, p_semana)
$$;
create or replace function public.idle_cup_moda_mistura(p_semana date)
returns int language sql immutable set search_path = public as $$
  select 1 + public.idle_place_semana_idx(4, 2, 15, p_semana)
$$;

-- moda (0–150): 75 pela base da moda, 75 pela mistura da moda
create or replace function public.idle_cup_moda(p_base int, p_mistura int, p_semana date)
returns int language sql immutable set search_path = public as $$
  select 75 * ((p_base = public.idle_cup_moda_base(p_semana))::int + (p_mistura = public.idle_cup_moda_mistura(p_semana))::int)
$$;

-- aguenta (0–199): 199 um acima do ponto da base, 170 no ponto, 140 um abaixo; mais longe cai 45 por ponto acima e 35 por
-- ponto abaixo; piso 0
create or replace function public.idle_cup_aguenta(p_forca int, p_ponto int)
returns int language sql immutable set search_path = public as $$
  select case when f = 1 then 199 when f = 0 then 170 when f = -1 then 140
              when f >= 2 then greatest(0, 170 - 45 * f) else greatest(0, 140 + 35 * (f + 1)) end
    from (select p_forca - p_ponto as f) x
$$;

-- chance de PT por noite, em %: (força − ponto) · 10 acima do ponto
create or replace function public.idle_cup_chance_pt(p_forca int, p_ponto int)
returns int language sql immutable set search_path = public as $$
  select greatest(0, p_forca - p_ponto) * 10
$$;

-- deu PT? sorte fixa por (copão, noite) (noite = idle_cup_noite_idx do início): reabrir dá o mesmo
create or replace function public.idle_cup_deu_pt(p_copao bigint, p_noite int, p_chance int)
returns boolean language sql immutable set search_path = public as $$
  select (p_copao * 7919 + p_noite::bigint * 104729 + 4) % 100 < p_chance
$$;

-- a nota e as partes, como avaliar() do TS: {rot_bm, rot_be, rot_me, sabor, custo-benefício, moda, aguenta, nota, chance de PT}
-- (semana = a segunda da semana em que o copão entrou)
create or replace function public.idle_cup_avaliar(p_base int, p_mistura int, p_extra int, p_tamanho int, p_forca int,
                                                   p_preco int, p_semana date)
returns int[] language plpgsql stable set search_path = public as $$
declare
  v_rot   int[] := public.idle_cup_rotulos(p_base, p_mistura, p_extra);
  v_ponto int := (select b.ponto from public.idle_cup_cat_base b where b.id = p_base);
  v_sabor int := public.idle_cup_sabor(p_base, p_mistura, p_extra);
  v_cb    int := public.idle_cup_custo_beneficio(p_tamanho, p_forca, p_preco);
  v_moda  int := public.idle_cup_moda(p_base, p_mistura, p_semana);
  v_ag    int := public.idle_cup_aguenta(p_forca, v_ponto);
begin
  return array[v_rot[1], v_rot[2], v_rot[3], v_sabor, v_cb, v_moda, v_ag, v_sabor + v_cb + v_moda + v_ag,
               public.idle_cup_chance_pt(p_forca, v_ponto)];
end;
$$;

-- ===== as noites: o bar abre das 18h às 2h de Brasília (UTC−3 fixo), todo dia; a noite 0 é 2026-01-05 21h UTC =====

-- início da noite do dia (18h de Brasília = 21h UTC)
create or replace function public.idle_cup_inicio_noite(p_dia date)
returns timestamptz language sql immutable set search_path = public as $$
  select (p_dia::timestamp + interval '21 hours') at time zone 'UTC'
$$;

-- número da noite: dias desde a noite 0 (a sorte do PT)
create or replace function public.idle_cup_noite_idx(p_inicio timestamptz)
returns int language sql immutable set search_path = public as $$
  select floor((extract(epoch from p_inicio) - extract(epoch from timestamptz '2026-01-05 21:00:00+00')) / 86400)::int
$$;

-- o início da primeira noite que começa em p_t ou depois
create or replace function public.idle_cup_proxima_noite(p_t timestamptz)
returns timestamptz language sql immutable set search_path = public as $$
  select timestamptz '2026-01-05 21:00:00+00'
       + ceil((extract(epoch from p_t) - extract(epoch from timestamptz '2026-01-05 21:00:00+00')) / 86400)::double precision
         * interval '24 hours'
$$;

-- a noite em andamento em p_t, ou a próxima (a "de hoje" da tela)
create or replace function public.idle_cup_noite_de(p_t timestamptz)
returns timestamptz language sql immutable set search_path = public as $$
  select case when p_t < x.ini + interval '8 hours' then x.ini else x.ini + interval '24 hours' end
    from (select timestamptz '2026-01-05 21:00:00+00'
               + floor((extract(epoch from p_t) - extract(epoch from timestamptz '2026-01-05 21:00:00+00')) / 86400)::double precision
                 * interval '24 hours' as ini) x
$$;

-- os inícios das noites em [p_a, p_b), em ordem
create or replace function public.idle_cup_noites_entre(p_a timestamptz, p_b timestamptz)
returns setof timestamptz language sql immutable set search_path = public as $$
  select g from generate_series(public.idle_cup_proxima_noite(p_a), p_b, interval '24 hours') g where g < p_b order by g
$$;

-- a noite abre se a pessoa passou pelo jogo desde 24 h antes do início (null = nunca passou: não abre)
create or replace function public.idle_cup_abre_noite(p_inicio timestamptz, p_visto timestamptz)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_visto >= p_inicio - interval '24 hours', false)
$$;

-- a noite que começa na sexta 18h de Brasília
create or replace function public.idle_cup_eh_sexta(p_inicio timestamptz)
returns boolean language sql immutable set search_path = public as $$
  select extract(dow from (p_inicio at time zone 'UTC') - interval '3 hours') = 5
$$;

-- quanto do total da noite já vendeu em p_t: linear nas 8 h, preso nas pontas (em ms, como o TS)
create or replace function public.idle_cup_vendido_noite(p_total double precision, p_inicio timestamptz, p_t timestamptz)
returns double precision language sql immutable set search_path = public as $$
  select p_total
       * least(greatest((extract(epoch from p_t) - extract(epoch from p_inicio)) * 1000, 0), 28800000)::double precision
       / 28800000::double precision
$$;

-- ===== movimento, vendas, lucro e galera =====

-- quanta gente passa pelo bar numa noite no nível (sem a galera)
create or replace function public.idle_cup_publico(p_nivel int)
returns double precision language sql stable set search_path = public as $$
  select k.publico_base * power(k.cresce, (p_nivel - 1)::double precision) from public.idle_cup_const k
$$;

-- o movimento da noite: público × (1 + min(√galera/30, GALERA_TETO))
create or replace function public.idle_cup_movimento(p_nivel int, p_galera double precision)
returns double precision language sql stable set search_path = public as $$
  select public.idle_cup_publico(p_nivel) * (1 + least(sqrt(p_galera) / 30, k.galera_teto)) from public.idle_cup_const k
$$;

-- a novidade cai 10% por noite no cardápio, até 30%
create or replace function public.idle_cup_novidade(p_noites int)
returns double precision language sql immutable set search_path = public as $$
  select greatest(0.3::double precision, 1::double precision - 0.1::double precision * p_noites)
$$;

-- quantos copões cada um do cardápio vende na noite inteira (na ordem dos arrays), como vendasNoite do TS e na mesma ordem
-- das contas: ((mov · atr_i) / Σatr) · participação · (ref_i / preço_i)^ELASTICIDADE · (sexta ? 2 : 1) · (curte ? 1,2 : 1),
-- com atr = (nota/999)² · novidade · canibal (0,7 se outro tem a mesma base e mistura) e participação = min(1, Σatr).
-- O DJ só conta na sexta. Σatr = 0: tudo 0.
create or replace function public.idle_cup_vendas_noite(p_bases int[], p_misturas int[], p_tamanhos int[], p_forcas int[],
                                                        p_precos int[], p_notas int[], p_noites int[], p_nivel int,
                                                        p_galera double precision, p_sexta boolean, p_dj int)
returns double precision[] language plpgsql stable set search_path = public as $$
declare
  v_n      int := coalesce(cardinality(p_bases), 0);
  v_atr    double precision[] := '{}';
  v_soma   double precision := 0;
  v_can    double precision;
  v_mov    double precision;
  v_part   double precision;
  v_curte  int[];
  v_elast  double precision := (select k.elasticidade from public.idle_cup_const k);
  v_out    double precision[] := '{}';
begin
  for i in 1..v_n loop
    v_can := 1;
    for j in 1..v_n loop
      if j <> i and p_bases[j] = p_bases[i] and p_misturas[j] = p_misturas[i] then
        v_can := 0.7;
      end if;
    end loop;
    v_atr := v_atr || (power(p_notas[i]::double precision / 999, 2::double precision) * public.idle_cup_novidade(p_noites[i]) * v_can);
    v_soma := v_soma + v_atr[i];
  end loop;
  if v_soma <= 0 then
    for i in 1..v_n loop
      v_out := v_out || 0::double precision;
    end loop;
    return v_out;
  end if;
  v_mov := public.idle_cup_movimento(p_nivel, p_galera);
  v_part := least(1::double precision, v_soma);
  if p_sexta and p_dj is not null then
    v_curte := (select d.bases from public.idle_cup_cat_dj d where d.id = p_dj);
  end if;
  for i in 1..v_n loop
    v_out := v_out || (((v_mov * v_atr[i]) / v_soma) * v_part
                       * power(public.idle_cup_preco_ref(p_tamanhos[i], p_forcas[i]) / p_precos[i], v_elast)
                       * case when p_sexta then 2 else 1 end::double precision
                       * case when p_bases[i] = any (coalesce(v_curte, '{}')) then 1.2 else 1 end::double precision);
  end loop;
  return v_out;
end;
$$;

-- lucro de cada venda (fichas): preço − doses · custo da base · (0,5 + força/10); pode ser negativo
create or replace function public.idle_cup_lucro_venda(p_base int, p_tamanho int, p_forca int, p_preco int)
returns double precision language sql stable set search_path = public as $$
  select p_preco - t.doses * b.custo * (0.5::double precision + p_forca::double precision / 10)
    from public.idle_cup_cat_base b, public.idle_cup_cat_tamanho t where b.id = p_base and t.id = p_tamanho
$$;

-- a galera no fim de uma noite aberta, como galeraNoite do TS: com a média das notas do cardápio ≥ 600 soma
-- round(público · 0,02 · média/999), abaixo de 300 perde 5%; depois −15% se deu PT (uma vez por noite); piso 0
create or replace function public.idle_cup_galera_noite(p_galera double precision, p_nivel int, p_notas int[], p_pt boolean)
returns double precision language plpgsql stable set search_path = public as $$
declare
  g       double precision := p_galera;
  v_media double precision;
begin
  if coalesce(cardinality(p_notas), 0) > 0 then
    v_media := (select sum(x)::double precision from unnest(p_notas) x) / cardinality(p_notas);
    if v_media >= 600 then
      g := g + floor(public.idle_cup_publico(p_nivel) * 0.02::double precision * (v_media / 999) + 0.5::double precision);
    elsif v_media < 300 then
      g := g * 0.95::double precision;
    end if;
  end if;
  if p_pt then
    g := g * 0.85::double precision;
  end if;
  return greatest(0::double precision, g);
end;
$$;

-- ===== pôr, tirar, DJ =====

-- Põe um copão no cardápio (de graça). Calcula agora a nota e as partes (com a moda desta semana) e grava; a tela só mostra
-- a partir da primeira noite dele. Repetido = mesma base, mistura, extra e tamanho de um que está no cardápio.
create or replace function public.idle_cup_por(p_base int, p_mistura int, p_extra int, p_tamanho int, p_forca int,
                                               p_preco int, p_nome text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  st     public.idle_place_state;
  v_nome text;
  v_id   bigint;
  v_av   int[];
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
  if p_preco is null or not public.idle_cup_preco_valido(p_tamanho, p_forca, p_preco) then
    raise exception 'idle_cup_preco' using errcode = 'P0001';
  end if;
  v_nome := public.idle_place_nome(p_nome);
  if (select count(*) from public.idle_cup_copoes c where c.user_id = s.user_id and c.saiu_em is null)
     >= public.idle_cup_vagas(st.nivel) then
    raise exception 'idle_cup_vaga' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.idle_cup_copoes c
              where c.user_id = s.user_id and c.saiu_em is null and c.base = p_base and c.mistura = p_mistura
                and c.extra = p_extra and c.tamanho = p_tamanho) then
    raise exception 'idle_cup_repetido' using errcode = 'P0001';
  end if;

  v_id := nextval(pg_get_serial_sequence('public.idle_cup_copoes', 'id'));
  v_av := public.idle_cup_avaliar(p_base, p_mistura, p_extra, p_tamanho, p_forca, p_preco, public.games_week_start());
  insert into public.idle_cup_copoes (id, user_id, nome, base, mistura, extra, tamanho, forca, preco, nivel, nota, sabor, cb, moda,
                                      aguenta, rot_bm, rot_be, rot_me, chance_pt, entrou_em, primeira_noite)
  overriding system value
  values (v_id, s.user_id, v_nome, p_base, p_mistura, p_extra, p_tamanho, p_forca, p_preco, st.nivel, v_av[8], v_av[4], v_av[5],
          v_av[6], v_av[7], v_av[1], v_av[2], v_av[3], v_av[9], now(), public.idle_cup_proxima_noite(now()));
  return public.idle_place_responder(s, 4);
end;
$$;

-- Tira um copão do cardápio (de graça). A venda até agora já foi contada (o idle_lock andou o bar antes); daqui pra frente
-- ele não vende mais.
create or replace function public.idle_cup_tirar(p_copao bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  perform 1 from public.idle_place_state where user_id = s.user_id and lugar = 4 for update;
  if not found then
    raise exception 'idle_lugar_fechado' using errcode = 'P0001';
  end if;
  update public.idle_cup_copoes set saiu_em = now() where id = p_copao and user_id = s.user_id and saiu_em is null;
  if not found then
    raise exception 'idle_cup_sem_copao' using errcode = 'P0001';
  end if;
  return public.idle_place_responder(s, 4);
end;
$$;

-- Escolhe o DJ da sexta (null = nenhum). Vale para a noite que a parte B contar depois da escolha.
create or replace function public.idle_cup_dj(p_dj int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s  public.idle_state;
  st public.idle_place_state;
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
  if p_dj is not null then
    if not exists (select 1 from public.idle_cup_cat_dj where id = p_dj) then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if not public.idle_cup_liberado('dj', p_dj, st.nivel) then
      raise exception 'idle_cup_trancado' using errcode = 'P0001';
    end if;
  end if;
  insert into public.idle_cup_estado (user_id, dj) values (s.user_id, p_dj)
  on conflict (user_id) do update set dj = excluded.dj;
  return public.idle_place_responder(s, 4);
end;
$$;

-- ===== o JSON da tela (troca o stub da 0057; estável: só lê) =====

-- um copão do cardápio: nota, partes, rótulos e chance de PT só quando p_revelado (a primeira noite dele começou)
create or replace function public.idle_cup_copao_json(c public.idle_cup_copoes, p_revelado boolean)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'nome', c.nome, 'base', c.base, 'mistura', c.mistura, 'extra', c.extra, 'tamanho', c.tamanho,
    'forca', c.forca, 'preco', c.preco, 'nivel', c.nivel, 'entrou_em', c.entrou_em, 'primeira_noite', c.primeira_noite,
    'saiu_em', c.saiu_em, 'revelado', p_revelado, 'noites', c.noites, 'vendido', c.vendido, 'fichas', c.fichas,
    'nota', case when p_revelado then c.nota end,
    'sabor', case when p_revelado then c.sabor end,
    'cb', case when p_revelado then c.cb end,
    'moda', case when p_revelado then c.moda end,
    'aguenta', case when p_revelado then c.aguenta end,
    'rotulos', case when p_revelado then jsonb_build_array(c.rot_bm, c.rot_be, c.rot_me) end,
    'chance_pt', case when p_revelado then c.chance_pt end)
$$;

-- moda = o copão da moda desta semana; dj = o escolhido; vagas = as do nível; cardapio = os copões no cardápio (na ordem em
-- que entraram); hoje = a noite em andamento ou a próxima (aberta: a linha da noite diz; a que ainda não começou abre, a
-- pessoa está aqui; a parte B grava a linha assim que a noite passa do início, então às 18h em ponto ainda vale "abre";
-- vendido/fichas até agora = o que a parte B já contou); ultima_noite = a última noite aberta que fechou,
-- com o que cada copão fez e a semente do chat (o número da noite): a tela mostra o que aconteceu com a pessoa longe;
-- historico = os últimos 10 revelados (mesmo os que já saíram). Lugar fechado: null.
create or replace function public.idle_cup_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'moda', jsonb_build_object('base', public.idle_cup_moda_base(public.games_week_start()),
                               'mistura', public.idle_cup_moda_mistura(public.games_week_start())),
    'dj', (select e.dj from public.idle_cup_estado e where e.user_id = s.user_id),
    'vagas', public.idle_cup_vagas(st.nivel),
    'cardapio', coalesce((select jsonb_agg(public.idle_cup_copao_json(c, now() >= c.primeira_noite) order by c.entrou_em, c.id)
                            from public.idle_cup_copoes c where c.user_id = s.user_id and c.saiu_em is null), '[]'::jsonb),
    'hoje', (select jsonb_build_object('inicio', h.ini, 'fim', h.ini + interval '8 hours', 'sexta', public.idle_cup_eh_sexta(h.ini),
                                       'aberta', coalesce(n.aberta, now() <= h.ini), 'dj', n.dj,
                                       'vendido_ate_agora', coalesce(n.vendas, 0), 'fichas_ate_agora', coalesce(n.fichas, 0))
               from (select public.idle_cup_noite_de(now()) as ini) h
               left join public.idle_cup_noites n on n.user_id = s.user_id and n.inicio = h.ini),
    'ultima_noite', (select jsonb_build_object(
                         'inicio', n.inicio, 'fim', n.inicio + interval '8 hours', 'sexta', n.sexta, 'dj', n.dj,
                         'vendas', n.vendas, 'fichas', n.fichas, 'pt', n.pt, 'galera_delta', n.galera_delta,
                         'chat_seed', public.idle_cup_noite_idx(n.inicio),
                         'copoes', coalesce((select jsonb_agg(jsonb_build_object(
                                                 'id', c.id, 'nome', c.nome, 'base', c.base, 'mistura', c.mistura, 'extra', c.extra,
                                                 'tamanho', c.tamanho, 'forca', c.forca, 'preco', c.preco, 'nota', c.nota,
                                                 'vendidos', x.vendidos, 'fichas', x.fichas, 'pt', x.pt)
                                               order by c.entrou_em, c.id)
                                              from public.idle_cup_noite_copoes x join public.idle_cup_copoes c on c.id = x.copao
                                             where x.user_id = n.user_id and x.inicio = n.inicio), '[]'::jsonb))
                       from public.idle_cup_noites n
                      where n.user_id = s.user_id and n.aberta and n.fechada
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
                                    order by c.primeira_noite desc, c.id desc limit 10) h), '[]'::jsonb))
  from public.idle_place_state st
  where st.user_id = s.user_id and st.lugar = 4
$$;

revoke all on function public.idle_cup_liberado(text, int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_vagas(int) from public, anon, authenticated;
revoke all on function public.idle_cup_rotulo_par(text[], text[], int, int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_rotulos(int, int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_sabor(int, int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_preco_ref(int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_preco_valido(int, int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_custo_beneficio(int, int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_moda_base(date) from public, anon, authenticated;
revoke all on function public.idle_cup_moda_mistura(date) from public, anon, authenticated;
revoke all on function public.idle_cup_moda(int, int, date) from public, anon, authenticated;
revoke all on function public.idle_cup_aguenta(int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_chance_pt(int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_deu_pt(bigint, int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_avaliar(int, int, int, int, int, int, date) from public, anon, authenticated;
revoke all on function public.idle_cup_inicio_noite(date) from public, anon, authenticated;
revoke all on function public.idle_cup_noite_idx(timestamptz) from public, anon, authenticated;
revoke all on function public.idle_cup_proxima_noite(timestamptz) from public, anon, authenticated;
revoke all on function public.idle_cup_noite_de(timestamptz) from public, anon, authenticated;
revoke all on function public.idle_cup_noites_entre(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_cup_abre_noite(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_cup_eh_sexta(timestamptz) from public, anon, authenticated;
revoke all on function public.idle_cup_vendido_noite(double precision, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_cup_publico(int) from public, anon, authenticated;
revoke all on function public.idle_cup_movimento(int, double precision) from public, anon, authenticated;
revoke all on function public.idle_cup_novidade(int) from public, anon, authenticated;
revoke all on function public.idle_cup_vendas_noite(int[], int[], int[], int[], int[], int[], int[], int, double precision, boolean, int)
  from public, anon, authenticated;
revoke all on function public.idle_cup_lucro_venda(int, int, int, int) from public, anon, authenticated;
revoke all on function public.idle_cup_galera_noite(double precision, int, int[], boolean) from public, anon, authenticated;
revoke all on function public.idle_cup_copao_json(public.idle_cup_copoes, boolean) from public, anon, authenticated;
revoke all on function public.idle_cup_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_cup_por(int, int, int, int, int, int, text) from public, anon;
grant execute on function public.idle_cup_por(int, int, int, int, int, int, text) to authenticated;
revoke all on function public.idle_cup_tirar(bigint) from public, anon;
grant execute on function public.idle_cup_tirar(bigint) to authenticated;
revoke all on function public.idle_cup_dj(int) from public, anon;
grant execute on function public.idle_cup_dj(int) to authenticated;

-- ===== parte B: as noites do bar (no idle_lock) e a revelação, o caderninho, as conquistas e os desafios (depois) =====

-- Abre a linha da noite (uma vez: a chave impede contar duas vezes). aberta = o visto_em de antes da visita (o do s que o
-- idle_lock passa). O cardápio da noite é o do início dela: copões que estrearam até o início e não saíram antes dele. O
-- total de cada um (o que ele venderia na noite inteira, igual a vendasNoite do TS) sai agora com o nível, a galera e o DJ
-- de agora, que são os do início: toda RPC trava e anda o bar antes de mudar qualquer um deles, e as noites são abertas e
-- fechadas em ordem (a galera e as noites no cardápio da noite anterior já entraram). O PT de cada copão é sorteado agora
-- pela semente (copão, noite): recarregar dá o mesmo. Noite que ninguém abriu: só a linha.
create or replace function public.idle_cup_noite_abrir(p_user uuid, p_inicio timestamptz, p_aberta boolean)
returns void language plpgsql volatile set search_path = public as $$
declare
  st       public.idle_place_state;
  v_dj     int := (select e.dj from public.idle_cup_estado e where e.user_id = p_user);
  v_sexta  boolean := public.idle_cup_eh_sexta(p_inicio);
  v_ids    bigint[];
  v_bases  int[];
  v_mist   int[];
  v_tams   int[];
  v_forcas int[];
  v_precos int[];
  v_notas  int[];
  v_noites int[];
  v_chance int[];
  v_tot    double precision[];
begin
  select * into st from public.idle_place_state where user_id = p_user and lugar = 4;
  insert into public.idle_cup_noites (user_id, inicio, aberta, sexta, dj, vagas)
  values (p_user, p_inicio, p_aberta, v_sexta, v_dj, public.idle_cup_vagas(st.nivel))
  on conflict do nothing;
  if not found or not p_aberta then
    return;
  end if;
  select array_agg(c.id order by c.entrou_em, c.id), array_agg(c.base order by c.entrou_em, c.id),
         array_agg(c.mistura order by c.entrou_em, c.id), array_agg(c.tamanho order by c.entrou_em, c.id),
         array_agg(c.forca order by c.entrou_em, c.id), array_agg(c.preco order by c.entrou_em, c.id),
         array_agg(c.nota order by c.entrou_em, c.id), array_agg(c.noites order by c.entrou_em, c.id),
         array_agg(c.chance_pt order by c.entrou_em, c.id)
    into v_ids, v_bases, v_mist, v_tams, v_forcas, v_precos, v_notas, v_noites, v_chance
    from public.idle_cup_copoes c
   where c.user_id = p_user and c.primeira_noite <= p_inicio and (c.saiu_em is null or c.saiu_em > p_inicio);
  if v_ids is null then
    return;
  end if;
  v_tot := public.idle_cup_vendas_noite(v_bases, v_mist, v_tams, v_forcas, v_precos, v_notas, v_noites, st.nivel, st.fas, v_sexta, v_dj);
  insert into public.idle_cup_noite_copoes (user_id, inicio, copao, total, pt)
  select p_user, p_inicio, v_ids[i], v_tot[i], public.idle_cup_deu_pt(v_ids[i], public.idle_cup_noite_idx(p_inicio), v_chance[i])
    from generate_subscripts(v_ids, 1) i;
end;
$$;

-- Anda uma noite até agora: cada copão do cardápio dela vendeu o proporcional do total até min(agora, fim, saiu_em)
-- (vendidoNaNoite do TS); as fichas (vendidos × lucro de cada venda; pode ser negativo) entram na moeda do lugar, pela
-- diferença do que já tinha entrado. No fim da noite, uma vez (fechada): a galera (galeraNoite do TS com as notas do
-- cardápio; −15% uma vez só, por mais copões em PT) e noites += 1 de cada copão do cardápio. Noite que ninguém abriu: só
-- fecha. Nada de marcos, conquistas, pódio, caderninho ou desafio aqui (isso é do idle_cup_depois).
create or replace function public.idle_cup_noite_andar(p_user uuid, p_inicio timestamptz)
returns void language plpgsql volatile set search_path = public as $$
declare
  n       public.idle_cup_noites;
  x       record;
  v_v     double precision;
  v_f     double precision;
  v_dv    double precision := 0;
  v_df    double precision := 0;
  v_notas int[];
  v_pt    boolean := false;
  v_antes double precision;
  v_g     double precision;
begin
  select * into n from public.idle_cup_noites where user_id = p_user and inicio = p_inicio for update;
  if not found or n.fechada then
    return;
  end if;
  if n.aberta then
    for x in select k.copao, k.total, k.vendidos, k.fichas, c.saiu_em,
                    public.idle_cup_lucro_venda(c.base, c.tamanho, c.forca, c.preco) as lucro
               from public.idle_cup_noite_copoes k join public.idle_cup_copoes c on c.id = k.copao
              where k.user_id = p_user and k.inicio = p_inicio
              order by c.entrou_em, c.id loop
      v_v := public.idle_cup_vendido_noite(x.total, p_inicio, least(now(), coalesce(x.saiu_em, now())));
      v_f := v_v * x.lucro;
      if v_v <> x.vendidos or v_f <> x.fichas then
        update public.idle_cup_noite_copoes set vendidos = v_v, fichas = v_f
         where user_id = p_user and inicio = p_inicio and copao = x.copao;
        update public.idle_cup_copoes set vendido = vendido + (v_v - x.vendidos), fichas = fichas + (v_f - x.fichas)
         where id = x.copao;
        v_dv := v_dv + (v_v - x.vendidos);
        v_df := v_df + (v_f - x.fichas);
      end if;
    end loop;
    if v_dv <> 0 or v_df <> 0 then
      update public.idle_cup_noites set vendas = vendas + v_dv, fichas = fichas + v_df where user_id = p_user and inicio = p_inicio;
      update public.idle_place_state set moeda = moeda + v_df where user_id = p_user and lugar = 4;
    end if;
  end if;
  if now() < p_inicio + interval '8 hours' then
    return;
  end if;
  if n.aberta then
    select coalesce(array_agg(c.nota order by c.entrou_em, c.id), '{}'), coalesce(bool_or(k.pt), false)
      into v_notas, v_pt
      from public.idle_cup_noite_copoes k join public.idle_cup_copoes c on c.id = k.copao
     where k.user_id = p_user and k.inicio = p_inicio;
    select st.fas, public.idle_cup_galera_noite(st.fas, st.nivel, v_notas, v_pt) into v_antes, v_g
      from public.idle_place_state st where st.user_id = p_user and st.lugar = 4 for update;
    update public.idle_place_state set fas = v_g where user_id = p_user and lugar = 4;
    update public.idle_cup_copoes c set noites = c.noites + 1
      from public.idle_cup_noite_copoes k
     where k.user_id = p_user and k.inicio = p_inicio and c.id = k.copao;
    update public.idle_cup_noites set fechada = true, pt = v_pt, galera_delta = v_g - v_antes
     where user_id = p_user and inicio = p_inicio;
  else
    update public.idle_cup_noites set fechada = true where user_id = p_user and inicio = p_inicio;
  end if;
end;
$$;

-- O bar anda até agora (dentro do idle_lock, antes de fechar a conta; s.visto_em = a visita de antes desta). Primeiro a
-- noite que ficou em andamento na última vez; depois cada noite que começou desde a última contada (a primeira: a do
-- momento em que o lugar abriu), em ordem: abre (aberta = a pessoa passou desde 24 h antes do início) e anda. Só a
-- primeira noite depois da última visita abre; as seguintes ficam fechadas e não ganham linha, menos a última que
-- começou, que sempre ganha (o JSON lê dela a noite de hoje). A noite começa depois do início (às 18h em ponto ainda
-- não: o copão posto nessa hora estreia nela). Mexe só na moeda, na galera e nos contadores das noites e dos copões.
create or replace function public.idle_cup_avancar(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
declare
  st       public.idle_place_state;
  v_ini    timestamptz;
  v_desde  timestamptz;
  v_aberta boolean;
begin
  select * into st from public.idle_place_state where user_id = s.user_id and lugar = 4 for update;
  if not found then
    return;
  end if;
  for v_ini in select n.inicio from public.idle_cup_noites n where n.user_id = s.user_id and not n.fechada order by n.inicio loop
    perform public.idle_cup_noite_andar(s.user_id, v_ini);
  end loop;
  v_desde := coalesce((select max(n.inicio) from public.idle_cup_noites n where n.user_id = s.user_id) + interval '24 hours',
                      public.idle_cup_noite_de(st.aberto_em));
  for v_ini in select g from generate_series(v_desde, now(), interval '24 hours') g where g < now() order by g loop
    v_aberta := public.idle_cup_abre_noite(v_ini, s.visto_em);
    if v_aberta or v_ini + interval '24 hours' >= now() then
      perform public.idle_cup_noite_abrir(s.user_id, v_ini, v_aberta);
      perform public.idle_cup_noite_andar(s.user_id, v_ini);
    end if;
  end loop;
end;
$$;

-- Depois da conta fechada e salva, na ordem em que aconteceu (uma marca por linha: rodar de novo não paga de novo):
-- * copão que estreou (primeira_noite ≤ agora; não conta o que saiu antes de estrear): revelado; pódio e placar com a hora
--   da estreia; caderninho (os 3 pares com o rótulo e o "aguenta" da base na força); volume + 1; lendário com nota 900+;
--   conquista da nota; desafios da nota, do sabor, da moda e do "aguenta";
-- * noite aberta que fechou: conferida; conquista do PT; desafios da galera ganha, do cardápio cheio (a menor nota), do
--   lucro com cardápio cheio e do copão 700+ sem PT na semana (a maior nota do cardápio, se nenhuma noite da semana deu PT
--   até ela);
-- * e o que vale assim que acontece, nesta semana (segunda 0h de Brasília): o balde posto no cardápio, as noites que o
--   bar abriu com copão no cardápio e a sexta que abriu com o DJ que combina com 2 copões do cardápio dela (sem esperar a
--   noite acabar: a de domingo acaba na semana seguinte).
-- Devolve o s (o prêmio do desafio mexe no valuation; quem chama salva).
create or replace function public.idle_cup_depois(s public.idle_state)
returns public.idle_state language plpgsql volatile set search_path = public as $$
declare
  e         record;
  c         public.idle_cup_copoes;
  n         public.idle_cup_noites;
  v_semana  timestamptz := public.games_week_start()::timestamp at time zone 'America/Sao_Paulo';
  v_qtd     int;
  v_menor   int;
  v_maior   int;
  v_combina int;
  v_cheio   boolean;
  v_noites  int;
  v_pt_sem  boolean;
begin
  for e in select x.quando, x.copao, x.inicio
             from (select k.primeira_noite as quando, k.id as copao, null::timestamptz as inicio
                     from public.idle_cup_copoes k
                    where k.user_id = s.user_id and not k.revelado and k.primeira_noite <= now()
                      and (k.saiu_em is null or k.saiu_em > k.primeira_noite)
                   union all
                   select m.inicio + interval '8 hours', null::bigint, m.inicio
                     from public.idle_cup_noites m
                    where m.user_id = s.user_id and m.aberta and m.fechada and not m.conferida) x
            order by x.quando, x.inicio nulls first, x.copao loop
    if e.copao is not null then
      update public.idle_cup_copoes set revelado = true where id = e.copao and not revelado returning * into c;
      continue when not found;
      perform public.idle_place_registrar(s.user_id, 4, c.nome, array[c.base, c.mistura, c.extra, c.tamanho, c.forca], c.nota,
                                          c.primeira_noite, 0);
      perform public.idle_place_nota(s.user_id, 4, 'par', c.base * 100 + c.mistura, 0, c.rot_bm);
      perform public.idle_place_nota(s.user_id, 4, 'par', 10000 + c.base * 100 + c.extra, 0, c.rot_be);
      perform public.idle_place_nota(s.user_id, 4, 'par', 20000 + c.mistura * 100 + c.extra, 0, c.rot_me);
      perform public.idle_place_nota(s.user_id, 4, 'aguenta', c.base, c.forca, c.aguenta);
      update public.idle_place_state set volume = volume + 1, lendario = lendario or c.nota >= 900
       where user_id = s.user_id and lugar = 4;
      perform public.idle_ganhar(s.user_id, 'cup_nota', c.nota);
      s := public.idle_place_desafio(s, 4, 'cup_nota', c.nota);
      s := public.idle_place_desafio(s, 4, 'cup_sabor', c.sabor);
      s := public.idle_place_desafio(s, 4, 'cup_moda', c.moda);
      s := public.idle_place_desafio(s, 4, 'cup_aguenta', c.aguenta);
    else
      update public.idle_cup_noites set conferida = true
       where user_id = s.user_id and inicio = e.inicio and not conferida returning * into n;
      continue when not found;
      select count(*)::int, min(k2.nota), max(k2.nota) into v_qtd, v_menor, v_maior
        from public.idle_cup_noite_copoes k join public.idle_cup_copoes k2 on k2.id = k.copao
       where k.user_id = s.user_id and k.inicio = n.inicio;
      v_cheio := v_qtd > 0 and v_qtd >= n.vagas;
      v_pt_sem := n.pt or exists (select 1 from public.idle_cup_noites m
                                   where m.user_id = s.user_id and m.aberta and m.fechada and m.pt
                                     and m.inicio >= v_semana and m.inicio <= n.inicio);
      if n.pt then
        perform public.idle_ganhar(s.user_id, 'cup_pt');
      end if;
      s := public.idle_place_desafio(s, 4, 'cup_galera', case when n.galera_delta > 0 then 1 else 0 end);
      s := public.idle_place_desafio(s, 4, 'cup_cardapio', case when v_cheio then v_menor end);
      s := public.idle_place_desafio(s, 4, 'cup_fichas', case when v_cheio and n.fichas > 0 then 1 else 0 end);
      s := public.idle_place_desafio(s, 4, 'cup_sem_pt', case when not v_pt_sem then v_maior end);
    end if;
  end loop;
  s := public.idle_place_desafio(s, 4, 'cup_balde',
         case when exists (select 1 from public.idle_cup_copoes k
                            where k.user_id = s.user_id and k.tamanho = 3 and k.entrou_em >= v_semana) then 1 else 0 end);
  -- as noites que já começaram nesta semana (a linha só existe depois do início)
  select count(*)::int into v_noites from public.idle_cup_noites m
   where m.user_id = s.user_id and m.aberta and m.inicio >= v_semana
     and exists (select 1 from public.idle_cup_noite_copoes k where k.user_id = m.user_id and k.inicio = m.inicio);
  s := public.idle_place_desafio(s, 4, 'cup_noites', v_noites);
  select coalesce(max(x.q), 0) into v_combina
    from (select count(*) as q
            from public.idle_cup_noites m
            join public.idle_cup_cat_dj d on d.id = m.dj
            join public.idle_cup_noite_copoes k on k.user_id = m.user_id and k.inicio = m.inicio
            join public.idle_cup_copoes k2 on k2.id = k.copao
           where m.user_id = s.user_id and m.aberta and m.sexta and m.inicio >= v_semana and k2.base = any (d.bases)
           group by m.inicio) x;
  s := public.idle_place_desafio(s, 4, 'cup_sexta', case when v_combina >= 2 then 1 else 0 end);
  return s;
end;
$$;

revoke all on function public.idle_cup_noite_abrir(uuid, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.idle_cup_noite_andar(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_cup_avancar(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_cup_depois(public.idle_state) from public, anon, authenticated;
