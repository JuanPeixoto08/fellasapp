-- fellasapp: Fellas Inc., Mapa do rolê, a camisetaria (lugar 3; spec 2026-10-12-fellas-inc-mapa-do-role-design.md §4).
-- Parte A: o catálogo escondido, as coleções, as contas (espelho de games/idle/camisetaria.ts, com teste de paridade em
-- games/test/idleCamisetaria.test.ts), lançar uma coleção e o JSON da tela. A parte B troca idle_tee_avancar e
-- idle_tee_depois (venda, revelação, caderninho, desafios) e traz encerrar e o relatório.
-- Depende da 0057 (a moldura: idle_place_*, os stubs idle_tee_* e o contrato das partes 2 a 4).

-- ===== catálogo (igual a games/idle/camisetaria.ts; escondido de quem joga: a tela usa o TS) =====
create table if not exists public.idle_tee_cat_tema (id int primary key, nome text not null, vibes text[] not null, nivel int not null);
create table if not exists public.idle_tee_cat_estilo (
  id int primary key, nome text not null, vibes text[] not null, foco int[] not null, nivel int not null
);
create table if not exists public.idle_tee_cat_peca (
  id int primary key, nome text not null, custo double precision not null, mult double precision not null,
  gosta text[] not null, odeia text[] not null, nivel int not null
);
create table if not exists public.idle_tee_cat_cor (id int primary key, nome text not null, hex text not null, forte boolean not null, nivel int not null);
create table if not exists public.idle_tee_cat_conflito (a text not null, b text not null, primary key (a, b));
-- as constantes ajustadas na simulação (camisetariaSim.test.ts): PUBLICO_BASE, CRESCE, PRECO_MULT e FAS_TETO
create table if not exists public.idle_tee_const (
  id int primary key default 1 check (id = 1), publico_base double precision not null, cresce double precision not null,
  preco_mult double precision not null, fas_teto double precision not null
);
alter table public.idle_tee_cat_tema enable row level security;
alter table public.idle_tee_cat_estilo enable row level security;
alter table public.idle_tee_cat_peca enable row level security;
alter table public.idle_tee_cat_cor enable row level security;
alter table public.idle_tee_cat_conflito enable row level security;
alter table public.idle_tee_const enable row level security;
revoke all on public.idle_tee_cat_tema, public.idle_tee_cat_estilo, public.idle_tee_cat_peca, public.idle_tee_cat_cor,
  public.idle_tee_cat_conflito, public.idle_tee_const from anon, authenticated;

delete from public.idle_tee_cat_tema where true;
delete from public.idle_tee_cat_estilo where true;
delete from public.idle_tee_cat_peca where true;
delete from public.idle_tee_cat_cor where true;
delete from public.idle_tee_cat_conflito where true;
delete from public.idle_tee_const where true;
insert into public.idle_tee_cat_tema (id, nome, vibes, nivel) values
  (1, 'Meme', '{zoeira,nerd}', 1),
  (2, 'Praia', '{praia,raiz}', 1),
  (3, 'Futebol de várzea', '{esporte,raiz,bruto}', 1),
  (4, 'Forró', '{raiz,retro}', 1),
  (5, 'Gato', '{fofo,zoeira}', 1),
  (6, 'Café', '{chique,urbano}', 1),
  (7, 'Signo', '{chique,fofo}', 2),
  (8, 'Anime', '{nerd,fofo}', 3),
  (9, 'Crise financeira', '{grana,zoeira,sombrio}', 4),
  (10, 'Cuscuz', '{raiz,zoeira}', 5),
  (11, 'Cachorro caramelo', '{fofo,raiz}', 6),
  (12, 'Carro rebaixado', '{bruto,urbano,zoeira}', 7),
  (13, 'Boleto', '{grana,sombrio}', 8),
  (14, 'Academia', '{esporte,bruto}', 9),
  (15, 'Caveira', '{sombrio,bruto}', 10),
  (16, 'Skate', '{urbano,esporte}', 11),
  (17, 'Jacaré', '{praia,bruto}', 12),
  (18, 'Coach quântico', '{grana,zoeira}', 13),
  (19, 'Pix', '{grana,urbano}', 14),
  (20, 'Ressaca', '{zoeira,sombrio}', 15),
  (21, 'Game', '{nerd,retro}', 16),
  (22, 'Tubarão', '{praia,sombrio}', 17),
  (23, 'Caju', '{raiz,praia}', 18),
  (24, 'Astronauta', '{nerd,retro}', 19),
  (25, 'Dinossauro', '{retro,fofo}', 20),
  (26, 'Pagode', '{raiz,zoeira}', 21),
  (27, 'Flor', '{fofo,chique}', 22),
  (28, 'Jampa raiz', '{raiz,praia,urbano}', 23),
  (29, 'Crush', '{fofo,zoeira}', 24),
  (30, 'Rock', '{sombrio,retro,bruto}', 25);
