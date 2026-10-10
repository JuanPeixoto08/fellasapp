// Números da Fellas Inc. em pt-BR, resumidos e sempre truncados (nunca mostram mais do que a pessoa tem).
const UNIDADES = ['mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci'] as const;

// Trunca nos dígitos decimais de n (os mesmos do literal, via toExponential), sem conta em ponto flutuante:
// dividir de mil em mil levava 1e33 a "999 noni"; x * 100 levava 1150 a "1,14 mil"; e 1e27 / 1e25 dá 99,999...
function resumir(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  const [m, e] = n.toExponential().split('e');
  const exp = Number(e);
  const i = Math.min(Math.floor(exp / 3) - 1, UNIDADES.length - 1);
  const inteiros = exp - 3 * (i + 1) + 1; // 1 a 3 (mais só em "deci")
  const casas = inteiros >= 3 ? 0 : inteiros === 2 ? 1 : 2;
  const d = m.replace('.', '').padEnd(inteiros + casas, '0').slice(0, inteiros + casas);
  const v = Number(`${d.slice(0, inteiros)}.${d.slice(inteiros) || '0'}`);
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })} ${UNIDADES[i]}`;
}

// Valor não finito ou negativo vira zero.
const valido = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export const formatarValor = (n: number) => `R$ ${resumir(valido(n))}`;

export function formatarTaxa(bruto: number): string {
  const n = valido(bruto);
  if (n < 10) return `+R$ ${(Math.floor(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/s`;
  return `+R$ ${resumir(n)}/s`;
}
