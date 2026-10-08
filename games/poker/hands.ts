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
