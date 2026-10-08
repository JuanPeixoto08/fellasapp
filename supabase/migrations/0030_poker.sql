-- fellasapp: Fellas Games — Poker (No-Limit Texas Hold'em ao vivo, uma mesa de 6). Idempotente.
-- Depende da 0027–0029. Toda regra mora aqui: a tela só pede jogadas e mostra o retrato público da mesa
-- (poker_tables.state), que o Realtime entrega a todos. As cartas de cada um ficam em poker_secrets (sem
-- política: ninguém lê). Também: o placar soma as fichas da mesa, o fiado espera levantar, e o reset de segunda
-- trava as carteiras, anula a mão aberta e levanta todo mundo antes de zerar (M2 da revisão do projeto 1).
-- Ordem das travas em todo lugar: poker_tables → game_wallets → bj_rounds.

-- ===== Avaliador de mãos =====
-- carta 0–51: rank = c % 13 (0 = A), naipe = c / 13. Valor: 2..10, J = 11, Q = 12, K = 13, A = 14.
create or replace function public.poker_value(c smallint)
returns int language sql immutable as $$ select case when c % 13 = 0 then 14 else c % 13 + 1 end $$;

-- 5 cartas → array comparável: categoria e desempates (maior primeiro).
-- 8 straight flush [8, alta] · 7 quadra [7, q, kicker] · 6 full [6, trinca, par] · 5 flush [5, 5 valores]
-- 4 sequência [4, alta] · 3 trinca [3, t, k, k] · 2 dois pares [2, alto, baixo, k] · 1 par [1, p, k, k, k]
-- 0 carta alta [0, 5 valores]. A-2-3-4-5 é a menor sequência (alta = 5); sem volta Q-K-A-2-3.
create or replace function public.poker_rank5(p smallint[])
returns int[] language plpgsql immutable as $$
declare
  v_vals   int[];
  v_flush  boolean;
  v_high   int;
  v_groups int[];
  v_counts int[];
begin
  select array_agg(public.poker_value(c) order by public.poker_value(c) desc) into v_vals from unnest(p) c;
  select count(distinct c / 13) = 1 into v_flush from unnest(p) c;
  if (select count(distinct v) from unnest(v_vals) v) = 5 then
    if v_vals[1] - v_vals[5] = 4 then
      v_high := v_vals[1];
    elsif v_vals = array[14, 5, 4, 3, 2] then
      v_high := 5;
    end if;
  end if;
  select array_agg(v order by n desc, v desc), array_agg(n order by n desc, v desc)
    into v_groups, v_counts
    from (select v, count(*)::int as n from unnest(v_vals) v group by v) g;

  if v_high is not null and v_flush then return array[8, v_high]; end if;
  if v_counts[1] = 4 then return array[7] || v_groups; end if;
  if v_counts[1] = 3 and v_counts[2] = 2 then return array[6] || v_groups; end if;
  if v_flush then return array[5] || v_vals; end if;
  if v_high is not null then return array[4, v_high]; end if;
  if v_counts[1] = 3 then return array[3] || v_groups; end if;
  if v_counts[1] = 2 and v_counts[2] = 2 then return array[2] || v_groups; end if;
  if v_counts[1] = 2 then return array[1] || v_groups; end if;
  return array[0] || v_vals;
end;
$$;

-- melhor mão de 5 entre 5 a 7 cartas (no showdown: 2 da mão + 5 da mesa = 21 combinações)
create or replace function public.poker_rank(p smallint[])
returns int[] language sql immutable as $$
  select max(public.poker_rank5(array[p[a], p[b], p[c], p[d], p[e]]))
    from generate_series(1, cardinality(p)) a
    join generate_series(1, cardinality(p)) b on b > a
    join generate_series(1, cardinality(p)) c on c > b
    join generate_series(1, cardinality(p)) d on d > c
    join generate_series(1, cardinality(p)) e on e > d
$$;

create or replace function public.poker_card_name(v int)
returns text language sql immutable as $$
  select case v when 11 then 'J' when 12 then 'Q' when 13 then 'K' when 14 then 'A' else v::text end
$$;

create or replace function public.poker_rank_name(r int[])
returns text language sql immutable as $$
  select case r[1]
    when 8 then case when r[2] = 14 then 'Royal flush' else 'Straight flush' end
    when 7 then 'Quadra de ' || public.poker_card_name(r[2])
    when 6 then 'Full house, ' || public.poker_card_name(r[2]) || ' e ' || public.poker_card_name(r[3])
    when 5 then 'Flush'
    when 4 then 'Sequência até o ' || public.poker_card_name(r[2])
    when 3 then 'Trinca de ' || public.poker_card_name(r[2])
    when 2 then 'Dois pares, ' || public.poker_card_name(r[2]) || ' e ' || public.poker_card_name(r[3])
    when 1 then 'Par de ' || public.poker_card_name(r[2])
    else 'Carta alta ' || public.poker_card_name(r[2])
  end
$$;

revoke all on function public.poker_value(smallint) from public, anon, authenticated;
revoke all on function public.poker_rank5(smallint[]) from public, anon, authenticated;
revoke all on function public.poker_rank(smallint[]) from public, anon, authenticated;
revoke all on function public.poker_card_name(int) from public, anon, authenticated;
revoke all on function public.poker_rank_name(int[]) from public, anon, authenticated;
