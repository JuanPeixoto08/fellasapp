# Fellas Games: Poker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mesa de No-Limit Texas Hold'em ao vivo (uma mesa, 6 lugares) no Fellas Games, com os créditos semanais, e as correções M1/M2 do projeto 1.

**Architecture:** Toda regra no Postgres (migração `0030_poker.sql`, funções `security definer`), estado público da mesa num `jsonb` em `poker_tables` que o Supabase Realtime entrega a todos; cartas escondidas em `poker_secrets`. A tela é uma página Vite + Three.js em `games/poker/` (mesma base do Blackjack): o banco manda retratos, a tela anima a diferença entre dois retratos e só pede jogadas.

**Tech Stack:** Supabase (Postgres 17, RLS, pg_cron, Realtime), Vite 8.3.4, three 0.186.1, @supabase/supabase-js 2.117.3, vitest 5.0.3 + @electric-sql/pglite 0.5.8 + happy-dom 20.14.5; app Expo Router (jest-expo).

**Spec:** `docs/superpowers/specs/2026-10-08-fellas-games-poker-design.md` (e o do projeto 1: `docs/superpowers/specs/2026-10-08-fellas-games-blackjack-design.md`).

## Global Constraints

- Texto de interface em pt-BR, no tom do `PRODUCT.md`; frases de erro e aviso exatamente as da seção 5 da spec.
- Migração `supabase/migrations/0030_poker.sql`: idempotente (`create table if not exists`, `create or replace`, `drop policy if exists`, `on conflict do nothing`); RLS ligado em todas as tabelas; `revoke all ... from anon, authenticated` nas tabelas e `grant select` só onde a spec diz; funções `security definer set search_path = public`; funções do app checam `public.is_member()` (`raise exception 'not_member' using errcode = '42501'`); demais erros `raise exception '<código>' using errcode = 'P0001'`; internas com `revoke all on function ... from public, anon, authenticated`.
- Cartas são `smallint` 0–51: `rank = c % 13` (0 = A, 1–9 = 2–10, 10 = J, 11 = Q, 12 = K), `naipe = c / 13` (♠ ♥ ♦ ♣).
- Cegas 5/10; entrada 200 a 500 de 10 em 10; apostas de 5 em 5; relógio 30 s; próxima mão 5 s (8 s com mesa revelada); ausente após 2 mãos estouradas; ausente levantado após 10 min; sem fichas levantado após 1 min; anti-rathole 30 min; mesa fechada domingo ≥ 23:55 (`America/Sao_Paulo`).
- Ordem das travas: `poker_tables` → `game_wallets` → `bj_rounds`. Toda função de poker que muda algo começa com `select ... from poker_tables where id = 1 for update`.
- `games/` não ganha dependência nova. Comandos: `npm test --prefix games`, `npm run build --prefix games` (faz `tsc --noEmit`); na raiz `npx tsc --noEmit` e `npm test`.
- App: telas só com tokens de `lib/theme.ts` e componentes de `components/ui`; skill `impeccable` para a parte do app (CLAUDE.md).
- Git: trabalhar no branch `poker` (criado da `main` no passo 1 da Task 1); commits sem `Co-Authored-By` nem marca de IA; nada de push até o Juan aplicar a 0030 e a conferência passar (Task 13). Nunca ler o `.env`.

## Review Focus

1. **Quem foi levantado no meio de uma mão aberta (ausente de 10 min que já tinha corrido) e a semana vira:** a anulação devolve o que ele pôs na mão para a carteira dele, não some. Teste em Task 5 (`'reset devolve a aposta de quem já tinha levantado'`).
2. **Toque na hora em que o relógio estoura:** o relógio joga por ele e a jogada atrasada é recusada com `stale_seq`, sem jogar duas vezes. Teste em Task 4 (`'jogada atrasada depois do relógio é recusada'`).
3. **Fella quebrado que completa dentro do minuto:** volta a receber cartas; quem não completa é levantado sem lançamento de `cashout` de 0. Teste em Task 4 (`'sem fichas: completa no minuto ou levanta'`).
4. **Anti-rathole com fichas quebradas (735):** pode sentar com exatamente 735 (fora do passo de 10), não com 730. Teste em Task 2 (`'anti-rathole aceita o valor exato de saída'`).
5. **Retrato do tempo real chegando fora de ordem:** a tela ignora retrato com `seq` menor que o que já mostra. Teste em Task 8 (`'ignora retrato mais velho'`).

## Rulings feitos no planejamento (já refletidos na spec)

- `poker_seats` sem `table_id` (uma mesa só); `poker_act(p_hand, p_action_no, p_action, p_amount)` usa o contador da mão, não o `seq` da mesa; `poker_rebuy`/`poker_show` sem número.
- `poker_secrets` é apagado quando a mão seguinte começa (o "Mostrar" precisa das cartas até lá).
- Sem fichas: 1 minuto para completar (a próxima mão sai em 5 s).
- Ausente ou saindo com a vez na mão aberta: joga na hora (mesa/corre), sem esperar 30 s.
- Vários all-ins curtos não somam para reabrir a ação.
- `poker_tick()` aceita chamada sem usuário (cron).
- `frames.html` mostra celular e PC com bancos separados (cada iframe tem o próprio PGlite); o "dois jogadores ao vivo" fica para o teste real.
- Casos do avaliador: 31 mãos + 12 comparações (a spec dizia ~60; cobrem todas as categorias e desempates listados).

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `supabase/migrations/0030_poker.sql` | tabelas, avaliador, motor da mão, relógio, carteira/fiado/placar, reset M2, cron, realtime |
| `games/test/db.ts` | + `0030_poker.sql` na lista de migrações |
| `games/test/poker.ts` | ajudantes dos testes de poker (lugares, baralho armado, jogar, relógio) |
| `games/test/hands.test.ts`, `games/test/fixtures/hands.json` | avaliador SQL × TS |
| `games/test/pokerTable.test.ts` | sentar, levantar, completar, voltar, retrato, carteira, placar |
| `games/test/pokerHand.test.ts` | cegas, apostas, ruas, potes, showdown, mostrar, cartas, histórico |
| `games/test/pokerClock.test.ts` | relógio, ausente, saindo, quebrado, mesa fechada, cron |
| `games/test/pokerWeek.test.ts` | reset M2, fiado, segurança |
| `games/test/pokerSim.test.ts` | 200 mãos aleatórias, conservação |
| `games/poker/hands.ts` | avaliador TS (rótulo da mão) |
| `games/poker/rules.ts` | o que oferecer na tela, textos de estado |
| `games/poker/machine.ts` | estado da tela |
| `games/poker/layout.ts` | posições 3D (em pé / deitado) |
| `games/poker/tableDiff.ts` | retrato → vista da mesa → passos de animação |
| `games/poker/table.ts` | cena 3D do poker |
| `games/poker/view.ts` | HUD em DOM |
| `games/poker/main.ts`, `games/poker/index.html` | página |
| `games/poker/poker.css` | estilos do HUD do poker |
| `games/shared/types.ts`, `errors.ts`, `api.ts`, `realtime.ts` | tipos, erros, chamadas, canal |
| `games/shared/table3d/chips.ts`, `textures.ts` | ficha de 5 |
| `games/blackjack/machine.ts` | M1 |
| `games/dev/mockApi.ts`, `games/dev/frames.html` | `?mock` com bots |
| `games/vite.config.ts` | página `poker` |
| `lib/api/games.ts`, `components/games/GameRows.tsx`, `app/(tabs)/games.tsx`, `lib/realtime.ts`, `types/database.ts` | app |
| `__tests__/pokerMigration.test.ts`, `__tests__/gamesApi.test.ts`, `__tests__/gamesScreen.test.tsx`, `__tests__/realtime.test.tsx` | testes do app |
| `DESIGN.md`, `supabase/README.md` | documentação |

---

### Task 1: Avaliador de mãos (SQL + TS, mesmos casos)

**Files:**
- Create: `supabase/migrations/0030_poker.sql` (cabeçalho + avaliador)
- Modify: `games/test/db.ts` (lista `MIGRATIONS`)
- Create: `games/test/fixtures/hands.json`, `games/test/hands.test.ts`, `games/poker/hands.ts`

**Interfaces:**
- Produces (SQL, internas): `poker_value(smallint) → int`, `poker_rank5(smallint[]) → int[]`, `poker_rank(smallint[]) → int[]` (melhor de 5 entre 5–7 cartas; arrays comparáveis com `>`/`max`), `poker_card_name(int) → text`, `poker_rank_name(int[]) → text`.
- Produces (TS, `games/poker/hands.ts`): `type Rank = number[]`, `rank(cards: number[]): Rank` (2–7 cartas; menos de 5 = só pares/trinca/quadra), `compareRank(a, b): number`, `rankName(r: Rank): string`.

- [ ] **Step 1: Branch**

```bash
git checkout -b poker
```

- [ ] **Step 2: Casos (fixture)**

`games/test/fixtures/hands.json`:

```json
{
  "ranks": [
    { "cards": ["As", "Ks", "Qs", "Js", "10s", "2h", "3d"], "rank": [8, 14], "name": "Royal flush" },
    { "cards": ["9h", "8h", "7h", "6h", "5h", "Ac", "Kd"], "rank": [8, 9], "name": "Straight flush" },
    { "cards": ["Ad", "2d", "3d", "4d", "5d", "Kc", "Qh"], "rank": [8, 5], "name": "Straight flush" },
    { "cards": ["Ks", "Kh", "Kd", "Kc", "As", "2h", "3h"], "rank": [7, 13, 14], "name": "Quadra de K" },
    { "cards": ["9s", "9h", "9d", "9c", "2s", "Qh", "3d"], "rank": [7, 9, 12], "name": "Quadra de 9" },
    { "cards": ["5s", "5h", "5d", "5c", "Ks", "Kh", "2d"], "rank": [7, 5, 13], "name": "Quadra de 5" },
    { "cards": ["Qs", "Qh", "Qd", "7c", "7s", "2h", "3d"], "rank": [6, 12, 7], "name": "Full house, Q e 7" },
    { "cards": ["8s", "8h", "8d", "5c", "5s", "5h", "Ad"], "rank": [6, 8, 5], "name": "Full house, 8 e 5" },
    { "cards": ["Js", "Jh", "Jd", "4c", "4s", "9h", "9d"], "rank": [6, 11, 9], "name": "Full house, J e 9" },
    { "cards": ["Ks", "Kh", "Kd", "2c", "2s"], "rank": [6, 13, 2], "name": "Full house, K e 2" },
    { "cards": ["Ah", "10h", "7h", "4h", "2h", "Ks", "Qd"], "rank": [5, 14, 10, 7, 4, 2], "name": "Flush" },
    { "cards": ["Ah", "Kh", "9h", "7h", "4h", "2h", "Qs"], "rank": [5, 14, 13, 9, 7, 4], "name": "Flush" },
    { "cards": ["5h", "6h", "7h", "8h", "2h", "9c", "10d"], "rank": [5, 8, 7, 6, 5, 2], "name": "Flush" },
    { "cards": ["10c", "9d", "8h", "7s", "6c", "2d", "2h"], "rank": [4, 10], "name": "Sequência até o 10" },
    { "cards": ["Ac", "2d", "3h", "4s", "5c", "Kd", "Kh"], "rank": [4, 5], "name": "Sequência até o 5" },
    { "cards": ["Ac", "Kd", "Qh", "Js", "10c", "3d", "2h"], "rank": [4, 14], "name": "Sequência até o A" },
    { "cards": ["6c", "7d", "8h", "9s", "9c", "10d", "2h"], "rank": [4, 10], "name": "Sequência até o 10" },
    { "cards": ["4c", "5d", "6h", "7s", "8c", "9d", "Kh"], "rank": [4, 9], "name": "Sequência até o 9" },
    { "cards": ["Ac", "2d", "3h", "4s", "5c", "6d", "Kh"], "rank": [4, 6], "name": "Sequência até o 6" },
    { "cards": ["Qc", "Kd", "Ah", "2s", "3c", "8d", "9h"], "rank": [0, 14, 13, 12, 9, 8], "name": "Carta alta A" },
    { "cards": ["7s", "7h", "7d", "Kc", "2s", "4h", "9d"], "rank": [3, 7, 13, 9], "name": "Trinca de 7" },
    { "cards": ["Ks", "Kh", "4d", "4c", "Qs", "2h", "3d"], "rank": [2, 13, 4, 12], "name": "Dois pares, K e 4" },
    { "cards": ["As", "Ah", "8d", "8c", "5s", "5h", "Kd"], "rank": [2, 14, 8, 13], "name": "Dois pares, A e 8" },
    { "cards": ["Qs", "Qh", "9d", "9c", "6s", "6h", "2d"], "rank": [2, 12, 9, 6], "name": "Dois pares, Q e 9" },
    { "cards": ["Js", "Jh", "9d", "7c", "4s", "3h", "2d"], "rank": [1, 11, 9, 7, 4], "name": "Par de J" },
    { "cards": ["2s", "2h", "Ad", "Kc", "Qs", "8h", "5d"], "rank": [1, 2, 14, 13, 12], "name": "Par de 2" },
    { "cards": ["As", "Jh", "9d", "7c", "5s", "3h", "2d"], "rank": [0, 14, 11, 9, 7, 5], "name": "Carta alta A" },
    { "cards": ["10s", "10h", "10d", "10c", "9s", "9h", "9d"], "rank": [7, 10, 9], "name": "Quadra de 10" },
    { "cards": ["Ah", "Kh", "Qh", "Jh", "9h", "10s", "2c"], "rank": [5, 14, 13, 12, 11, 9], "name": "Flush" },
    { "cards": ["2c", "3c", "4c", "5c", "7d", "8h", "Kd"], "rank": [0, 13, 8, 7, 5, 4], "name": "Carta alta K" },
    { "cards": ["Kc", "Kd", "Ks", "Ah", "Ad", "As", "2c"], "rank": [6, 14, 13], "name": "Full house, A e K" }
  ],
  "duels": [
    { "board": ["Ks", "9h", "4d", "2c", "7s"], "a": ["Ah", "Qd"], "b": ["Kd", "3c"], "winner": "b" },
    { "board": ["Ks", "9h", "4d", "2c", "7s"], "a": ["Kh", "Qd"], "b": ["Kd", "Jc"], "winner": "a" },
    { "board": ["As", "Ks", "Qs", "Js", "10s"], "a": ["2h", "3h"], "b": ["4d", "5d"], "winner": "tie" },
    { "board": ["5c", "6d", "7h", "8s", "Kd"], "a": ["9h", "2c"], "b": ["9d", "3c"], "winner": "tie" },
    { "board": ["5c", "6d", "7h", "8s", "Kd"], "a": ["9h", "2c"], "b": ["9d", "10c"], "winner": "b" },
    { "board": ["Ah", "9h", "4h", "2c", "7s"], "a": ["Kh", "3h"], "b": ["Qh", "Jh"], "winner": "a" },
    { "board": ["Ks", "Kh", "8d", "8c", "3s"], "a": ["Ad", "2c"], "b": ["Qd", "Qc"], "winner": "b" },
    { "board": ["8s", "8h", "4d", "4c", "Ks"], "a": ["2d", "2c"], "b": ["3d", "5c"], "winner": "tie" },
    { "board": ["10s", "10h", "5d", "5c", "2s"], "a": ["10d", "3c"], "b": ["5h", "2h"], "winner": "a" },
    { "board": ["2c", "3d", "4h", "5s", "Kd"], "a": ["Ac", "Qd"], "b": ["6c", "Qh"], "winner": "b" },
    { "board": ["9s", "9h", "9d", "9c", "3s"], "a": ["Ac", "2d"], "b": ["Kc", "Kd"], "winner": "a" },
    { "board": ["Js", "7h", "7d", "2c", "4s"], "a": ["7c", "3c"], "b": ["Jh", "4h"], "winner": "a" }
  ]
}
```

- [ ] **Step 3: Teste que falha**

`games/test/hands.test.ts`:

```ts
// O avaliador do banco (poker_rank, quem decide) e o da tela (hands.ts, só o rótulo) nos mesmos casos.
import { beforeAll, describe, expect, it } from 'vitest';

import { compareRank, rank, rankName } from '../poker/hands';
import { card } from './cards';
import { freshDb, type TestDb } from './db';
import fixture from './fixtures/hands.json';

let t: TestDb;
beforeAll(async () => {
  t = await freshDb();
});

/** Array do Postgres em texto ('{0,13,26}'): não depende de como o driver serializa arrays. */
const arr = (codes: string[]) => `{${codes.map(card).join(',')}}`;

const sqlRank = async (codes: string[]) => {
  const rows = await t.db.query<{ r: number[]; n: string }>(
    `select public.poker_rank($1::smallint[]) as r, public.poker_rank_name(public.poker_rank($1::smallint[])) as n`,
    [arr(codes)],
  );
  return rows.rows[0];
};

describe('poker_rank (SQL) e rank (TS)', () => {
  for (const c of fixture.ranks) {
    it(`${c.cards.join(' ')} → ${c.name}`, async () => {
      const sql = await sqlRank(c.cards);
      expect(sql.r).toEqual(c.rank);
      expect(sql.n).toBe(c.name);
      const ts = rank(c.cards.map(card));
      expect(ts).toEqual(c.rank);
      expect(rankName(ts)).toBe(c.name);
    });
  }

  for (const d of fixture.duels) {
    it(`mesa ${d.board.join(' ')}: ${d.a.join(' ')} × ${d.b.join(' ')} → ${d.winner}`, async () => {
      const a = [...d.a, ...d.board];
      const b = [...d.b, ...d.board];
      const rows = await t.db.query<{ w: string }>(
        `select case when public.poker_rank($1::smallint[]) > public.poker_rank($2::smallint[]) then 'a'
                     when public.poker_rank($1::smallint[]) < public.poker_rank($2::smallint[]) then 'b' else 'tie' end as w`,
        [arr(a), arr(b)],
      );
      expect(rows.rows[0].w).toBe(d.winner);
      const cmp = compareRank(rank(a.map(card)), rank(b.map(card)));
      expect(cmp > 0 ? 'a' : cmp < 0 ? 'b' : 'tie').toBe(d.winner);
    });
  }
});

describe('rótulo antes do flop (TS)', () => {
  it('2 cartas: par ou carta alta; 6 cartas: melhor de 5', () => {
    expect(rankName(rank(['As', 'Ah'].map(card)))).toBe('Par de A');
    expect(rankName(rank(['As', 'Kd'].map(card)))).toBe('Carta alta A');
    expect(rankName(rank(['As', 'Ah', 'Kd', 'Kc', '2s', '3h'].map(card)))).toBe('Dois pares, A e K');
  });
});
```

`games/test/db.ts` — trocar a lista:

```ts
export const MIGRATIONS: string[] = [
  '0027_fellas_games.sql',
  '0028_blackjack.sql',
  '0029_fellas_games_ajustes.sql',
  '0030_poker.sql',
];
```

`games/tsconfig.json` precisa aceitar `import fixture from './fixtures/hands.json'`: conferir se já tem `"resolveJsonModule": true`; se não tiver, adicionar em `compilerOptions`.

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test --prefix games -- hands`
Expected: FAIL (`ENOENT ... 0030_poker.sql` e `Cannot find module '../poker/hands'`).

- [ ] **Step 5: Avaliador SQL**

`supabase/migrations/0030_poker.sql` (começo do arquivo):

```sql
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
```

- [ ] **Step 6: Avaliador TS**

`games/poker/hands.ts`:

```ts
// Avaliador de mãos — o mesmo do banco (poker_rank, 0030). Quem decide quem ganha é o banco; aqui é só o rótulo
// da minha mão na tela ("Par de K"). Os dois passam pelos mesmos casos (test/fixtures/hands.json).
export type Rank = number[];

const value = (c: number) => (c % 13 === 0 ? 14 : (c % 13) + 1);

/** Igual à comparação de arrays do Postgres: elemento a elemento; prefixo igual, o mais curto é menor. */
export function compareRank(a: Rank, b: Rank): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

/** Valores agrupados (maior contagem primeiro, depois maior valor) e as contagens. */
function groups(vals: number[]): { g: number[]; n: number[] } {
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  return { g: sorted.map(([v]) => v), n: sorted.map(([, k]) => k) };
}

function rank5(cards: number[]): Rank {
  const vals = cards.map(value).sort((a, b) => b - a);
  const flush = new Set(cards.map((c) => Math.floor(c / 13))).size === 1;
  let high = 0;
  if (new Set(vals).size === 5) {
    if (vals[0] - vals[4] === 4) high = vals[0];
    else if (vals.join() === '14,5,4,3,2') high = 5;
  }
  const { g, n } = groups(vals);
  if (high && flush) return [8, high];
  if (n[0] === 4) return [7, ...g];
  if (n[0] === 3 && n[1] === 2) return [6, ...g];
  if (flush) return [5, ...vals];
  if (high) return [4, high];
  if (n[0] === 3) return [3, ...g];
  if (n[0] === 2 && n[1] === 2) return [2, ...g];
  if (n[0] === 2) return [1, ...g];
  return [0, ...vals];
}

/** Menos de 5 cartas (antes do flop): só pares, trinca e quadra contam. */
function partial(cards: number[]): Rank {
  const vals = cards.map(value).sort((a, b) => b - a);
  const { g, n } = groups(vals);
  if (n[0] === 4) return [7, ...g];
  if (n[0] === 3) return [3, ...g];
  if (n[0] === 2 && n[1] === 2) return [2, ...g];
  if (n[0] === 2) return [1, ...g];
  return [0, ...vals];
}

export function rank(cards: number[]): Rank {
  if (cards.length < 5) return partial(cards);
  const n = cards.length;
  let best: Rank | null = null;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const r = rank5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareRank(r, best) > 0) best = r;
          }
  return best!;
}

const NAMES: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const nm = (v: number) => NAMES[v] ?? String(v);