insert into public.idle_tee_cat_estilo (id, nome, vibes, foco, nivel) values
  (1, 'Minimalista', '{chique,urbano}', '{3,5,2}', 1),
  (2, 'Rabisco de caneta', '{zoeira,nerd}', '{6,1,3}', 1),
  (3, 'Pixel', '{nerd,retro}', '{6,2,2}', 1),
  (4, 'Grafite', '{urbano,bruto}', '{5,2,3}', 2),
  (5, 'Vintage desbotado', '{retro,raiz}', '{3,5,2}', 5),
  (6, 'Estêncil', '{urbano,sombrio}', '{5,3,2}', 7),
  (7, 'Tie-dye', '{praia,fofo}', '{2,6,2}', 10),
  (8, 'Xilogravura de cordel', '{raiz,retro,zoeira}', '{6,3,1}', 11),
  (9, 'Neon', '{urbano,zoeira}', '{4,1,5}', 14),
  (10, 'Bordado', '{fofo,raiz,chique}', '{2,7,1}', 16),
  (11, 'Pop art', '{zoeira,retro}', '{5,1,4}', 18),
  (12, 'Colagem', '{zoeira,urbano}', '{4,2,4}', 20),
  (13, 'Aquarela', '{fofo,praia,chique}', '{6,3,1}', 22),
  (14, 'Gótico', '{sombrio,bruto}', '{4,4,2}', 24),
  (15, 'Y2K', '{retro,fofo,zoeira}', '{3,2,5}', 25);
insert into public.idle_tee_cat_peca (id, nome, custo, mult, gosta, odeia, nivel) values
  (1, 'Camiseta', 3, 1, '{zoeira}', '{}', 1),
  (2, 'Ecobag', 2, 0.8, '{fofo,chique,raiz}', '{bruto,esporte}', 1),
  (3, 'Regata', 3, 0.9, '{praia,esporte}', '{chique,sombrio}', 4),
  (4, 'Boné', 4, 0.7, '{esporte,urbano,raiz}', '{fofo}', 8),
  (5, 'Cropped', 3, 0.8, '{fofo,chique,zoeira}', '{bruto,esporte}', 13),
  (6, 'Moletom', 6, 0.5, '{sombrio,nerd}', '{zoeira,raiz,fofo,retro,esporte,praia,chique,bruto,urbano,grana}', 19);
insert into public.idle_tee_cat_cor (id, nome, hex, forte, nivel) values
  (1, 'Preto', '#1B1B1F', false, 1),
  (2, 'Branco', '#F4F1EA', false, 1),
  (3, 'Amarelo', '#F2C230', true, 1),
  (4, 'Cinza mescla', '#8D8F93', false, 1),
  (5, 'Off-white', '#E8E0CC', false, 3),
  (6, 'Vermelho', '#D23A3A', true, 6),
  (7, 'Verde-bandeira', '#1F8A4C', false, 9),
  (8, 'Azul-marinho', '#23315A', false, 12),
  (9, 'Rosa', '#E98BB3', true, 15),
  (10, 'Laranja', '#EE7A2D', true, 17),
  (11, 'Roxo', '#7A4FC4', true, 21),
  (12, 'Verde-limão', '#A6D93A', true, 23);
