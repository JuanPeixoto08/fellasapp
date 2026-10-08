// 'As' = Ás de espadas, '10h', 'Kc'… → número da carta no banco; rig() faz o bj_shuffle devolver esse sapato.
import type { TestDb } from './db';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['s', 'h', 'd', 'c'];

export function card(code: string): number {
  const suit = SUITS.indexOf(code.slice(-1));
  const rank = RANKS.indexOf(code.slice(0, -1));
  if (suit < 0 || rank < 0) throw new Error(`carta inválida: ${code}`);
  return suit * 13 + rank;
}

/** O sapato começa com essas cartas (ordem de distribuição) e completa com 2♠ que ninguém usa. */
export async function rig(t: TestDb, codes: string[]) {
  const head = codes.map(card).join(',');
  await t.db.exec(`create or replace function public.bj_shuffle() returns smallint[] language sql volatile as
    $$ select array[${head}]::smallint[] || array_fill(1::smallint, array[300]) $$`);
}