export function rankName(r: Rank): string {
  switch (r[0]) {
    case 8:
      return r[1] === 14 ? 'Royal flush' : 'Straight flush';
    case 7:
      return `Quadra de ${nm(r[1])}`;
    case 6:
      return `Full house, ${nm(r[1])} e ${nm(r[2])}`;
    case 5:
      return 'Flush';
    case 4:
      return `Sequência até o ${nm(r[1])}`;
    case 3:
      return `Trinca de ${nm(r[1])}`;
    case 2:
      return `Dois pares, ${nm(r[1])} e ${nm(r[2])}`;
    case 1:
      return `Par de ${nm(r[1])}`;
    default:
      return `Carta alta ${nm(r[1])}`;
  }
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test --prefix games -- hands`
Expected: PASS (31 + 12 + 1 testes). Depois `npm test --prefix games` inteiro: blackjack/credits continuam verdes com a 0030 carregada.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0030_poker.sql games/test/db.ts games/test/hands.test.ts games/test/fixtures/hands.json games/poker/hands.ts games/tsconfig.json
git commit -m "Poker: avaliador de mãos no banco e na tela, com os mesmos casos"
```

### Task 2: Mesa no banco — tabelas, sentar, levantar, completar, voltar, retrato, carteira e placar

**Files:**
- Modify: `supabase/migrations/0030_poker.sql` (acrescentar as seções abaixo, nesta ordem, depois do avaliador)
- Create: `games/test/poker.ts`, `games/test/pokerTable.test.ts`

**Interfaces:**
- Consumes: `games_ensure_wallet(uuid)`, `games_move(uuid, int, text, uuid)`, `games_open_round(uuid)`, `games_today()`, `is_member()` (0027/0028).
- Produces (tabelas): `poker_tables` (linha `id = 1`), `poker_seats`, `poker_hands`, `poker_secrets`, `poker_leaves`; `game_ledger.reason` aceita `'buyin'`, `'cashout'`.
- Produces (internas): `poker_closed(timestamptz) → boolean`, `poker_shuffle() → smallint[]`, `poker_next(smallint, smallint[]) → smallint`, `poker_prev(smallint, smallint[]) → smallint`, `poker_patch(uuid, smallint, jsonb)`, `poker_put(uuid, smallint, int)`, `poker_snapshot() → jsonb`, `poker_stand(smallint, boolean default true)`, `poker_maybe_start()` (stub aqui; Task 3 troca).
- Produces (app): `poker_state() → jsonb`, `poker_sit(p_seat int, p_buyin int) → jsonb`, `poker_leave() → jsonb`, `poker_back() → jsonb`, `poker_rebuy(p_amount int) → jsonb`, `games_board() → jsonb` (`[{user_id, balance, fiado_count}]`); `games_wallet()` ganha `seated_stack`; `games_fiado()` recusa `fiado_seated`.
- Produces (testes, `games/test/poker.ts`): `P: string[]` (fella do lugar i), `OUT`, tipos `State/Hand/Player/Seat`, `members(t)`, `rigDeck(t, codes)`, `startHand(t, stacks, bb)`, `state(t)`, `act(t, seat, action, amount?)`, `sit(t, seat, buyin)`, `stacks(t)`, `balance(t, uid)`, `expireTurn(t)`, `nextHand(t)`, `tick(t)`.

- [ ] **Step 1: Ajudantes dos testes**

`games/test/poker.ts`:

```ts
// Ajudantes dos testes de poker: o fella P[i] senta no lugar i; baralho armado; mão começando direto; jogadas;
// relógio adiantado. Formatos iguais aos de poker_tables.state (0030).
import { card } from './cards';
import type { TestDb } from './db';

export const P = [0, 1, 2, 3, 4, 5].map((i) => `00000000-0000-0000-0000-0000000000a${i}`);
export const OUT = '00000000-0000-0000-0000-0000000000ff';

export type Player = {
  user_id: string;
  bet: number;
  total: number;
  folded: boolean;
  all_in: boolean;
  acted: boolean;
  capped: boolean;
  last: string | null;
  timed_out: boolean;
};
export type Results = {
  showdown: boolean;
  pots: { amount: number; winners: number[]; name: string | null }[];
  payouts: Record<string, number>;
  hands: Record<string, string>;
};
export type Hand = {
  id: string;
  no: number;
  status: 'betting' | 'done' | 'void';
  street: string;
  board: number[];
  players: Record<string, Player>;
  pot: number;
  current_bet: number;
  min_raise_to: number;
  to_act: number | null;
  action_no: number;
  deadline: string | null;
  button: number;
  sb: number;
  bb: number;
  runout: boolean;
  results: Results | null;
  shown: Record<string, number[]>;
};
export type Seat = { seat: number; user_id: string; stack: number; status: 'playing' | 'away'; wait_bb: boolean; leaving: boolean; busted: boolean };
export type State = {
  seq: number;
  server_now: string;
  closed: boolean;
  next_hand_at: string | null;
  blinds: number[];
  buyin: number[];
  seats: Seat[];
  hand: Hand | null;
  me?: { rathole_min: number | null };
};

export async function members(t: TestDb) {
  for (const u of P) await t.member(u);
  await t.member(OUT, { isMember: false });
}

/**
 * Próximo baralho: essas cartas primeiro e o resto em ordem. Ordem de distribuição: 2 cartas para cada um a
 * partir do primeiro à esquerda do botão (no heads-up, a cega grande), depois as 5 da mesa.
 */
export async function rigDeck(t: TestDb, codes: string[]) {
  const head = codes.map(card);
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !head.includes(c));
  await t.db.exec(`create or replace function public.poker_shuffle() returns smallint[] language sql volatile as
    $$ select array[${[...head, ...rest].join(',')}]::smallint[] $$`);
}

/** Senta direto (sem carteira) quem está em `stacks`, prontos, e começa a mão com a cega grande em `bb`. */
export async function startHand(t: TestDb, stacks: Record<number, number>, bb: number): Promise<State> {
  const seats = Object.keys(stacks).map(Number).sort((a, b) => a - b);
  for (const s of seats) {
    await t.db.query(`insert into public.poker_seats (seat, user_id, stack, wait_bb) values ($1, $2, $3, false)`, [s, P[s], stacks[s]]);
  }
  const prev = seats[(seats.indexOf(bb) - 1 + seats.length) % seats.length];
  await t.db.query(`update public.poker_tables set last_bb_seat = $1, next_hand_at = null`, [prev]);
  await t.db.exec(`select public.poker_maybe_start(); select public.poker_snapshot();`);
  return state(t);
}

export async function state(t: TestDb): Promise<State> {
  return (await t.db.query<{ s: State }>(`select state as s from public.poker_tables where id = 1`)).rows[0].s;
}

/** Jogada do fella do lugar `seat`, com o número da mão que está na mesa. */
export async function act(t: TestDb, seat: number, action: string, amount?: number): Promise<State> {
  const h = (await state(t)).hand!;
  await t.as(P[seat]);
  return t.rpc<State>('poker_act', { p_hand: h.id, p_action_no: h.action_no, p_action: action, p_amount: amount ?? null });
}

export async function sit(t: TestDb, seat: number, buyin = 300): Promise<State> {
  await t.as(P[seat]);
  return t.rpc<State>('poker_sit', { p_seat: seat, p_buyin: buyin });
}

export async function stacks(t: TestDb): Promise<Record<number, number>> {
  const rows = (await t.db.query<{ seat: number; stack: number }>(`select seat, stack from public.poker_seats order by seat`)).rows;
  return Object.fromEntries(rows.map((r) => [r.seat, r.stack]));
}

export async function balance(t: TestDb, uid: string): Promise<number | undefined> {
  return (await t.db.query<{ b: number }>(`select balance as b from public.game_wallets where user_id = $1`, [uid])).rows[0]?.b;
}

/** O prazo da vez já passou (o tick seguinte joga por quem está na vez). */
export const expireTurn = (t: TestDb) =>
  t.db.exec(`update public.poker_hands set deadline = now() - interval '1 second' where status = 'betting'`);

/** Relógio como o cron: sem usuário. */
export async function tick(t: TestDb) {
  await t.as(null);
  await t.db.query(`select public.poker_tick()`);
}

/** A pausa entre mãos já passou: o tick começa a próxima. */
export async function nextHand(t: TestDb): Promise<State> {
  await t.db.exec(`update public.poker_tables set next_hand_at = now() - interval '1 second'`);
  await tick(t);
  return state(t);
}
```

- [ ] **Step 2: Testes que falham**

`games/test/pokerTable.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';
import { balance, members, P, sit, state, type State } from './poker';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type Wallet = { balance: number; can_fiado: boolean; seated_stack: number | null };

beforeEach(async () => {
  t = await freshDb();
  await members(t);
});

describe('poker_sit', () => {
  it('sentar tira a entrada da carteira e entra esperando a cega grande', async () => {
    const s = await sit(t, 2, 300);
    expect(await balance(t, P[2])).toBe(700);
    expect(await q('select delta, reason from public.game_ledger where user_id = $1 order by id', [P[2]])).toEqual([
      { delta: 1000, reason: 'start' },
      { delta: -300, reason: 'buyin' },
    ]);
    expect(s.seats).toEqual([{ seat: 2, user_id: P[2], stack: 300, status: 'playing', wait_bb: true, leaving: false, busted: false }]);
    expect(s.hand).toBeNull();
  });

  it('entrada fora de 200–500, fora do passo de 10 ou maior que a carteira é recusada', async () => {
    await expect(sit(t, 0, 190)).rejects.toThrow(/buyin_out_of_range/);
    await expect(sit(t, 0, 510)).rejects.toThrow(/buyin_out_of_range/);
    await expect(sit(t, 0, 205)).rejects.toThrow(/buyin_out_of_range/);
    await q('update public.game_wallets set balance = 250 where user_id = $1', [P[0]]);
    await expect(sit(t, 0, 300)).rejects.toThrow(/insufficient_credits/);
    expect(await q('select count(*)::int as n from public.poker_seats')).toEqual([{ n: 0 }]);
  });

  it('lugar ocupado, já sentado e lugar que não existe', async () => {
    await sit(t, 2);
    await expect(sit(t, 2)).rejects.toThrow(/already_seated/);
    await t.as(P[1]);
    await expect(t.rpc('poker_sit', { p_seat: 2, p_buyin: 300 })).rejects.toThrow(/seat_taken/);
    await expect(t.rpc('poker_sit', { p_seat: 6, p_buyin: 300 })).rejects.toThrow(/invalid_action/);
  });

  it('não membro é barrado', async () => {
    await t.as('00000000-0000-0000-0000-0000000000ff');
    await expect(t.rpc('poker_sit', { p_seat: 0, p_buyin: 300 })).rejects.toThrow(/not_member/);
    await expect(t.rpc('poker_state')).rejects.toThrow(/not_member/);
  });
});

describe('poker_leave e anti-rathole', () => {
  it('levantar fora de mão devolve as fichas e marca a saída', async () => {
    await sit(t, 2, 300);
    await q('update public.poker_seats set stack = 735 where seat = 2');
    await t.as(P[2]);
    const s = await t.rpc<State>('poker_leave');
    expect(s.seats).toEqual([]);
    expect(await balance(t, P[2])).toBe(700 + 735);
    expect(await q(`select delta from public.game_ledger where user_id = $1 and reason = 'cashout'`, [P[2]])).toEqual([{ delta: 735 }]);
    expect((await t.rpc<State>('poker_state')).me).toEqual({ rathole_min: 735 });
  });

  it('anti-rathole aceita o valor exato de saída', async () => {
    await sit(t, 2, 300);
    await q('update public.poker_seats set stack = 735 where seat = 2');
    await t.as(P[2]);
    await t.rpc('poker_leave');
    await expect(sit(t, 2, 300)).rejects.toThrow(/rathole_min/);
    await expect(sit(t, 2, 730)).rejects.toThrow(/rathole_min/);
    const s = await sit(t, 2, 735);
    expect(s.seats[0].stack).toBe(735);
    expect((await t.rpc<State>('poker_state')).me).toEqual({ rathole_min: null });
  });

  it('depois de 30 min volta com a entrada normal', async () => {
    await sit(t, 2, 400);
    await t.as(P[2]);
    await t.rpc('poker_leave');
    await expect(sit(t, 2, 200)).rejects.toThrow(/rathole_min/);
    await q(`update public.poker_leaves set left_at = now() - interval '31 minutes'`);
    expect((await sit(t, 2, 200)).seats[0].stack).toBe(200);
  });

  it('levantar sem estar sentado', async () => {
    await t.as(P[0]);
    await expect(t.rpc('poker_leave')).rejects.toThrow(/not_seated/);
  });
});

describe('poker_rebuy e poker_back', () => {
  it('completar: fora da mão, de 10 em 10 e até 500 na mesa', async () => {
    await sit(t, 2, 300);
    await t.as(P[2]);
    expect((await t.rpc<State>('poker_rebuy', { p_amount: 200 })).seats[0].stack).toBe(500);
    expect(await balance(t, P[2])).toBe(500);
    await expect(t.rpc('poker_rebuy', { p_amount: 10 })).rejects.toThrow(/rebuy_out_of_range/);
    await q('update public.poker_seats set stack = 295');
    await expect(t.rpc('poker_rebuy', { p_amount: 15 })).rejects.toThrow(/rebuy_out_of_range/);
    await expect(t.rpc('poker_rebuy', { p_amount: 0 })).rejects.toThrow(/rebuy_out_of_range/);
  });

  it('voltar do ausente entra esperando a cega grande', async () => {
    await sit(t, 2, 300);
    await q(`update public.poker_seats set status = 'away', away_since = now(), timeouts = 2, wait_bb = false`);
    await t.as(P[2]);
    const s = await t.rpc<State>('poker_back');
    expect(s.seats[0]).toMatchObject({ status: 'playing', wait_bb: true });
    expect(await q('select timeouts, away_since from public.poker_seats')).toEqual([{ timeouts: 0, away_since: null }]);
    await t.as(P[0]);
    await expect(t.rpc('poker_back')).rejects.toThrow(/not_seated/);
  });
});

describe('retrato', () => {
  it('seq sobe a cada mudança; cegas, entrada e hora do servidor', async () => {
    const before = await state(t);
    expect(before).toMatchObject({ blinds: [5, 10], buyin: [200, 500], closed: expect.any(Boolean), hand: null, seats: [] });
    await sit(t, 1);
    const after = await state(t);
    expect(after.seq).toBeGreaterThan(before.seq);
    expect(Date.parse(after.server_now)).not.toBeNaN();
  });
});

describe('carteira, fiado e placar', () => {
  it('fichas na mesa aparecem na carteira e o fiado espera levantar', async () => {
    await sit(t, 2, 300);
    await q('update public.game_wallets set balance = 0 where user_id = $1', [P[2]]);
    await t.as(P[2]);
    expect(await t.rpc<Wallet>('games_wallet')).toMatchObject({ balance: 0, seated_stack: 300, can_fiado: false });
    await expect(t.rpc('games_fiado')).rejects.toThrow(/fiado_seated/);
    await q('update public.poker_seats set stack = 0');
    await t.rpc('poker_leave');
    expect(await t.rpc<Wallet>('games_wallet')).toMatchObject({ balance: 0, seated_stack: null, can_fiado: true });
  });

  it('placar soma carteira e fichas na mesa', async () => {
    await sit(t, 0, 300); // 700 + 300 na mesa
    await t.as(P[1]);
    await t.rpc('games_wallet');
    await q(`update public.game_wallets set balance = 900 where user_id = $1`, [P[1]]);
    await q(`update public.game_wallets set last_played_at = now()`);
    expect(await t.rpc('games_board')).toEqual([
      { user_id: P[0], balance: 1000, fiado_count: 0 },
      { user_id: P[1], balance: 900, fiado_count: 0 },
    ]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test --prefix games -- pokerTable`
Expected: FAIL (`function public.poker_sit(...) does not exist`).

- [ ] **Step 4: Tabelas, acesso, tempo real**

Acrescentar em `supabase/migrations/0030_poker.sql`:

```sql
-- ===== Tabelas =====
-- a mesa (uma linha só) e o retrato público que o Realtime entrega
create table if not exists public.poker_tables (
  id           smallint primary key default 1 check (id = 1),
  small_blind  int not null default 5,
  big_blind    int not null default 10,
  min_buyin    int not null default 200,
  max_buyin    int not null default 500,
  seq          bigint not null default 0,
  hand_no      int not null default 0,
  last_bb_seat smallint,
  next_hand_at timestamptz,
  state        jsonb not null default '{}',
  updated_at   timestamptz not null default now()
);
insert into public.poker_tables (id) values (1) on conflict (id) do nothing;

-- os 6 lugares: as fichas da mesa existem aqui
create table if not exists public.poker_seats (
  seat       smallint primary key check (seat between 0 and 5),
  user_id    uuid not null unique references public.profiles (id) on delete cascade,
  stack      int not null check (stack >= 0),
  status     text not null default 'playing' check (status in ('playing', 'away')),
  wait_bb    boolean not null default true,
  leaving    boolean not null default false,
  timeouts   smallint not null default 0,
  away_since timestamptz,
  busted_at  timestamptz,
  sat_at     timestamptz not null default now()
);

-- mãos: só o que é público (cartas abertas da mesa e as mostradas)
create table if not exists public.poker_hands (
  id          uuid primary key default gen_random_uuid(),
  hand_no     int not null,
  status      text not null default 'betting' check (status in ('betting', 'done', 'void')),
  street      text not null default 'preflop' check (street in ('preflop', 'flop', 'turn', 'river', 'showdown')),
  button      smallint not null,
  sb_seat     smallint not null,
  bb_seat     smallint not null,
  board       smallint[] not null default '{}',
  -- lugar → { user_id, bet (na rodada), total (na mão), folded, all_in, acted, capped, last, timed_out }
  players     jsonb not null,
  current_bet int not null default 0,
  last_raise  int not null default 0,
  to_act      smallint,
  action_no   int not null default 0,
  deadline    timestamptz,
  runout      boolean not null default false,
  results     jsonb,
  shown       jsonb not null default '{}',
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create unique index if not exists poker_hands_one_open on public.poker_hands (status) where status = 'betting';
create index if not exists poker_hands_recent on public.poker_hands (hand_no desc);

-- baralho e cartas de cada um: ninguém lê (sem política); some quando a mão seguinte começa
create table if not exists public.poker_secrets (
  hand_id uuid primary key references public.poker_hands (id) on delete cascade,
  deck    smallint[] not null,
  holes   jsonb not null
);

-- anti-rathole: com quanto cada um levantou
create table if not exists public.poker_leaves (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stack   int not null,
  left_at timestamptz not null default now()
);

alter table public.poker_tables  enable row level security;
alter table public.poker_seats   enable row level security;
alter table public.poker_hands   enable row level security;
alter table public.poker_secrets enable row level security;
alter table public.poker_leaves  enable row level security;
revoke all on public.poker_tables, public.poker_seats, public.poker_hands, public.poker_secrets, public.poker_leaves
  from anon, authenticated;
grant select on public.poker_tables, public.poker_seats, public.poker_hands to authenticated;

drop policy if exists "poker_tables_select_members" on public.poker_tables;
create policy "poker_tables_select_members" on public.poker_tables
  for select to authenticated using (public.is_member());
drop policy if exists "poker_seats_select_members" on public.poker_seats;
create policy "poker_seats_select_members" on public.poker_seats
  for select to authenticated using (public.is_member());
drop policy if exists "poker_hands_select_members" on public.poker_hands;
create policy "poker_hands_select_members" on public.poker_hands
  for select to authenticated using (public.is_member());

-- entrada e saída da mesa no extrato
alter table public.game_ledger drop constraint if exists game_ledger_reason_check;
alter table public.game_ledger add constraint game_ledger_reason_check
  check (reason in ('start', 'bet', 'win', 'push', 'fiado', 'reset', 'buyin', 'cashout'));

-- o retrato da mesa vai pelo Realtime (como as tabelas da 0021)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poker_tables') then
    alter publication supabase_realtime add table public.poker_tables;
  end if;
end $$;
```

- [ ] **Step 5: Peças internas**

Acrescentar:

```sql
-- ===== Peças internas =====
-- domingo 23:55 em diante (Brasília): nenhuma mão nova até o reset da meia-noite
create or replace function public.poker_closed(ts timestamptz default now())
returns boolean language sql stable as $$
  select extract(isodow from ts at time zone 'America/Sao_Paulo') = 7
     and (ts at time zone 'America/Sao_Paulo')::time >= time '23:55'
$$;

create or replace function public.poker_shuffle()
returns smallint[] language sql volatile as $$
  select array_agg(c::smallint order by gen_random_uuid()) from generate_series(0, 51) c
$$;

-- próximo lugar do conjunto no sentido horário (número maior; dá a volta)
create or replace function public.poker_next(p_from smallint, p_set smallint[])
returns smallint language sql immutable as $$
  select coalesce((select min(s) from unnest(p_set) s where s > coalesce(p_from, -1)),
                  (select min(s) from unnest(p_set) s))
$$;

create or replace function public.poker_prev(p_from smallint, p_set smallint[])
returns smallint language sql immutable as $$
  select coalesce((select max(s) from unnest(p_set) s where s < p_from),
                  (select max(s) from unnest(p_set) s))
$$;

-- muda campos de um jogador da mão
create or replace function public.poker_patch(p_hand uuid, p_seat smallint, p_patch jsonb)
returns void language sql security definer set search_path = public as $$
  update public.poker_hands
     set players = jsonb_set(players, array[p_seat::text], (players -> p_seat::text) || p_patch)
   where id = p_hand
$$;

-- fichas do lugar para a aposta da rodada (quem zera fica all-in)
create or replace function public.poker_put(p_hand uuid, p_seat smallint, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_left int;
  p      jsonb;
begin
  update public.poker_seats set stack = stack - p_amount where seat = p_seat returning stack into v_left;
  select players -> p_seat::text into p from public.poker_hands where id = p_hand;
  perform public.poker_patch(p_hand, p_seat, jsonb_build_object(
    'bet', (p ->> 'bet')::int + p_amount,
    'total', (p ->> 'total')::int + p_amount,
    'all_in', v_left = 0));
end;
$$;

-- retrato público: refeito no fim de toda mudança (mesma transação); o Realtime entrega a linha
create or replace function public.poker_snapshot()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.poker_tables;
  h public.poker_hands;
  v jsonb;
begin
  update public.poker_tables set seq = seq + 1 where id = 1 returning * into t;
  select * into h from public.poker_hands order by hand_no desc limit 1;
  v := jsonb_build_object(
    'seq', t.seq,
    'server_now', now(),
    'closed', public.poker_closed(now()),
    'next_hand_at', t.next_hand_at,
    'blinds', jsonb_build_array(t.small_blind, t.big_blind),
    'buyin', jsonb_build_array(t.min_buyin, t.max_buyin),
    'seats', coalesce((select jsonb_agg(jsonb_build_object(
        'seat', s.seat, 'user_id', s.user_id, 'stack', s.stack, 'status', s.status, 'wait_bb', s.wait_bb,
        'leaving', s.leaving, 'busted', s.busted_at is not null) order by s.seat)
      from public.poker_seats s), '[]'),
    'hand', case when h.id is null then null else jsonb_build_object(
        'id', h.id, 'no', h.hand_no, 'status', h.status, 'street', h.street, 'board', to_jsonb(h.board),
        'players', h.players,
        'pot', (select coalesce(sum((e.value ->> 'total')::int), 0) from jsonb_each(h.players) e),
        'current_bet', h.current_bet,
        'min_raise_to', h.current_bet + greatest(h.last_raise, t.big_blind),
        'to_act', h.to_act, 'action_no', h.action_no, 'deadline', h.deadline,
        'button', h.button, 'sb', h.sb_seat, 'bb', h.bb_seat, 'runout', h.runout,
        'results', h.results, 'shown', h.shown) end);
  update public.poker_tables set state = v, updated_at = now() where id = 1;
  return v;
end;
$$;

-- levanta o lugar: fichas para a carteira; p_track grava a saída (anti-rathole). O reset não grava.
create or replace function public.poker_stand(p_seat smallint, p_track boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare s public.poker_seats;
begin
  delete from public.poker_seats where seat = p_seat returning * into s;
  if s.user_id is null then
    return;
  end if;
  if s.stack > 0 then
    perform public.games_ensure_wallet(s.user_id);
    perform public.games_move(s.user_id, s.stack, 'cashout');
  end if;
  if p_track then
    insert into public.poker_leaves (user_id, stack, left_at) values (s.user_id, s.stack, now())
    on conflict (user_id) do update set stack = excluded.stack, left_at = excluded.left_at;
  end if;
end;
$$;

-- começa uma mão se der (Task 3 troca este corpo pelo de verdade)
create or replace function public.poker_maybe_start()
returns void language plpgsql security definer set search_path = public as $$
begin
end;
$$;
```

- [ ] **Step 6: Funções do app (mesa)**

Acrescentar:

```sql
-- ===== Funções do app: mesa =====
-- o retrato atual, com a hora de agora e o mínimo do anti-rathole de quem pergunta
create or replace function public.poker_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  l public.poker_leaves;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select state into v from public.poker_tables where id = 1;
  select * into l from public.poker_leaves where user_id = auth.uid() and left_at > now() - interval '30 minutes';
  return v || jsonb_build_object(
    'server_now', now(),
    'me', jsonb_build_object('rathole_min', case when l.user_id is null then null else greatest(l.stack, 200) end));
end;
$$;

create or replace function public.poker_sit(p_seat int, p_buyin int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t     public.poker_tables;
  l     public.poker_leaves;
  v_min int;
  v_max int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into t from public.poker_tables where id = 1 for update;
  if p_seat is null or p_seat < 0 or p_seat > 5 then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.poker_seats where user_id = auth.uid()) then
    raise exception 'already_seated' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.poker_seats where seat = p_seat) then
    raise exception 'seat_taken' using errcode = 'P0001';
  end if;
  -- levantou há menos de 30 min: volta com pelo menos o que levou (pode passar de 500; o valor exato vale)
  select * into l from public.poker_leaves where user_id = auth.uid() and left_at > now() - interval '30 minutes';
  v_min := greatest(t.min_buyin, coalesce(l.stack, 0));
  v_max := greatest(t.max_buyin, v_min);
  if p_buyin is null or p_buyin > v_max or (p_buyin % 10 <> 0 and p_buyin <> v_min) then
    raise exception 'buyin_out_of_range' using errcode = 'P0001';
  end if;
  if p_buyin < v_min then
    if v_min > t.min_buyin then
      raise exception 'rathole_min' using errcode = 'P0001';
    end if;
    raise exception 'buyin_out_of_range' using errcode = 'P0001';
  end if;
  perform public.games_ensure_wallet(auth.uid());
  perform public.games_move(auth.uid(), -p_buyin, 'buyin');
  delete from public.poker_leaves where user_id = auth.uid();
  insert into public.poker_seats (seat, user_id, stack) values (p_seat, auth.uid(), p_buyin);
  perform public.poker_maybe_start();
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;

-- levanta já, ou (na mão) "sai ao fim da mão": corre quando a vez chegar; all-in fica até o fim
create or replace function public.poker_leave()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.poker_seats;
  h public.poker_hands;
  p jsonb;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform 1 from public.poker_tables where id = 1 for update;
  select * into s from public.poker_seats where user_id = auth.uid();
  if s.user_id is null then
    raise exception 'not_seated' using errcode = 'P0001';
  end if;
  select * into h from public.poker_hands where status = 'betting';
  p := h.players -> s.seat::text;
  if p is not null and (p ->> 'user_id')::uuid = s.user_id and not (p ->> 'folded')::boolean then
    update public.poker_seats set leaving = true where seat = s.seat;
    if h.to_act = s.seat and not (p ->> 'all_in')::boolean then
      perform public.poker_apply(h.id, s.seat, 'fold');
      perform public.poker_advance(h.id);
    end if;
  else
    perform public.poker_stand(s.seat, true);
  end if;
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;

-- volta do ausente: entra quando a cega grande chegar nele
create or replace function public.poker_back()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform 1 from public.poker_tables where id = 1 for update;
  if not exists (select 1 from public.poker_seats where user_id = auth.uid()) then
    raise exception 'not_seated' using errcode = 'P0001';
  end if;
  update public.poker_seats set status = 'playing', wait_bb = true, timeouts = 0, away_since = null
   where user_id = auth.uid() and status = 'away';
  perform public.poker_maybe_start();
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;

-- completa as fichas fora da mão (quem já correu também pode), até 500 na mesa
create or replace function public.poker_rebuy(p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.poker_tables;
  s public.poker_seats;
  p jsonb;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into t from public.poker_tables where id = 1 for update;
  select * into s from public.poker_seats where user_id = auth.uid();
  if s.user_id is null then
    raise exception 'not_seated' using errcode = 'P0001';
  end if;
  select players -> s.seat::text into p from public.poker_hands where status = 'betting';
  if p is not null and (p ->> 'user_id')::uuid = s.user_id and not (p ->> 'folded')::boolean then
    raise exception 'rebuy_in_hand' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount % 10 <> 0 or s.stack + p_amount > t.max_buyin then
    raise exception 'rebuy_out_of_range' using errcode = 'P0001';
  end if;
  perform public.games_ensure_wallet(s.user_id);
  perform public.games_move(s.user_id, -p_amount, 'buyin');
  update public.poker_seats set stack = stack + p_amount, busted_at = null where seat = s.seat;
  perform public.poker_maybe_start();
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;
```

- [ ] **Step 7: Carteira, fiado e placar**

Acrescentar (substitui as da 0027; mesmos privilégios porque é `create or replace`):

```sql
-- ===== Carteira, fiado e placar (0027 ajustada) =====
-- a carteira mostra as fichas na mesa; o fiado espera levantar
create or replace function public.games_wallet_json(w public.game_wallets)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_open  uuid := public.games_open_round(w.user_id);
  v_stack int := (select stack from public.poker_seats where user_id = w.user_id);
begin
  return jsonb_build_object(
    'balance', w.balance,
    'fiado_count', w.fiado_count,
    'can_fiado', w.balance < 10 and v_open is null and v_stack is null
                 and w.last_fiado_on is distinct from public.games_today(),
    'open_round_id', v_open,
    'seated_stack', v_stack,
    'week_start', w.week_start);
end;
$$;

create or replace function public.games_fiado()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare w public.game_wallets;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  w := public.games_ensure_wallet(auth.uid());
  -- abaixo da aposta mínima (o troco de um blackjack pode deixar 5) já conta como quebrado
  if w.balance >= 10 then
    raise exception 'fiado_not_broke' using errcode = 'P0001';
  end if;
  if public.games_open_round(w.user_id) is not null then
    raise exception 'fiado_open_round' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.poker_seats where user_id = w.user_id) then
    raise exception 'fiado_seated' using errcode = 'P0001';
  end if;
  if w.last_fiado_on = public.games_today() then
    raise exception 'fiado_today' using errcode = 'P0001';
  end if;
  perform public.games_move(w.user_id, 100, 'fiado');
  update public.game_wallets
     set fiado_count = fiado_count + 1, last_fiado_on = public.games_today()
   where user_id = w.user_id
  returning * into w;
  return public.games_wallet_json(w);
end;
$$;

-- placar da semana: carteira + fichas na mesa; só quem jogou; ordem do placar
create or replace function public.games_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', w.user_id, 'balance', w.balance + coalesce(s.stack, 0),
                                        'fiado_count', w.fiado_count)
                     order by w.balance + coalesce(s.stack, 0) desc, w.fiado_count asc, w.last_played_at asc)
      from public.game_wallets w
      left join public.poker_seats s on s.user_id = w.user_id
     where w.last_played_at is not null), '[]');
end;
$$;

revoke all on function public.poker_closed(timestamptz) from public, anon, authenticated;
revoke all on function public.poker_shuffle() from public, anon, authenticated;
revoke all on function public.poker_next(smallint, smallint[]) from public, anon, authenticated;
revoke all on function public.poker_prev(smallint, smallint[]) from public, anon, authenticated;
revoke all on function public.poker_patch(uuid, smallint, jsonb) from public, anon, authenticated;
revoke all on function public.poker_put(uuid, smallint, int) from public, anon, authenticated;
revoke all on function public.poker_snapshot() from public, anon, authenticated;
revoke all on function public.poker_stand(smallint, boolean) from public, anon, authenticated;
revoke all on function public.poker_maybe_start() from public, anon, authenticated;
revoke all on function public.poker_state() from public, anon;
revoke all on function public.poker_sit(int, int) from public, anon;
revoke all on function public.poker_leave() from public, anon;
revoke all on function public.poker_back() from public, anon;
revoke all on function public.poker_rebuy(int) from public, anon;
revoke all on function public.games_board() from public, anon;
grant execute on function public.poker_state() to authenticated;
grant execute on function public.poker_sit(int, int) to authenticated;
grant execute on function public.poker_leave() to authenticated;
grant execute on function public.poker_back() to authenticated;
grant execute on function public.poker_rebuy(int) to authenticated;
grant execute on function public.games_board() to authenticated;

-- primeiro retrato (a mesa vazia)
select public.poker_snapshot();
```

> O `select public.poker_snapshot();` fica sempre como **última linha** do arquivo: as Tasks 3 e 4 acrescentam as seções delas **antes** dele.

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test --prefix games -- pokerTable`
Expected: PASS (todos). `npm test --prefix games` inteiro verde (o fiado da 0027 continua com os testes de `credits.test.ts`).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0030_poker.sql games/test/poker.ts games/test/pokerTable.test.ts
git commit -m "Poker: mesa no banco (sentar, levantar, completar, voltar), retrato público, fiado e placar com as fichas"
```

### Task 3: Motor da mão — cegas, apostas, ruas, potes, showdown, mostrar, cartas, histórico

**Files:**
- Modify: `supabase/migrations/0030_poker.sql` (troca o stub `poker_maybe_start` e acrescenta a seção "Mão" antes da linha final `select public.poker_snapshot();`)
- Create: `games/test/pokerHand.test.ts`

**Interfaces:**
- Consumes: Task 1 (`poker_rank`, `poker_rank_name`), Task 2 (tabelas, `poker_next/prev/patch/put/snapshot/stand/state`), helpers de `games/test/poker.ts`.
- Produces (internas): `poker_maybe_start()`, `poker_apply(uuid, smallint, text, int default null)`, `poker_advance(uuid)`, `poker_finish(uuid)`.
- Produces (app): `poker_act(p_hand uuid, p_action_no int, p_action text, p_amount int default null) → jsonb`, `poker_show() → jsonb`, `poker_my_cards() → jsonb` (`{hand_id, cards}` ou null), `poker_history() → jsonb` (`[{id, no, board, results, shown, players: {lugar: user_id}, ended_at}]`, até 20, mais nova primeiro).
- Formato de `results`: `{ showdown: bool, pots: [{amount, winners: [lugar], name: text|null}], payouts: {lugar: valor}, hands: {lugar: nome} }`.

- [ ] **Step 1: Testes que falham**

`games/test/pokerHand.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { card } from './cards';
import { freshDb, type TestDb } from './db';
import { act, members, nextHand, P, rigDeck, sit, stacks, startHand, state, type State } from './poker';

let t: TestDb;

beforeEach(async () => {
  t = await freshDb();
  await members(t);
});

describe('cegas e ordem', () => {
  it('heads-up: o botão é a cega pequena e fala primeiro antes do flop', async () => {
    const s = await startHand(t, { 0: 300, 1: 300 }, 0);
    expect(s.hand).toMatchObject({ button: 1, sb: 1, bb: 0, to_act: 1, current_bet: 10, min_raise_to: 20, street: 'preflop', pot: 15 });
    expect(s.hand!.players['1']).toMatchObject({ bet: 5, last: 'sb' });
    expect(s.hand!.players['0']).toMatchObject({ bet: 10, last: 'bb' });
    expect(await stacks(t)).toEqual({ 0: 290, 1: 295 });
  });

  it('a cega grande tem a opção; depois do flop fala quem não é o botão', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await act(t, 1, 'call');
    expect((await state(t)).hand!.to_act).toBe(0);
    await expect(act(t, 0, 'call')).rejects.toThrow(/invalid_action/);
    const s = await act(t, 0, 'check');
    expect(s.hand).toMatchObject({ street: 'flop', to_act: 0, current_bet: 0, pot: 20 });
    expect(s.hand!.board).toHaveLength(3);
  });

  it('3 na mesa: botão, cega pequena e cega grande em sequência; fala o botão primeiro', async () => {
    const s = await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    expect(s.hand).toMatchObject({ button: 0, sb: 1, bb: 2, to_act: 0 });
  });

  it('cega maior que as fichas: paga o que tem e fica all-in', async () => {
    const s = await startHand(t, { 0: 5, 1: 300 }, 0);
    expect(s.hand!.players['0']).toMatchObject({ bet: 5, all_in: true });
    const end = await act(t, 1, 'call');
    expect(end.hand).toMatchObject({ status: 'done', street: 'showdown' });
    expect(end.hand!.board).toHaveLength(5);
  });
});

describe('apostas', () => {
  it('aumento mínimo, de 5 em 5 e no máximo tudo', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await expect(act(t, 0, 'raise', 15)).rejects.toThrow(/raise_too_small/);
    await expect(act(t, 0, 'raise', 33)).rejects.toThrow(/invalid_action/);
    await expect(act(t, 0, 'raise', 400)).rejects.toThrow(/raise_too_big/);
    let s = await act(t, 0, 'raise', 30);
    expect(s.hand).toMatchObject({ current_bet: 30, min_raise_to: 50, to_act: 1 });
    await expect(act(t, 1, 'raise', 45)).rejects.toThrow(/raise_too_small/);
    s = await act(t, 1, 'raise', 50);
    expect(s.hand).toMatchObject({ current_bet: 50, min_raise_to: 70, to_act: 2 });
  });

  it('all-in curto não reabre a ação para quem já falou', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 60 }, 2);
    await act(t, 0, 'raise', 40);
    await act(t, 1, 'call');
    let s = await act(t, 2, 'allin'); // vai a 60: +20, menos que o aumento de 30
    expect(s.hand).toMatchObject({ current_bet: 60, min_raise_to: 90, to_act: 0 });
    expect(s.hand!.players['0']).toMatchObject({ capped: true, acted: false });
    await expect(act(t, 0, 'raise', 100)).rejects.toThrow(/invalid_action/);
    await expect(act(t, 0, 'allin')).rejects.toThrow(/invalid_action/);
    await act(t, 0, 'call');
    s = await act(t, 1, 'call');
    expect(s.hand).toMatchObject({ street: 'flop', pot: 180, to_act: 1 });
  });

  it('jogada fora da vez, número velho e quem não está sentado', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await expect(act(t, 0, 'check')).rejects.toThrow(/not_your_turn/);
    const h = (await state(t)).hand!;
    await t.as(P[1]);
    await expect(
      t.rpc('poker_act', { p_hand: h.id, p_action_no: h.action_no - 1, p_action: 'call', p_amount: null }),
    ).rejects.toThrow(/stale_seq/);
    await t.as(P[3]);
    await expect(
      t.rpc('poker_act', { p_hand: h.id, p_action_no: h.action_no, p_action: 'call', p_amount: null }),
    ).rejects.toThrow(/not_seated/);
  });

  it('completar no meio da mão só para quem já correu', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await t.as(P[1]);
    await expect(t.rpc('poker_rebuy', { p_amount: 100 })).rejects.toThrow(/rebuy_in_hand/);
    await act(t, 0, 'fold');
    await t.as(P[0]);
    expect((await t.rpc<State>('poker_rebuy', { p_amount: 100 })).seats.find((x) => x.seat === 0)!.stack).toBe(400);
  });
});

describe('fim da mão', () => {
  it('todos correm: leva sem mostrar e a aposta que ninguém pagou volta', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    const s = await act(t, 1, 'fold');
    expect(s.hand).toMatchObject({ status: 'done', to_act: null, shown: {} });
    expect(s.hand!.results).toMatchObject({ showdown: false, payouts: { '0': 10 }, pots: [{ amount: 10, winners: [0], name: null }] });
    expect(await stacks(t)).toEqual({ 0: 305, 1: 295 });
    expect(s.next_hand_at).not.toBeNull();
  });

  it('potes paralelos com 3 all-ins diferentes', async () => {
    // ordem: 1 (cega pequena), 2 (cega grande), 0 (botão), depois a mesa
    await rigDeck(t, ['Kh', 'Kd', '7c', '2d', 'Ah', 'Ad', '9s', '8c', '4h', '3d', 'Js']);
    await startHand(t, { 0: 100, 1: 200, 2: 300 }, 2);
    await act(t, 0, 'allin');
    await act(t, 1, 'allin');
    const s = await act(t, 2, 'allin'); // os 100 de cima ninguém pagou: voltam
    expect(s.hand).toMatchObject({ status: 'done', runout: true, street: 'showdown' });
    expect(s.hand!.board).toHaveLength(5);
    expect(s.hand!.results!.pots).toEqual([
      { amount: 300, winners: [0], name: 'Par de A' },
      { amount: 200, winners: [1], name: 'Par de K' },
    ]);
    expect(await stacks(t)).toEqual({ 0: 300, 1: 200, 2: 100 });
    expect(Object.keys(s.hand!.shown).sort()).toEqual(['0', '1', '2']);
  });

  it('empate divide; a ficha que sobra vai para o primeiro vencedor à esquerda do botão', async () => {
    await rigDeck(t, ['2c', '3c', '4d', '5d', '6h', '7h', 'As', 'Ks', 'Qs', 'Js', '10s']);
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await act(t, 0, 'call');
    await act(t, 1, 'fold');
    await act(t, 2, 'check');
    for (let i = 0; i < 3; i++) {
      await act(t, 2, 'check');
      await act(t, 0, 'check');
    }
    const s = await state(t);
    expect(s.hand!.results).toMatchObject({
      showdown: true,
      payouts: { '2': 13, '0': 12 },
      hands: { '0': 'Royal flush', '2': 'Royal flush' },
    });
    expect(Object.keys(s.hand!.shown).sort()).toEqual(['0', '2']); // quem correu não mostra
  });
});

describe('cartas, mostrar e histórico', () => {
  it('poker_my_cards devolve só as minhas', async () => {
    await rigDeck(t, ['Ah', 'Kh', '2c', '3c']); // ordem heads-up: 0 (cega grande), 1
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await t.as(P[0]);
    expect(await t.rpc('poker_my_cards')).toMatchObject({ cards: [card('Ah'), card('Kh')] });
    await t.as(P[1]);
    expect(await t.rpc('poker_my_cards')).toMatchObject({ cards: [card('2c'), card('3c')] });
    await t.as(P[2]);
    expect(await t.rpc('poker_my_cards')).toBeNull();
  });

  it('Mostrar vale até a próxima mão começar', async () => {
    await rigDeck(t, ['Ah', 'Kh', '2c', '3c']);
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await act(t, 1, 'fold');
    await t.as(P[1]);
    expect((await t.rpc<State>('poker_show')).hand!.shown).toEqual({ '1': [card('2c'), card('3c')] });
    await expect(t.rpc('poker_show')).rejects.toThrow(/nothing_to_show/);
    await t.as(P[2]);
    await expect(t.rpc('poker_show')).rejects.toThrow(/nothing_to_show/);
    await nextHand(t);
    await t.as(P[1]);
    await expect(t.rpc('poker_show')).rejects.toThrow(/nothing_to_show/);
    expect((await t.db.query<{ n: number }>('select count(*)::int as n from public.poker_secrets')).rows).toEqual([{ n: 1 }]);
  });

  it('histórico traz as mãos que acabaram, mais nova primeiro', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await act(t, 1, 'fold');
    await t.as(P[0]);
    const rows = await t.rpc<{ no: number; players: Record<string, string>; results: { payouts: Record<string, number> } }[]>('poker_history');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ no: 1, players: { '0': P[0], '1': P[1] }, results: { payouts: { '0': 10 } } });
  });
});

describe('quem entra e quem sai', () => {
  it('quem senta no meio espera a cega grande chegar nele', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await sit(t, 2, 300);
    expect((await state(t)).seats.find((x) => x.seat === 2)).toMatchObject({ wait_bb: true });
    await act(t, 1, 'fold');
    let s = await nextHand(t);
    expect(s.hand).toMatchObject({ bb: 1 });
    expect(Object.keys(s.hand!.players).sort()).toEqual(['0', '1']);
    await act(t, 0, 'fold');
    s = await nextHand(t);
    expect(s.hand).toMatchObject({ bb: 2, sb: 1, button: 0 });
    expect(Object.keys(s.hand!.players).sort()).toEqual(['0', '1', '2']);
  });

  it('dois sentam com a mesa parada: a mão começa na hora', async () => {
    await sit(t, 0, 300);
    const s = await sit(t, 3, 300);
    expect(s.hand).toMatchObject({ status: 'betting', no: 1 });
    expect(s.seats.every((x) => !x.wait_bb)).toBe(true);
  });

  it('ninguém paga a cega grande duas vezes seguidas quando alguém sai', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await act(t, 0, 'fold');
    await act(t, 1, 'fold');
    await t.as(P[0]);
    await t.rpc('poker_leave');
    const s = await nextHand(t);
    expect(s.hand).toMatchObject({ bb: 1, sb: 2, button: 2 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --prefix games -- pokerHand`
Expected: FAIL (`function public.poker_act(...) does not exist`; o stub não começa mão).

- [ ] **Step 3: Começo da mão**

Em `supabase/migrations/0030_poker.sql`, **trocar** o bloco do stub `poker_maybe_start` (seção "Peças internas") por:

```sql
-- começa uma mão se der: sem mão aberta, mesa aberta, pausa vencida e 2+ prontos
create or replace function public.poker_maybe_start()
returns void language plpgsql security definer set search_path = public as $$
declare
  t       public.poker_tables;
  v_ready smallint[];
  v_wait  smallint[];
  v_bb    smallint;
  v_sb    smallint;
  v_btn   smallint;
  v_cur   smallint;
  v_deck  smallint[];
  v_holes jsonb := '{}';
  v_pl    jsonb := '{}';
  v_hand  uuid;
  i       int;
begin
  select * into t from public.poker_tables where id = 1;
  if exists (select 1 from public.poker_hands where status = 'betting')
     or public.poker_closed(now())
     or (t.next_hand_at is not null and t.next_hand_at > now()) then
    return;
  end if;

  select coalesce(array_agg(seat order by seat) filter (where not wait_bb), '{}'),
         coalesce(array_agg(seat order by seat) filter (where wait_bb), '{}')
    into v_ready, v_wait
    from public.poker_seats
   where status = 'playing' and stack > 0 and not leaving;
  -- mesa parada: quem espera a cega grande entra já
  if cardinality(v_ready) < 2 then
    v_ready := array(select s from unnest(v_ready || v_wait) s order by s);
    v_wait := '{}';
  end if;
  if cardinality(v_ready) < 2 then
    return;
  end if;
  -- a cega grande anda para o próximo depois da última; quem espera e cai nela entra pagando
  v_bb := public.poker_next(t.last_bb_seat, array(select s from unnest(v_ready || v_wait) s order by s));
  if v_bb = any (v_wait) then
    v_ready := array(select s from unnest(v_ready || v_bb) s order by s);
  end if;
  if cardinality(v_ready) = 2 then
    v_sb := public.poker_next(v_bb, v_ready); -- heads-up: o botão é a cega pequena
    v_btn := v_sb;
  else
    v_sb := public.poker_prev(v_bb, v_ready);
    v_btn := public.poker_prev(v_sb, v_ready);
  end if;

  -- 2 cartas para cada um, a partir do primeiro à esquerda do botão
  v_deck := public.poker_shuffle();
  v_cur := v_btn;
  for i in 1 .. cardinality(v_ready) loop
    v_cur := public.poker_next(v_cur, v_ready);
    v_holes := v_holes || jsonb_build_object(v_cur::text, jsonb_build_array(v_deck[2 * i - 1], v_deck[2 * i]));
    v_pl := v_pl || jsonb_build_object(v_cur::text, jsonb_build_object(
      'user_id', (select user_id from public.poker_seats where seat = v_cur),
      'bet', 0, 'total', 0, 'folded', false, 'all_in', false, 'acted', false, 'capped', false,
      'last', null, 'timed_out', false));
  end loop;

  delete from public.poker_secrets; -- cartas da mão anterior: o "Mostrar" acabou
  insert into public.poker_hands (hand_no, button, sb_seat, bb_seat, players, current_bet, last_raise, to_act)
  values (t.hand_no + 1, v_btn, v_sb, v_bb, v_pl, 0, t.big_blind, v_bb)
  returning id into v_hand;
  insert into public.poker_secrets (hand_id, deck, holes) values (v_hand, v_deck, v_holes);
  update public.poker_seats set wait_bb = false where seat = any (v_ready);
  update public.poker_tables set hand_no = hand_no + 1, last_bb_seat = v_bb, next_hand_at = null where id = 1;
  update public.game_wallets set last_played_at = now()
   where user_id in (select user_id from public.poker_seats where seat = any (v_ready));

  -- cegas (quem não tem o bastante fica all-in com o que tem)
  perform public.poker_put(v_hand, v_sb, least(t.small_blind, (select stack from public.poker_seats where seat = v_sb)));
  perform public.poker_put(v_hand, v_bb, least(t.big_blind, (select stack from public.poker_seats where seat = v_bb)));
  perform public.poker_patch(v_hand, v_sb, '{"last": "sb"}');
  perform public.poker_patch(v_hand, v_bb, '{"last": "bb"}');
  update public.poker_hands set current_bet = t.big_blind where id = v_hand;
  -- a vez: o primeiro depois da cega grande (advance acha e joga sozinho por ausente/saindo)
  perform public.poker_advance(v_hand);
end;
$$;
```

- [ ] **Step 4: Jogada, avanço e fim**

Acrescentar antes da linha final `select public.poker_snapshot();`:

```sql
-- ===== Mão =====
-- aplica uma jogada de quem está na vez (já conferido por quem chama: dono do lugar ou relógio)
create or replace function public.poker_apply(p_hand uuid, p_seat smallint, p_action text, p_amount int default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  h       public.poker_hands;
  p       jsonb;
  v_bb    int := (select big_blind from public.poker_tables where id = 1);
  v_bet   int;
  v_stack int;
  v_call  int;
  v_to    int;
begin
  select * into h from public.poker_hands where id = p_hand;
  if h.status <> 'betting' or h.to_act is distinct from p_seat then
    raise exception 'not_your_turn' using errcode = 'P0001';
  end if;
  p := h.players -> p_seat::text;
  v_bet := (p ->> 'bet')::int;
  select stack into v_stack from public.poker_seats where seat = p_seat;
  v_stack := coalesce(v_stack, 0);
  v_call := least(greatest(h.current_bet - v_bet, 0), v_stack);

  if p_action = 'fold' then
    perform public.poker_patch(p_hand, p_seat, '{"folded": true, "acted": true, "last": "fold"}');
  elsif p_action = 'check' then
    if v_bet < h.current_bet then
      raise exception 'invalid_action' using errcode = 'P0001';
    end if;
    perform public.poker_patch(p_hand, p_seat, '{"acted": true, "last": "check"}');
  elsif p_action = 'call' then
    if v_bet >= h.current_bet then
      raise exception 'invalid_action' using errcode = 'P0001';
    end if;
    perform public.poker_put(p_hand, p_seat, v_call);
    perform public.poker_patch(p_hand, p_seat, jsonb_build_object('acted', true,
      'last', case when v_call = v_stack then 'allin' else 'call' end));
  elsif p_action in ('raise', 'allin') then
    v_to := case when p_action = 'allin' then v_bet + v_stack else p_amount end;
    if v_to is null or v_to > v_bet + v_stack then
      raise exception 'raise_too_big' using errcode = 'P0001';
    end if;
    if v_to <= h.current_bet then
      -- all-in que não cobre a aposta é um pagar
      if p_action <> 'allin' then
        raise exception 'raise_too_small' using errcode = 'P0001';
      end if;
      perform public.poker_put(p_hand, p_seat, v_stack);
      perform public.poker_patch(p_hand, p_seat, '{"acted": true, "last": "allin"}');
    else
      if (p ->> 'capped')::boolean then
        raise exception 'invalid_action' using errcode = 'P0001';
      end if;
      if v_to < v_bet + v_stack then
        if v_to % 5 <> 0 then
          raise exception 'invalid_action' using errcode = 'P0001';
        end if;
        if v_to < h.current_bet + greatest(h.last_raise, v_bb) then
          raise exception 'raise_too_small' using errcode = 'P0001';
        end if;
      end if;
      perform public.poker_put(p_hand, p_seat, v_to - v_bet);
      if v_to - h.current_bet >= greatest(h.last_raise, v_bb) then
        -- aumento completo: todo mundo volta a falar, podendo aumentar
        update public.poker_hands
           set last_raise = v_to - h.current_bet, current_bet = v_to,
               players = (select jsonb_object_agg(e.key, case when e.key = p_seat::text then e.value
                                                              else e.value || '{"acted": false, "capped": false}' end)
                            from jsonb_each(players) e)
         where id = p_hand;
      else
        -- all-in curto: quem já tinha falado só paga ou corre
        update public.poker_hands
           set current_bet = v_to,
               players = (select jsonb_object_agg(e.key, case when e.key <> p_seat::text and (e.value ->> 'acted')::boolean
                                                              then e.value || '{"acted": false, "capped": true}'
                                                              else e.value end)
                            from jsonb_each(players) e)
         where id = p_hand;
      end if;
      perform public.poker_patch(p_hand, p_seat, jsonb_build_object('acted', true,
        'last', case when v_to = v_bet + v_stack then 'allin' else 'raise' end));
    end if;
  else
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  update public.poker_hands set action_no = action_no + 1 where id = p_hand;
end;
$$;

-- anda a mão: próxima vez, próxima rua, mesa revelada no all-in, ou fim
create or replace function public.poker_advance(p_hand uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  h      public.poker_hands;
  sec    public.poker_secrets;
  s      public.poker_seats;
  p      jsonb;
  v_bb   int := (select big_blind from public.poker_tables where id = 1);
  v_live int;
  v_can  smallint[];
  v_need smallint[];
  v_next smallint;
  v_n    int;
begin
  loop
    select * into h from public.poker_hands where id = p_hand;
    exit when h.status <> 'betting';
    select count(*) filter (where not (e.value ->> 'folded')::boolean),
           coalesce(array_agg(e.key::smallint order by e.key::smallint)
                    filter (where not (e.value ->> 'folded')::boolean and not (e.value ->> 'all_in')::boolean), '{}'),
           coalesce(array_agg(e.key::smallint order by e.key::smallint)
                    filter (where not (e.value ->> 'folded')::boolean and not (e.value ->> 'all_in')::boolean
                              and (not (e.value ->> 'acted')::boolean or (e.value ->> 'bet')::int < h.current_bet)), '{}')
      into v_live, v_can, v_need
      from jsonb_each(h.players) e;

    if v_live <= 1 then
      perform public.poker_finish(p_hand);
      return;
    end if;
    -- só um ainda pode apostar e já cobriu: não tem contra quem
    if cardinality(v_can) = 1 and (h.players -> v_can[1]::text ->> 'bet')::int >= h.current_bet then
      v_need := '{}';
    end if;

    if cardinality(v_need) > 0 then
      v_next := public.poker_next(h.to_act, v_need);
      update public.poker_hands set to_act = v_next, deadline = now() + interval '30 seconds' where id = p_hand;
      select * into s from public.poker_seats where seat = v_next;
      p := h.players -> v_next::text;
      -- ausente, saindo ou o lugar já não é dele: joga na hora (ausente: mesa se pode; saindo: corre)
      if s.user_id is distinct from (p ->> 'user_id')::uuid or s.leaving or s.status = 'away' then
        perform public.poker_apply(p_hand, v_next,
          case when s.user_id = (p ->> 'user_id')::uuid and not s.leaving
                    and (p ->> 'bet')::int >= h.current_bet then 'check' else 'fold' end);
        continue;
      end if;
      return;
    end if;

    -- rodada fechada
    v_n := (select count(*) from jsonb_object_keys(h.players));
    select * into sec from public.poker_secrets where hand_id = p_hand;
    if h.street = 'river' then
      update public.poker_hands set street = 'showdown' where id = p_hand;
      perform public.poker_finish(p_hand);
      return;
    end if;
    if cardinality(v_can) <= 1 then
      -- ninguém mais aposta: abre o resto da mesa de uma vez (a tela solta com pausa)
      update public.poker_hands
         set board = sec.deck[2 * v_n + 1 : 2 * v_n + 5], runout = cardinality(board) < 5, street = 'showdown'
       where id = p_hand;
      perform public.poker_finish(p_hand);
      return;
    end if;
    update public.poker_hands
       set street = case street when 'preflop' then 'flop' when 'flop' then 'turn' else 'river' end,
           board = sec.deck[2 * v_n + 1 : 2 * v_n + (case street when 'preflop' then 3 when 'flop' then 4 else 5 end)],
           players = (select jsonb_object_agg(e.key, e.value || jsonb_build_object('bet', 0, 'acted', false, 'capped', false,
                        'last', case when (e.value ->> 'folded')::boolean then 'fold'
                                     when (e.value ->> 'all_in')::boolean then 'allin' end))
                        from jsonb_each(players) e),
           current_bet = 0, last_raise = v_bb, to_act = button, deadline = null
     where id = p_hand;
  end loop;
end;
$$;

-- fim: devolve a aposta não paga, mostra quem chegou, monta os potes, paga e marca a próxima mão
create or replace function public.poker_finish(p_hand uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  h        public.poker_hands;
  sec      public.poker_secrets;
  v_top    text;
  v_refund int;
  v_live   smallint[];
  v_show   boolean;
  v_ranks  jsonb := '{}';
  v_names  jsonb := '{}';
  v_lvl    int;
  v_prev   int := 0;
  v_amount int;
  v_total  int;
  v_elig   smallint[];
  v_best   int[];
  v_r      int[];
  v_win    smallint[];
  v_share  int;
  v_pots   jsonb := '[]';
  v_pay    jsonb := '{}';
  v_user   uuid;
  w        smallint;
  i        int;
begin
  select * into h from public.poker_hands where id = p_hand for update;
  if h.status <> 'betting' then
    return;
  end if;
  select * into sec from public.poker_secrets where hand_id = p_hand;

  -- aposta que ninguém pagou volta para quem apostou (só o maior pode ter sobra)
  select e.key, (e.value ->> 'total')::int
           - coalesce((select max((f.value ->> 'total')::int) from jsonb_each(h.players) f where f.key <> e.key), 0)
    into v_top, v_refund
    from jsonb_each(h.players) e
   order by (e.value ->> 'total')::int desc
   limit 1;
  if v_refund > 0 then
    v_user := (h.players -> v_top ->> 'user_id')::uuid;
    update public.poker_seats set stack = stack + v_refund where seat = v_top::smallint and user_id = v_user;
    if not found then
      perform public.games_ensure_wallet(v_user);
      perform public.games_move(v_user, v_refund, 'cashout');
    end if;
    perform public.poker_patch(p_hand, v_top::smallint, jsonb_build_object(
      'total', (h.players -> v_top ->> 'total')::int - v_refund,
      'bet', greatest((h.players -> v_top ->> 'bet')::int - v_refund, 0)));
    select * into h from public.poker_hands where id = p_hand;
  end if;
  select coalesce(sum((e.value ->> 'total')::int), 0) into v_total from jsonb_each(h.players) e;

  select coalesce(array_agg(e.key::smallint order by e.key::smallint), '{}') into v_live
    from jsonb_each(h.players) e where not (e.value ->> 'folded')::boolean;
  v_show := cardinality(v_live) > 1;
  if v_show then
    foreach w in array v_live loop
      v_r := public.poker_rank(h.board || array(select x::smallint from jsonb_array_elements_text(sec.holes -> w::text) x));
      v_ranks := v_ranks || jsonb_build_object(w::text, to_jsonb(v_r));
      v_names := v_names || jsonb_build_object(w::text, public.poker_rank_name(v_r));
      h.shown := h.shown || jsonb_build_object(w::text, sec.holes -> w::text);
    end loop;
  end if;

  -- um pote por nível de contribuição de quem chegou; cada um disputado por quem pôs até ali
  for v_lvl in select distinct (e.value ->> 'total')::int from jsonb_each(h.players) e
                where not (e.value ->> 'folded')::boolean order by 1 loop
    select coalesce(sum(least((e.value ->> 'total')::int, v_lvl) - least((e.value ->> 'total')::int, v_prev)), 0)
      into v_amount from jsonb_each(h.players) e;
    v_elig := array(select x from unnest(v_live) x where (h.players -> x::text ->> 'total')::int >= v_lvl order by x);
    v_prev := v_lvl;
    continue when v_amount = 0;
    if v_show then
      v_best := null;
      v_win := '{}';
      foreach w in array v_elig loop
        v_r := array(select x::int from jsonb_array_elements_text(v_ranks -> w::text) with ordinality a(x, n) order by n);
        if v_best is null or v_r > v_best then
          v_best := v_r;
          v_win := array[w];
        elsif v_r = v_best then
          v_win := v_win || w;
        end if;
      end loop;
    else
      v_win := v_elig;
    end if;
    -- a ficha que sobra vai para o primeiro vencedor à esquerda do botão
    v_win := array(select x from unnest(v_win) x order by (x - h.button + 5) % 6);
    v_share := v_amount / cardinality(v_win);
    for i in 1 .. cardinality(v_win) loop
      v_pay := v_pay || jsonb_build_object(v_win[i]::text,
        coalesce((v_pay ->> v_win[i]::text)::int, 0) + v_share
        + case when i = 1 then v_amount - v_share * cardinality(v_win) else 0 end);
    end loop;
    v_pots := v_pots || jsonb_build_array(jsonb_build_object('amount', v_amount, 'winners', to_jsonb(v_win),
      'name', case when v_show then public.poker_rank_name(v_best) end));
  end loop;
  -- trava de segurança: nada some (sobra, se houver, vai para o primeiro vencedor do último pote)
  v_amount := v_total - coalesce((select sum(value::int) from jsonb_each_text(v_pay)), 0);
  if v_amount > 0 then
    v_pay := v_pay || jsonb_build_object(v_win[1]::text, (v_pay ->> v_win[1]::text)::int + v_amount);
  end if;

  for w in select x::smallint from jsonb_object_keys(v_pay) x loop
    v_user := (h.players -> w::text ->> 'user_id')::uuid;
    update public.poker_seats set stack = stack + (v_pay ->> w::text)::int where seat = w and user_id = v_user;
    if not found then
      perform public.games_ensure_wallet(v_user);
      perform public.games_move(v_user, (v_pay ->> w::text)::int, 'cashout');
    end if;
  end loop;

  update public.poker_hands
     set status = 'done', street = case when v_show then 'showdown' else street end, to_act = null, deadline = null,
         ended_at = now(), shown = h.shown,
         results = jsonb_build_object('showdown', v_show, 'pots', v_pots, 'payouts', v_pay, 'hands', v_names)
   where id = p_hand;
  update public.poker_seats set busted_at = now() where stack = 0 and busted_at is null;
  for w in select seat from public.poker_seats where leaving loop
    perform public.poker_stand(w, true);
  end loop;
  update public.poker_tables
     set next_hand_at = now() + case when h.runout then interval '8 seconds' else interval '5 seconds' end
   where id = 1;
end;
$$;
```

- [ ] **Step 5: Funções do app (mão)**

Acrescentar logo depois:

```sql
-- jogada de quem está na vez; p_action_no = número da mão que a tela viu (diferente: a mesa mudou)
create or replace function public.poker_act(p_hand uuid, p_action_no int, p_action text, p_amount int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h      public.poker_hands;
  v_seat smallint;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform 1 from public.poker_tables where id = 1 for update;
  select seat into v_seat from public.poker_seats where user_id = auth.uid();
  if v_seat is null then
    raise exception 'not_seated' using errcode = 'P0001';
  end if;
  select * into h from public.poker_hands where id = p_hand;
  if h.id is null or h.status <> 'betting' or h.action_no <> p_action_no then
    raise exception 'stale_seq' using errcode = 'P0001';
  end if;
  if h.to_act is distinct from v_seat or (h.players -> v_seat::text ->> 'user_id')::uuid <> auth.uid() then
    raise exception 'not_your_turn' using errcode = 'P0001';
  end if;
  if p_action is null or p_action not in ('fold', 'check', 'call', 'raise', 'allin') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  perform public.poker_apply(p_hand, v_seat, p_action, p_amount);
  update public.poker_seats set timeouts = 0 where seat = v_seat;
  perform public.poker_advance(p_hand);
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;

-- mostra as minhas 2 cartas da última mão (correu ou levou sem showdown), até a próxima começar
create or replace function public.poker_show()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h       public.poker_hands;
  v_key   text;
  v_cards jsonb;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform 1 from public.poker_tables where id = 1 for update;
  select * into h from public.poker_hands order by hand_no desc limit 1;
  if h.id is null or h.status <> 'done' then
    raise exception 'nothing_to_show' using errcode = 'P0001';
  end if;
  select e.key into v_key from jsonb_each(h.players) e where (e.value ->> 'user_id')::uuid = auth.uid();
  select holes -> v_key into v_cards from public.poker_secrets where hand_id = h.id;
  if v_key is null or v_cards is null or h.shown ? v_key then
    raise exception 'nothing_to_show' using errcode = 'P0001';
  end if;
  update public.poker_hands set shown = shown || jsonb_build_object(v_key, v_cards) where id = h.id;
  perform public.poker_snapshot();
  return public.poker_state();
end;
$$;

-- só as minhas cartas, da mão aberta ou da que acabou de acabar
create or replace function public.poker_my_cards()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h     public.poker_hands;
  v_key text;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into h from public.poker_hands order by hand_no desc limit 1;
  select e.key into v_key from jsonb_each(h.players) e where (e.value ->> 'user_id')::uuid = auth.uid();
  if v_key is null then
    return null;
  end if;
  return (select jsonb_build_object('hand_id', h.id, 'cards', s.holes -> v_key)
            from public.poker_secrets s where s.hand_id = h.id);
end;
$$;

-- últimas 20 mãos que acabaram (o que foi público na hora)
create or replace function public.poker_history()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'no', x.hand_no, 'board', to_jsonb(x.board), 'results', x.results, 'shown', x.shown,
             'players', (select jsonb_object_agg(e.key, e.value -> 'user_id') from jsonb_each(x.players) e),
             'ended_at', x.ended_at) order by x.hand_no desc)
      from (select * from public.poker_hands where status = 'done' order by hand_no desc limit 20) x), '[]');
end;
$$;

revoke all on function public.poker_apply(uuid, smallint, text, int) from public, anon, authenticated;
revoke all on function public.poker_advance(uuid) from public, anon, authenticated;
revoke all on function public.poker_finish(uuid) from public, anon, authenticated;
revoke all on function public.poker_act(uuid, int, text, int) from public, anon;
revoke all on function public.poker_show() from public, anon;
revoke all on function public.poker_my_cards() from public, anon;
revoke all on function public.poker_history() from public, anon;
grant execute on function public.poker_act(uuid, int, text, int) to authenticated;
grant execute on function public.poker_show() to authenticated;
grant execute on function public.poker_my_cards() to authenticated;
grant execute on function public.poker_history() to authenticated;
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test --prefix games -- pokerHand pokerTable`
Expected: PASS. Se algum número de pote/pilha não bater, depurar com `select state from poker_tables` no teste antes de mexer no esperado: os valores do teste foram calculados à mão a partir das regras da spec.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0030_poker.sql games/test/pokerHand.test.ts
git commit -m "Poker: motor da mão (cegas, apostas, potes paralelos, showdown, mostrar, histórico)"
```

### Task 4: Relógio — vez vencida, ausente, saindo, sem fichas, mesa fechada, cron

**Files:**
- Modify: `supabase/migrations/0030_poker.sql` (seção "Relógio" antes da linha final)
- Create: `games/test/pokerClock.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3 (`poker_apply`, `poker_advance`, `poker_stand`, `poker_maybe_start`, `poker_snapshot`, `poker_state`, `poker_patch`).
- Produces: `poker_tick() → jsonb` (null quando chamado sem usuário); job `fellas-poker-tick` (`* * * * *`).

- [ ] **Step 1: Testes que falham**

`games/test/pokerClock.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';
import { act, balance, expireTurn, members, nextHand, OUT, P, rigDeck, sit, startHand, state, tick, type State } from './poker';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb();
  await members(t);
});

describe('vez vencida', () => {
  it('nada acontece antes do prazo', async () => {
    const before = (await startHand(t, { 0: 300, 1: 300 }, 0)).hand!;
    await tick(t);
    expect((await state(t)).hand).toMatchObject({ action_no: before.action_no, to_act: before.to_act });
  });

  it('estourou em 2 mãos seguidas: fica ausente e a vez dele é jogada na hora', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await expireTurn(t);
    await tick(t); // mão 1: o 1 tinha 5 a pagar → corre (1º estouro)
    let s = await state(t);
    expect(s.hand).toMatchObject({ status: 'done' });
    expect(s.hand!.players['1']).toMatchObject({ folded: true, timed_out: true });

    s = await nextHand(t); // mão 2: cega grande no 1; o botão (0) fala primeiro
    expect(s.hand).toMatchObject({ bb: 1, to_act: 0 });
    await act(t, 0, 'call');
    await expireTurn(t);
    await tick(t); // o 1 não tinha nada a pagar → mesa (2º estouro) → ausente
    s = await state(t);
    expect(s.seats.find((x) => x.seat === 1)).toMatchObject({ status: 'away' });
    // flop: a vez do 1 (ausente) é jogada na hora; volta para o 0
    expect(s.hand).toMatchObject({ street: 'flop', to_act: 0 });
    expect(s.hand!.players['1'].last).toBe('check');

    s = await act(t, 0, 'raise', 20); // ausente com aposta a pagar: corre na hora
    expect(s.hand).toMatchObject({ status: 'done' });
    expect(s.hand!.players['1'].folded).toBe(true);

    s = await nextHand(t); // só 1 pronto: nada de mão nova
    expect(s.hand!.status).toBe('done');

    await t.as(P[1]);
    s = await t.rpc<State>('poker_back'); // mesa parada: volta e a mão sai na hora
    expect(s.hand).toMatchObject({ status: 'betting' });
    expect(Object.keys(s.hand!.players).sort()).toEqual(['0', '1']);
  });

  it('jogada própria zera os estouros', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await q('update public.poker_seats set timeouts = 1 where seat = 1');
    await act(t, 1, 'call');
    expect(await q('select timeouts from public.poker_seats where seat = 1')).toEqual([{ timeouts: 0 }]);
  });

  it('jogada atrasada depois do relógio é recusada', async () => {
    const h = (await startHand(t, { 0: 300, 1: 300 }, 0)).hand!;
    await expireTurn(t);
    await tick(t);
    await t.as(P[1]);
    await expect(
      t.rpc('poker_act', { p_hand: h.id, p_action_no: h.action_no, p_action: 'call', p_amount: null }),
    ).rejects.toThrow(/stale_seq/);
    expect((await state(t)).hand!.players['1'].folded).toBe(true); // jogou uma vez só
  });
});

describe('quem sai e quem some', () => {
  it('ausente há 10 minutos é levantado e as fichas voltam', async () => {
    await sit(t, 0, 300);
    await q(`update public.poker_seats set status = 'away', away_since = now() - interval '11 minutes'`);
    await tick(t);
    expect((await state(t)).seats).toEqual([]);
    expect(await balance(t, P[0])).toBe(1000);
  });

  it('quem sai no meio da mão corre quando a vez chega e levanta no fim', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await t.as(P[2]);
    let s = await t.rpc<State>('poker_leave');
    expect(s.seats.find((x) => x.seat === 2)).toMatchObject({ leaving: true });
    await act(t, 0, 'call');
    s = await act(t, 1, 'fold'); // vez do 2 (saindo): corre na hora → só o 0 sobra
    expect(s.hand).toMatchObject({ status: 'done' });
    expect(s.hand!.players['2'].folded).toBe(true);
    expect(s.seats.map((x) => x.seat)).toEqual([0, 1]);
    expect(await balance(t, P[2])).toBe(1000 + 290);
  });

  it('quem sai estando all-in fica até o fim', async () => {
    await rigDeck(t, ['Ah', 'Ad', '2c', '7d', 'Ks', 'Qh', '9c', '4d', '3s']); // ordem: 0 (cega grande), 1
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await act(t, 1, 'raise', 50);
    await act(t, 0, 'allin');
    await t.as(P[0]);
    await t.rpc('poker_leave');
    const s = await act(t, 1, 'call');
    expect(s.hand).toMatchObject({ status: 'done', runout: true });
    expect(s.hand!.results!.payouts).toEqual({ '0': 600 });
    expect(s.seats.map((x) => x.seat)).toEqual([1]);
    expect(await balance(t, P[0])).toBe(1000 + 600);
  });

  it('sem fichas: completa no minuto e volta a receber cartas', async () => {
    await rigDeck(t, ['Ah', 'Ad', '2c', '7d', 'Ks', 'Qh', '9c', '4d', '3s']);
    await startHand(t, { 0: 300, 1: 100 }, 0);
    await act(t, 1, 'allin');
    let s = await act(t, 0, 'call');
    expect(s.seats.find((x) => x.seat === 1)).toMatchObject({ stack: 0, busted: true });
    s = await nextHand(t);
    expect(s.hand!.status).toBe('done'); // só o 0 tem fichas
    await t.as(P[1]);
    s = await t.rpc<State>('poker_rebuy', { p_amount: 200 });
    expect(s.seats.find((x) => x.seat === 1)).toMatchObject({ stack: 200 - 10, busted: false }); // já pagou a cega grande
    expect(Object.keys(s.hand!.players).sort()).toEqual(['0', '1']);
  });

  it('sem fichas: depois de 1 minuto levanta, sem lançamento de 0', async () => {
    await rigDeck(t, ['Ah', 'Ad', '2c', '7d', 'Ks', 'Qh', '9c', '4d', '3s']);
    await startHand(t, { 0: 300, 1: 100 }, 0);
    await act(t, 1, 'allin');
    await act(t, 0, 'call');
    await q(`update public.poker_seats set busted_at = now() - interval '61 seconds' where seat = 1`);
    await tick(t);
    expect((await state(t)).seats.map((x) => x.seat)).toEqual([0]);
    expect(await q(`select count(*)::int as n from public.game_ledger where user_id = $1 and reason = 'cashout'`, [P[1]])).toEqual([{ n: 0 }]);
  });
});

describe('mesa fechada e cron', () => {
  it('domingo 23:55 em diante a mesa fecha; segunda 00:00 abre', async () => {
    const closed = async (ts: string) =>
      (await q<{ c: boolean }>(`select public.poker_closed($1::timestamptz) as c`, [ts]))[0].c;
    expect(await closed('2026-10-11 23:54:59-03')).toBe(false);
    expect(await closed('2026-10-11 23:55:00-03')).toBe(true);
    expect(await closed('2026-10-12 00:00:00-03')).toBe(false);
    expect(await closed('2026-10-10 23:59:00-03')).toBe(false);
  });

  it('o relógio roda pelo cron a cada minuto', async () => {
    expect(await q(`select schedule, command from cron.jobs where name = 'fellas-poker-tick'`)).toEqual([
      { schedule: '* * * * *', command: 'select public.poker_tick()' },
    ]);
  });

  it('membro chamando o relógio recebe o retrato; não membro é barrado', async () => {
    await t.as(P[0]);
    expect(await t.rpc<State>('poker_tick')).toMatchObject({ seats: [], hand: null });
    await t.as(OUT);
    await expect(t.rpc('poker_tick')).rejects.toThrow(/not_member/);
  });
});
```

> Nota do "completa no minuto": o `poker_rebuy` chama `poker_maybe_start`; a pausa já venceu (o `nextHand` a pôs no passado) e a mão sai na hora. A cega grande anda (a última foi do 0), então o 1 paga 10 — daí `200 - 10`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --prefix games -- pokerClock`
Expected: FAIL (`function public.poker_tick() does not exist`).

- [ ] **Step 3: Relógio**

Acrescentar antes da linha final `select public.poker_snapshot();`:

```sql
-- ===== Relógio =====
-- vez vencida, ausente de 10 min, sem fichas há 1 min e a próxima mão. Qualquer membro pode chamar (o app chama
-- quando o prazo passa); o cron chama sem usuário a cada minuto. Só age por prazo: chamar antes não faz nada.
create or replace function public.poker_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t       public.poker_tables;
  h       public.poker_hands;
  p       jsonb;
  v_seat  smallint;
  v_moved boolean := false;
begin
  if auth.uid() is not null and not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into t from public.poker_tables where id = 1 for update;

  -- vez vencida: mesa se pode, senão corre; conta um estouro por mão; 2 mãos seguidas → ausente
  select * into h from public.poker_hands where status = 'betting';
  if h.id is not null and h.deadline < now() then
    v_seat := h.to_act;
    p := h.players -> v_seat::text;
    if not (p ->> 'timed_out')::boolean then
      update public.poker_seats
         set timeouts = timeouts + 1,
             status = case when timeouts + 1 >= 2 then 'away' else status end,
             away_since = case when timeouts + 1 >= 2 then now() else away_since end
       where seat = v_seat and user_id = (p ->> 'user_id')::uuid;
      perform public.poker_patch(h.id, v_seat, '{"timed_out": true}');
    end if;
    perform public.poker_apply(h.id, v_seat,
      case when (p ->> 'bet')::int >= h.current_bet then 'check' else 'fold' end);
    perform public.poker_advance(h.id);
    v_moved := true;
  end if;

  -- fora da mão (ou já tendo corrido): ausente há 10 min e sem fichas há 1 min levantam
  for v_seat in
    select s.seat from public.poker_seats s
     where ((s.status = 'away' and s.away_since < now() - interval '10 minutes')
            or (s.stack = 0 and s.busted_at < now() - interval '1 minute'))
       and not exists (select 1 from public.poker_hands x
                        where x.status = 'betting' and x.players ? s.seat::text
                          and (x.players -> s.seat::text ->> 'user_id')::uuid = s.user_id
                          and not (x.players -> s.seat::text ->> 'folded')::boolean)
  loop
    perform public.poker_stand(v_seat, true);
    v_moved := true;
  end loop;

  -- próxima mão (poker_maybe_start confere de novo pausa e mesa fechada)
  if not exists (select 1 from public.poker_hands where status = 'betting') then
    perform public.poker_maybe_start();
    v_moved := v_moved or exists (select 1 from public.poker_hands where status = 'betting');
  end if;

  if v_moved then
    perform public.poker_snapshot();
  end if;
  if auth.uid() is null then
    return null;
  end if;
  return public.poker_state();
end;
$$;

revoke all on function public.poker_tick() from public, anon;
grant execute on function public.poker_tick() to authenticated;

select cron.schedule('fellas-poker-tick', '* * * * *', $$select public.poker_tick()$$);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --prefix games -- pokerClock pokerHand pokerTable`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0030_poker.sql games/test/pokerClock.test.ts
git commit -m "Poker: relógio (vez vencida, ausente, saindo, sem fichas, mesa fechada) e cron de 1 minuto"
```

### Task 5: Semana (M2), segurança e simulação de 200 mãos

**Files:**
- Modify: `supabase/migrations/0030_poker.sql` (seção "Semana" antes da linha final)
- Create: `games/test/pokerWeek.test.ts`, `games/test/pokerSim.test.ts`

**Interfaces:**
- Consumes: 0027 (`games_weekly_reset` original, para copiar o corpo), 0028 (`bj_force_finish`), Tasks 2–4.
- Produces: `games_close_open_rounds()` (anula a mão de poker, levanta todos sem anti-rathole, fecha Blackjack), `games_weekly_reset()` (trava mesa e carteiras antes de tudo).

- [ ] **Step 1: Testes que falham**

`games/test/pokerWeek.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';
import { act, balance, members, nextHand, OUT, P, sit, state } from './poker';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const ageWeek = () => q(`update public.game_wallets set week_start = week_start - 7`);

beforeEach(async () => {
  t = await freshDb();
  await members(t);
});

describe('reset da semana (M2)', () => {
  it('anula a mão aberta, devolve as apostas, levanta todo mundo e conta as fichas no pódio', async () => {
    await sit(t, 0, 300);
    await sit(t, 1, 300); // mesa parada: a mão sai; cega grande no 0, o 1 fala
    await act(t, 1, 'raise', 50);
    await q('update public.poker_seats set stack = stack + 500 where seat = 0'); // o 0 vinha ganhando
    await ageWeek();
    await q('select public.games_weekly_reset()');

    const s = await state(t);
    expect(s.seats).toEqual([]);
    expect(s.hand!.status).toBe('void');
    // 0: carteira 700 + mesa (290 + 500) + 10 devolvido = 1.500; 1: 700 + 250 + 50 = 1.000
    expect(await q('select podium from public.game_weeks')).toEqual([
      {
        podium: [
          { user_id: P[0], balance: 1500, fiado_count: 0 },
          { user_id: P[1], balance: 1000, fiado_count: 0 },
        ],
      },
    ]);
    expect(await balance(t, P[0])).toBe(1000);
    expect(await q('select count(*)::int as n from public.poker_leaves')).toEqual([{ n: 0 }]); // sem anti-rathole
    expect(await q('select count(*)::int as n from public.poker_secrets')).toEqual([{ n: 0 }]);
  });

  it('reset devolve a aposta de quem já tinha levantado', async () => {
    await sit(t, 0, 300);
    await sit(t, 1, 300); // mão 1: 0 e 1
    await sit(t, 2, 300);
    await act(t, 1, 'fold'); // 0 leva: 305 × 295
    await q('update public.poker_seats set wait_bb = false');
    let s = await nextHand(t); // mão 2: cega grande no 1, pequena no 0, botão no 2
    expect(s.hand).toMatchObject({ bb: 1, sb: 0, button: 2, to_act: 2 });
    await act(t, 2, 'call');
    await act(t, 0, 'fold'); // pôs 5 e correu
    await q('select public.poker_stand(0::smallint, true)'); // levantado (como o ausente de 10 min)
    await q('select public.games_close_open_rounds()');
    // 0: 700 + 300 (levantou) + 5 (anulada); 1: 700 + 285 + 10; 2: 700 + 290 + 10
    expect([await balance(t, P[0]), await balance(t, P[1]), await balance(t, P[2])]).toEqual([1005, 995, 1000]);
    s = await state(t);
    expect(s.seats).toEqual([]);
  });

  it('segunda chamada do reset não mexe na mesa', async () => {
    await sit(t, 0, 300);
    await ageWeek();
    await q('select public.games_weekly_reset()');
    const seq = (await state(t)).seq;
    await q('select public.games_weekly_reset()');
    expect((await state(t)).seq).toBe(seq);
  });
});

describe('segurança', () => {
  const denied = /permission denied/;

  it('ninguém lê o baralho nem as saídas', async () => {
    await t.as(P[0]);
    await expect(t.asRole('authenticated', 'select * from public.poker_secrets')).rejects.toThrow(denied);
    await expect(t.asRole('authenticated', 'select * from public.poker_leaves')).rejects.toThrow(denied);
  });

  it('o app não escreve direto nas tabelas da mesa', async () => {
    await t.as(P[0]);
    await expect(
      t.asRole('authenticated', `insert into public.poker_seats (seat, user_id, stack) values (0, '${P[0]}', 500)`),
    ).rejects.toThrow(denied);
    await expect(t.asRole('authenticated', 'update public.poker_tables set seq = 0')).rejects.toThrow(denied);
    await expect(t.asRole('authenticated', `update public.poker_hands set status = 'void'`)).rejects.toThrow(denied);
  });

  it('funções internas fechadas para o app; anon não chama nada', async () => {
    await t.as(P[0]);
    for (const fn of [
      'poker_maybe_start()',
      'poker_snapshot()',
      `poker_stand(0::smallint, true)`,
      `poker_finish('00000000-0000-0000-0000-000000000000'::uuid)`,
      `poker_rank('{0,1,2,3,4}'::smallint[])`,
      'games_close_open_rounds()',
    ]) {
      await expect(t.asRole('authenticated', `select public.${fn}`)).rejects.toThrow(denied);
    }
    await expect(t.asRole('anon', 'select public.poker_state()')).rejects.toThrow(denied);
    await expect(t.asRole('anon', 'select public.poker_tick()')).rejects.toThrow(denied);
  });

  it('membro lê a mesa; quem não é membro não vê nada', async () => {
    await t.as(P[0]);
    expect(await t.asRole('authenticated', 'select id from public.poker_tables')).toEqual([{ id: 1 }]);
    await t.as(OUT);
    expect(await t.asRole('authenticated', 'select id from public.poker_tables')).toEqual([]);
  });
});
```

`games/test/pokerSim.test.ts`:

```ts
// 6 fellas, 200 mãos com jogadas aleatórias válidas (semente fixa), relógio estourando, entradas, saídas e
// completas. A cada passo: carteiras + fichas na mesa + apostas da mão aberta = constante (nenhum crédito surge ou
// some), e o extrato de cada um soma o saldo.
import { beforeAll, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';
import { act, balance, expireTurn, members, nextHand, P, sit, state, tick, type State } from './poker';

let t: TestDb;
let expected = 0;

function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const one = async <T>(sql: string) => (await t.db.query<{ v: T }>(sql)).rows[0].v;

async function invariants() {
  const total = await one<number>(`
    select ((select coalesce(sum(balance), 0) from public.game_wallets)
          + (select coalesce(sum(stack), 0) from public.poker_seats)
          + coalesce((select sum((e.value ->> 'total')::int)
                        from public.poker_hands h, jsonb_each(h.players) e where h.status = 'betting'), 0))::int as v`);
  expect(total).toBe(expected);
  expect(
    await one<number>(`select count(*)::int as v from public.game_wallets w
                        where w.balance <> (select sum(delta) from public.game_ledger l where l.user_id = w.user_id)`),
  ).toBe(0);
}

async function randomAct(s: State, r: () => number) {
  const h = s.hand!;
  const seat = h.to_act!;
  const p = h.players[String(seat)];
  const stack = s.seats.find((x) => x.seat === seat)!.stack;
  const facing = h.current_bet > p.bet;
  const x = r();
  const safe = facing ? 'call' : 'check';
  try {
    if (x < 0.15) await act(t, seat, 'fold');
    else if (x < 0.6) await act(t, seat, safe);
    else if (x < 0.9) await act(t, seat, 'raise', Math.min(h.min_raise_to + 5 * Math.floor(r() * 10), p.bet + stack));
    else await act(t, seat, 'allin');
  } catch {
    await act(t, seat, safe); // aumento que não vale (ex.: só pode pagar depois de all-in curto)
  }
}

async function betweenHands(s: State, r: () => number) {
  // recusas (carteira curta, etc.) fazem parte: o que importa é nada surgir ou sumir
  const call = (fn: string, args?: Record<string, unknown>) => t.rpc(fn, args).catch(() => null);
  for (const seat of s.seats) {
    await t.as(P[seat.seat]);
    const x = r();
    if (seat.status === 'away') await call('poker_back');
    else if (seat.stack === 0) await call(x < 0.7 ? 'poker_rebuy' : 'poker_leave', x < 0.7 ? { p_amount: 200 } : undefined);
    else if (x < 0.05) await call('poker_leave');
    else if (x < 0.1 && seat.stack <= 400) await call('poker_rebuy', { p_amount: 100 });
  }
  for (let i = 0; i < 6; i++) {
    if (s.seats.some((x) => x.seat === i) || r() > 0.4) continue;
    // carteira seca: entra um fiado de mentira (e o esperado sobe junto), para a mesa nunca parar
    if ((await balance(t, P[i]))! < 500) {
      await t.db.query(`update public.game_wallets set balance = balance + 500 where user_id = $1`, [P[i]]);
      await t.db.query(`insert into public.game_ledger (user_id, delta, reason) values ($1, 500, 'fiado')`, [P[i]]);
      expected += 500;
    }
    await sit(t, i, 200).catch(() => {}); // anti-rathole pode recusar: tudo bem
  }
}

beforeAll(async () => {
  t = await freshDb();
  await members(t);
});

describe('simulação', () => {
  it('200 mãos sem criar nem sumir crédito', async () => {
    const r = rng(42);
    for (let i = 0; i < 6; i++) await sit(t, i, 200 + 10 * Math.floor(r() * 31));
    expected = 6000;
    await invariants();
    let steps = 0;
    let s = await state(t);
    while ((s.hand?.no ?? 0) < 200 && steps < 20000) {
      steps++;
      if (s.hand?.status === 'betting') {
        if (r() < 0.03) {
          await expireTurn(t);
          await tick(t);
        } else {
          await randomAct(s, r);
        }
      } else {
        await betweenHands(s, r);
        await nextHand(t);
      }
      await invariants();
      s = await state(t);
    }
    expect(s.hand!.no).toBeGreaterThanOrEqual(200);
  }, 600_000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --prefix games -- pokerWeek`
Expected: FAIL (o reset ainda não mexe no poker: `seats` não vazio, `podium` sem as fichas). `pokerSim` pode já passar (as regras existem); rodar mesmo assim: `npm test --prefix games -- pokerSim` e anotar o resultado — se falhar, é bug do motor (Task 3/4): depurar com `superpowers:systematic-debugging` antes de seguir.

- [ ] **Step 3: Semana no banco**

Acrescentar antes da linha final `select public.poker_snapshot();`:

```sql
-- ===== Semana (M2) =====
-- gancho do reset: a mão de poker aberta é anulada (cada um recebe o que pôs), todo mundo levanta sem anti-rathole,
-- e o Blackjack aberto fecha como na 0028
create or replace function public.games_close_open_rounds()
returns void language plpgsql security definer set search_path = public as $$
declare
  h      public.poker_hands;
  e      record;
  v_id   uuid;
  v_seat smallint;
  v_user uuid;
  v_back int;
begin
  select * into h from public.poker_hands where status = 'betting';
  if h.id is not null then
    for e in select key, value from jsonb_each(h.players) loop
      v_user := (e.value ->> 'user_id')::uuid;
      v_back := (e.value ->> 'total')::int;
      continue when v_back = 0;
      update public.poker_seats set stack = stack + v_back where seat = e.key::smallint and user_id = v_user;
      if not found then
        -- já tinha levantado (ausente de 10 min que tinha corrido): volta direto para a carteira
        perform public.games_ensure_wallet(v_user);
        perform public.games_move(v_user, v_back, 'cashout');
      end if;
    end loop;
    update public.poker_hands set status = 'void', to_act = null, deadline = null, ended_at = now() where id = h.id;
  end if;
  delete from public.poker_secrets;
  for v_seat in select seat from public.poker_seats loop
    perform public.poker_stand(v_seat, false);
  end loop;
  delete from public.poker_leaves;
  update public.poker_tables set next_hand_at = null where id = 1;
  perform public.poker_snapshot();

  for v_id in select id from public.bj_rounds where status = 'playing' loop
    perform public.bj_force_finish(v_id);
  end loop;
end;
$$;

-- segunda 00:00 (Brasília): trava a mesa e as carteiras antes de tudo (aposta à meia-noite fica inteira numa
-- semana), fecha mãos, grava pódio (carteira + fichas, que já voltaram), passa o troféu, volta todo mundo pra 1.000
create or replace function public.games_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_new    date := public.games_week_start();
  v_old    date;
  v_podium jsonb;
  v_champ  uuid;
begin
  perform 1 from public.poker_tables where id = 1 for update;
  perform 1 from public.game_wallets where week_start < v_new for update;
  -- só quem ficou na semana velha: quem criou a carteira já na semana nova (antes do cron) não conta nem zera
  select max(week_start) into v_old from public.game_wallets where week_start < v_new;
  if v_old is null then
    return;
  end if;

  perform public.games_close_open_rounds();

  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'balance', balance, 'fiado_count', fiado_count)
                            order by balance desc, fiado_count asc, last_played_at asc), '[]')
    into v_podium
    from (select * from public.game_wallets
           where last_played_at is not null and week_start < v_new
           order by balance desc, fiado_count asc, last_played_at asc
           limit 3) top;
  v_champ := (v_podium -> 0 ->> 'user_id')::uuid;

  insert into public.game_weeks (week_start, champion_id, podium)
  values (v_old, v_champ, v_podium)
  on conflict (week_start) do nothing;

  update public.profiles set badges = array_remove(badges, 'weekly_champion') where 'weekly_champion' = any (badges);
  if v_champ is not null then
    update public.profiles set badges = array_append(badges, 'weekly_champion') where id = v_champ;
  end if;

  insert into public.game_ledger (user_id, delta, reason)
  select user_id, 1000 - balance, 'reset' from public.game_wallets where balance <> 1000 and week_start < v_new;
  update public.game_wallets
     set balance = 1000, week_start = v_new, fiado_count = 0, last_fiado_on = null,
         last_played_at = null, updated_at = now()
   where week_start < v_new;
end;
$$;
```

(Os `revoke` dessas duas já existem desde a 0027/0028; `create or replace` mantém os privilégios.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --prefix games`
Expected: PASS em tudo (inclusive `credits.test.ts`, que cobre o reset do Blackjack, e `pokerSim` em menos de 10 min).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0030_poker.sql games/test/pokerWeek.test.ts games/test/pokerSim.test.ts
git commit -m "Poker: reset da semana trava carteiras e anula a mão aberta (M2); segurança; simulação de 200 mãos"
```

### Task 6: Cliente compartilhado — tipos, erros, chamadas, tempo real, ficha de 5

**Files:**
- Modify: `games/shared/types.ts`, `games/shared/errors.ts`, `games/shared/api.ts`, `games/shared/table3d/chips.ts`, `games/shared/table3d/chips.test.ts`, `games/shared/table3d/textures.ts`
- Create: `games/shared/realtime.ts`, `games/shared/errors.test.ts`

**Interfaces:**
- Produces (tipos): `PokerLast`, `PokerPlayer`, `PokerSeat`, `PokerPot`, `PokerResults`, `PokerHand`, `PokerState`, `PokerCards`, `PokerAction`, `PokerHistoryRow`, `Fella = { id; name; avatarUrl }`; `Wallet.seated_stack?: number | null`.
- Produces (api): `pokerState()`, `pokerSit(seat, buyin)`, `pokerAct(handId, actionNo, action, amount?)`, `pokerRebuy(amount)`, `pokerLeave()`, `pokerBack()`, `pokerShow()`, `pokerMyCards()`, `pokerTick()`, `pokerHistory()`, `fellas(ids): Promise<Fella[]>`; `weekBoard()` passa a usar `games_board` (soma a mesa).
- Produces (realtime): `watchTable(onState: (s: PokerState) => void, onLive: (live: boolean) => void): { stop(): void }`.
- Produces (fichas): `BLACKJACK_CHIPS`, `POKER_CHIPS = [500, 100, 50, 10, 5]`, `chipStack(amount, values = BLACKJACK_CHIPS)`; `CHIP_COLORS[5]`.

- [ ] **Step 1: Testes que falham**

`games/shared/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { ERROR_TEXT, toGameError } from './errors';

describe('erros do poker', () => {
  it('código do banco vira frase da mesa', () => {
    const cases: [string, string][] = [
      ['seat_taken', 'Alguém sentou aí primeiro'],
      ['already_seated', 'Você já está na mesa'],
      ['buyin_out_of_range', 'Entrada vai de 200 a 500'],
      ['rathole_min', 'Você levantou há pouco: volta com pelo menos o que levou'],
      ['not_seated', 'Você não está na mesa'],
      ['not_your_turn', 'Ainda não é sua vez'],
      ['stale_seq', 'A mesa mudou'],
      ['raise_too_small', 'Aumento menor que o mínimo'],
      ['raise_too_big', 'Você não tem tudo isso'],
      ['rebuy_in_hand', 'Completa quando a mão acabar'],
      ['rebuy_out_of_range', 'Completa de 10 em 10, até 500 na mesa'],
      ['nothing_to_show', 'Não tem carta pra mostrar agora'],
      ['fiado_seated', 'Levanta da mesa de poker pra pegar fiado'],
    ];
    for (const [code, text] of cases) {
      const e = toGameError({ message: code, code: 'P0001' });
      expect(e.code).toBe(code);
      expect(e.message).toBe(text);
      expect(ERROR_TEXT[e.code]).toBe(text);
    }
  });

  it('not_seated não é confundido com already_seated nem fiado_seated', () => {
    expect(toGameError({ message: 'already_seated' }).code).toBe('already_seated');
    expect(toGameError({ message: 'fiado_seated' }).code).toBe('fiado_seated');
  });
});
```

`games/shared/table3d/chips.test.ts` — acrescentar:

```ts
import { POKER_CHIPS } from './chips';

describe('chipStack no poker', () => {
  it('tem ficha de 5 (cega pequena e apostas de 5 em 5)', () => {
    expect(chipStack(5, POKER_CHIPS)).toEqual([5]);
    expect(chipStack(25, POKER_CHIPS)).toEqual([10, 10, 5]);
    expect(chipStack(25)).toEqual([10, 10]); // Blackjack continua sem a de 5
  });
});
```

(juntar o `import { POKER_CHIPS }` ao import existente de `./chips`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --prefix games -- errors chips`
Expected: FAIL (códigos desconhecidos viram `unknown`; `POKER_CHIPS` não existe).

- [ ] **Step 3: Implementar**

`games/shared/errors.ts` — o tipo, as frases e a lista do banco ganham os códigos do poker:

```ts
export type GameErrorCode =
  | 'no_session'
  | 'offline'
  | 'insufficient_credits'
  | 'bet_out_of_range'
  | 'round_open'
  | 'round_done'
  | 'round_not_found'
  | 'invalid_action'
  | 'fiado_today'
  | 'fiado_not_broke'
  | 'fiado_open_round'
  | 'fiado_seated'
  | 'seat_taken'
  | 'already_seated'
  | 'buyin_out_of_range'
  | 'rathole_min'
  | 'not_seated'
  | 'not_your_turn'
  | 'stale_seq'
  | 'raise_too_small'
  | 'raise_too_big'
  | 'rebuy_in_hand'
  | 'rebuy_out_of_range'
  | 'nothing_to_show'
  | 'unknown';
```

Em `ERROR_TEXT`, antes de `unknown`:

```ts
  fiado_seated: 'Levanta da mesa de poker pra pegar fiado',
  seat_taken: 'Alguém sentou aí primeiro',
  already_seated: 'Você já está na mesa',
  buyin_out_of_range: 'Entrada vai de 200 a 500',
  rathole_min: 'Você levantou há pouco: volta com pelo menos o que levou',
  not_seated: 'Você não está na mesa',
  not_your_turn: 'Ainda não é sua vez',
  stale_seq: 'A mesa mudou',
  raise_too_small: 'Aumento menor que o mínimo',
  raise_too_big: 'Você não tem tudo isso',
  rebuy_in_hand: 'Completa quando a mão acabar',
  rebuy_out_of_range: 'Completa de 10 em 10, até 500 na mesa',
  nothing_to_show: 'Não tem carta pra mostrar agora',
```

Em `FROM_DB`, acrescentar no fim: `'fiado_seated', 'seat_taken', 'already_seated', 'buyin_out_of_range', 'rathole_min', 'not_seated', 'not_your_turn', 'stale_seq', 'raise_too_small', 'raise_too_big', 'rebuy_in_hand', 'rebuy_out_of_range', 'nothing_to_show'`.

`games/shared/types.ts` — `Wallet` ganha `seated_stack?: number | null;` (opcional: o Blackjack e o mock antigo não precisam). Acrescentar no fim:

```ts
// Poker (0030): o retrato público da mesa (poker_tables.state) e o que só eu vejo.
export type PokerLast = 'sb' | 'bb' | 'fold' | 'check' | 'call' | 'raise' | 'allin';
export type PokerPlayer = {
  user_id: string;
  /** Aposta nesta rodada. */
  bet: number;
  /** Tudo que pôs na mão. */
  total: number;
  folded: boolean;
  all_in: boolean;
  acted: boolean;
  /** Depois de um all-in curto: só paga ou corre. */
  capped: boolean;
  last: PokerLast | null;
  timed_out: boolean;
};
export type PokerSeat = {
  seat: number;
  user_id: string;
  stack: number;
  status: 'playing' | 'away';
  wait_bb: boolean;
  leaving: boolean;
  busted: boolean;
};
export type PokerPot = { amount: number; winners: number[]; name: string | null };
export type PokerResults = {
  showdown: boolean;
  pots: PokerPot[];
  payouts: Record<string, number>;
  hands: Record<string, string>;
};
export type PokerHand = {
  id: string;
  no: number;
  status: 'betting' | 'done' | 'void';
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  board: Card[];
  /** Por lugar ("0".."5"). */
  players: Record<string, PokerPlayer>;
  pot: number;
  current_bet: number;
  min_raise_to: number;
  to_act: number | null;
  action_no: number;
  deadline: string | null;
  button: number;
  sb: number;
  bb: number;
  runout: boolean;
  results: PokerResults | null;
  shown: Record<string, Card[]>;
};
export type PokerState = {
  seq: number;
  server_now: string;
  closed: boolean;
  next_hand_at: string | null;
  blinds: [number, number];
  buyin: [number, number];
  seats: PokerSeat[];
  hand: PokerHand | null;
  /** Só na resposta das funções (não no tempo real). */
  me?: { rathole_min: number | null };
};
export type PokerCards = { hand_id: string; cards: Card[] } | null;
export type PokerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';
export type PokerHistoryRow = {
  id: string;
  no: number;
  board: Card[];
  results: PokerResults;
  shown: Record<string, Card[]>;
  players: Record<string, string>;
  ended_at: string;
};
export type Fella = { id: string; name: string; avatarUrl: string | null };
```

`games/shared/api.ts` — importar os tipos novos e acrescentar (trocando o `weekBoard` antigo):

```ts
export const pokerState = () => rpc<PokerState>('poker_state');
export const pokerSit = (seat: number, buyin: number) => rpc<PokerState>('poker_sit', { p_seat: seat, p_buyin: buyin });
export const pokerAct = (hand: string, actionNo: number, action: PokerAction, amount?: number) =>
  rpc<PokerState>('poker_act', { p_hand: hand, p_action_no: actionNo, p_action: action, p_amount: amount ?? null });
export const pokerRebuy = (amount: number) => rpc<PokerState>('poker_rebuy', { p_amount: amount });
export const pokerLeave = () => rpc<PokerState>('poker_leave');
export const pokerBack = () => rpc<PokerState>('poker_back');
export const pokerShow = () => rpc<PokerState>('poker_show');
export const pokerMyCards = () => rpc<PokerCards>('poker_my_cards');
export const pokerTick = () => rpc<PokerState | null>('poker_tick');
export const pokerHistory = () => rpc<PokerHistoryRow[]>('poker_history');

const isUrl = (p: string) => /^https?:\/\//.test(p);

/** Nome e foto dos fellas. Avatar no bucket privado: link assinado por 1 h (como o app faz). */
export async function fellas(ids: string[]): Promise<Fella[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', ids);
  if (error) throw toGameError(error);
  type Row = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
  const rows = (data ?? []) as Row[];
  const paths = rows.map((r) => r.avatar_url).filter((p): p is string => !!p && !isUrl(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from('post-images').createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.display_name || r.username || 'Alguém',
    avatarUrl: !r.avatar_url ? null : isUrl(r.avatar_url) ? r.avatar_url : (signed.get(r.avatar_url) ?? null),
  }));
}

/** Placar da semana para o painel do PC: carteira + fichas na mesa (games_board), na ordem do placar. */
export async function weekBoard(): Promise<BoardRow[]> {
  const rows = (await rpc<{ user_id: string; balance: number }[]>('games_board')).slice(0, 6);
  const names = await fellas(rows.map((r) => r.user_id)).catch(() => [] as Fella[]);
  return rows.map((r) => ({
    userId: r.user_id,
    balance: r.balance,
    name: names.find((n) => n.id === r.user_id)?.name ?? 'Alguém',
  }));
}
```

`games/shared/realtime.ts`:

```ts
// Tempo real da mesa de poker: uma linha só (poker_tables, id = 1), cujo `state` já é o retrato público inteiro.
// O Realtime respeita a política de leitura (só membros). Quem usa ignora retrato com seq menor que o que tem.
import { supabase } from './supabase';
import type { PokerState } from './types';

export type Watch = { stop(): void };

export function watchTable(onState: (s: PokerState) => void, onLive: (live: boolean) => void): Watch {
  const channel = supabase
    .channel('poker-table')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'poker_tables', filter: 'id=eq.1' }, (payload) => {
      const state = (payload.new as { state?: PokerState }).state;
      if (state && typeof state.seq === 'number') onState(state);
    })
    .subscribe((status) => onLive(status === 'SUBSCRIBED'));
  return { stop: () => void supabase.removeChannel(channel) };
}
```

`games/shared/table3d/chips.ts`:

```ts
export const BLACKJACK_CHIPS = [500, 100, 50, 10];
/** Poker aposta de 5 em 5 (a cega pequena é 5). */
export const POKER_CHIPS = [500, 100, 50, 10, 5];