insert into public.idle_tee_cat_conflito (a, b) values
  ('fofo', 'sombrio'), ('fofo', 'bruto'), ('chique', 'bruto'), ('chique', 'zoeira'), ('nerd', 'esporte'), ('praia', 'sombrio');
insert into public.idle_tee_const (id, publico_base, cresce, preco_mult, fas_teto) values (1, 75, 1.35, 6.5, 3);

-- os desafios da semana da camisetaria (um por semana, sorteado pela moldura; pagos no idle_tee_depois da parte B)
delete from public.idle_cat_place_desafio where lugar = 3;
insert into public.idle_cat_place_desafio (id, lugar, tipo, valor, texto, premio, premio_valor) values
  (301, 3, 'tee_nota', 8, 'Lança uma coleção com nota média 8 ou mais', 'horas', 2),
  (302, 3, 'tee_pct', 300, 'Coleção com 300% de procura', 'horas', 3),
  (303, 3, 'tee_esgotou_grande', 1, 'Esgota uma coleção de lote grande', 'legado', 2),
  (304, 3, 'tee_tendencia', 7, 'Coleção com o tema da semana e nota 7 ou mais', 'horas', 2),
  (305, 3, 'tee_quatro', 8, 'Os 4 influencers dão 8 ou mais', 'legado', 3),
  (306, 3, 'tee_luis', 9, 'Arranca 9 ou mais do @luisviton', 'investidor', 1),
  (307, 3, 'tee_resenha', 10, 'Faz o @mcresenha dar 10', 'horas', 2),
  (308, 3, 'tee_mauro', 10, 'Faz o @SuperMauro64 dar 10', 'horas', 2),
  (309, 3, 'tee_otima', 1, 'Acha uma combinação ótima nova', 'legado', 2),
  (310, 3, 'tee_moletom', 7, 'Moletom com nota 7 ou mais (boa sorte)', 'legado', 3),
  (311, 3, 'tee_colecoes', 3, 'Lança 3 coleções na semana', 'horas', 3),
  (312, 3, 'tee_pct', 600, 'Coleção com 600% de procura', 'investidor', 1);

-- ===== as coleções (só pelas funções) =====
-- Tudo é calculado no lançamento (determinístico, guardado aqui) e só mostrado quando fica pronta. custo = o que a pessoa
-- pagou (0 quando o fornecedor fiou: encerrar antes não devolve cupom de lote fiado). fiado = saiu de graça (no máximo um
-- a cada 24 h: a última vez é o max(criada_em) das fiadas).
create table if not exists public.idle_tee_colecoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  nome text not null, tema int not null, estilo int not null, peca int not null, cor int not null,
  arte int not null, tecido int not null, div int not null, lote smallint not null check (lote between 0 and 2),
  nivel int not null, pecas int not null, custo double precision not null, tendencia int not null,
  rotulo int not null, peca_tema int not null, notas int[] not null, media double precision not null,
  procura double precision not null, pct double precision not null,
  criada_em timestamptz not null default now(), pronta_em timestamptz not null, fim_em timestamptz not null,
  encerrada_em timestamptz, vendido double precision not null default 0,
  fas_excesso_pago boolean not null default false, revelada boolean not null default false,
  fiado boolean not null default false
);
create index if not exists idle_tee_colecoes_user on public.idle_tee_colecoes (user_id, criada_em desc);
alter table public.idle_tee_colecoes enable row level security;
revoke all on public.idle_tee_colecoes from anon, authenticated;

-- ===== as contas (mesmos nomes de camisetaria.ts em snake_case; paridade no teste) =====

