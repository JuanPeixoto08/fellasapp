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