/** Valor em fichas, das maiores para as menores (até 10 na pilha). */
export function chipStack(amount: number, values: number[] = BLACKJACK_CHIPS): number[] {
  const out: number[] = [];
  let left = amount;
  for (const v of values) {
    while (left >= v && out.length < 10) {
      out.push(v);
      left -= v;
    }
  }
  return out;
}
```

`games/shared/table3d/textures.ts` — em `CHIP_COLORS`, antes do `10`:

```ts
  5: { fill: '#1f9e8f', edge: '#FFFFFF', text: '#FFFFFF' },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --prefix games` e `npm run build --prefix games`
Expected: PASS; build sem erro de tipo (o `blackjack/main.ts` continua usando `weekBoard` com a mesma forma).

- [ ] **Step 5: Commit**

```bash
git add games/shared
git commit -m "Poker: tipos, erros, chamadas e canal de tempo real da mesa; placar do PC soma a mesa; ficha de 5"
```

---

### Task 7: Regras da tela (`poker/rules.ts`)

**Files:**
- Create: `games/poker/rules.ts`, `games/poker/rules.test.ts`

**Interfaces:**
- Consumes: tipos da Task 6; `Orientation` de `games/shared/table3d/layout.ts`.
- Produces: `STEP`, `seatOf(s, me)`, `playerOf(hand, me): { seat; p } | null`, `isMyTurn(s, me)`, `type Offer`, `offer(s, me): Offer | null`, `clampRaise(to, o)`, `visualOf(seat, mySeat, o)`, `secondsLeft(deadline, offsetMs, now?)`, `lastLabel(p)`, `buyinRange(s, wallet)`, `readyCount(s)`, `type Names = (userId: string) => string`, `statusLine(s, me, name, offsetMs, now?)`, `resultLine(hand, me, name)`.

- [ ] **Step 1: Teste que falha**

`games/poker/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { PokerHand, PokerPlayer, PokerState } from '../shared/types';
import {
  buyinRange,
  clampRaise,
  isMyTurn,
  lastLabel,
  offer,
  readyCount,
  resultLine,
  secondsLeft,
  statusLine,
  visualOf,
} from './rules';

