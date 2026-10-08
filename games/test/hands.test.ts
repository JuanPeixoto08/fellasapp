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