-- o que o lugar libera no nível (tipo 'tema', 'estilo', 'peca' ou 'cor'); id que não existe: false
create or replace function public.idle_tee_liberado(p_tipo text, p_id int, p_nivel int)
returns boolean language sql stable set search_path = public as $$
  select coalesce(p_nivel >= case p_tipo
                                when 'tema' then (select c.nivel from public.idle_tee_cat_tema c where c.id = p_id)
                                when 'estilo' then (select c.nivel from public.idle_tee_cat_estilo c where c.id = p_id)
                                when 'peca' then (select c.nivel from public.idle_tee_cat_peca c where c.id = p_id)
                                when 'cor' then (select c.nivel from public.idle_tee_cat_cor c where c.id = p_id)
                              end, false)
$$;

-- tema × estilo: 2 por vibe em comum, -2 por par em conflito e o empurrãozinho fixo ((tema·31 + estilo·17) mod 3) − 1
create or replace function public.idle_tee_rotulo(p_tema int, p_estilo int)
returns int language sql stable set search_path = public as $$
  select case when x.s >= 3 then 4 when x.s = 2 then 3 when x.s >= 0 then 2 when x.s >= -2 then 1 else 0 end
    from (select 2 * (select count(*) from unnest(t.vibes) as tv(v) where tv.v = any (e.vibes))
               - 2 * (select count(*) from unnest(t.vibes) as tv(v) cross join unnest(e.vibes) as ev(v)
                       where exists (select 1 from public.idle_tee_cat_conflito k
                                      where (k.a = tv.v and k.b = ev.v) or (k.a = ev.v and k.b = tv.v)))
               + (((p_tema * 31 + p_estilo * 17) % 3) - 1) as s
            from public.idle_tee_cat_tema t, public.idle_tee_cat_estilo e
           where t.id = p_tema and e.id = p_estilo) x
$$;

-- +1 se a peça combina com o tema, -1 se brigam, 0 no resto
create or replace function public.idle_tee_peca_tema(p_peca int, p_tema int)
returns int language sql stable set search_path = public as $$
  select case when t.vibes && p.gosta then 1 when t.vibes && p.odeia then -1 else 0 end
    from public.idle_tee_cat_peca p, public.idle_tee_cat_tema t where p.id = p_peca and t.id = p_tema
$$;

-- distância entre o foco (arte, tecido, divulgação) e o ideal do estilo: (|Δa| + |Δt| + |Δd|) / 2, inteira
create or replace function public.idle_tee_distancia(p_estilo int, p_arte int, p_tecido int, p_div int)
returns int language sql stable set search_path = public as $$
  select (abs(p_arte - e.foco[1]) + abs(p_tecido - e.foco[2]) + abs(p_div - e.foco[3])) / 2
    from public.idle_tee_cat_estilo e where e.id = p_estilo
$$;

-- as quatro notas (1 a 10, na ordem dos influencers) em décimos inteiros, como notas() do TS. p_ult_* = as últimas coleções
-- da pessoa, a mais recente primeiro (só as 3 primeiras contam). sorte10 = ((id·7919 + k·104729) mod 11) − 5.
create or replace function public.idle_tee_notas(p_id bigint, p_tema int, p_estilo int, p_peca int, p_cor int, p_arte int,
                                                 p_tecido int, p_div int, p_tendencia int, p_ult_temas int[], p_ult_estilos int[])
returns int[] language plpgsql stable set search_path = public as $$
declare
  v_rot   int := public.idle_tee_rotulo(p_tema, p_estilo);
  v_dist  int := public.idle_tee_distancia(p_estilo, p_arte, p_tecido, p_div);
  v_n     int := coalesce(cardinality(p_ult_temas), 0);
  v_rep   int := 0;
  v_base  bigint;
  v_gosto int[];
  v_total bigint;
  v_notas int[] := '{}';