const ME = 'me';
const pl = (o: Partial<PokerPlayer> = {}): PokerPlayer => ({
  user_id: 'x',
  bet: 0,
  total: 0,
  folded: false,
  all_in: false,
  acted: false,
  capped: false,
  last: null,
  timed_out: false,
  ...o,
});
const hand = (o: Partial<PokerHand> = {}): PokerHand => ({
  id: 'h1',
  no: 1,
  status: 'betting',
  street: 'preflop',
  board: [],
  players: { '0': pl({ user_id: ME, bet: 10 }), '1': pl({ user_id: 'bia', bet: 30 }) },
  pot: 40,
  current_bet: 30,
  min_raise_to: 50,
  to_act: 0,
  action_no: 3,
  deadline: '2026-10-08T12:00:30.000Z',
  button: 1,
  sb: 1,
  bb: 0,
  runout: false,
  results: null,
  shown: {},
  ...o,
});
const st = (o: Partial<PokerState> = {}): PokerState => ({
  seq: 1,
  server_now: '2026-10-08T12:00:00.000Z',
  closed: false,
  next_hand_at: null,
  blinds: [5, 10],
  buyin: [200, 500],
  seats: [
    { seat: 0, user_id: ME, stack: 290, status: 'playing', wait_bb: false, leaving: false, busted: false },
    { seat: 1, user_id: 'bia', stack: 270, status: 'playing', wait_bb: false, leaving: false, busted: false },
  ],
  hand: hand(),
  ...o,
});
const names = (id: string) => ({ bia: 'Bia', teteu: 'Teteu' })[id] ?? 'Alguém';

describe('offer', () => {
  it('pagar quanto, aumento mínimo, ½ pote e pote', () => {
    expect(offer(st(), ME)).toEqual({
      canCheck: false,
      toCall: 20,
      callAllIn: false,
      canRaise: true,
      minTo: 50,
      maxTo: 300,
      halfPotTo: 60, // 30 + (40 + 20) / 2
      potTo: 90, // 30 + 40 + 20
    });
  });

  it('fora da minha vez não oferece nada', () => {
    expect(offer(st({ hand: hand({ to_act: 1 }) }), ME)).toBeNull();
    expect(isMyTurn(st({ hand: hand({ status: 'done' }) }), ME)).toBe(false);
  });

  it('depois de all-in curto só paga; sem fichas para cobrir, pagar é all-in', () => {
    const capped = st({ hand: hand({ players: { '0': pl({ user_id: ME, bet: 10, capped: true }), '1': pl({ user_id: 'bia', bet: 30 }) } }) });
    expect(offer(capped, ME)!.canRaise).toBe(false);
    const short = st({ seats: [{ seat: 0, user_id: ME, stack: 15, status: 'playing', wait_bb: false, leaving: false, busted: false }] });
    expect(offer(short, ME)).toMatchObject({ toCall: 15, callAllIn: true, canRaise: false, maxTo: 25 });
  });

  it('régua: de 5 em 5, entre o mínimo e tudo', () => {
    const o = offer(st(), ME)!;
    expect(clampRaise(52, o)).toBe(50);
    expect(clampRaise(10, o)).toBe(50);
    expect(clampRaise(999, o)).toBe(300);
    expect(clampRaise(77, o)).toBe(75);
  });
});

describe('tela', () => {
  it('em pé eu fico embaixo; deitado os lugares são fixos', () => {
    expect(visualOf(3, 3, 'portrait')).toBe(0);
    expect(visualOf(4, 3, 'portrait')).toBe(1);
    expect(visualOf(2, 3, 'portrait')).toBe(5);
    expect(visualOf(4, 3, 'landscape')).toBe(4);
    expect(visualOf(4, null, 'portrait')).toBe(4);
  });

  it('relógio com a diferença para a hora do servidor', () => {
    const now = Date.parse('2026-10-08T12:00:00.000Z');
    expect(secondsLeft('2026-10-08T12:00:30.000Z', 0, now)).toBe(30);
    expect(secondsLeft('2026-10-08T12:00:30.000Z', 10_000, now)).toBe(20); // servidor 10 s na frente
    expect(secondsLeft('2026-10-08T12:00:30.000Z', 0, now + 60_000)).toBe(0);
    expect(secondsLeft(null, 0, now)).toBeNull();
  });

  it('o que cada um fez na rodada', () => {
    expect(lastLabel(pl({ last: 'call', bet: 40 }))).toBe('Pagou 40');
    expect(lastLabel(pl({ last: 'raise', bet: 120 }))).toBe('Aumentou p/ 120');
    expect(lastLabel(pl({ last: 'fold' }))).toBe('Correu');
    expect(lastLabel(pl({ last: 'check' }))).toBe('Mesa');
    expect(lastLabel(pl({ last: 'allin' }))).toBe('All-in');
    expect(lastLabel(pl({ last: null }))).toBeNull();
  });

  it('faixa de entrada: carteira e anti-rathole', () => {
    expect(buyinRange(st(), 740)).toEqual({ min: 200, max: 500, ok: true });
    expect(buyinRange(st(), 300)).toEqual({ min: 200, max: 300, ok: true });
    expect(buyinRange(st(), 150)).toEqual({ min: 200, max: 150, ok: false });
    expect(buyinRange(st({ me: { rathole_min: 735 } }), 2000)).toEqual({ min: 735, max: 735, ok: true });
  });
});

