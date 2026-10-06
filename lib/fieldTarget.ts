/**
 * O toque/clique foi dentro de um campo de texto? Na web, o `onPress` de um Pressable vem do clique
 * nativo, que sobe de um <input> lá dentro (ex.: o campo do local no compositor) até ele. No celular o
 * alvo é um número e o próprio TextInput fica com o toque, então é sempre false.
 */
export function isFieldTarget(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const closest = (target as { closest?: (selector: string) => unknown }).closest;
  return typeof closest === 'function' && closest.call(target, 'input, textarea') != null;
}