begin
  if exists (select 1 from generate_series(1, least(v_n, 3)) i where p_ult_temas[i] = p_tema and p_ult_estilos[i] = p_estilo) then
    v_rep := -20;
  elsif v_n >= 1 and (p_ult_temas[1] = p_tema or p_ult_estilos[1] = p_estilo) then
    v_rep := -10;
  end if;
  v_base := (array[25, 40, 60, 75, 90])[v_rot + 1] + 10 * public.idle_tee_peca_tema(p_peca, p_tema) - 3 * v_dist + v_rep
          + case when p_tema = p_tendencia then 10 else 0 end;
  v_gosto := array[
    case when p_tema = p_tendencia then 1 else 0 end,
    case when p_estilo in (5, 10) or (select c.forte from public.idle_tee_cat_cor c where c.id = p_cor) then 1 else 0 end,
    case when p_tema = 3 then 2 else -1 end,
    case when v_rot = 4 and v_dist <= 1 then 1 else -1 end];
  for k in 1..4 loop
    v_total := v_base + 10 * v_gosto[k] + ((p_id * 7919 + k * 104729) % 11) - 5;
    v_notas := v_notas || least(10, greatest(1, floor((v_total + 5) / 10.0)::int));
  end loop;
  return v_notas;
end;
$$;

-- peças de um lote (0 pequeno, 1 médio, 2 grande) no nível: round(12 · CRESCE^(nível−1)) · [1, 3, 7] (round do JS: meio pra cima)
create or replace function public.idle_tee_pecas_lote(p_nivel int, p_lote int)
returns int language sql stable set search_path = public as $$
  select (floor(12 * power(k.cresce, p_nivel - 1) + 0.5) * (array[1, 3, 7])[p_lote + 1])::int from public.idle_tee_const k
$$;

create or replace function public.idle_tee_custo_lote(p_peca int, p_nivel int, p_lote int)
returns double precision language sql stable set search_path = public as $$
  select p.custo * public.idle_tee_pecas_lote(p_nivel, p_lote) from public.idle_tee_cat_peca p where p.id = p_peca
$$;

-- quanta gente passa querendo camisa no nível
create or replace function public.idle_tee_publico(p_nivel int)
returns double precision language sql stable set search_path = public as $$
  select k.publico_base * power(k.cresce, p_nivel - 1) from public.idle_tee_const k
$$;

-- procura: público × (média/10)² × (1 + min(√fãs/30, FAS_TETO)) × a pegada da peça (mesma ordem das contas do TS)
create or replace function public.idle_tee_procura(p_nivel int, p_peca int, p_fas double precision, p_notas int[])
returns double precision language sql stable set search_path = public as $$
  select public.idle_tee_publico(p_nivel)
       * power((p_notas[1] + p_notas[2] + p_notas[3] + p_notas[4])::double precision / 4 / 10, 2)
       * (1 + least(sqrt(p_fas) / 30, k.fas_teto))
       * p.mult
    from public.idle_tee_const k, public.idle_tee_cat_peca p where p.id = p_peca
$$;

-- a procura em % do lote médio
create or replace function public.idle_tee_pct_procura(p_nivel int, p_peca int, p_fas double precision, p_notas int[])
returns double precision language sql stable set search_path = public as $$
  select public.idle_tee_procura(p_nivel, p_peca, p_fas, p_notas) / public.idle_tee_pecas_lote(p_nivel, 1) * 100
$$;

-- preço do relatório dos influencers: 50 × CRESCE^(nível−1)
create or replace function public.idle_tee_preco_relatorio(p_nivel int)
returns double precision language sql stable set search_path = public as $$
  select 50 * power(k.cresce, p_nivel - 1) from public.idle_tee_const k
$$;

-- peso acumulado (em ms) desde o epoch: 1 sempre, mais 1 nos shows (sexta 18h–sábado 2h e sábado 18h–domingo 2h de Brasília,
-- UTC−3 fixo), contando a semana da segunda 00h de Brasília (o epoch foi numa quinta: −(4 dias + 3 h)). Igual a acumulado().
create or replace function public.idle_tee_acumulado(p_ms double precision)
returns double precision language plpgsql immutable set search_path = public as $$
declare
  h       constant double precision := 3600000;
  dia     constant double precision := 86400000;
  semana  constant double precision := 604800000;
  s       double precision := p_ms + (-(4 * dia + 3 * h));
  semanas double precision := floor(s / semana);
  u       double precision := s - semanas * semana;
  extra   double precision;