describe('linhas de estado', () => {
  const now = Date.parse('2026-10-08T12:00:12.000Z');

  it('vez de outro fella, com o relógio', () => {
    expect(statusLine(st({ hand: hand({ to_act: 1 }) }), ME, names, 0, now)).toBe('Vez de Bia · 18 s');
    expect(statusLine(st(), ME, names, 0, now)).toBeNull(); // minha vez: os botões falam
  });

  it('esperando gente, esperando a cega grande, saindo, sem fichas, mesa fechada', () => {
    const alone = st({ hand: null, seats: [st().seats[0]] });
    expect(readyCount(alone)).toBe(1);
    expect(statusLine(alone, ME, names, 0, now)).toBe('Esperando mais 1 fella pra começar');
    expect(statusLine(st({ hand: null, seats: [] }), null, names, 0, now)).toBe('Esperando mais 2 fellas pra começar');
    const waiting = st({
      seats: [...st().seats, { seat: 2, user_id: 'teteu', stack: 300, status: 'playing', wait_bb: true, leaving: false, busted: false }],
    });
    expect(statusLine(waiting, 'teteu', names, 0, now)).toBe('Você entra quando a cega grande chegar em você');
    const leaving = st({ seats: [{ ...st().seats[0], leaving: true }, st().seats[1]] });
    expect(statusLine(leaving, ME, names, 0, now)).toBe('Você sai no fim dessa mão');
    const busted = st({ hand: hand({ status: 'done' }), seats: [{ ...st().seats[0], stack: 0, busted: true }, st().seats[1]] });
    expect(statusLine(busted, ME, names, 0, now)).toBe('Acabaram suas fichas. Completa em até 1 minuto ou você levanta.');
    expect(statusLine(st({ hand: hand({ status: 'done' }), closed: true }), ME, names, 0, now)).toBe(
      'A mesa fecha pro reset. Volta 00:00.',
    );
  });

  it('resultado: eu levei, outro levou, dividiram, potes diferentes', () => {
    const done = (payouts: Record<string, number>, winners: number[][]) =>
      hand({
        status: 'done',
        results: { showdown: true, payouts, hands: {}, pots: winners.map((w) => ({ amount: 1, winners: w, name: null })) },
      });
    expect(resultLine(done({ '0': 240 }, [[0]]), ME, names)).toBe('Você levou 240');
    expect(resultLine(done({ '1': 1240 }, [[1]]), ME, names)).toBe('Bia levou 1.240');
    expect(resultLine(done({ '0': 150, '1': 150 }, [[0, 1]]), ME, names)).toBe('Você e Bia dividiram 300');
    expect(resultLine(done({ '0': 300, '1': 200 }, [[0], [1]]), ME, names)).toBe('Você levou 300 · Bia levou 200');
    expect(resultLine(hand(), ME, names)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --prefix games -- poker/rules`
Expected: FAIL (`Cannot find module './rules'`).

- [ ] **Step 3: Implementar**

`games/poker/rules.ts`:

```ts
// O que a tela do poker pode oferecer e o que ela escreve. Quem decide é o banco (0030); aqui só não se oferece
// o que ele recusaria, para o toque não voltar com erro.
import type { Orientation } from '../shared/table3d/layout';
import type { PokerHand, PokerPlayer, PokerSeat, PokerState } from '../shared/types';

export const STEP = 5;
const down = (n: number) => Math.floor(n / STEP) * STEP;
const fmt = (n: number) => n.toLocaleString('pt-BR');

export function seatOf(s: PokerState | null, me: string | null): PokerSeat | null {
  return (me && s?.seats.find((x) => x.user_id === me)) || null;
}

/** Meu lugar na mão (aberta ou a última), pelo user_id gravado nela. */
export function playerOf(hand: PokerHand | null, me: string | null): { seat: number; p: PokerPlayer } | null {
  if (!hand || !me) return null;
  for (const [k, p] of Object.entries(hand.players)) if (p.user_id === me) return { seat: Number(k), p };
  return null;
}

export function isMyTurn(s: PokerState | null, me: string | null): boolean {
  const h = s?.hand ?? null;
  const mine = playerOf(h, me);
  return !!h && h.status === 'betting' && !!mine && h.to_act === mine.seat;
}

export type Offer = {
  canCheck: boolean;
  toCall: number;
  callAllIn: boolean;
  canRaise: boolean;
  minTo: number;
  maxTo: number;
  halfPotTo: number;
  potTo: number;
};

export function offer(s: PokerState | null, me: string | null): Offer | null {
  if (!s || !isMyTurn(s, me)) return null;
  const h = s.hand!;
  const { p } = playerOf(h, me)!;
  const stack = seatOf(s, me)?.stack ?? 0;
  const toCall = Math.min(Math.max(h.current_bet - p.bet, 0), stack);
  const maxTo = p.bet + stack;
  const minTo = Math.min(h.min_raise_to, maxTo);
  const clamp = (to: number) => Math.min(Math.max(to, minTo), maxTo);
  const potAfterCall = h.pot + toCall;
  return {
    canCheck: p.bet >= h.current_bet,
    toCall,
    callAllIn: toCall > 0 && toCall === stack,
    canRaise: !p.capped && maxTo > h.current_bet,
    minTo,
    maxTo,
    halfPotTo: clamp(h.current_bet + down(potAfterCall / 2)),
    potTo: clamp(h.current_bet + down(potAfterCall)),
  };
}

/** Valor da régua: de 5 em 5, entre o mínimo e tudo (tudo pode ser quebrado). */
export function clampRaise(to: number, o: Offer): number {
  if (to >= o.maxTo) return o.maxTo;
  return Math.max(o.minTo, down(to));
}

/** Posição na tela (0 = embaixo, depois no sentido horário). Em pé eu fico embaixo; deitado os lugares são fixos. */
export function visualOf(seat: number, mySeat: number | null, o: Orientation): number {
  return o === 'landscape' || mySeat === null ? seat : (seat - mySeat + 6) % 6;
}

/** Segundos até o prazo, com a diferença para a hora do servidor (servidor = local + offsetMs). */
export function secondsLeft(deadline: string | null, offsetMs: number, now = Date.now()): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((Date.parse(deadline) - (now + offsetMs)) / 1000));
}

export function lastLabel(p: PokerPlayer): string | null {
  switch (p.last) {
    case 'fold':
      return 'Correu';
    case 'check':
      return 'Mesa';
    case 'call':
      return `Pagou ${fmt(p.bet)}`;
    case 'raise':
      return `Aumentou p/ ${fmt(p.bet)}`;
    case 'allin':
      return 'All-in';
    case 'sb':
      return 'Cega pequena';
    case 'bb':
      return 'Cega grande';
    default:
      return null;
  }
}

/** Faixa da folha de sentar: entrada da mesa, anti-rathole e o que tenho na carteira. */
export function buyinRange(s: PokerState, wallet: number): { min: number; max: number; ok: boolean } {
  const min = Math.max(s.buyin[0], s.me?.rathole_min ?? 0);
  const max = Math.min(Math.max(s.buyin[1], min), wallet);
  return { min, max, ok: max >= min };
}

/** Quem receberia cartas se a mesa estivesse parada. */
export function readyCount(s: PokerState): number {
  return s.seats.filter((x) => x.status === 'playing' && x.stack > 0 && !x.leaving).length;
}

export type Names = (userId: string) => string;

/** A linha acima dos botões: o que está acontecendo quando não é a minha vez. */
export function statusLine(s: PokerState, me: string | null, name: Names, offsetMs: number, now = Date.now()): string | null {
  const h = s.hand;
  const betting = h?.status === 'betting';
  const mine = seatOf(s, me);
  if (!betting && s.closed) return 'A mesa fecha pro reset. Volta 00:00.';
  if (mine?.status === 'away') return null; // a faixa do ausente cuida
  if (mine?.busted) return 'Acabaram suas fichas. Completa em até 1 minuto ou você levanta.';
  if (mine?.leaving) return 'Você sai no fim dessa mão';
  if (!betting) {
    const missing = 2 - readyCount(s);
    return missing > 0 ? `Esperando mais ${missing} ${missing === 1 ? 'fella' : 'fellas'} pra começar` : null;
  }
  if (mine && !playerOf(h!, me)) return 'Você entra quando a cega grande chegar em você';
  if (isMyTurn(s, me) || h!.to_act === null) return null;
  const who = h!.players[String(h!.to_act)];
  const secs = secondsLeft(h!.deadline, offsetMs, now);
  return `Vez de ${name(who.user_id)}${secs === null ? '' : ` · ${secs} s`}`;
}

/** Quem levou a mão que acabou. */
export function resultLine(h: PokerHand, me: string | null, name: Names): string | null {
  if (h.status !== 'done' || !h.results) return null;
  const who = (uid: string) => (uid === me ? 'Você' : name(uid));
  const pays = Object.entries(h.results.payouts)
    .filter(([, v]) => v > 0)
    .map(([seat, v]) => ({ uid: h.players[seat].user_id, v }))
    .sort((a, b) => b.v - a.v);
  if (!pays.length) return null;
  if (pays.length === 1) return `${who(pays[0].uid)} levou ${fmt(pays[0].v)}`;
  if (h.results.pots.every((p) => p.winners.length > 1)) {
    const list = pays.map((x) => who(x.uid));
    const total = pays.reduce((sum, x) => sum + x.v, 0);
    return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]} dividiram ${fmt(total)}`;
  }
  return pays.map((x) => `${who(x.uid)} levou ${fmt(x.v)}`).join(' · ');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --prefix games -- poker/rules`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/poker/rules.ts games/poker/rules.test.ts
git commit -m "Poker: regras da tela (o que oferecer, régua, relógio, linhas de estado e resultado)"
```

---

### Task 8: Estado da tela (`poker/machine.ts`) e M1 do Blackjack

**Files:**
- Create: `games/poker/machine.ts`, `games/poker/machine.test.ts`
- Modify: `games/blackjack/machine.ts` (casos `loaded` e `wallet` quando a semana virou), `games/blackjack/machine.test.ts`

**Interfaces:**
- Consumes: `ERROR_TEXT`, `GameError` (shared/errors), tipos da Task 6.
- Produces: `type Sheet = null | { kind: 'sit'; seat: number; amount: number } | { kind: 'rebuy'; amount: number } | { kind: 'history' }`, `type PokerUi`, `type UiEvent`, `initial: PokerUi`, `reduce(s, e): PokerUi`, `WEEK_TURNED_POKER`.

- [ ] **Step 1: Testes que falham**

`games/poker/machine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { GameError } from '../shared/errors';
import type { PokerState, Wallet } from '../shared/types';
import { initial, reduce, WEEK_TURNED_POKER, type PokerUi } from './machine';

const table = (seq: number, o: Partial<PokerState> = {}): PokerState => ({
  seq,
  server_now: '2026-10-08T12:00:05.000Z',
  closed: false,
  next_hand_at: null,
  blinds: [5, 10],
  buyin: [200, 500],
  seats: [],
  hand: null,
  ...o,
});
const wallet = (week = '2026-10-05'): Wallet => ({
  balance: 700,
  fiado_count: 0,
  can_fiado: false,
  open_round_id: null,
  week_start: week,
  seated_stack: 300,
});
const NOW = Date.parse('2026-10-08T12:00:00.000Z');
const loaded = (s: PokerUi = initial) => reduce(s, { type: 'loaded', table: table(5, { me: { rathole_min: null } }), cards: null, wallet: wallet(), now: NOW });

describe('poker machine', () => {
  it('carrega: pronto, com a diferença para a hora do servidor', () => {
    const s = loaded();
    expect(s).toMatchObject({ phase: 'ready', offsetMs: 5000, busy: false, weekStart: '2026-10-05' });
  });

  it('ignora retrato mais velho', () => {
    const s = loaded();
    expect(reduce(s, { type: 'table', table: table(4), now: NOW }).table!.seq).toBe(5);
    expect(reduce(s, { type: 'table', table: table(6), now: NOW }).table!.seq).toBe(6);
  });

  it('retrato do tempo real (sem `me`) mantém o `me` que veio das funções', () => {
    const s = reduce(loaded(), { type: 'table', table: table(6), now: NOW });
    expect(s.table!.me).toEqual({ rathole_min: null });
  });

  it('régua fecha quando a vez muda', () => {
    const h = { id: 'h', action_no: 1 } as PokerState['hand'];
    let s = reduce(loaded(), { type: 'table', table: table(6, { hand: h }), now: NOW });
    s = reduce(s, { type: 'raise', to: 120 });
    expect(reduce(s, { type: 'table', table: table(7, { hand: h }), now: NOW }).raise).toBe(120);
    expect(reduce(s, { type: 'table', table: table(8, { hand: { ...h!, action_no: 2 } }), now: NOW }).raise).toBeNull();
  });

  it('pedido em andamento trava outro; erro vira aviso; sem sessão', () => {
    let s = reduce(loaded(), { type: 'request' });
    expect(s.busy).toBe(true);
    expect(reduce(s, { type: 'request' })).toBe(s);
    s = reduce(s, { type: 'failed', error: new GameError('stale_seq') });
    expect(s).toMatchObject({ busy: false, notice: 'A mesa mudou' });
    expect(reduce(initial, { type: 'failed', error: new GameError('no_session') }).phase).toBe('no_session');
  });

  it('feito: fecha folha e régua', () => {
    let s = reduce(loaded(), { type: 'sheet', sheet: { kind: 'sit', seat: 2, amount: 300 } });
    s = reduce(reduce(s, { type: 'raise', to: 80 }), { type: 'request' });
    expect(reduce(s, { type: 'done' })).toMatchObject({ busy: false, sheet: null, raise: null });
  });

  it('semana virou: avisa', () => {
    const s = reduce(loaded(), { type: 'wallet', wallet: wallet('2026-10-12') });
    expect(s.notice).toBe(WEEK_TURNED_POKER);
  });
});
```

`games/blackjack/machine.test.ts` — acrescentar no `describe('machine')` (usa as fábricas `wallet()`, `round()` e `run()` do arquivo; importar `WEEK_TURNED` de `./machine`):

```ts
  it('semana virou com mão aberta na semana nova: mostra a mão (M1)', () => {
    const s = run(
      { type: 'loaded', wallet: wallet(), round: null },
      { type: 'loaded', wallet: wallet({ week_start: '2026-10-12', open_round_id: 'r1' }), round: round() },
    );
    expect(s).toMatchObject({ phase: 'playing', round: { id: 'r1' }, notice: WEEK_TURNED, weekStart: '2026-10-12' });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --prefix games -- machine`
Expected: FAIL (`./machine` do poker não existe; no Blackjack a fase vem `betting` e a mão some).

- [ ] **Step 3: Implementar**

`games/poker/machine.ts`:

```ts
// Estado da tela do poker. A mesa em si vem pronta do banco (retrato); aqui fica só o que é da tela: carregando,
// pedido em andamento, folha aberta, régua do aumento, aviso, conexão e a diferença de relógio.
import { ERROR_TEXT, type GameError } from '../shared/errors';
import type { PokerCards, PokerState, Wallet } from '../shared/types';

export type Sheet = null | { kind: 'sit'; seat: number; amount: number } | { kind: 'rebuy'; amount: number } | { kind: 'history' };

export type PokerUi = {
  phase: 'loading' | 'ready' | 'no_session';
  table: PokerState | null;
  cards: PokerCards;
  wallet: Wallet | null;
  busy: boolean;
  online: boolean;
  /** Hora do servidor menos a local, em ms. */
  offsetMs: number;
  sheet: Sheet;
  /** Valor da régua aberta (null = fechada). */
  raise: number | null;
  notice: string | null;
  weekStart: string | null;
};

export type UiEvent =
  | { type: 'loaded'; table: PokerState; cards: PokerCards; wallet: Wallet; now: number }
  | { type: 'table'; table: PokerState; now: number }
  | { type: 'cards'; cards: PokerCards }
  | { type: 'wallet'; wallet: Wallet }
  | { type: 'request' }
  | { type: 'done' }
  | { type: 'failed'; error: GameError }
  | { type: 'online'; online: boolean }
  | { type: 'sheet'; sheet: Sheet }
  | { type: 'raise'; to: number | null }
  | { type: 'dismiss' };

export const WEEK_TURNED_POKER = 'A semana virou! Todo mundo foi levantado e as fichas voltaram pra carteira.';

export const initial: PokerUi = {
  phase: 'loading',
  table: null,
  cards: null,
  wallet: null,
  busy: false,
  online: true,
  offsetMs: 0,
  sheet: null,
  raise: null,
  notice: null,
  weekStart: null,
};

const offset = (t: PokerState, now: number) => Date.parse(t.server_now) - now;
const turned = (s: PokerUi, w: Wallet) => s.weekStart !== null && w.week_start !== s.weekStart;

export function reduce(s: PokerUi, e: UiEvent): PokerUi {
  switch (e.type) {
    case 'loaded':
      return {
        ...s,
        phase: 'ready',
        table: e.table,
        cards: e.cards,
        wallet: e.wallet,
        offsetMs: offset(e.table, e.now),
        weekStart: e.wallet.week_start,
        notice: turned(s, e.wallet) ? WEEK_TURNED_POKER : s.notice,
        busy: false,
      };
    case 'table': {
      if (s.table && e.table.seq < s.table.seq) return s; // retrato velho chegou depois
      const sameTurn = e.table.hand?.id === s.table?.hand?.id && e.table.hand?.action_no === s.table?.hand?.action_no;
      return {
        ...s,
        table: { ...e.table, me: e.table.me ?? s.table?.me },
        offsetMs: offset(e.table, e.now),
        raise: sameTurn ? s.raise : null,
      };
    }
    case 'cards':
      return { ...s, cards: e.cards };
    case 'wallet':
      return { ...s, wallet: e.wallet, weekStart: e.wallet.week_start, notice: turned(s, e.wallet) ? WEEK_TURNED_POKER : s.notice };
    case 'request':
      return s.busy ? s : { ...s, busy: true, notice: null };
    case 'done':
      return { ...s, busy: false, sheet: null, raise: null };
    case 'failed':
      if (e.error.code === 'no_session') return { ...s, phase: 'no_session', busy: false };
      return { ...s, busy: false, notice: ERROR_TEXT[e.error.code] };
    case 'online':
      return { ...s, online: e.online };
    case 'sheet':
      return { ...s, sheet: e.sheet };
    case 'raise':
      return { ...s, raise: e.to };
    case 'dismiss':
      return { ...s, notice: null };
  }
}
```

`games/blackjack/machine.ts` — nos dois lugares onde a semana virou (`loaded` e `wallet`), manter a mão aberta da semana nova:

```ts
    case 'loaded': {
      const playing = e.round?.status === 'playing';
      if (turned(s, e.wallet)) {
        // a mão da semana velha foi fechada pelo reset; uma aberta agora é da semana nova (outra aba): mostra (M1)
        return {
          ...s,
          phase: playing ? 'playing' : 'betting',
          wallet: e.wallet,
          round: playing ? e.round : null,
          bet: 0,
          notice: WEEK_TURNED,
          weekStart: e.wallet.week_start,
          back: null,
        };
      }
      return {
        ...s,
        phase: playing ? 'playing' : 'betting',
        wallet: e.wallet,
        round: playing ? e.round : null,
        bet: playing ? s.bet : 0,
        weekStart: e.wallet.week_start,
        back: null,
      };
    }
```

e em `wallet`:

```ts
    case 'wallet':
      if (turned(s, e.wallet)) {
        const keep = s.round?.status === 'playing' && e.wallet.open_round_id === s.round.id;
        return {
          ...s,
          phase: keep ? 'playing' : 'betting',
          wallet: e.wallet,
          round: keep ? s.round : null,
          bet: 0,
          notice: WEEK_TURNED,
          weekStart: e.wallet.week_start,
          back: null,
        };
      }
      return { ...s, wallet: e.wallet, phase: s.phase === 'busy' ? (s.back ?? 'betting') : s.phase, back: null };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --prefix games`
Expected: PASS (inclusive os testes antigos do `blackjack/machine` sobre a semana virando sem mão aberta).

- [ ] **Step 5: Commit**

```bash
git add games/poker/machine.ts games/poker/machine.test.ts games/blackjack/machine.ts games/blackjack/machine.test.ts
git commit -m "Poker: estado da tela; Blackjack mostra a mão aberta da semana nova quando a semana vira (M1)"
```

---

### Task 9: Mesa 3D do poker — posições, passos de animação, cena

**Files:**
- Create: `games/poker/layout.ts`, `games/poker/layout.test.ts`, `games/poker/tableDiff.ts`, `games/poker/tableDiff.test.ts`, `games/poker/table.ts`

**Interfaces:**
- Consumes: `rules.ts` (`playerOf`, `seatOf`, `visualOf`), tipos da Task 6, `shared/table3d` (`CARD_W/D/T`, `orientationOf`, `Orientation`, `createLoop`, `tween`, `cardFace`, `cardBack`, `chipFace`, `chipSide`, `chipStack`, `POKER_CHIPS`).
- Produces (`layout.ts`): `type P2 = { x; z }`, `FELT`, `SEATS`, `holeSlot(o, v, i)`, `myCardSlot(o, i)`, `boardSlot(o, i)`, `betSpot(o, v)`, `buttonSpot(o, v)`, `POT`, `DECK`, `camera(o)`.
- Produces (`tableDiff.ts`): `type TableView`, `EMPTY_VIEW`, `buildView(s, me, cards, o): TableView`, `type Step`, `diff(prev, next): Step[]`.
- Produces (`table.ts`): `type PokerTable = { resize(w, h): boolean /* orientação mudou */; orientation(); reducedMotion: boolean; play(steps): Promise<void>; seatAnchor(v); potAnchor(); mineAnchor() }`, `createPokerTable(canvas): PokerTable | null`.

- [ ] **Step 1: Testes que falham**

`games/poker/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { betSpot, boardSlot, FELT, holeSlot, myCardSlot, SEATS } from './layout';

describe('layout do poker', () => {
  for (const o of ['portrait', 'landscape'] as const) {
    it(`${o}: 6 lugares distintos em volta do feltro`, () => {
      expect(SEATS[o]).toHaveLength(6);
      const keys = new Set(SEATS[o].map((p) => `${p.x},${p.z}`));
      expect(keys.size).toBe(6);
      for (const p of SEATS[o]) {
        // na borda: fora do miolo do feltro, mas perto dele
        const r = Math.hypot(p.x / FELT[o].rx, p.z / FELT[o].rz);
        expect(r).toBeGreaterThan(0.85);
        expect(r).toBeLessThan(1.35);
      }
    });

    it(`${o}: aposta e cartas de cada lugar ficam entre ele e o meio`, () => {
      SEATS[o].forEach((p, v) => {
        expect(Math.hypot(betSpot(o, v).x, betSpot(o, v).z)).toBeLessThan(Math.hypot(p.x, p.z));
        expect(Math.hypot(holeSlot(o, v, 0).x, holeSlot(o, v, 0).z)).toBeLessThan(Math.hypot(p.x, p.z));
      });
    });

    it(`${o}: minhas cartas embaixo, no meio; mesa centrada`, () => {
      expect(myCardSlot(o, 0).x).toBeCloseTo(-myCardSlot(o, 1).x);
      expect(myCardSlot(o, 0).z).toBeGreaterThan(0.5);
      expect(boardSlot(o, 0).x).toBeCloseTo(-boardSlot(o, 4).x);
      expect(boardSlot(o, 2).x).toBeCloseTo(0);
    });
  }

  it('deitado: lugares fixos com a esquerda no 0 e sentido horário', () => {
    const [left, topLeft, topRight, right, bottomRight, bottomLeft] = SEATS.landscape;
    expect(left.x).toBeLessThan(topLeft.x);
    expect(topLeft.z).toBeLessThan(0);
    expect(topRight.x).toBeGreaterThan(0);
    expect(right.x).toBeGreaterThan(topRight.x);
    expect(bottomRight.z).toBeGreaterThan(0);
    expect(bottomLeft.x).toBeLessThan(0);
  });
});
```

`games/poker/tableDiff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { PokerHand, PokerPlayer, PokerState } from '../shared/types';
import { buildView, diff, EMPTY_VIEW, type TableView } from './tableDiff';

const pl = (user_id: string, o: Partial<PokerPlayer> = {}): PokerPlayer => ({
  user_id,
  bet: 0,
  total: 0,
  folded: false,
  all_in: false,
  acted: false,
  capped: false,
  last: null,
  timed_out: false,
  ...o,
});
const hand = (o: Partial<PokerHand> = {}): PokerHand => ({
  id: 'h1',
  no: 1,
  status: 'betting',
  street: 'preflop',
  board: [],
  players: { '1': pl('bia', { bet: 5, total: 5 }), '3': pl('me', { bet: 10, total: 10 }), '4': pl('teteu', { bet: 10, total: 30 }) },
  pot: 45,
  current_bet: 10,
  min_raise_to: 20,
  to_act: 4,
  action_no: 0,
  deadline: null,
  button: 4,
  sb: 1,
  bb: 3,
  runout: false,
  results: null,
  shown: {},
  ...o,
});
const st = (h: PokerHand | null): PokerState => ({
  seq: 1,
  server_now: '2026-10-08T12:00:00Z',
  closed: false,
  next_hand_at: null,
  blinds: [5, 10],
  buyin: [200, 500],
  seats: [
    { seat: 1, user_id: 'bia', stack: 295, status: 'playing', wait_bb: false, leaving: false, busted: false },
    { seat: 3, user_id: 'me', stack: 290, status: 'playing', wait_bb: false, leaving: false, busted: false },
    { seat: 4, user_id: 'teteu', stack: 270, status: 'playing', wait_bb: false, leaving: false, busted: false },
  ],
  hand: h,
});
const CARDS = { hand_id: 'h1', cards: [0, 13] };

describe('buildView', () => {
  it('em pé: eu (lugar 3) embaixo; os outros giram junto', () => {
    const v = buildView(st(hand()), 'me', CARDS, 'portrait');
    expect(v).toMatchObject({ handId: 'h1', mine: [0, 13], button: 1, dealt: [4, 1], bets: { 4: 5, 0: 10, 1: 10 }, pot: 20 });
  });

  it('deitado: lugares fixos; cartas de outra mão não aparecem', () => {
    const v = buildView(st(hand()), 'me', { hand_id: 'velha', cards: [1, 2] }, 'landscape');
    expect(v).toMatchObject({ mine: null, button: 4, dealt: [1, 4], bets: { 1: 5, 3: 10, 4: 10 } });
  });

  it('mão acabada: apostas no pote e quem levou', () => {
    const h = hand({ status: 'done', results: { showdown: false, pots: [], payouts: { '3': 45 }, hands: {} } });
    expect(buildView(st(h), 'me', CARDS, 'landscape')).toMatchObject({ bets: {}, pot: 45, payouts: { 3: 45 } });
  });

  it('sem mão ou mão anulada: mesa vazia', () => {
    expect(buildView(st(null), 'me', null, 'portrait')).toEqual(EMPTY_VIEW);
    expect(buildView(st(hand({ status: 'void' })), 'me', null, 'portrait')).toEqual(EMPTY_VIEW);
  });
});

describe('diff', () => {
  const base: TableView = { ...EMPTY_VIEW, handId: 'h1', dealt: [1, 4], mine: [0, 13], bets: { 0: 10 }, pot: 20, button: 1 };

  it('primeira vez: desenha tudo', () => {
    expect(diff(null, base)).toEqual([{ kind: 'reset', view: base }]);
  });

  it('mão nova: limpa, fichas, distribui, minhas cartas', () => {
    const fresh: TableView = { ...base, handId: 'h2' };
    expect(diff(base, fresh)).toEqual([
      { kind: 'reset', view: { ...EMPTY_VIEW, handId: 'h2', button: 1 } },
      { kind: 'chips', bets: { 0: 10 }, pot: 20 },
      { kind: 'deal', seats: [1, 4] },
      { kind: 'mine', cards: [0, 13] },
    ]);
  });

  it('correu: as cartas dele saem; apostas mudam', () => {
    expect(diff(base, { ...base, dealt: [4], bets: { 0: 10, 4: 30 } })).toEqual([
      { kind: 'muck', seat: 1 },
      { kind: 'chips', bets: { 0: 10, 4: 30 }, pot: 20 },
    ]);
  });

  it('nova rua: apostas para o pote e 3 cartas sem pausa', () => {
    expect(diff(base, { ...base, bets: {}, pot: 60, board: [5, 6, 7] })).toEqual([
      { kind: 'chips', bets: {}, pot: 60 },
      { kind: 'board', cards: [5, 6, 7], from: 0, pause: false },
    ]);
  });

  it('all-in: as mãos viram antes, a mesa sai com pausa, depois paga', () => {
    const end: TableView = { ...base, bets: {}, pot: 600, board: [5, 6, 7, 8, 9], shown: { 4: [20, 21] }, runout: true, payouts: { 0: 600 } };
    expect(diff(base, end)).toEqual([
      { kind: 'chips', bets: {}, pot: 600 },
      { kind: 'show', seat: 4, cards: [20, 21] },
      { kind: 'board', cards: [5, 6, 7, 8, 9], from: 0, pause: true },
      { kind: 'pay', payouts: { 0: 600 } },
    ]);
  });

  it('nada mudou: nada a fazer', () => {
    expect(diff(base, { ...base })).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --prefix games -- poker/layout poker/tableDiff`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Posições**

`games/poker/layout.ts`:

```ts
// Onde cada coisa fica na mesa de poker (mundo 3D: x para a direita, z para perto de quem olha, y para cima).
// Câmera quase de cima. Em pé: mesa comprida no z e eu sempre embaixo (lugar 0 na tela). Deitado: mesa comprida
// no x, lugares fixos (como no mockup do PC) e as minhas cartas embaixo, no meio da mesa.
import type { Orientation } from '../shared/table3d/layout';

export type P2 = { x: number; z: number };
export type Slot = P2 & { scale: number };

/** Meia largura (x) e meio comprimento (z) do feltro. */
export const FELT: Record<Orientation, { rx: number; rz: number }> = {
  portrait: { rx: 2.75, rz: 4.3 },
  landscape: { rx: 4.9, rz: 2.75 },
};

/** Lugares na tela, no sentido horário. Em pé: 0 embaixo. Deitado: 0 à esquerda (o lugar 0 do banco). */
export const SEATS: Record<Orientation, P2[]> = {
  portrait: [
    { x: 0, z: 4.55 },
    { x: -2.95, z: 2.2 },
    { x: -2.95, z: -1.9 },
    { x: 0, z: -4.55 },
    { x: 2.95, z: -1.9 },
    { x: 2.95, z: 2.2 },
  ],
  landscape: [
    { x: -5.2, z: 0 },
    { x: -2.6, z: -3.05 },
    { x: 2.6, z: -3.05 },
    { x: 5.2, z: 0 },
    { x: 2.6, z: 3.05 },
    { x: -2.6, z: 3.05 },
  ],
};

const toward = (p: P2, k: number): P2 => ({ x: p.x * (1 - k), z: p.z * (1 - k) });

/** As 2 cartas viradas de um lugar: pequenas, um pouco para dentro da mesa. */
export function holeSlot(o: Orientation, v: number, i: number): Slot {
  const c = toward(SEATS[o][v], 0.3);
  return { x: c.x + (i - 0.5) * 0.42, z: c.z, scale: 0.55 };
}

/** As minhas 2 cartas: embaixo, no meio da mesa, grandes. */
export function myCardSlot(o: Orientation, i: number): Slot {
  return o === 'portrait'
    ? { x: (i - 0.5) * 1.15, z: 2.85, scale: 1.25 }
    : { x: (i - 0.5) * 1.05, z: 1.75, scale: 1.1 };
}

/** As 5 cartas da mesa, em fila no meio. */
export function boardSlot(o: Orientation, i: number): Slot {
  return { x: (i - 2) * 0.98, z: o === 'portrait' ? -0.15 : -0.35, scale: 0.98 };
}

/** Fichas apostadas na rodada: entre o lugar e o meio. */
export function betSpot(o: Orientation, v: number): P2 {
  return toward(SEATS[o][v], 0.45);
}

/** Botão do dealer: ao lado das cartas do lugar. */
export function buttonSpot(o: Orientation, v: number): P2 {
  const p = toward(SEATS[o][v], 0.25);
  return { x: p.x + 0.65, z: p.z + 0.15 };
}

/** Pote (acima das cartas da mesa) e o baralho de onde as cartas saem (no meio). */
export const POT: Record<Orientation, P2> = { portrait: { x: 0, z: -1.55 }, landscape: { x: 0, z: -1.55 } };
export const DECK: Record<Orientation, P2> = { portrait: { x: 0, z: -0.15 }, landscape: { x: 0, z: -0.35 } };

export function camera(o: Orientation): { fov: number; pos: [number, number, number]; look: [number, number, number] } {
  return o === 'portrait'
    ? { fov: 50, pos: [0, 12.6, 1.6], look: [0, 0, 0.1] }
    : { fov: 40, pos: [0, 11.5, 3.6], look: [0, 0, 0.15] };
}
```

- [ ] **Step 4: Retrato → vista → passos**

`games/poker/tableDiff.ts`:

```ts
// Do retrato do banco para o que a mesa 3D mostra (TableView), e de uma vista para a outra em passos de animação.
// Puro: a cena (table.ts) só executa os passos.
import type { Orientation } from '../shared/table3d/layout';
import type { Card, PokerCards, PokerState } from '../shared/types';
import { playerOf, seatOf, visualOf } from './rules';

export type TableView = {
  handId: string | null;
  /** Lugares (na tela) com 2 cartas viradas para baixo — sem mim, que tenho as minhas embaixo. */
  dealt: number[];
  /** Minhas cartas, quando estou na mão e elas já chegaram. */
  mine: Card[] | null;
  board: Card[];
  /** Lugar na tela → cartas abertas (showdown ou "Mostrar"). */
  shown: Record<number, Card[]>;
  /** Apostas da rodada por lugar na tela. */
  bets: Record<number, number>;
  /** Fichas no meio (rodadas anteriores; no fim, tudo). */
  pot: number;
  button: number | null;
  payouts: Record<number, number> | null;
  runout: boolean;
};

export const EMPTY_VIEW: TableView = {
  handId: null,
  dealt: [],
  mine: null,
  board: [],
  shown: {},
  bets: {},
  pot: 0,
  button: null,
  payouts: null,
  runout: false,
};

export function buildView(s: PokerState | null, me: string | null, cards: PokerCards, o: Orientation): TableView {
  const h = s?.hand;
  if (!s || !h || h.status === 'void') return EMPTY_VIEW;
  const mine = playerOf(h, me);
  const mySeat = seatOf(s, me)?.seat ?? mine?.seat ?? null;
  const vis = (seat: number) => visualOf(seat, mySeat, o);
  const entries = Object.entries(h.players).map(([k, p]) => [Number(k), p] as const);
  const done = h.status === 'done';
  const bets: Record<number, number> = {};
  if (!done) for (const [k, p] of entries) if (p.bet > 0) bets[vis(k)] = p.bet;
  const onTable = Object.values(bets).reduce((a, b) => a + b, 0);
  const shown: Record<number, Card[]> = {};
  for (const [k, c] of Object.entries(h.shown)) if (!mine || Number(k) !== mine.seat) shown[vis(Number(k))] = c;
  return {
    handId: h.id,
    dealt: entries.filter(([k, p]) => !p.folded && !(mine && k === mine.seat)).map(([k]) => vis(k)),
    mine: mine && cards?.hand_id === h.id ? cards.cards : null,
    board: h.board,
    shown,
    bets,
    pot: h.pot - onTable,
    button: vis(h.button),
    payouts:
      done && h.results
        ? Object.fromEntries(Object.entries(h.results.payouts).map(([k, v]) => [vis(Number(k)), v]))
        : null,
    runout: h.runout,
  };
}

export type Step =
  | { kind: 'reset'; view: TableView }
  | { kind: 'deal'; seats: number[] }
  | { kind: 'mine'; cards: Card[] }
  | { kind: 'muck'; seat: number }
  | { kind: 'chips'; bets: Record<number, number>; pot: number }
  | { kind: 'board'; cards: Card[]; from: number; pause: boolean }
  | { kind: 'show'; seat: number; cards: Card[] }
  | { kind: 'pay'; payouts: Record<number, number> };

const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

export function diff(prev: TableView | null, next: TableView): Step[] {
  if (!prev) return [{ kind: 'reset', view: next }];
  if (prev.handId !== next.handId) {
    // mão que começou agora anima; entrar no meio de uma (ou mesa vazia) só desenha
    const fresh = next.handId !== null && next.board.length === 0 && !next.payouts;
    if (!fresh) return [{ kind: 'reset', view: next }];
    const steps: Step[] = [
      { kind: 'reset', view: { ...EMPTY_VIEW, handId: next.handId, button: next.button } },
      { kind: 'chips', bets: next.bets, pot: next.pot },
      { kind: 'deal', seats: next.dealt },
    ];
    if (next.mine) steps.push({ kind: 'mine', cards: next.mine });
    return steps;
  }
  const steps: Step[] = [];
  if (!prev.mine && next.mine) steps.push({ kind: 'mine', cards: next.mine });
  for (const v of prev.dealt) if (!next.dealt.includes(v) && !next.shown[v]) steps.push({ kind: 'muck', seat: v });
  if (!same(prev.bets, next.bets) || prev.pot !== next.pot) steps.push({ kind: 'chips', bets: next.bets, pot: next.pot });
  const shows: Step[] = Object.keys(next.shown)
    .map(Number)
    .filter((v) => !prev.shown[v])
    .map((v) => ({ kind: 'show', seat: v, cards: next.shown[v] }));
  if (next.runout) steps.push(...shows); // todos all-in: as mãos viram antes de abrir a mesa
  if (next.board.length > prev.board.length) {
    steps.push({ kind: 'board', cards: next.board.slice(prev.board.length), from: prev.board.length, pause: next.runout });
  }
  if (!next.runout) steps.push(...shows);
  if (!prev.payouts && next.payouts) steps.push({ kind: 'pay', payouts: next.payouts });
  return steps;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test --prefix games -- poker/layout poker/tableDiff`
Expected: PASS. Conferir à mão o primeiro caso do `buildView`: eu no lugar 3 → visual 0; lugar 4 → 1; lugar 1 → 4; botão (4) → 1; apostas `{4: 5, 0: 10, 1: 10}`; pote 45 − 25 = 20.

- [ ] **Step 6: Cena 3D**

`games/poker/table.ts`:

```ts
// Mesa 3D do poker (Three.js): feltro oval com borda de madeira, cartas, fichas e o botão do dealer. Recebe passos
// (tableDiff) e anima; nenhuma regra aqui. Textos e botões ficam no HUD (view.ts), presos à cena pelos anchors.
// Só redesenha enquanto algo se mexe.
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';

import { chipStack, POKER_CHIPS } from '../shared/table3d/chips';
import { CARD_D, CARD_T, CARD_W, orientationOf, type Orientation } from '../shared/table3d/layout';
import { createLoop } from '../shared/table3d/loop';
import { cardBack, cardFace, chipFace, chipSide } from '../shared/table3d/textures';
import { tween } from '../shared/table3d/tween';
import {
  betSpot,
  boardSlot,
  buttonSpot,
  camera as cameraFor,
  DECK,
  FELT,
  holeSlot,
  myCardSlot,
  POT,
  SEATS,
  type P2,
  type Slot,
} from './layout';
import type { Step, TableView } from './tableDiff';

export type PokerTable = {
  /** Devolve true quando a orientação mudou (quem chama redesenha a vista, que depende dela). */
  resize(w: number, h: number): boolean;
  orientation(): Orientation;
  reducedMotion: boolean;
  play(steps: Step[]): Promise<void>;
  seatAnchor(visual: number): { x: number; y: number };
  potAnchor(): { x: number; y: number };
  mineAnchor(): { x: number; y: number };
};

type CardObj = { mesh: Mesh; shadow: Mesh };

/** Feltro visto de cima: verde com luz no meio e um anel dourado fino. */
function feltCanvas(o: Orientation): HTMLCanvasElement {
  const { rx, rz } = FELT[o];
  const w = 1024;
  const h = Math.round((1024 * rz) / rx);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, '#1f8a57');
  grad.addColorStop(0.6, '#11603b');
  grad.addColorStop(1, '#0a3f27');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(242,210,122,0.35)';
  g.lineWidth = 4;
  const r = Math.min(w, h) / 2 - 70;
  g.beginPath();
  g.roundRect(70, 70, w - 140, h - 140, r);
  g.stroke();
  return c;
}

/** Retângulo de pontas redondas (estádio) no plano x / y (= −z). */
function stadium(rx: number, rz: number, pad = 0): Shape {
  const a = rx + pad;
  const b = rz + pad;
  const r = Math.min(a, b);
  const s = new Shape();
  if (a >= b) {
    const l = a - r;
    s.moveTo(-l, -r);
    s.lineTo(l, -r);
    s.absarc(l, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-l, r);
    s.absarc(-l, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  } else {
    const l = b - r;
    s.moveTo(r, -l);
    s.lineTo(r, l);
    s.absarc(0, l, r, 0, Math.PI, false);
    s.lineTo(-r, -l);
    s.absarc(0, -l, r, Math.PI, 2 * Math.PI, false);
  }
  return s;
}

/** Botão do dealer: disco branco com "D". */
function dealerCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f1ea';
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#121212';
  g.font = '800 70px "Golos Text", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('D', 64, 68);
  return c;
}

export function createPokerTable(canvas: HTMLCanvasElement): PokerTable | null {
  let renderer: WebGLRenderer;
  try {
    if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) return null;
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.4));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(2, 10, 4);
  scene.add(sun);
  const cam = new PerspectiveCamera(50, 1, 0.1, 100);
  const loop = createLoop(() => renderer.render(scene, cam));
  let orient: Orientation = 'portrait';
  let size = { w: 1, h: 1 };

  const tex = (c: HTMLCanvasElement) => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };

  // feltro e borda: refeitos quando a orientação muda
  let felt: Mesh | null = null;
  let rim: Mesh | null = null;
  function buildTable() {
    if (felt) scene.remove(felt);
    if (rim) scene.remove(rim);
    const { rx, rz } = FELT[orient];
    const geo = new ShapeGeometry(stadium(rx, rz), 64);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + rx) / (2 * rx), (pos.getY(i) + rz) / (2 * rz));
    felt = new Mesh(geo, new MeshBasicMaterial({ map: tex(feltCanvas(orient)) }));
    felt.rotation.x = -Math.PI / 2;
    const ring = stadium(rx, rz, 0.42);
    ring.holes.push(stadium(rx, rz));
    rim = new Mesh(
      new ExtrudeGeometry(ring, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, curveSegments: 64 }),
      new MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.55 }),
    );
    rim.rotation.x = -Math.PI / 2;
    scene.add(felt, rim);
  }

  // cartas
  const cardGeo = new BoxGeometry(CARD_W, CARD_T, CARD_D);
  const edgeMat = new MeshBasicMaterial({ color: 0xe9e6df });
  const backMat = new MeshBasicMaterial({ map: tex(cardBack()) });
  const faceMats = new Map<number, Material>();
  const faceMat = (c: number) => {
    if (!faceMats.has(c)) faceMats.set(c, new MeshBasicMaterial({ map: tex(cardFace(c)) }));
    return faceMats.get(c)!;
  };
  const shadowGeo = new PlaneGeometry(CARD_W * 1.06, CARD_D * 1.06);
  const shadowMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });

  // fichas
  const chipGeo = new CylinderGeometry(0.3, 0.3, 0.07, 36);
  const chipMats = new Map<string, Material[]>();
  const chipMat = (v: number, top: boolean) => {
    const key = `${v}-${top}`;
    if (!chipMats.has(key)) {
      const face = new MeshBasicMaterial({ map: tex(chipFace(v, top)) });
      chipMats.set(key, [new MeshBasicMaterial({ map: tex(chipSide(v)) }), face, face]);
    }
    return chipMats.get(key)!;
  };

  const dealer = new Mesh(new CylinderGeometry(0.24, 0.24, 0.06, 32), [
    new MeshBasicMaterial({ color: 0xd9d6cf }),
    new MeshBasicMaterial({ map: tex(dealerCanvas()) }),
    new MeshBasicMaterial({ color: 0xd9d6cf }),
  ]);

  const holes = new Map<number, CardObj[]>();
  let mine: CardObj[] = [];
  let board: CardObj[] = [];
  const bets = new Map<number, Mesh[]>();
  let pot: Mesh[] = [];

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const table: PokerTable = { reducedMotion, resize, orientation: () => orient, play, seatAnchor, potAnchor, mineAnchor };

  function run(ms: number, step: (k: number) => void): Promise<void> {
    if (table.reducedMotion) {
      step(1);
      loop.invalidate();
      return Promise.resolve();
    }
    const t = tween(ms, step);
    loop.track(() => t.busy());
    return t.done;
  }
  const pause = (ms: number) => (table.reducedMotion ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms)));

  function newCard(face: number | null, at: Slot): CardObj {
    const mesh = new Mesh(cardGeo, [edgeMat, edgeMat, face === null ? backMat : faceMat(face), backMat, edgeMat, edgeMat]);
    if (face === null) mesh.rotation.z = Math.PI;
    mesh.scale.set(at.scale, 1, at.scale);
    const shadow = new Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(at.scale, at.scale, 1);
    scene.add(shadow, mesh);
    const o = { mesh, shadow };
    place(o, at.x, 0.02, at.z);
    return o;
  }
  function place(o: CardObj, x: number, y: number, z: number) {
    o.mesh.position.set(x, y, z);
    o.shadow.position.set(x + 0.03, 0.004, z + 0.06);
  }
  function drop(o: CardObj) {
    scene.remove(o.mesh, o.shadow);
  }
  function fly(o: CardObj, from: P2, to: Slot, ms: number) {
    return run(ms, (k) => place(o, from.x + (to.x - from.x) * k, 0.02 + Math.sin(k * Math.PI) * 0.5, from.z + (to.z - from.z) * k));
  }
  function flip(o: CardObj, c: number) {
    (o.mesh.material as Material[])[2] = faceMat(c);
    const y = o.mesh.position.y;
    return run(240, (k) => {
      o.mesh.rotation.z = Math.PI * (1 - k);
      o.mesh.position.y = y + Math.sin(k * Math.PI) * 0.4;
    });
  }

  function stackAt(amount: number, at: P2): Mesh[] {
    const values = chipStack(amount, POKER_CHIPS);
    return values.map((v, n) => {
      const m = new Mesh(chipGeo, chipMat(v, n === values.length - 1));
      m.position.set(at.x, 0.04 + n * 0.075, at.z);
      m.rotation.y = n * 0.7;
      scene.add(m);
      return m;
    });
  }
  function setChips(next: Record<number, number>, amount: number) {
    for (const ms of bets.values()) for (const m of ms) scene.remove(m);
    bets.clear();
    for (const [v, a] of Object.entries(next)) bets.set(Number(v), stackAt(a, betSpot(orient, Number(v))));
    for (const m of pot) scene.remove(m);
    pot = stackAt(amount, POT[orient]);
    loop.invalidate();
  }
  function setButton(v: number | null) {
    if (v === null) {
      scene.remove(dealer);
    } else {
      const p = buttonSpot(orient, v);
      dealer.position.set(p.x, 0.035, p.z);
      scene.add(dealer);
    }
    loop.invalidate();
  }

  function clearAll() {
    for (const cs of holes.values()) cs.forEach(drop);
    holes.clear();
    mine.forEach(drop);
    mine = [];
    board.forEach(drop);
    board = [];
  }

  /** Desenha a vista inteira, sem animar. */
  function draw(v: TableView) {
    clearAll();
    for (const s of v.dealt) {
      const faces = v.shown[s];
      holes.set(s, [0, 1].map((i) => newCard(faces ? faces[i] : null, holeSlot(orient, s, i))));
    }
    if (v.mine) mine = v.mine.map((c, i) => newCard(c, myCardSlot(orient, i)));
    board = v.board.map((c, i) => newCard(c, boardSlot(orient, i)));
    setChips(v.bets, v.pot);
    setButton(v.button);
  }

  async function step(s: Step) {
    switch (s.kind) {
      case 'reset':
        draw(s.view);
        return;
      case 'chips':
        setChips(s.bets, s.pot);
        return;
      case 'deal':
        for (let i = 0; i < 2; i++) {
          for (const v of s.seats) {
            const o = newCard(null, { ...DECK[orient], scale: holeSlot(orient, v, i).scale });
            holes.set(v, [...(holes.get(v) ?? []), o]);
            await fly(o, DECK[orient], holeSlot(orient, v, i), 110);
          }
        }
        return;
      case 'mine':
        mine.forEach(drop);
        mine = [];
        for (let i = 0; i < 2; i++) {
          const o = newCard(null, { ...DECK[orient], scale: myCardSlot(orient, i).scale });
          mine.push(o);
          await fly(o, DECK[orient], myCardSlot(orient, i), 160);
        }
        await Promise.all(mine.map((o, i) => flip(o, s.cards[i])));
        return;
      case 'muck': {
        const cs = holes.get(s.seat) ?? [];
        holes.delete(s.seat);
        await Promise.all(cs.map((o) => fly(o, o.mesh.position, { ...DECK[orient], scale: 0.55 }, 220)));
        cs.forEach(drop);
        return;
      }
      case 'board':
        for (let i = 0; i < s.cards.length; i++) {
          const at = s.from + i;
          if (s.pause && at >= 3) await pause(1500); // turn e river com suspense no all-in
          const o = newCard(null, { ...DECK[orient], scale: boardSlot(orient, at).scale });
          board.push(o);
          await fly(o, DECK[orient], boardSlot(orient, at), 200);
          await flip(o, s.cards[i]);
        }
        return;
      case 'show': {
        let cs = holes.get(s.seat);
        if (!cs) {
          cs = [0, 1].map((i) => newCard(null, holeSlot(orient, s.seat, i)));
          holes.set(s.seat, cs);
        }
        await Promise.all(cs.map((o, i) => flip(o, s.cards[i])));
        return;
      }
      case 'pay': {
        const moving = pot;
        pot = [];
        const winners = Object.keys(s.payouts).map(Number);
        await Promise.all(
          moving.map((m, n) => {
            const to = betSpot(orient, winners[n % winners.length]);
            const from = { x: m.position.x, z: m.position.z };
            return run(420, (k) => m.position.set(from.x + (to.x - from.x) * k, m.position.y, from.z + (to.z - from.z) * k));
          }),
        );
        await pause(500);
        for (const m of moving) scene.remove(m);
        loop.invalidate();
        return;
      }
    }
  }

  async function play(steps: Step[]) {
    for (const s of steps) await step(s);
  }

  function project(p: P2) {
    const v = new Vector3(p.x, 0, p.z).project(cam);
    return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h };
  }
  function seatAnchor(visual: number) {
    return project(SEATS[orient][visual]);
  }
  function potAnchor() {
    const p = POT[orient];
    return project({ x: p.x, z: p.z - 0.55 });
  }
  function mineAnchor() {
    const a = myCardSlot(orient, 0);
    return project({ x: 0, z: a.z + (CARD_D * a.scale) / 2 + 0.25 });
  }

  function resize(w: number, h: number): boolean {
    size = { w, h };
    renderer.setSize(w, h, false);
    const next = orientationOf(window.innerWidth, window.innerHeight);
    const changed = next !== orient || !felt;
    orient = next;
    const c = cameraFor(orient);
    cam.fov = c.fov;
    cam.aspect = w / h;
    cam.position.set(...c.pos);
    cam.lookAt(...c.look);
    cam.updateProjectionMatrix();
    if (changed) buildTable();
    loop.invalidate();
    return changed;
  }

  resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
  return table;
}
```

- [ ] **Step 7: Tipos e testes**

Run: `npm test --prefix games` e `npm run build --prefix games`
Expected: PASS e build limpo (a cena ainda não é usada por nenhuma página; o build confere os tipos).

- [ ] **Step 8: Commit**

```bash
git add games/poker/layout.ts games/poker/layout.test.ts games/poker/tableDiff.ts games/poker/tableDiff.test.ts games/poker/table.ts
git commit -m "Poker: mesa 3D (posições em pé e deitado, passos de animação entre retratos, cena)"
```

---

### Task 10: HUD do poker (`poker/view.ts` + `poker/poker.css`)

**Files:**
- Modify: `games/poker/rules.ts`, `games/poker/rules.test.ts` (faixa de completar e encaixe do valor)
- Create: `games/poker/view.ts`, `games/poker/view.test.ts`, `games/poker/poker.css`

**Interfaces:**
- Consumes: `PokerUi` (Task 8), rules (Task 7), `rank/rankName` (Task 1), `button/el/fmt` de `shared/hud/hud.ts`, tipos (Task 6).
- Produces (rules): `rebuyRange(stack, max, wallet): { min; max; ok }`, `snapAmount(v, range): number`.
- Produces (view): `type Anchors = { seatAnchor(v); potAnchor(); mineAnchor(); orientation() }`, `type ViewHandlers`, `type Extras = { me; fella(id); history; board; tab; now }`, `type View = { canvas; render(ui, anchors, extras); fatal(text) }`, `createView(root, handlers): View`.

`ViewHandlers`:

```ts
export type ViewHandlers = {
  openSit(seat: number): void;
  sheetAmount(amount: number): void;
  confirmSheet(): void;
  closeSheet(): void;
  act(action: Exclude<PokerAction, 'raise'>): void;
  openRaise(): void;
  raiseTo(to: number): void;
  confirmRaise(): void;
  closeRaise(): void;
  leave(): void;
  back(): void;
  openRebuy(): void;
  show(): void;
  openHistory(): void;
  tab(tab: 'hands' | 'board'): void;
  retry(): void;
};
```

- [ ] **Step 1: Testes que falham**

`games/poker/rules.test.ts` — acrescentar (e importar `rebuyRange`, `snapAmount`):

```ts
describe('folhas', () => {
  it('completar: de 10 em 10 até 500 na mesa e até a carteira', () => {
    expect(rebuyRange(295, 500, 1000)).toEqual({ min: 10, max: 200, ok: true });
    expect(rebuyRange(100, 500, 155)).toEqual({ min: 10, max: 150, ok: true });
    expect(rebuyRange(495, 500, 1000)).toEqual({ min: 10, max: 0, ok: false });
  });

  it('valor da régua da folha: o mínimo exato (anti-rathole) ou de 10 em 10', () => {
    expect(snapAmount(735, { min: 735, max: 900 })).toBe(735);
    expect(snapAmount(745, { min: 735, max: 900 })).toBe(750);
    expect(snapAmount(305, { min: 200, max: 500 })).toBe(310);
    expect(snapAmount(999, { min: 200, max: 500 })).toBe(500);
    expect(snapAmount(100, { min: 200, max: 500 })).toBe(200);
  });
});
```

`games/poker/view.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { PokerHand, PokerPlayer, PokerSeat, PokerState, Wallet } from '../shared/types';
import { initial, type PokerUi } from './machine';
import { createView, type Extras, type ViewHandlers } from './view';

