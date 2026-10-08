/** Valor da aposta em fichas, das maiores para as menores (até 10 na pilha). */
export function chipStack(amount: number): number[] {
  const out: number[] = [];
  let left = amount;
  for (const v of [500, 100, 50, 10]) {
    while (left >= v && out.length < 10) {
      out.push(v);
      left -= v;
    }
  }
  return out;
}