begin
  extra := 0 + greatest(0, least(u, 5 * dia + 2 * h) - (4 * dia + 18 * h));
  extra := extra + greatest(0, least(u, 6 * dia + 2 * h) - (5 * dia + 18 * h));
  return semanas * (semana + 16 * h) + u + extra;
end;
$$;

-- integral do peso da venda entre dois instantes, em ms (pesoVenda)
create or replace function public.idle_tee_peso(p_a timestamptz, p_b timestamptz)
returns double precision language sql immutable set search_path = public as $$
  select public.idle_tee_acumulado((extract(epoch from p_b) * 1000)::double precision)
       - public.idle_tee_acumulado((extract(epoch from p_a) * 1000)::double precision)
$$;

-- quanto do total já vendeu em p_t: reparte pelas 12 h na proporção do peso (t preso entre o pronto e o fim)
create or replace function public.idle_tee_vendido_ate(p_total double precision, p_pronta timestamptz, p_t timestamptz)
returns double precision language sql immutable set search_path = public as $$
  select p_total * public.idle_tee_peso(p_pronta, least(greatest(p_t, p_pronta), p_pronta + interval '12 hours'))
       / public.idle_tee_peso(p_pronta, p_pronta + interval '12 hours')
$$;

-- tema em alta na semana (segunda de Brasília): o mesmo para todo mundo
create or replace function public.idle_tee_tendencia(p_semana date)
returns int language sql immutable set search_path = public as $$
  select 1 + public.idle_place_semana_idx(3, 1, 30, p_semana)
$$;