const seat = (n: number, user_id: string, o: Partial<PokerSeat> = {}): PokerSeat => ({
  seat: n,
  user_id,
  stack: 300,
  status: 'playing',
  wait_bb: false,
  leaving: false,
  busted: false,
  ...o,
});
const pl = (user_id: string, o: Partial<PokerPlayer> = {}): PokerPlayer => ({
  user_id,
  bet: 0,
  total: 0,
  folded: false,
  all_in: false,
  acted: false,
  capped: false,
  last: null,
  timed_out: false,
  ...o,
});
const hand = (o: Partial<PokerHand> = {}): PokerHand => ({
  id: 'h1',
  no: 3,
  status: 'betting',
  street: 'preflop',
  board: [],
  players: { '0': pl('me', { bet: 10 }), '1': pl('bia', { bet: 30, last: 'raise' }) },
  pot: 40,
  current_bet: 30,
  min_raise_to: 50,
  to_act: 0,
  action_no: 2,
  deadline: '2026-10-08T12:00:30.000Z',
  button: 1,
  sb: 1,
  bb: 0,
  runout: false,
  results: null,
  shown: {},
  ...o,
});
const table = (o: Partial<PokerState> = {}): PokerState => ({
  seq: 9,
  server_now: '2026-10-08T12:00:00.000Z',
  closed: false,
  next_hand_at: null,
  blinds: [5, 10],
  buyin: [200, 500],
  seats: [seat(0, 'me', { stack: 290 }), seat(1, 'bia', { stack: 270 })],
  hand: hand(),
  me: { rathole_min: null },
  ...o,
});
const wallet: Wallet = { balance: 740, fiado_count: 0, can_fiado: false, open_round_id: null, week_start: '2026-10-05', seated_stack: 290 };
const ui = (o: Partial<PokerUi> = {}): PokerUi => ({ ...initial, phase: 'ready', table: table(), wallet, weekStart: '2026-10-05', ...o });
const anchors = {
  seatAnchor: (v: number) => ({ x: v * 10, y: v * 10 }),
  potAnchor: () => ({ x: 50, y: 50 }),
  mineAnchor: () => ({ x: 50, y: 90 }),
  orientation: () => 'portrait' as const,
};
const extras = (o: Partial<Extras> = {}): Extras => ({
  me: 'me',
  fella: (id) => ({ bia: { id: 'bia', name: 'Bia', avatarUrl: null } })[id],
  history: [],
  board: [],
  tab: 'hands',
  now: Date.parse('2026-10-08T12:00:12.000Z'),
  ...o,
});

let h: { [K in keyof ViewHandlers]: Mock<ViewHandlers[K]> };
let root: HTMLElement;
const byLabel = (name: string) =>
  [...root.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
  ) as HTMLButtonElement | undefined;
const visible = (e: Element | null | undefined) => !!e && !(e as HTMLElement).closest('[hidden]');
const text = () => root.textContent ?? '';

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
  h = {
    openSit: vi.fn(),
    sheetAmount: vi.fn(),
    confirmSheet: vi.fn(),
    closeSheet: vi.fn(),
    act: vi.fn(),
    openRaise: vi.fn(),
    raiseTo: vi.fn(),
    confirmRaise: vi.fn(),
    closeRaise: vi.fn(),
    leave: vi.fn(),
    back: vi.fn(),
    openRebuy: vi.fn(),
    show: vi.fn(),
    openHistory: vi.fn(),
    tab: vi.fn(),
    retry: vi.fn(),
  };
});

