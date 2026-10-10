// Números da Fellas Inc. em pt-BR, resumidos e sempre truncados (nunca mostram mais do que a pessoa tem).
const UNIDADES = ['mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci'] as const;

function tres(x: number): string {
  const casas = x >= 100 ? 0 : x >= 10 ? 1 : 2;
  const f = 10 ** casas;
  return (Math.floor(x * f) / f).toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

// 1e3, 1e6, ... lidos como literal (exatos); dividir de mil em mil acumula erro (1e33 virava "999 noni").
const potencia = (i: number) => Number(`1e${3 * (i + 1)}`);

function resumir(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  let i = 0;
  while (i < UNIDADES.length - 1 && n >= potencia(i + 1)) i++;
  return `${tres(n / potencia(i))} ${UNIDADES[i]}`;
}

export const formatarValor = (n: number) => `R$ ${resumir(Math.max(0, n))}`;

export function formatarTaxa(n: number): string {
  if (n < 10) return `+R$ ${(Math.floor(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/s`;
  return `+R$ ${resumir(n)}/s`;
}