-- ===== lançar uma coleção =====
-- Uma por vez (em produção ou à venda). Calcula tudo agora (notas, média, procura, %, rótulo, peça × tema, o tema da semana)
-- e grava; a tela só mostra o resultado quando fica pronta. "O fornecedor fia": sem cupom pro lote pequeno da peça, o lote
-- pequeno sai de graça, no máximo uma vez a cada 24 h (podeFiar).
create or replace function public.idle_tee_lancar(p_tema int, p_estilo int, p_peca int, p_cor int, p_arte int, p_tecido int,
                                                  p_div int, p_lote int, p_nome text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s           public.idle_state;
  st          public.idle_place_state;
  v_nome      text;
  v_custo     double precision;
  v_fiado     boolean := false;
  v_ult_fiado timestamptz;
  v_id        bigint;
  v_tend      int;
  v_ult_t     int[];
  v_ult_e     int[];
  v_notas     int[];
  v_pronta    timestamptz;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  select * into st from public.idle_place_state where user_id = s.user_id and lugar = 3 for update;
  if not found then
    raise exception 'idle_lugar_fechado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.idle_tee_colecoes c
              where c.user_id = s.user_id and c.encerrada_em is null and now() < c.fim_em) then
    raise exception 'idle_tee_ocupada' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.idle_tee_cat_tema where id = p_tema)
     or not exists (select 1 from public.idle_tee_cat_estilo where id = p_estilo)
     or not exists (select 1 from public.idle_tee_cat_peca where id = p_peca)
     or not exists (select 1 from public.idle_tee_cat_cor where id = p_cor) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if not (public.idle_tee_liberado('tema', p_tema, st.nivel) and public.idle_tee_liberado('estilo', p_estilo, st.nivel)
          and public.idle_tee_liberado('peca', p_peca, st.nivel) and public.idle_tee_liberado('cor', p_cor, st.nivel)) then
    raise exception 'idle_tee_trancado' using errcode = 'P0001';
  end if;
  if p_arte is null or p_tecido is null or p_div is null or least(p_arte, p_tecido, p_div) < 0
     or greatest(p_arte, p_tecido, p_div) > 10 or p_arte + p_tecido + p_div <> 10 then
    raise exception 'idle_tee_foco' using errcode = 'P0001';
  end if;
  if p_lote is null or p_lote not between 0 and 2 then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  v_nome := public.idle_place_nome(p_nome);
  v_custo := public.idle_tee_custo_lote(p_peca, st.nivel, p_lote);
  if st.moeda < v_custo then
    -- sem coleção ativa (conferido acima) e sem cupom pro lote pequeno desta peça: o pequeno sai fiado, 1 vez a cada 24 h
    select max(c.criada_em) into v_ult_fiado from public.idle_tee_colecoes c where c.user_id = s.user_id and c.fiado;
    if p_lote = 0 and (v_ult_fiado is null or now() - v_ult_fiado >= interval '24 hours') then
      v_fiado := true;
      v_custo := 0;
    else
      raise exception 'idle_lugar_moeda' using errcode = 'P0001';
    end if;
  end if;

  -- o id entra na sorte das notas: pega antes de gravar (uma linha só, tudo calculado)
  v_id := nextval(pg_get_serial_sequence('public.idle_tee_colecoes', 'id'));
  v_tend := public.idle_tee_tendencia(public.games_week_start());
  select coalesce(array_agg(u.tema order by u.criada_em desc, u.id desc), '{}'),
         coalesce(array_agg(u.estilo order by u.criada_em desc, u.id desc), '{}')
    into v_ult_t, v_ult_e
    from (select c.tema, c.estilo, c.criada_em, c.id from public.idle_tee_colecoes c
           where c.user_id = s.user_id order by c.criada_em desc, c.id desc limit 3) u;
  v_notas := public.idle_tee_notas(v_id, p_tema, p_estilo, p_peca, p_cor, p_arte, p_tecido, p_div, v_tend, v_ult_t, v_ult_e);
  v_pronta := now() + make_interval(hours => (array[1, 2, 4])[p_lote + 1]);
  insert into public.idle_tee_colecoes (id, user_id, nome, tema, estilo, peca, cor, arte, tecido, div, lote, nivel, pecas, custo,
                                        tendencia, rotulo, peca_tema, notas, media, procura, pct, criada_em, pronta_em, fim_em, fiado)
  overriding system value
  values (v_id, s.user_id, v_nome, p_tema, p_estilo, p_peca, p_cor, p_arte, p_tecido, p_div, p_lote, st.nivel,
          public.idle_tee_pecas_lote(st.nivel, p_lote), v_custo, v_tend, public.idle_tee_rotulo(p_tema, p_estilo),
          public.idle_tee_peca_tema(p_peca, p_tema), v_notas,
          (v_notas[1] + v_notas[2] + v_notas[3] + v_notas[4])::double precision / 4,
          public.idle_tee_procura(st.nivel, p_peca, st.fas, v_notas), public.idle_tee_pct_procura(st.nivel, p_peca, st.fas, v_notas),
          now(), v_pronta, v_pronta + interval '12 hours', v_fiado);
  update public.idle_place_state set moeda = moeda - v_custo where user_id = s.user_id and lugar = 3;
  return public.idle_place_responder(s, 3);
end;
$$;