describe('poker view', () => {
  it('sem lugar: os vazios viram Sentar e abrem a folha do lugar certo', () => {
    const v = createView(root, h);
    v.render(ui({ table: table({ seats: [seat(1, 'bia')], hand: null }) }), anchors, extras({ me: 'eu' }));
    const empties = [...root.querySelectorAll('button.seat.empty')].filter(visible);
    expect(empties).toHaveLength(5);
    (empties[2] as HTMLButtonElement).click();
    expect(h.openSit).toHaveBeenCalledWith(3);
    expect(text()).toContain('Toca num lugar vazio pra sentar');
  });

  it('minha vez: moedas acesas e Pagar com o valor', () => {
    const v = createView(root, h);
    v.render(ui(), anchors, extras());
    const call = byLabel('Pagar 20')!;
    expect(visible(call)).toBe(true);
    expect(call.disabled).toBe(false);
    expect(call.textContent).toContain('20');
    byLabel('Correr')!.click();
    expect(h.act).toHaveBeenCalledWith('fold');
    byLabel('Aumentar')!.click();
    expect(h.openRaise).toHaveBeenCalled();
  });

  it('fora da vez: moedas apagadas e a linha diz de quem é a vez', () => {
    const v = createView(root, h);
    v.render(ui({ table: table({ hand: hand({ to_act: 1 }) }) }), anchors, extras());
    expect(byLabel('Correr')!.disabled).toBe(true);
    expect(text()).toContain('Vez de Bia · 18 s');
  });

  it('régua: atalhos, confirmar e voltar', () => {
    const v = createView(root, h);
    v.render(ui({ raise: 50 }), anchors, extras());
    expect(text()).toContain('½ pote 60');
    expect(text()).toContain('Pote 90');
    byLabel('Pote 90')!.click();
    expect(h.raiseTo).toHaveBeenCalledWith(90);
    byLabel('Aumentar para 50')!.click();
    expect(h.confirmRaise).toHaveBeenCalled();
    byLabel('Voltar aos botões')!.click();
    expect(h.closeRaise).toHaveBeenCalled();
  });

  it('ausente: faixa e Voltar pra mesa', () => {
    const v = createView(root, h);
    v.render(ui({ table: table({ seats: [seat(0, 'me', { status: 'away' }), seat(1, 'bia')], hand: null }) }), anchors, extras());
    expect(text()).toContain('Você ficou ausente: as mãos seguem sem você.');
    byLabel('Voltar pra mesa')!.click();
    expect(h.back).toHaveBeenCalled();
    expect(visible(byLabel('Correr'))).toBe(false);
  });

  it('folha de sentar: faixa da carteira; sem carteira, explica e trava', () => {
    const v = createView(root, h);
    const away = table({ seats: [seat(1, 'bia')], hand: null });
    v.render(ui({ table: away, sheet: { kind: 'sit', seat: 2, amount: 300 } }), anchors, extras({ me: 'eu' }));
    const range = root.querySelector<HTMLInputElement>('input[type=range]')!;
    expect([range.min, range.max, range.value]).toEqual(['200', '500', '300']);
    expect(byLabel('Sentar com 300')!.disabled).toBe(false);
    v.render(
      ui({ table: away, wallet: { ...wallet, balance: 150 }, sheet: { kind: 'sit', seat: 2, amount: 300 } }),
      anchors,
      extras({ me: 'eu' }),
    );
    expect(text()).toContain('Você precisa de pelo menos 200 na carteira.');
    expect(byLabel('Sentar com 200')!.disabled).toBe(true);
  });

  it('resultado em dourado e nome do fella como texto', () => {
    const v = createView(root, h);
    const done = hand({ status: 'done', to_act: null, results: { showdown: false, pots: [{ amount: 40, winners: [1], name: null }], payouts: { '1': 40 }, hands: {} } });
    v.render(
      ui({ table: table({ hand: done }) }),
      anchors,
      extras({ fella: () => ({ id: 'bia', name: '<b>Bia</b>', avatarUrl: null }) }),
    );
    expect(text()).toContain('<b>Bia</b> levou 40');
    expect(root.querySelector('.tags b')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --prefix games -- poker/rules poker/view`
Expected: FAIL (`rebuyRange` e `./view` não existem).

- [ ] **Step 3: Regras das folhas**

`games/poker/rules.ts` — acrescentar:

```ts
/** Faixa da folha de completar: de 10 em 10, até o teto da mesa e até a carteira. */
export function rebuyRange(stack: number, max: number, wallet: number): { min: number; max: number; ok: boolean } {
  const top = Math.min(Math.floor((max - stack) / 10) * 10, Math.floor(wallet / 10) * 10);
  return { min: 10, max: top, ok: top >= 10 };
}

/** Valor da régua da folha: o mínimo exato vale (anti-rathole pode ser quebrado); o resto, de 10 em 10. */
export function snapAmount(v: number, r: { min: number; max: number }): number {
  if (v <= r.min) return r.min;
  return Math.min(Math.max(Math.round(v / 10) * 10, r.min), r.max);
}
```

- [ ] **Step 4: Estilos**

`games/poker/poker.css`:

```css
/* HUD do poker: lugares em volta da mesa, relógio, régua do aumento e folhas. Cores do hud.css (mockups aprovados
   em .superpowers/brainstorm/20068-1791484731/content/mesa-celular.html e tela-pc-sentar.html). */
.poker .top .title { font-weight: 700; }
.poker .tools { display: flex; align-items: center; gap: 8px; }
.ghost { min-height: 44px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid rgba(244, 241, 234, 0.45); background: transparent; cursor: pointer; white-space: nowrap; }
.app[data-orient='landscape'] .ghost.hist { display: none; }

/* lugares */
.seat { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 3px; width: 88px; pointer-events: none; }
.seat .av { width: 44px; height: 44px; border-radius: 50%; position: relative; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; color: var(--ink); border: 2px solid #0b100d; }
.seat .av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.seat .ring { position: absolute; inset: -6px; border-radius: 50%; background: conic-gradient(var(--gold) calc(var(--k, 1) * 360deg), rgba(242, 210, 122, 0.15) 0);
  -webkit-mask: radial-gradient(circle, transparent 25px, #000 26px); mask: radial-gradient(circle, transparent 25px, #000 26px); }
.seat.turn .av { box-shadow: 0 0 16px rgba(242, 210, 122, 0.6); }
.seat .nm { font-size: 11px; font-weight: 700; background: var(--tag-bg); border: 1px solid var(--gold-soft); border-radius: 999px; padding: 2px 9px; text-align: center; line-height: 1.25; max-width: 88px; }
.seat .nm span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seat .nm small { display: block; color: var(--gold); font-size: 11px; font-weight: 600; }
.seat .st { font-size: 10px; font-weight: 700; color: var(--mint); min-height: 12px; text-align: center; letter-spacing: 0.02em; }
.seat.out { opacity: 0.5; }
.seat.win .nm { background: var(--gold); color: var(--ink); }
.seat.win .nm small { color: var(--ink); }
.seat.empty { pointer-events: auto; background: none; border: 0; padding: 0; cursor: pointer; color: var(--paper); min-height: 64px; }
.seat.empty .av { background: transparent; border: 1.5px dashed var(--gold-soft); color: var(--gold); font-size: 22px; font-weight: 600; }
.c0 { background: #e8b4a0; } .c1 { background: #a0c4e8; } .c2 { background: #c9e8a0; }
.c3 { background: #e8d9a0; } .c4 { background: #d2a0e8; } .c5 { background: #f2d27a; }

/* faixa do ausente */
.banner { position: absolute; left: 14px; right: 14px; top: 8px; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 8px 8px 14px; border-radius: 12px; background: var(--tag-bg); border: 1px solid var(--gold-soft); font-size: 13px; font-weight: 600; }
.banner button { background: none; border: 0; color: var(--gold); font-weight: 800; min-height: 44px; padding: 0 8px; cursor: pointer; }

/* moedas do poker */
.fold .b, .back .b { background: var(--red); }
.call .b { background: var(--green); }
.raise .b { background: var(--violet); }
.allin .b { background: var(--orange); }
.coin .b .v { font-weight: 800; font-size: 15px; color: #fff; }

/* régua do aumento */
.ruler { display: grid; gap: 8px; padding: 0 14px 12px; }
.ruler .row { display: flex; gap: 6px; }
.ruler button { flex: 1; min-height: 44px; border-radius: 999px; border: 1px solid rgba(244, 241, 234, 0.4); background: transparent; font-size: 12px; font-weight: 700; cursor: pointer; }
.ruler button.on { background: var(--gold); color: var(--ink); border-color: var(--gold); }
.ruler button:disabled { opacity: 0.35; cursor: default; }
.ruler .step { flex: 0 0 56px; font-size: 18px; }
.ruler .val { flex: 1; align-self: center; text-align: center; font-size: 22px; font-weight: 800; color: var(--gold); }

/* folhas */
.sheetwrap { position: absolute; inset: 0; z-index: 7; display: flex; align-items: flex-end; }
.sheetwrap .dim { position: absolute; inset: 0; background: rgba(4, 8, 6, 0.6); border: 0; }
.sheet { position: relative; width: 100%; max-width: 480px; margin: 0 auto; background: #0d1611; border-top: 1px solid var(--gold-soft); border-radius: 20px 20px 0 0; padding: 18px 18px max(22px, env(safe-area-inset-bottom)); max-height: 80dvh; overflow: auto; }
.sheet h2 { margin: 0 0 4px; font-size: 17px; }
.sheet p { margin: 0 0 14px; font-size: 13px; color: var(--mint); }
.sheet .amt { text-align: center; font-size: 30px; font-weight: 800; color: var(--gold); margin-bottom: 4px; }
.sheet input[type='range'] { width: 100%; min-height: 44px; accent-color: var(--gold); }
.sheet .ends { display: flex; justify-content: space-between; font-size: 11px; color: var(--mint); margin-bottom: 14px; }
.sheet .btn { width: 100%; flex: none; margin-top: 8px; }
.list .row { padding: 8px 0; border-bottom: 1px solid rgba(242, 210, 122, 0.12); font-size: 13px; }
.list .row:last-child { border: 0; }
.list .row b { color: var(--gold); }
.list .row .m { color: var(--mint); font-size: 12px; margin-top: 2px; }
.list .empty { color: var(--mint); font-size: 13px; }
.mc { display: inline-block; background: #fff; color: var(--ink); border-radius: 3px; font-size: 11px; font-weight: 800; padding: 0 3px; margin-right: 2px; }
.mc.r { color: #c81e3a; }

/* painel da direita (deitado): abas Mãos | Placar */
.side .tabs { display: flex; gap: 6px; margin-bottom: 8px; }
.side .tabs button { flex: 1; min-height: 44px; border-radius: 999px; border: 1px solid rgba(244, 241, 234, 0.35); background: transparent; font-size: 11px; font-weight: 700; cursor: pointer; }
.side .tabs button[aria-selected='true'] { background: var(--gold); color: var(--ink); border-color: var(--gold); }
.app.poker[data-orient='landscape'] .side { width: 230px; }
.app.poker[data-orient='landscape'] .acts { flex: none; }
```

- [ ] **Step 5: HUD**

`games/poker/view.ts`:

```ts
// HUD do poker em DOM: lugares em volta da mesa (foto, nome, fichas, o que fez, relógio), pote, minha mão, botões
// moeda, régua do aumento, folhas (sentar, completar, histórico) e avisos. Monta uma vez; cada render reescreve só
// o que muda. Texto de usuário sempre por textContent.
import { button, el, fmt } from '../shared/hud/hud';
import type { Orientation } from '../shared/table3d/layout';
import type { BoardRow, Fella, PokerAction, PokerHistoryRow } from '../shared/types';
import { rank, rankName } from './hands';
import type { PokerUi } from './machine';
import {
  buyinRange,
  lastLabel,
  offer,
  playerOf,
  rebuyRange,
  resultLine,
  seatOf,
  secondsLeft,
  statusLine,
} from './rules';

export type Anchors = {
  seatAnchor(v: number): { x: number; y: number };
  potAnchor(): { x: number; y: number };
  mineAnchor(): { x: number; y: number };
  orientation(): Orientation;
};

export type ViewHandlers = {
  openSit(seat: number): void;
  sheetAmount(amount: number): void;
  confirmSheet(): void;
  closeSheet(): void;
  act(action: Exclude<PokerAction, 'raise'>): void;
  openRaise(): void;
  raiseTo(to: number): void;
  confirmRaise(): void;
  closeRaise(): void;
  leave(): void;
  back(): void;
  openRebuy(): void;
  show(): void;
  openHistory(): void;
  tab(tab: 'hands' | 'board'): void;
  retry(): void;
};

export type Extras = {
  me: string | null;
  fella(id: string): Fella | undefined;
  history: PokerHistoryRow[];
  board: BoardRow[];
  tab: 'hands' | 'board';
  now: number;
};

export type View = { canvas: HTMLCanvasElement; render(ui: PokerUi, t: Anchors | null, x: Extras): void; fatal(text: string): void };

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

function miniCard(c: number): HTMLElement {
  const suit = Math.floor(c / 13);
  return el('span', suit === 1 || suit === 2 ? 'mc r' : 'mc', RANKS[c % 13] + SUITS[suit]);
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

type Coin = { b: HTMLButtonElement; face: HTMLElement; label: HTMLElement };

/** Botão moeda (mesmo desenho do Blackjack): face com valor ou símbolo e plaquinha com o nome. */
function coin(kind: string, face: string, label: string, aria: string, key: string, onPress: () => void): Coin {
  const b = el('button', `coin ${kind}`);
  b.type = 'button';
  b.setAttribute('aria-label', aria);
  if (key) b.setAttribute('aria-keyshortcuts', key);
  const f = el('span', 'b');
  const v = el('span', 'v', face);
  f.append(v);
  const l = el('span', 'l', label);
  if (key) b.append(el('kbd', undefined, key));
  b.append(f, l);
  b.addEventListener('click', onPress);
  return { b, face: v, label: l };
}

type SeatEl = {
  root: HTMLElement;
  av: HTMLElement;
  img: HTMLImageElement;
  ini: HTMLElement;
  ring: HTMLElement;
  name: HTMLElement;
  stack: HTMLElement;
  status: HTMLElement;
};

function seatTag(): SeatEl {
  const root = el('div', 'seat');
  const av = el('div', 'av');
  const img = el('img');
  img.alt = '';
  const ini = el('span');
  const ring = el('div', 'ring');
  av.append(img, ini, ring);
  const nm = el('div', 'nm');
  const name = el('span');
  const stack = el('small');
  nm.append(name, stack);
  const status = el('div', 'st');
  root.append(av, nm, status);
  return { root, av, img, ini, ring, name, stack, status };
}

export function createView(root: HTMLElement, h: ViewHandlers): View {
  const app = el('div', 'app poker');

  // topo
  const top = el('header', 'top');
  const back = el('a', undefined, '← Voltar');
  back.href = '/games';
  const title = el('span', 'title', 'Poker');
  const tools = el('div', 'tools');
  const histBtn = button('Mãos', 'ghost hist', h.openHistory);
  histBtn.setAttribute('aria-label', 'Últimas mãos');
  const rebuyBtn = button('Completar', 'ghost', h.openRebuy);
  const leaveBtn = button('Levantar', 'ghost', h.leave);
  const pill = el('span', 'pill', '● —');
  tools.append(histBtn, rebuyBtn, leaveBtn, pill);
  top.append(back, title, tools);

  // cena e o que fica preso nela
  const stage = el('div', 'stage');
  const canvas = el('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const tags = el('div', 'tags');
  const seatAt = [0, 1, 2, 3, 4, 5];
  const seats = seatAt.map(() => seatTag());
  const empties = seatAt.map((_, v) => {
    const b = el('button', 'seat empty');
    b.type = 'button';
    b.setAttribute('aria-label', 'Sentar neste lugar');
    const av = el('span', 'av', '+');
    const nm = el('span', 'nm', 'Sentar');
    b.append(av, nm);
    b.addEventListener('click', () => h.openSit(seatAt[v]));
    return b;
  });
  const potTag = el('div', 'tag');
  potTag.setAttribute('aria-live', 'polite');
  const mineTag = el('div', 'tag');
  tags.append(...seats.map((s) => s.root), ...empties, potTag, mineTag);
  const side = el('aside', 'side');
  side.setAttribute('aria-label', 'Mãos e placar');
  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  const tabHands = button('Mãos', '', () => h.tab('hands'));
  const tabBoard = button('Placar', '', () => h.tab('board'));
  for (const b of [tabHands, tabBoard]) b.setAttribute('role', 'tab');
  tabs.append(tabHands, tabBoard);
  const sideList = el('div', 'list');
  side.append(tabs, sideList);
  const betbox = el('div', 'betbox');
  const banner = el('div', 'banner');
  banner.append(el('span', undefined, 'Você ficou ausente: as mãos seguem sem você.'), button('Voltar', '', h.back));
  stage.append(canvas, tags, side, betbox, banner);

  // painel
  const panel = el('section', 'panel');
  panel.setAttribute('aria-label', 'Controles da mesa');
  const hint = el('p', 'hint');
  hint.setAttribute('aria-live', 'polite');
  const presetValues = [0, 0, 0];
  const presets = [0, 1, 2].map((i) => button('', '', () => h.raiseTo(presetValues[i])));
  let raiseNow = 0;
  const minus = button('−', 'step', () => h.raiseTo(raiseNow - 10));
  minus.setAttribute('aria-label', 'Menos 10');
  const plus = button('+', 'step', () => h.raiseTo(raiseNow + 10));
  plus.setAttribute('aria-label', 'Mais 10');
  const val = el('b', 'val');
  const ruler = el('div', 'ruler');
  const presetRow = el('div', 'row');
  presetRow.append(...presets);
  const stepRow = el('div', 'row');
  stepRow.append(minus, val, plus);
  ruler.append(presetRow, stepRow);
  const fold = coin('fold', '✕', 'CORRER', 'Correr', '1', () => h.act('fold'));
  const call = coin('call', '✓', 'MESA', 'Mesa', '2', () => h.act(callAction));
  const raise = coin('raise', '↑', 'AUMENTAR', 'Aumentar', '3', h.openRaise);
  const allin = coin('allin', 'ALL', 'ALL-IN', 'All-in', '4', () => h.act('allin'));
  let callAction: 'check' | 'call' = 'check';
  const acts = el('div', 'acts');
  acts.append(fold.b, call.b, raise.b, allin.b);
  const raiseBack = coin('back', '←', 'VOLTAR', 'Voltar aos botões', '', h.closeRaise);
  const raiseGo = coin('raise', '↑', 'AUMENTAR', 'Aumentar', '', h.confirmRaise);
  const raiseActs = el('div', 'acts');
  raiseActs.append(raiseBack.b, raiseGo.b);
  const cta = el('div', 'cta');
  const backBtn = button('Voltar pra mesa', 'btn main', h.back);
  const standBtn = button('Levantar', 'btn', h.leave);
  const showBtn = button('Mostrar cartas', 'btn', h.show);
  const rebuyCta = button('Completar', 'btn main', h.openRebuy);
  cta.append(backBtn, standBtn, showBtn, rebuyCta);
  panel.append(hint, ruler, acts, raiseActs, cta);

  // folha (sentar, completar, histórico)
  const sheetWrap = el('div', 'sheetwrap');
  const dim = el('button', 'dim');
  dim.type = 'button';
  dim.setAttribute('aria-label', 'Fechar');
  dim.addEventListener('click', h.closeSheet);
  const sheet = el('section', 'sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  const sheetTitle = el('h2');
  const sheetText = el('p');
  const amt = el('div', 'amt');
  const range = el('input');
  range.type = 'range';
  range.step = '5';
  range.setAttribute('aria-label', 'Quanto levar para a mesa');
  range.addEventListener('input', () => h.sheetAmount(Number(range.value)));
  const ends = el('div', 'ends');
  const endMin = el('span');
  const endMid = el('span');
  const endMax = el('span');
  ends.append(endMin, endMid, endMax);
  const form = el('div');
  const confirm = button('', 'btn main', h.confirmSheet);
  form.append(amt, range, ends, confirm);
  const sheetList = el('div', 'list');
  const cancel = button('Agora não', 'btn', h.closeSheet);
  sheet.append(sheetTitle, sheetText, form, sheetList, cancel);
  sheetWrap.append(dim, sheet);

  // avisos
  const notice = el('div', 'notice');
  notice.setAttribute('role', 'status');
  const noticeText = el('span');
  const retryBtn = button('Tentar de novo', '', h.retry);
  notice.append(noticeText, retryBtn);
  const overlay = el('div', 'overlay');
  const overlayText = el('p');
  const enter = el('a', 'btn main', 'Entrar');
  enter.href = '/';
  overlay.append(overlayText, enter);

  app.append(top, stage, panel, sheetWrap, notice, overlay);
  root.append(app);

  let sideKey = '';
  let sheetKey = '';

  function place(n: HTMLElement, p: { x: number; y: number } | undefined) {
    if (!p) return;
    n.style.left = `${p.x}px`;
    n.style.top = `${p.y}px`;
  }

  function historyRow(r: PokerHistoryRow, name: (id: string) => string): HTMLElement {
    const row = el('div', 'row');
    const head = el('div');
    const pays = Object.entries(r.results.payouts).filter(([, v]) => v > 0);
    pays.forEach(([seat, v], i) => {
      if (i) head.append(document.createTextNode(' · '));
      head.append(el('b', undefined, name(r.players[seat])), document.createTextNode(` levou ${fmt(v)}`));
    });
    const m = el('div', 'm');
    const named = r.results.pots.find((p) => p.name)?.name ?? '';
    m.append(document.createTextNode(r.results.showdown ? named : 'Todos correram'));
    if (r.board.length) {
      m.append(document.createTextNode(' · '));
      r.board.forEach((c) => m.append(miniCard(c)));
    }
    row.append(head, m);
    return row;
  }

  function fillList(list: HTMLElement, rows: HTMLElement[], empty: string) {
    list.replaceChildren(...(rows.length ? rows : [el('p', 'empty', empty)]));
  }

  function render(ui: PokerUi, t: Anchors | null, x: Extras) {
    overlay.hidden = ui.phase !== 'no_session';
    overlayText.textContent = 'Entra no fellas pra jogar';
    const noticeMsg = ui.notice ?? (ui.online ? null : 'Reconectando…');
    notice.hidden = !noticeMsg;
    noticeText.textContent = noticeMsg ?? '';
    retryBtn.hidden = ui.online;
    pill.textContent = ui.wallet ? `● ${fmt(ui.wallet.balance)}` : '● —';
    pill.setAttribute('aria-label', ui.wallet ? `Sua carteira: ${fmt(ui.wallet.balance)}` : 'Carteira');
    const s = ui.table;
    if (!s) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    const o = t?.orientation() ?? 'portrait';
    app.dataset.orient = o;
    const me = x.me;
    const name = (id: string) => (id === me ? 'Você' : (x.fella(id)?.name ?? 'Alguém'));
    const mine = seatOf(s, me);
    const mySeat = mine?.seat ?? null;
    const h0 = s.hand && s.hand.status !== 'void' ? s.hand : null;
    const betting = h0?.status === 'betting';
    const live = playerOf(h0, me);
    const inOpenHand = !!(betting && live && !live.p.folded);
    const full = s.seats.length >= 6;
    const away = mine?.status === 'away';

    title.textContent = `Poker · cegas ${s.blinds[0]}/${s.blinds[1]}`;
    leaveBtn.hidden = !mine;
    rebuyBtn.hidden = !mine || inOpenHand || mine.stack >= s.buyin[1];

    // lugares
    for (let v = 0; v < 6; v++) {
      const seatNo = o === 'landscape' || mySeat === null ? v : (v + mySeat) % 6;
      seatAt[v] = seatNo;
      const occ = s.seats.find((z) => z.seat === seatNo);
      const tag = seats[v];
      const pos = t?.seatAnchor(v);
      place(tag.root, pos);
      place(empties[v], pos);
      tag.root.hidden = !occ;
      empties[v].hidden = !!occ || !!mine || full || s.closed;
      if (!occ) continue;
      const nm = name(occ.user_id);
      tag.name.textContent = nm;
      tag.stack.textContent = fmt(occ.stack);
      const url = x.fella(occ.user_id)?.avatarUrl ?? null;
      tag.img.hidden = !url;
      if (url && tag.img.getAttribute('src') !== url) tag.img.src = url;
      tag.ini.hidden = !!url;
      tag.ini.textContent = initials(nm);
      tag.av.className = `av c${seatNo}`;
      const p = h0?.players[String(seatNo)];
      const inHand = !!p && p.user_id === occ.user_id;
      const turn = betting && inHand && h0!.to_act === seatNo;
      tag.root.classList.toggle('turn', turn);
      tag.root.classList.toggle('out', occ.status === 'away' || (inHand && p!.folded));
      tag.root.classList.toggle('win', h0?.status === 'done' && inHand && (h0.results?.payouts[String(seatNo)] ?? 0) > 0);
      tag.ring.hidden = !turn;
      if (turn) tag.ring.style.setProperty('--k', String(Math.min(1, (secondsLeft(h0!.deadline, ui.offsetMs, x.now) ?? 0) / 30)));
      const handName = h0?.status === 'done' && inHand ? h0.results?.hands[String(seatNo)] : undefined;
      tag.status.textContent =
        occ.status === 'away'
          ? 'Ausente'
          : occ.leaving
            ? 'Saindo'
            : occ.busted
              ? 'Sem fichas'
              : (handName ?? (inHand ? (lastLabel(p!) ?? '') : occ.wait_bb ? 'Esperando a cega' : ''));
      tag.root.setAttribute(
        'aria-label',
        `${nm}, ${fmt(occ.stack)} fichas${tag.status.textContent ? `, ${tag.status.textContent}` : ''}${turn ? ', na vez' : ''}`,
      );
    }

    // pote ou resultado, e o nome da minha mão
    const result = h0 ? resultLine(h0, me, name) : null;
    potTag.hidden = !h0 || (!result && h0.pot <= 0);
    potTag.textContent = result ?? (h0 ? `Pote ${fmt(h0.pot)}` : '');
    potTag.className = result ? 'tag gold' : 'tag';
    place(potTag, t?.potAnchor());
    const myCards = live && h0 && ui.cards?.hand_id === h0.id ? ui.cards.cards : null;
    const myHand = myCards
      ? ((h0!.status === 'done' ? h0!.results?.hands[String(live!.seat)] : undefined) ?? rankName(rank([...myCards, ...h0!.board])))
      : null;
    mineTag.hidden = !myHand;
    mineTag.textContent = myHand ?? '';
    place(mineTag, t?.mineAnchor());

    // deitado: eu na mesa e o painel da direita
    betbox.hidden = !mine;
    betbox.replaceChildren(document.createTextNode('Você na mesa'), el('b', undefined, fmt(mine?.stack ?? 0)));
    banner.hidden = !away;
    tabHands.setAttribute('aria-selected', String(x.tab === 'hands'));
    tabBoard.setAttribute('aria-selected', String(x.tab === 'board'));
    const key = JSON.stringify([x.tab, x.history.map((r) => r.id), x.board, me]);
    if (key !== sideKey) {
      sideKey = key;
      if (x.tab === 'hands') fillList(sideList, x.history.slice(0, 8).map((r) => historyRow(r, name)), 'Nenhuma mão ainda.');
      else
        fillList(
          sideList,
          x.board.map((r) => {
            const row = el('div', r.userId === me ? 'row me' : 'row');
            row.append(el('span', 'n', r.userId === me ? 'Você' : r.name), el('b', undefined, fmt(r.balance)));
            return row;
          }),
          'Ninguém jogou essa semana ainda.',
        );
    }

    // linha de estado
    const of = offer(s, me);
    const myTurn = !!of && ui.online && !ui.busy;
    const raising = ui.raise !== null && !!of;
    let hintText: string | null;
    if (!mine) {
      hintText =
        s.closed && !betting
          ? 'A mesa fecha pro reset. Volta 00:00.'
          : full
            ? 'Mesa cheia (6/6). Fica de olho que já libera.'
            : 'Toca num lugar vazio pra sentar';
    } else if (away) {
      hintText = 'Ao voltar, você entra quando a cega grande chegar em você.';
    } else {
      hintText = statusLine(s, me, name, ui.offsetMs, x.now);
    }
    hint.textContent = hintText ?? '';
    hint.hidden = !hintText;

    // moedas
    acts.hidden = !mine || away || raising;
    for (const c of [fold, call, raise, allin]) c.b.disabled = !myTurn;
    if (of) {
      callAction = of.canCheck ? 'check' : 'call';
      call.face.textContent = of.canCheck ? '✓' : fmt(of.toCall);
      call.label.textContent = of.canCheck ? 'MESA' : of.callAllIn ? 'ALL-IN' : 'PAGAR';
      call.b.setAttribute('aria-label', of.canCheck ? 'Mesa' : `Pagar ${of.toCall}`);
      raise.b.disabled = !myTurn || !of.canRaise;
    } else {
      call.face.textContent = '✓';
      call.label.textContent = 'MESA';
      call.b.setAttribute('aria-label', 'Mesa');
    }

    // régua
    ruler.hidden = !raising;
    raiseActs.hidden = !raising;
    if (raising && of) {
      raiseNow = ui.raise!;
      const labels = [`Mín ${fmt(of.minTo)}`, `½ pote ${fmt(of.halfPotTo)}`, `Pote ${fmt(of.potTo)}`];
      [of.minTo, of.halfPotTo, of.potTo].forEach((value, i) => {
        presetValues[i] = value;
        presets[i].textContent = labels[i];
        presets[i].setAttribute('aria-label', labels[i]);
        presets[i].classList.toggle('on', value === raiseNow);
      });
      val.textContent = fmt(raiseNow);
      minus.disabled = raiseNow <= of.minTo;
      plus.disabled = raiseNow >= of.maxTo;
      const all = raiseNow >= of.maxTo;
      raiseGo.label.textContent = all ? 'ALL-IN' : `AUMENTAR P/ ${fmt(raiseNow)}`;
      raiseGo.b.setAttribute('aria-label', all ? 'All-in' : `Aumentar para ${raiseNow}`);
      raiseGo.b.disabled = ui.busy;
    }

    // chamadas
    backBtn.hidden = !away;
    standBtn.hidden = !away;
    standBtn.textContent = `Levantar (${fmt(mine?.stack ?? 0)} voltam pra carteira)`;
    showBtn.hidden = !(h0 && h0.status === 'done' && live && myCards && !(String(live.seat) in h0.shown));
    rebuyCta.hidden = !mine?.busted;
    cta.hidden = [backBtn, standBtn, showBtn, rebuyCta].every((b) => b.hidden);
    for (const b of [backBtn, standBtn, showBtn, rebuyCta]) b.disabled = ui.busy;

    // folha
    sheetWrap.hidden = !ui.sheet;
    if (ui.sheet?.kind === 'history') {
      sheetTitle.textContent = 'Últimas mãos';
      sheetText.hidden = true;
      form.hidden = true;
      sheetList.hidden = false;
      cancel.textContent = 'Fechar';
      const k = JSON.stringify(x.history.map((r) => r.id));
      if (k !== sheetKey) {
        sheetKey = k;
        fillList(sheetList, x.history.map((r) => historyRow(r, name)), 'Nenhuma mão ainda.');
      }
    } else if (ui.sheet) {
      sheetKey = '';
      sheetText.hidden = false;
      form.hidden = false;
      sheetList.hidden = true;
      cancel.textContent = 'Agora não';
      const w = ui.wallet?.balance ?? 0;
      const sit = ui.sheet.kind === 'sit';
      const r = sit ? buyinRange(s, w) : rebuyRange(mine?.stack ?? 0, s.buyin[1], w);
      const amount = r.ok ? Math.min(Math.max(ui.sheet.amount, r.min), r.max) : r.min;
      sheetTitle.textContent = sit ? 'Sentar na mesa' : 'Completar fichas';
      sheetText.textContent = !r.ok
        ? sit
          ? `Você precisa de pelo menos ${fmt(r.min)} na carteira.${ui.wallet?.can_fiado ? ' Dá pra pegar fiado na aba Games.' : ''}`
          : 'Sua carteira não cobre nem 10.'
        : sit && s.me?.rathole_min
          ? `Você levantou há pouco: volta com pelo menos ${fmt(r.min)}.`
          : sit
            ? 'Sai da carteira e vira fichas. Ao levantar, volta tudo.'
            : `Sai da carteira e entra na mesa (até ${fmt(s.buyin[1])}).`;
      range.min = String(r.min);
      range.max = String(Math.max(r.max, r.min));
      range.value = String(amount);
      range.disabled = !r.ok || r.min >= r.max;
      amt.textContent = fmt(amount);
      endMin.textContent = fmt(r.min);
      endMid.textContent = `Carteira ${fmt(w)}`;
      endMax.textContent = fmt(Math.max(r.max, r.min));
      confirm.textContent = `${sit ? 'Sentar' : 'Completar'} com ${fmt(amount)}`;
      confirm.disabled = !r.ok || ui.busy;
    }
  }

  function fatal(text: string) {
    overlayText.textContent = text;
    enter.hidden = true;
    overlay.hidden = false;
    panel.hidden = true;
  }

  overlay.hidden = true;
  notice.hidden = true;
  sheetWrap.hidden = true;
  return { canvas, render, fatal };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test --prefix games -- poker` e `npm run build --prefix games`
Expected: PASS; build limpo.

- [ ] **Step 7: Commit**

```bash
git add games/poker/view.ts games/poker/view.test.ts games/poker/poker.css games/poker/rules.ts games/poker/rules.test.ts
git commit -m "Poker: HUD (lugares, relógio, botões moeda, régua, folhas de sentar/completar/histórico, avisos)"
```

---

### Task 11: A página — `poker/main.ts`, `index.html`, Vite, `?mock` com bots

**Files:**
- Create: `games/poker/index.html`, `games/poker/main.ts`, `games/dev/mockDb.ts`, `games/dev/mockPoker.ts`
- Modify: `games/vite.config.ts` (entrada `poker`), `games/dev/mockApi.ts` (usa `mockDb`), `games/dev/frames.html` (escolhe o jogo)

**Interfaces:**
- Consumes: tudo das Tasks 6–10.
- Produces: página `/games/poker/`; `dev/mockDb.ts` (`ME`, `FRIENDS`, `ready`, `call<T>(sql, params?, as?)`); `dev/mockPoker.ts` (mesmas funções que `main.ts` usa de `shared/api` + `watchTable`).

- [ ] **Step 1: Banco do dev compartilhado**

`games/dev/mockDb.ts`:

```ts
// Só no dev (?mock): o banco roda no navegador (PGlite) com as migrações de verdade. Compartilhado pelo Blackjack e
// pelo Poker. Uma chamada por vez (o usuário do teste e o papel mudam por chamada): a fila evita misturar os bots
// com quem está jogando. Nunca entra no build.
import { PGlite } from '@electric-sql/pglite';

import m27 from '../../supabase/migrations/0027_fellas_games.sql?raw';
import m28 from '../../supabase/migrations/0028_blackjack.sql?raw';
import m29 from '../../supabase/migrations/0029_fellas_games_ajustes.sql?raw';
import m30 from '../../supabase/migrations/0030_poker.sql?raw';
import { toGameError } from '../shared/errors';
import { SKELETON } from '../test/skeleton';

export const ME = '00000000-0000-0000-0000-0000000000aa';
export const FRIENDS: [string, string, number][] = [
  ['00000000-0000-0000-0000-0000000000b1', 'Oliveira', 3420],
  ['00000000-0000-0000-0000-0000000000b2', 'Bia', 2180],
  ['00000000-0000-0000-0000-0000000000b3', 'Teteu', 640],
];

export const ready = (async () => {
  const db = new PGlite();
  await db.exec(SKELETON);
  for (const m of [m27, m28, m29, m30]) await db.exec(m);
  await db.query(`insert into public.profiles (id, username, display_name) values ($1, 'eu', 'Você')`, [ME]);
  for (const [id, name, balance] of FRIENDS) {
    await db.query(`insert into public.profiles (id, username, display_name) values ($1, lower($2), $2)`, [id, name]);
    await db.query(
      `insert into public.game_wallets (user_id, balance, week_start, last_played_at) values ($1, $2, public.games_week_start(), now())`,
      [id, balance],
    );
  }
  return db;
})();

let queue: Promise<unknown> = Promise.resolve();

/** Roda `sql` (que devolve uma coluna `v`) como `authenticated`, no papel de `as`. */
export function call<T>(sql: string, params: unknown[] = [], as = ME): Promise<T> {
  const run = queue.then(async () => {
    const db = await ready;
    try {
      await db.query(`select set_config('test.uid', $1, false)`, [as]);
      await db.exec('set role authenticated');
      return (await db.query<{ v: T }>(sql, params)).rows[0]?.v as T;
    } catch (e) {
      throw toGameError(e);
    } finally {
      await db.exec('reset role');
    }
  });
  queue = run.catch(() => undefined);
  return run;
}
```

`games/dev/mockApi.ts` — trocar o começo (imports, `ME`, `FRIENDS`, `ready`, `call`) por:

```ts
// Só no dev (?mock): o Blackjack contra as migrações rodando no navegador (dev/mockDb.ts). Mesmas funções e
// formatos de shared/api.ts. Nunca entra no build.
import type { Action, BoardRow, RoundState, Wallet } from '../shared/types';
import { call, ME, ready } from './mockDb';
```

e o `weekBoard` passa a usar o placar do banco (soma a mesa):

```ts
export async function weekBoard(): Promise<BoardRow[]> {
  const rows = await call<{ user_id: string; balance: number }[]>('select public.games_board() as v');
  const names = await call<{ id: string; name: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name)), '[]') as v from public.profiles`,
  );
  return rows
    .slice(0, 6)
    .map((r) => ({ userId: r.user_id, balance: r.balance, name: names.find((n) => n.id === r.user_id)?.name ?? 'Alguém' }));
}
```

(O resto do arquivo — `gamesWallet`, `bjDeal`… e o `__rig` — fica como está; o `__rig` passa a usar `await ready`.)

- [ ] **Step 2: Poker de mentira com bots**

`games/dev/mockPoker.ts`:

```ts
// Só no dev (?mock): o poker no PGlite do navegador (migrações de verdade) com 3 fellas de mentira sentados que
// jogam sozinhos, e o "tempo real" é um aviso local depois de cada mudança. Mesmas funções que poker/main.ts usa.
import type { BoardRow, Fella, PokerAction, PokerCards, PokerHistoryRow, PokerState, Wallet } from '../shared/types';
import { call, FRIENDS, ME, ready } from './mockDb';

const BOTS = FRIENDS.map(([id]) => id);
const listeners = new Set<(s: PokerState) => void>();

async function emit() {
  const s = await call<PokerState>('select public.poker_state() as v');
  for (const fn of listeners) fn(s);
}
async function change<T>(sql: string, params: unknown[] = []): Promise<T> {
  const v = await call<T>(sql, params);
  void emit();
  return v;
}

export const hasSession = async () => true;
export const myId = async () => ME;
export const gamesWallet = () => call<Wallet>('select public.games_wallet() as v');
export const pokerState = () => call<PokerState>('select public.poker_state() as v');
export const pokerMyCards = () => call<PokerCards>('select public.poker_my_cards() as v');
export const pokerHistory = () => call<PokerHistoryRow[]>('select public.poker_history() as v');
export const pokerSit = (seat: number, buyin: number) => change<PokerState>('select public.poker_sit($1, $2) as v', [seat, buyin]);
export const pokerAct = (hand: string, actionNo: number, action: PokerAction, amount?: number) =>
  change<PokerState>('select public.poker_act($1, $2, $3, $4) as v', [hand, actionNo, action, amount ?? null]);
export const pokerRebuy = (amount: number) => change<PokerState>('select public.poker_rebuy($1) as v', [amount]);
export const pokerLeave = () => change<PokerState>('select public.poker_leave() as v');
export const pokerBack = () => change<PokerState>('select public.poker_back() as v');
export const pokerShow = () => change<PokerState>('select public.poker_show() as v');
export const pokerTick = () => change<PokerState | null>('select public.poker_tick() as v');

export async function fellas(ids: string[]): Promise<Fella[]> {
  const rows = await call<{ id: string; name: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name)), '[]') as v
       from public.profiles where id = any($1::uuid[])`,
    [`{${ids.join(',')}}`],
  );
  return rows.map((r) => ({ ...r, avatarUrl: null }));
}

export async function weekBoard(): Promise<BoardRow[]> {
  const rows = await call<{ user_id: string; balance: number }[]>('select public.games_board() as v');
  const names = await fellas(rows.map((r) => r.user_id));
  return rows.slice(0, 6).map((r) => ({ userId: r.user_id, balance: r.balance, name: names.find((n) => n.id === r.user_id)?.name ?? 'Alguém' }));
}

export function watchTable(onState: (s: PokerState) => void, onLive: (live: boolean) => void) {
  listeners.add(onState);
  onLive(true);
  return { stop: () => void listeners.delete(onState) };
}

// bots: sentam nos lugares 1, 3 e 4 e jogam quando é a vez deles; o relógio roda como o cron
async function botTurn() {
  await call('select public.poker_tick() as v', [], BOTS[0]).catch(() => null);
  const s = await call<PokerState>('select public.poker_state() as v', [], BOTS[0]);
  const h = s.hand;
  if (h?.status === 'betting' && h.to_act !== null) {
    const p = h.players[String(h.to_act)];
    if (BOTS.includes(p.user_id)) {
      const facing = h.current_bet > p.bet;
      const x = Math.random();
      const safe = facing ? 'call' : 'check';
      const [action, amount] = x < 0.12 && facing ? ['fold', null] : x < 0.85 ? [safe, null] : ['raise', h.min_raise_to];
      await call('select public.poker_act($1, $2, $3, $4) as v', [h.id, h.action_no, action, amount], p.user_id).catch(() =>
        call('select public.poker_act($1, $2, $3, null) as v', [h.id, h.action_no, safe], p.user_id).catch(() => null),
      );
    }
  }
  await emit();
}

void (async () => {
  await ready;
  for (const [i, id] of BOTS.entries()) {
    await call('select public.poker_sit($1, 300) as v', [[1, 3, 4][i]], id).catch(() => null);
  }
  await emit();
  setInterval(() => void botTurn(), 1500);
})();

// console do dev: __rigPoker([0, 13, ...]) faz o próximo baralho começar com essas cartas
(window as unknown as { __rigPoker: (cards: number[]) => Promise<void> }).__rigPoker = async (cards) => {
  const db = await ready;
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !cards.includes(c));
  await db.exec(`create or replace function public.poker_shuffle() returns smallint[] language sql volatile as
    $$ select array[${[...cards, ...rest].map(Number).join(',')}]::smallint[] $$`);
};
```

- [ ] **Step 3: Página e Vite**

`games/poker/index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b100d" />
    <title>Poker · Fellas Games</title>
    <link rel="icon" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`games/vite.config.ts` — `rollupOptions.input` ganha o poker:

```ts
    rollupOptions: {
      input: {
        blackjack: resolve(import.meta.dirname, 'blackjack/index.html'),
        poker: resolve(import.meta.dirname, 'poker/index.html'),
      },
    },
```

`games/dev/frames.html` — escolher o jogo por `?game=` (padrão: blackjack):

```html
  <body>
    <iframe id="phone" width="390" height="844"></iframe>
    <iframe id="pc" width="1280" height="720"></iframe>
    <script>
      const game = new URLSearchParams(location.search).get('game') || 'blackjack';
      for (const id of ['phone', 'pc']) document.getElementById(id).src = `../${game}/?mock&shot`;
    </script>
  </body>
```

- [ ] **Step 4: `poker/main.ts`**

```ts
// Mesa do Poker: liga o estado da tela (machine), o HUD (view) e a mesa 3D (table) ao banco (api) e ao tempo real.
// O banco manda retratos; a tela anima a diferença entre o último desenhado e o novo, e só pede jogadas.
import '../shared/hud/hud.css';
import './poker.css';

import * as realApi from '../shared/api';
import { GameError, toGameError } from '../shared/errors';
import { watchTable as realWatch } from '../shared/realtime';
import type { BoardRow, Fella, PokerAction, PokerHistoryRow, PokerState } from '../shared/types';
import { initial, reduce, type PokerUi, type UiEvent } from './machine';
import { buyinRange, clampRaise, isMyTurn, offer, playerOf, rebuyRange, seatOf, snapAmount } from './rules';
import { createPokerTable, type PokerTable } from './table';
import { buildView, diff, type TableView } from './tableDiff';
import { createView } from './view';

// só no dev: ?shot faz a página se achar visível (o Chrome da automação marca a aba como escondida e freia timers)
const SHOT = import.meta.env.DEV && new URLSearchParams(location.search).has('shot');
if (SHOT) {
  Object.defineProperty(document, 'hidden', { get: () => false });
  const tick = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'])));
  const queue: FrameRequestCallback[] = [];
  tick.onmessage = () => queue.splice(0).forEach((cb) => cb(performance.now()));
  window.requestAnimationFrame = (cb) => (queue.push(cb), 0);
}

type Api = Pick<
  typeof realApi,
  | 'gamesWallet'
  | 'hasSession'
  | 'myId'
  | 'weekBoard'
  | 'fellas'
  | 'pokerState'
  | 'pokerSit'
  | 'pokerAct'
  | 'pokerRebuy'
  | 'pokerLeave'
  | 'pokerBack'
  | 'pokerShow'
  | 'pokerMyCards'
  | 'pokerTick'
  | 'pokerHistory'
> & { watchTable: typeof realWatch };
// só no dev: ?mock joga contra as migrações no navegador, com 3 bots (dev/mockPoker.ts)
const api: Api =
  import.meta.env.DEV && new URLSearchParams(location.search).has('mock')
    ? await import('../dev/mockPoker')
    : { ...realApi, watchTable: realWatch };

let ui: PokerUi = initial;
let table: PokerTable | null = null;
let me: string | null = null;
let drawn: TableView | null = null;
let animating: Promise<void> = Promise.resolve();
const people = new Map<string, Fella>();
let history: PokerHistoryRow[] = [];
let board: BoardRow[] = [];
let tab: 'hands' | 'board' = 'hands';
let wasMyTurn = false;
let tickedFor = '';

const view = createView(document.getElementById('app')!, {
  openSit(seat) {
    if (!ui.table || !ui.wallet) return;
    const r = buyinRange(ui.table, ui.wallet.balance);
    send({ type: 'sheet', sheet: { kind: 'sit', seat, amount: snapAmount(Math.max(300, r.min), { min: r.min, max: Math.max(r.max, r.min) }) } });
  },
  sheetAmount(v) {
    const sh = ui.sheet;
    if (!sh || sh.kind === 'history' || !ui.table || !ui.wallet) return;
    const w = ui.wallet.balance;
    const mine = seatOf(ui.table, me);
    const r = sh.kind === 'sit' ? buyinRange(ui.table, w) : rebuyRange(mine?.stack ?? 0, ui.table.buyin[1], w);
    send({ type: 'sheet', sheet: { ...sh, amount: snapAmount(v, r) } });
  },
  confirmSheet() {
    const sh = ui.sheet;
    if (sh?.kind === 'sit') void guard(() => api.pokerSit(sh.seat, sh.amount), true);
    else if (sh?.kind === 'rebuy') void guard(() => api.pokerRebuy(sh.amount), true);
  },
  closeSheet: () => send({ type: 'sheet', sheet: null }),
  act: (a) => act(a),
  openRaise() {
    const o = offer(ui.table, me);
    if (o?.canRaise) send({ type: 'raise', to: o.minTo });
  },
  raiseTo(to) {
    const o = offer(ui.table, me);
    if (o) send({ type: 'raise', to: clampRaise(to, o) });
  },
  confirmRaise() {
    const o = offer(ui.table, me);
    if (o && ui.raise !== null) act(ui.raise >= o.maxTo ? 'allin' : 'raise', ui.raise);
  },
  closeRaise: () => send({ type: 'raise', to: null }),
  leave: () => void guard(() => api.pokerLeave(), true),
  back: () => void guard(() => api.pokerBack()),
  openRebuy() {
    const mine = seatOf(ui.table, me);
    if (!mine || !ui.table || !ui.wallet) return;
    const r = rebuyRange(mine.stack, ui.table.buyin[1], ui.wallet.balance);
    send({ type: 'sheet', sheet: { kind: 'rebuy', amount: Math.max(r.max, r.min) } });
  },
  show: () => void guard(() => api.pokerShow()),
  openHistory() {
    void loadHistory();
    send({ type: 'sheet', sheet: { kind: 'history' } });
  },
  tab(next) {
    tab = next;
    if (next === 'board') void loadBoard();
    paint();
  },
  retry: () => void reload(),
});

function send(e: UiEvent) {
  ui = reduce(ui, e);
  paint();
}

function paint() {
  view.render(ui, table, { me, fella: (id) => people.get(id), history, board, tab, now: Date.now() });
  if (!table) return;
  const next = buildView(ui.table, me, ui.cards, table.orientation());
  const steps = diff(drawn, next);
  if (!steps.length) return;
  drawn = next;
  const t = table;
  animating = animating.then(() => t.play(steps)).catch(() => {});
}

/** Retrato novo (tempo real ou resposta): cartas da mão nova, histórico, nomes, carteira, vibrar na minha vez. */
function onTable(s: PokerState) {
  const before = ui.table;
  send({ type: 'table', table: s, now: Date.now() });
  if (ui.table !== before && ui.table?.seq === s.seq) {
    const handChanged = before?.hand?.id !== s.hand?.id;
    if (handChanged && playerOf(s.hand, me)) void loadCards();
    if (before?.hand?.status === 'betting' && s.hand?.status === 'done') void loadHistory();
    void loadPeople(s.seats.map((x) => x.user_id));
    const seated = !!seatOf(s, me);
    if (seated !== !!seatOf(before, me)) void refreshWallet();
  }
  const mine = isMyTurn(ui.table, me);
  if (mine && !wasMyTurn && typeof navigator.vibrate === 'function') navigator.vibrate(120);
  wasMyTurn = mine;
}

async function guard(work: () => Promise<PokerState | null>, wallet = false) {
  if (ui.busy) return;
  send({ type: 'request' });
  try {
    const s = await work();
    if (s) onTable(s);
    send({ type: 'done' });
    if (wallet) await refreshWallet();
  } catch (e) {
    const err = toGameError(e);
    send({ type: 'failed', error: err });
    if (['stale_seq', 'not_your_turn', 'seat_taken', 'not_seated', 'rebuy_in_hand', 'already_seated'].includes(err.code)) {
      await reload();
    }
  }
}

function act(a: PokerAction, amount?: number) {
  const h = ui.table?.hand;
  if (!h || !isMyTurn(ui.table, me)) return;
  void guard(() => api.pokerAct(h.id, h.action_no, a, amount));
}

async function loadCards() {
  try {
    send({ type: 'cards', cards: await api.pokerMyCards() });
  } catch {
    /* a próxima recarga traz */
  }
}

async function loadPeople(ids: string[]) {
  const missing = [...new Set(ids)].filter((id) => !people.has(id));
  if (!missing.length) return;
  try {
    for (const f of await api.fellas(missing)) people.set(f.id, f);
    paint();
  } catch {
    /* sem nome: "Alguém" até a próxima */
  }
}

async function loadHistory() {
  try {
    history = await api.pokerHistory();
    await loadPeople(history.flatMap((r) => Object.values(r.players)));
    paint();
  } catch {
    /* fica o que tinha */
  }
}

async function loadBoard() {
  try {
    board = await api.weekBoard();
    paint();
  } catch {
    /* fica o que tinha */
  }
}

async function refreshWallet() {
  try {
    send({ type: 'wallet', wallet: await api.gamesWallet() });
  } catch {
    /* fica o que tinha */
  }
}

async function reload() {
  try {
    const [s, cards, wallet] = await Promise.all([api.pokerState(), api.pokerMyCards(), api.gamesWallet()]);
    await loadPeople(s.seats.map((x) => x.user_id));
    send({ type: 'loaded', table: s, cards, wallet, now: Date.now() });
    wasMyTurn = isMyTurn(ui.table, me);
    void loadHistory();
    if (table?.orientation() === 'landscape') void loadBoard();
  } catch (e) {
    send({ type: 'failed', error: toGameError(e) });
  }
}

// relógio da tela: anel e segundos; prazo vencido (ou pausa entre mãos) → pede o tick (uma vez por prazo)
setInterval(() => {
  const s = ui.table;
  if (!s || document.hidden) return;
  paint();
  const due = s.hand?.status === 'betting' ? s.hand.deadline : s.next_hand_at;
  if (!due || Date.parse(due) + 1000 > Date.now() + ui.offsetMs) return;
  const key = `${due}|${s.seq}`;
  if (tickedFor === key) return;
  tickedFor = key;
  api
    .pokerTick()
    .then((st) => st && onTable(st))
    .catch(() => {});
}, 1000);

// PC: 1 Correr · 2 Mesa/Pagar · 3 Aumentar (abre a régua; com ela aberta, confirma) · 4 All-in · Esc fecha
addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
  const o = offer(ui.table, me);
  if (e.key === 'Escape') {
    if (ui.raise !== null) send({ type: 'raise', to: null });
    else if (ui.sheet) send({ type: 'sheet', sheet: null });
    return;
  }
  if (!o) return;
  if (e.key === '1') act('fold');
  else if (e.key === '2') act(o.canCheck ? 'check' : 'call');
  else if (e.key === '3' || (e.key === 'Enter' && ui.raise !== null)) {
    if (ui.raise === null) {
      if (o.canRaise) send({ type: 'raise', to: o.minTo });
    } else act(ui.raise >= o.maxTo ? 'allin' : 'raise', ui.raise);
  } else if (e.key === '4') act('allin');
});

// voltou para a aba: pode ter perdido eventos
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ui.phase === 'ready') void reload();
});

void (async () => {
  if (import.meta.env.DEV && api.myId === realApi.myId) {
    const { devLogin } = await import('../shared/devLogin');
    await devLogin();
  }
  await document.fonts.ready; // as cartas são desenhadas com a Golos Text
  table = createPokerTable(view.canvas);
  if (!table) {
    view.fatal('Esse navegador não roda a mesa 3D. Tenta pelo Chrome ou Safari atualizado.');
    return;
  }
  if (SHOT) table.reducedMotion = true;
  const t = table;
  new ResizeObserver(() => {
    if (t.resize(view.canvas.clientWidth || 1, view.canvas.clientHeight || 1)) {
      drawn = null; // a vista depende da orientação: redesenha inteira
      if (t.orientation() === 'landscape') void loadBoard();
    }
    paint();
  }).observe(view.canvas);
  if (!(await api.hasSession())) {
    send({ type: 'failed', error: new GameError('no_session') });
    return;
  }
  me = await api.myId();
  await reload();
  api.watchTable(onTable, (live) => {
    const was = ui.online;
    send({ type: 'online', online: live });
    if (live && !was) void reload();
  });
})();
```

- [ ] **Step 5: Build e conferência no navegador (dev)**

Run: `npm run build --prefix games`
Expected: build gera `dist/games/poker/index.html` e `dist/games/blackjack/index.html`; sem erro de tipo.

Run (em segundo plano): `npm run dev --prefix games` e abrir `http://localhost:5173/games/poker/?mock` no Chrome (claude-in-chrome) e `http://localhost:5173/games/dev/frames.html?game=poker`.
Expected: mesa com 3 bots sentados (lugares 1, 3, 4) jogando sozinhos; toco num lugar vazio → folha de sentar → "Sentar com 300" → a mão seguinte me dá cartas; na minha vez as moedas acendem; Aumentar abre a régua; o anel do relógio esvazia; o histórico enche. Também abrir `/games/blackjack/?mock` e jogar uma mão (o mock do Blackjack mudou de base).

- [ ] **Step 6: Commit**

```bash
git add games/poker/index.html games/poker/main.ts games/vite.config.ts games/dev
git commit -m "Poker: página da mesa (tempo real, relógio, atalhos) e ?mock com bots"
```

---

### Task 12: App — card do Poker, placar com a mesa, carteira sentada, tempo real, docs

> Parte de interface do app: **usar a skill `impeccable`** (modo Operate, plataforma adaptive) antes de mexer em `GameRows.tsx`/`games.tsx` (CLAUDE.md). Só tokens de `lib/theme.ts` e componentes de `components/ui`.

**Files:**
- Modify: `lib/api/games.ts`, `components/games/GameRows.tsx`, `app/(tabs)/games.tsx`, `lib/realtime.ts`, `types/database.ts`, `DESIGN.md`, `supabase/README.md`
- Modify (testes): `__tests__/gamesApi.test.ts`, `__tests__/gamesScreen.test.tsx`, `__tests__/realtime.test.tsx`
- Create: `__tests__/pokerMigration.test.ts`

**Interfaces:**
- Consumes: `games_board()`, `poker_tables.state` (0030), `openGame(slug)` (`lib/games.ts`), `onLive/debounce/LIVE_DEBOUNCE_MS` (`lib/realtime.ts`).
- Produces: `Wallet.seatedStack: number | null`; `GAMES_ERRORS.fiadoSeated`; `type PokerTable = { count: number; seated: boolean }`; `getPokerTable(me: string | null): Promise<PokerTable>`; `GameRow` ganha `meta?: string`; `GameList({ openRound, onBlackjack, poker, onPoker })`; `LIVE_TABLES` inclui `'poker_tables'`.

- [ ] **Step 1: Testes que falham**

`__tests__/gamesApi.test.ts`:
- no `mockQuery`, a lista de passos encadeados passa a ser `['select', 'not', 'order', 'limit', 'eq']`;
- importar `getPokerTable`;
- no teste "lê a carteira pelo banco", o objeto esperado ganha `seatedStack: null`;
- trocar o `describe('getLeaderboard')` e acrescentar os novos:

```ts
describe('getLeaderboard', () => {
  it('placar do banco (carteira + fichas na mesa), com nome e foto do diretório', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { user_id: 'u2', balance: 2000, fiado_count: 0 },
        { user_id: 'u1', balance: 2000, fiado_count: 1 },
        { user_id: 'saiu', balance: 50, fiado_count: 3 },
      ],
      error: null,
    });
    const rows = await getLeaderboard();
    expect(mockRpc).toHaveBeenCalledWith('games_board');
    expect(rows.map((r) => [r.name, r.balance, r.fiadoCount])).toEqual([
      ['Teteu', 2000, 0],
      ['Bia', 2000, 1],
      ['Alguém', 50, 3],
    ]);
    expect(rows[1].avatarUrl).toBe('https://signed/a.jpg');
  });

  it('erro do banco sobe', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getLeaderboard()).rejects.toEqual({ message: 'boom' });
  });
});

describe('carteira sentada e mesa de poker', () => {
  it('fichas na mesa vêm na carteira; fiado sentado vira frase', async () => {
    mockRpc.mockResolvedValue({ data: { ...ROW, seated_stack: 300 }, error: null });
    expect((await getWallet()).seatedStack).toBe(300);
    expect(gamesErrorMessage({ message: 'fiado_seated' })).toBe('Levanta da mesa de poker pra pegar fiado');
  });

  it('quantos na mesa e se eu estou nela', async () => {
    mockResult = { data: { state: { seats: [{ user_id: 'u1' }, { user_id: 'me' }] } }, error: null };
    await expect(getPokerTable('me')).resolves.toEqual({ count: 2, seated: true });
    await expect(getPokerTable('u9')).resolves.toEqual({ count: 2, seated: false });
    expect(mockCalls.find((c) => c.table === 'poker_tables' && c.op === 'eq')?.args).toEqual(['id', 1]);
    mockResult = { data: null, error: null };
    await expect(getPokerTable('me')).resolves.toEqual({ count: 0, seated: false });
  });
});
```

`__tests__/gamesScreen.test.tsx`:
- `mockApi` ganha `getPokerTable: jest.fn<Promise<PokerTable>, [string | null]>()` e o `jest.mock` repassa `getPokerTable: (me: string | null) => mockApi.getPokerTable(me)`; importar o tipo `PokerTable`;
- a fábrica `wallet()` ganha `seatedStack: null`;
- `beforeEach`: `mockApi.getPokerTable.mockResolvedValue({ count: 0, seated: false });`
- trocar o teste "Jogar abre a mesa; com mão aberta vira Continuar mão; Poker em breve" por:

```ts
  it('Jogar abre a mesa; com mão aberta vira Continuar mão', async () => {
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByLabelText('Jogar Blackjack')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Jogar Blackjack'));
    expect(mockOpen).toHaveBeenCalledWith('blackjack');
    mockApi.getWallet.mockResolvedValue(wallet({ openRoundId: 'r1' }));
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Continuar mão')).toBeTruthy());
  });

  it('Poker: quantos na mesa, Jogar abre a mesa; sentado vira Voltar pra mesa', async () => {
    mockApi.getPokerTable.mockResolvedValue({ count: 2, seated: false });
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('2 na mesa')).toBeTruthy());
    expect(screen.queryByText('Em breve')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Jogar Poker'));
    expect(mockOpen).toHaveBeenCalledWith('poker');
    mockApi.getPokerTable.mockResolvedValue({ count: 3, seated: true });
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByLabelText('Voltar pra mesa Poker')).toBeTruthy());
  });

  it('sem saldo e sentado no poker: mostra as fichas na mesa e pede para levantar antes do fiado', async () => {
    mockApi.getWallet.mockResolvedValue(wallet({ balance: 0, seatedStack: 300 }));
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('+ 300 na mesa de poker')).toBeTruthy());
    expect(screen.getByText('Levanta da mesa de poker pra pegar fiado')).toBeTruthy();
    expect(screen.queryByText('Fiado de hoje já foi. Volta amanhã.')).toBeNull();
  });
```

`__tests__/realtime.test.tsx` — no `describe('affectsNotifications')`:

```ts
  it('mesa de poker não vira notificação', () => {
    expect(affectsNotifications({ kind: 'change', table: 'poker_tables', type: 'UPDATE', row: {}, mine: false })).toBe(false);
  });
```

`__tests__/pokerMigration.test.ts`:

```ts
declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const poker = readFileSync(`${__dirname}/../supabase/migrations/0030_poker.sql`, 'utf8');

// O comportamento roda de verdade em games/test (PGlite); aqui ficam as travas que não podem sumir.
describe('0030_poker.sql', () => {
  it('baralho e cartas de cada um: ninguém lê', () => {
    expect(poker).toContain('alter table public.poker_secrets enable row level security;');
    expect(poker).not.toMatch(/create policy[^;]*poker_secrets/);
    expect(poker).not.toMatch(/create policy[^;]*poker_leaves/);
  });

  it('o app só lê a mesa e joga pelas funções', () => {
    expect(poker).toContain('grant select on public.poker_tables, public.poker_seats, public.poker_hands to authenticated;');
    expect(poker).toContain('grant execute on function public.poker_act(uuid, int, text, int) to authenticated;');
    expect(poker).toContain('revoke all on function public.poker_finish(uuid) from public, anon, authenticated;');
    expect(poker).toContain('revoke all on function public.poker_maybe_start() from public, anon, authenticated;');
  });

  it('retrato da mesa no tempo real e relógio pelo cron a cada minuto', () => {
    expect(poker).toContain('alter publication supabase_realtime add table public.poker_tables;');
    expect(poker).toContain("cron.schedule('fellas-poker-tick', '* * * * *'");
  });

  it('reset trava mesa e carteiras antes de mexer (M2)', () => {
    expect(poker).toContain('perform 1 from public.game_wallets where week_start < v_new for update;');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- gamesApi gamesScreen realtime pokerMigration`
Expected: FAIL (`getPokerTable` não existe, placar ainda lê `game_wallets`, "Em breve" ainda aparece, `poker_tables` fora do tempo real).

- [ ] **Step 3: API do app**

`lib/api/games.ts`:

```ts
export type Wallet = {
  balance: number;
  fiadoCount: number;
  canFiado: boolean;
  openRoundId: string | null;
  weekStart: string;
  /** Fichas na mesa de poker (null = não está sentado). */
  seatedStack: number | null;
};
export type PokerTable = { count: number; seated: boolean };

type WalletRow = {
  balance: number;
  fiado_count: number;
  can_fiado: boolean;
  open_round_id: string | null;
  week_start: string;
  seated_stack?: number | null;
};
type BoardRow = { user_id: string; balance: number; fiado_count: number };
```

(`BoardRow` deixa de vir de `Database[...]['game_wallets']`: o placar agora é a função.) `GAMES_ERRORS` ganha `fiadoSeated: 'Levanta da mesa de poker pra pegar fiado',`. `toWallet` ganha `seatedStack: w.seated_stack ?? null,`. Trocar `getLeaderboard` e acrescentar `getPokerTable`:

```ts
/** Placar da semana pelo banco: carteira + fichas na mesa de poker; só quem jogou; ordem do placar. */
export async function getLeaderboard(): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc('games_board');
  if (error) throw error;
  return ((data ?? []) as BoardRow[]).map((r) => ({
    userId: r.user_id,
    balance: r.balance,
    fiadoCount: r.fiado_count,
    ...who(r.user_id),
  }));
}

/** Quantos estão sentados na mesa de poker agora e se eu sou um deles (retrato público da mesa, 0030). */
export async function getPokerTable(me: string | null): Promise<PokerTable> {
  const { data, error } = await supabase.from('poker_tables').select('state').eq('id', 1).maybeSingle();
  if (error) throw error;
  const seats = (data?.state as { seats?: { user_id: string }[] } | null)?.seats ?? [];
  return { count: seats.length, seated: !!me && seats.some((s) => s.user_id === me) };
}
```

Em `gamesErrorMessage`, antes do `if (msg.includes('fiado'))`: `if (msg.includes('fiado_seated')) return GAMES_ERRORS.fiadoSeated;`.

`types/database.ts` — em `Tables`, na ordem alfabética (depois de `post_*`/antes de `posts`, como o arquivo já ordena):

```ts
      poker_tables: {
        Row: {
          id: number;
          small_blind: number;
          big_blind: number;
          min_buyin: number;
          max_buyin: number;
          seq: number;
          hand_no: number;
          last_bb_seat: number | null;
          next_hand_at: string | null;
          state: Json;
          updated_at: string;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
```

e em `Functions`, junto de `games_fiado`:

```ts
      games_board: {
        Args: Record<string, never>;
        Returns: Json;
      };
```

`lib/realtime.ts` — `LIVE_TABLES` ganha `'poker_tables'` no fim; em `affectsNotifications`, antes da regra de `profiles/posts`: `if (event.table === 'poker_tables') return false; // a mesa de poker só atualiza o card da aba Games`.

- [ ] **Step 4: Tela (com a skill `impeccable`)**

`components/games/GameRows.tsx`:
- `WalletRow`: o aviso vira

```ts
  const seated = wallet.seatedStack !== null;
  // sem dar pra apostar: sentado no poker, primeiro levanta; sem mão aberta e sem fiado liberado, o de hoje já foi
  const note =
    fiadoMessage ??
    (wallet.balance < MIN_BET
      ? seated
        ? GAMES_ERRORS.fiadoSeated
        : !wallet.canFiado && !wallet.openRoundId
          ? GAMES_ERRORS.fiadoToday
          : null
      : null);
```

  o `accessibilityLabel` ganha `${seated ? `, mais ${fmt(wallet.seatedStack!)} na mesa de poker` : ''}` logo depois do saldo; e, embaixo do texto da posição, quando `seated`:

```tsx
          {seated ? (
            <Text variant="small" tone="muted">{`+ ${fmt(wallet.seatedStack!)} na mesa de poker`}</Text>
          ) : null}
```

- `GameRow` ganha `meta?: string`, mostrado embaixo do `subtitle` como `<Text variant="small" tone="muted">{meta}</Text>` quando existe.
- `GameList`:

```tsx
export function GameList({
  openRound,
  onBlackjack,
  poker,
  onPoker,
}: {
  openRound: boolean;
  onBlackjack: () => void;
  poker: PokerTable | null;
  onPoker: () => void;
}) {
  return (
    <View>
      <GameRow
        title="Blackjack"
        subtitle="Você contra a banca · 10 a 500"
        art={[
          { rank: 'A', suit: '♠', red: false },
          { rank: 'K', suit: '♥', red: true },
        ]}
        playLabel={openRound ? 'Continuar mão' : 'Jogar'}
        onPlay={onBlackjack}
      />
      <Divider />
      <GameRow
        title="Poker"
        subtitle="Texas Hold'em · 2 a 6 fellas · entrada 200 a 500"
        meta={poker ? (poker.count ? `${poker.count} na mesa` : 'Mesa vazia') : undefined}
        art={[
          { rank: 'Q', suit: '♣', red: false },
          { rank: 'Q', suit: '♦', red: true },
        ]}
        playLabel={poker?.seated ? 'Voltar pra mesa' : 'Jogar'}
        onPlay={onPoker}
      />
    </View>
  );
}
```

  (importar `PokerTable` de `../../lib/api/games`.)

`app/(tabs)/games.tsx`:
- importar `getPokerTable`, `type PokerTable` e `debounce, LIVE_DEBOUNCE_MS, onLive` de `../../lib/realtime`; `useEffect` de `react`;
- estado `const [poker, setPoker] = useState<PokerTable | null>(null);`;
- no `load`, junto do `Promise.all`: `void getPokerTable(me).then(setPoker, () => setPoker(null));` (o card do poker não derruba a aba se falhar); `load` passa a depender de `[me]`;
- tempo real (quem senta ou levanta muda o card):

```tsx
  useEffect(() => {
    const refresh = debounce(() => void getPokerTable(me).then(setPoker, () => {}), LIVE_DEBOUNCE_MS);
    const off = onLive((e) => {
      if (e.kind === 'resync' || e.table === 'poker_tables') refresh();
    });
    return () => {
      off();
      refresh.cancel();
    };
  }, [me]);
```

- `games` passa a ser `<GameList openRound={!!data.wallet.openRoundId} onBlackjack={() => openGame('blackjack')} poker={poker} onPoker={() => openGame('poker')} />`.

- [ ] **Step 5: Documentação**

`DESIGN.md`, seção "Fellas Games":
- no item **Aba no app**: "Jogos" passa a dizer: Poker com "Texas Hold'em · 2 a 6 fellas · entrada 200 a 500" e uma linha `small` `textMuted` "N na mesa"/"Mesa vazia" (ao vivo); botão "Jogar" ou "Voltar pra mesa"; em "Seus créditos", "+ 300 na mesa de poker" `small` `textMuted` quando sentado, e o placar soma as fichas da mesa.
- novo item **Mesa de poker** depois de **Mesa**: "Página `/games/poker/`. Mesma base visual do Blackjack (feltro 3D, cartas, fichas, botões moeda, painel escuro), mas câmera quase de cima e feltro oval. Celular em pé: mesa em pé, eu sempre embaixo com as 2 cartas grandes e o nome da mão; os outros 5 lugares em volta (foto, nome, fichas, o que fez na rodada; quem está na vez com anel dourado que esvazia em 30 s; ausente apagado). PC e celular deitado: mesa deitada com os lugares fixos, minhas cartas sempre embaixo no meio da mesa, minhas fichas de aposta na frente do meu lugar; painel à direita com abas Mãos | Placar. Lugar vazio = "+ Sentar" tracejado. Botões moeda: vermelho Correr ✕ · verde Mesa ✓ / Pagar X · violeta Aumentar (abre a régua: Mín, ½ pote, Pote, − / + de 10, "Aumentar p/ X") · laranja All-in; atalhos 1–4, Enter confirma a régua, Esc fecha. Folhas de baixo (sentar, completar, últimas mãos) com régua dourada. Showdown: cartas viram, nome da mão em cada lugar, fichas voam para quem levou; resultado em plaquinha dourada. All-in: turn e river com pausa de 1,5 s. Vibra na minha vez (Android)."

`supabase/README.md` — nova linha na tabela de migrações, depois da 0029:

```
| `0030_poker.sql` | poker ao vivo (uma mesa de 6): `poker_tables` (retrato público no Realtime), `poker_seats`, `poker_hands` (todo membro lê), `poker_secrets` (baralho e cartas: **ninguém** lê), `poker_leaves`; funções `poker_sit/act/leave/back/rebuy/show/my_cards/history/state/tick`; cron `fellas-poker-tick` (a cada minuto); placar `games_board()` soma as fichas da mesa; fiado espera levantar; o reset trava as carteiras, anula a mão aberta e levanta todo mundo antes de zerar. **Se a 0027, 0028 ou 0029 forem coladas de novo no SQL editor, rode a 0030 depois delas** | a aba Games não mostra o placar (o app chama `games_board`) e a mesa de poker não abre |
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx tsc --noEmit` e `npm test`
Expected: PASS em tudo (inclusive os testes antigos da aba Games e do tempo real).

- [ ] **Step 7: Commit**

```bash
git add lib/api/games.ts components/games/GameRows.tsx "app/(tabs)/games.tsx" lib/realtime.ts types/database.ts DESIGN.md supabase/README.md __tests__/gamesApi.test.ts __tests__/gamesScreen.test.tsx __tests__/realtime.test.tsx __tests__/pokerMigration.test.ts
git commit -m "Fellas Games: card do Poker ao vivo, placar com as fichas da mesa, fiado espera levantar"
```

---

### Task 13: Conferência visual, suíte inteira, revisão e subida

**Files:** os que a conferência pedir (ajustes de `games/poker/layout.ts`, `poker.css`, `view.ts`).

- [ ] **Step 1: Suítes**

Run: `npm test --prefix games`, `npm run build --prefix games`, `npx tsc --noEmit`, `npm test`
Expected: tudo verde. Anotar o tempo do `pokerSim`.

- [ ] **Step 2: Conferência visual (uma rodada, celular e PC juntos)**

Com `npm run dev --prefix games` rodando, abrir no Chrome (claude-in-chrome) `http://localhost:5173/games/dev/frames.html?game=poker` e tirar print das duas telas: (a) olhando sem lugar; (b) sentado na minha vez com a régua aberta; (c) showdown. Comparar com `.superpowers/brainstorm/20068-1791484731/content/mesa-celular.html` (opção A) e `tela-pc-sentar.html`, e com o pedido do Juan: **no PC as minhas cartas ficam embaixo, no meio da mesa, e as minhas fichas na frente do meu lugar**. Ajustar de uma vez só o que a rodada mostrar (posições em `layout.ts`, câmera, tamanhos no `poker.css`): plaquinhas sobrepostas, lugar cortado na borda, carta cobrindo nome, texto ilegível em cima das cartas brancas. Uma segunda rodada só para confirmar.

- [ ] **Step 3: Revisão final do branch**

Seguir a revisão final do executor (`superpowers:executing-plans` → Final Review): pacote `review-package` de `git merge-base main HEAD` até `HEAD`, revisor novo no modelo mais forte, com a spec, este plano e a seção **Review Focus**. Corrigir Critical/Important com teste que falha antes (RED→GREEN) e suíte inteira verde.

- [ ] **Step 4: Subida (ordem da spec)**

1. Merge local na `main` (fluxo da casa: sem PR), **sem push**.
2. Pedir ao Juan: `! npx supabase migration list` e, conferido que só falta a 0030, `! npx supabase db push`.
3. Conferir pela REST/SQL: `poker_tables` responde com `state`; `poker_secrets` não devolve nada para um membro; `poker_state()` e `games_board()` respondem; `poker_tables` está na publicação `supabase_realtime`; job `fellas-poker-tick` ativo em `cron.job`.
4. `git push` (o deploy-web publica `dist/games/poker/`).
5. Abrir `fellasapp.pages.dev/games/poker/` no Chrome: mesa carrega com a sessão do app; sentar com 200; levantar volta para a carteira.
6. Pedir ao Juan o teste real com mais um fella em dois celulares: uma mão até o showdown, um all-in, deixar o relógio estourar, ficar ausente e voltar, levantar no meio da mão.

- [ ] **Step 5: Memória**

Atualizar `fellas-games.md` (Poker publicado, data, migração 0030, pendências que sobrarem) e o índice `MEMORY.md`.