-- ===== o JSON da tela (troca o stub da 0057; estável: só lê) =====
-- ativa = a coleção em produção ou à venda; notas, média, procura, %, rótulo e peça × tema só depois de pronta.
-- historico = as últimas 10 reveladas; semana = quantas lançou nesta semana; ultimo_fiado = a última vez que o fornecedor fiou
-- (a tela usa com podeFiar). Lugar fechado: null.
create or replace function public.idle_tee_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'tendencia', public.idle_tee_tendencia(public.games_week_start()),
    'lotes', jsonb_build_array(public.idle_tee_pecas_lote(st.nivel, 0), public.idle_tee_pecas_lote(st.nivel, 1),
                               public.idle_tee_pecas_lote(st.nivel, 2)),
    'precos', jsonb_build_object('relatorio', public.idle_tee_preco_relatorio(st.nivel)),
    'ativa', (select jsonb_build_object(
                  'id', c.id, 'nome', c.nome, 'tema', c.tema, 'estilo', c.estilo, 'peca', c.peca, 'cor', c.cor,
                  'arte', c.arte, 'tecido', c.tecido, 'div', c.div, 'lote', c.lote, 'nivel', c.nivel, 'pecas', c.pecas,
                  'custo', c.custo, 'fiado', c.fiado, 'tendencia', c.tendencia, 'criada_em', c.criada_em,
                  'pronta_em', c.pronta_em, 'fim_em', c.fim_em, 'vendido', c.vendido, 'pronta', now() >= c.pronta_em,
                  'notas', case when now() >= c.pronta_em then to_jsonb(c.notas) end,
                  'media', case when now() >= c.pronta_em then c.media end,
                  'procura', case when now() >= c.pronta_em then c.procura end,
                  'pct', case when now() >= c.pronta_em then c.pct end,
                  'rotulo', case when now() >= c.pronta_em then c.rotulo end,
                  'peca_tema', case when now() >= c.pronta_em then c.peca_tema end)
                from public.idle_tee_colecoes c
               where c.user_id = s.user_id and c.encerrada_em is null and now() < c.fim_em
               order by c.criada_em desc, c.id desc
               limit 1),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'nome', h.nome, 'tema', h.tema, 'estilo', h.estilo,
                                                               'peca', h.peca, 'cor', h.cor, 'notas', to_jsonb(h.notas), 'pct', h.pct)
                                            order by h.criada_em desc, h.id desc)
                             from (select * from public.idle_tee_colecoes c
                                    where c.user_id = s.user_id and c.revelada
                                    order by c.criada_em desc, c.id desc limit 10) h), '[]'::jsonb),
    'semana', (select count(*) from public.idle_tee_colecoes c
                where c.user_id = s.user_id
                  and c.criada_em >= (public.games_week_start()::timestamp at time zone 'America/Sao_Paulo')),
    'ultimo_fiado', (select max(c.criada_em) from public.idle_tee_colecoes c where c.user_id = s.user_id and c.fiado))
  from public.idle_place_state st
  where st.user_id = s.user_id and st.lugar = 3
$$;

revoke all on function public.idle_tee_liberado(text, int, int) from public, anon, authenticated;
revoke all on function public.idle_tee_rotulo(int, int) from public, anon, authenticated;
revoke all on function public.idle_tee_peca_tema(int, int) from public, anon, authenticated;
revoke all on function public.idle_tee_distancia(int, int, int, int) from public, anon, authenticated;
revoke all on function public.idle_tee_notas(bigint, int, int, int, int, int, int, int, int, int[], int[]) from public, anon, authenticated;
revoke all on function public.idle_tee_pecas_lote(int, int) from public, anon, authenticated;
revoke all on function public.idle_tee_custo_lote(int, int, int) from public, anon, authenticated;
revoke all on function public.idle_tee_publico(int) from public, anon, authenticated;
revoke all on function public.idle_tee_procura(int, int, double precision, int[]) from public, anon, authenticated;
revoke all on function public.idle_tee_pct_procura(int, int, double precision, int[]) from public, anon, authenticated;
revoke all on function public.idle_tee_preco_relatorio(int) from public, anon, authenticated;
revoke all on function public.idle_tee_acumulado(double precision) from public, anon, authenticated;
revoke all on function public.idle_tee_peso(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_tee_vendido_ate(double precision, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_tee_tendencia(date) from public, anon, authenticated;
revoke all on function public.idle_tee_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_tee_lancar(int, int, int, int, int, int, int, int, text) from public, anon;
grant execute on function public.idle_tee_lancar(int, int, int, int, int, int, int, int, text) to authenticated;
