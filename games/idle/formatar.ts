// Números da Fellas Inc. em pt-BR, resumidos e sempre truncados (nunca mostram mais do que a pessoa tem). Os nomes dos
// grupos de mil saem por regra (prefixo + dezena) até o centilhão (10³⁰³); de 10¹⁰⁰ até antes de 10¹⁰³ é "googol"
// (homenagem a quem deu o nome ao Google); de 10³⁰⁶ em diante, notação científica curta ("1,2 × 10³⁰⁶").
const ATE_DECI = ['mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci'] as const;
const PREFIXO = ['', 'un', 'duo', 'tre', 'quator', 'quin', 'sex', 'septen', 'octo', 'noven'] as const;
const DEZENA = ['', 'deci', 'viginti', 'triginti', 'quadraginti', 'quinquaginti', 'sexaginti', 'septuaginti', 'octoginti', 'nonaginti'] as const;
/** O último grupo com nome: centi = 10^303. */
export const ULTIMO_GRUPO = 100;
const GOOGOL = 100; // o expoente

/** O nome do grupo k (10^(3k + 3)): 0 mil, 1 mi … 10 deci, 11 undeci … 20 viginti … 99 novennonaginti, 100 centi. */
export function nomeGrupo(k: number): string {
  if (k <= 10) return ATE_DECI[k];
  if (k >= ULTIMO_GRUPO) return 'centi';
  return `${PREFIXO[k % 10]}${DEZENA[Math.floor(k / 10)]}`;
}

const SOBRESCRITO = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sobrescrito = (n: number) => [...String(n)].map((c) => SOBRESCRITO[Number(c)]).join('');

// Trunca nos dígitos decimais de n (os mesmos do literal, via toExponential), sem conta em ponto flutuante:
// dividir de mil em mil levava 1e33 a "999 noni"; x * 100 levava 1150 a "1,14 mil"; e 1e27 / 1e25 dá 99,999...
function resumir(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  const [m, e] = n.toExponential().split('e');
  const exp = Number(e);
  const digitos = m.replace('.', '');
  /** Os primeiros dígitos com `inteiros` antes da vírgula (1 a 3) e casas até 3 algarismos no total. */
  const corta = (inteiros: number) => {
    const casas = inteiros >= 3 ? 0 : inteiros === 2 ? 1 : 2;
    const d = digitos.padEnd(inteiros + casas, '0').slice(0, inteiros + casas);
    return Number(`${d.slice(0, inteiros)}.${d.slice(inteiros) || '0'}`).toLocaleString('pt-BR', { maximumFractionDigits: casas });
  };
  if (exp >= 3 * ULTIMO_GRUPO + 6) return `${corta(1)} × 10${sobrescrito(exp)}`;
  if (exp >= GOOGOL && exp < GOOGOL + 3) return `${corta(exp - GOOGOL + 1)} googol`;
  const k = Math.floor(exp / 3) - 1;
  return `${corta(exp - 3 * (k + 1) + 1)} ${nomeGrupo(k)}`;
}

// Valor não finito ou negativo vira zero.
const valido = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export const formatarValor = (n: number) => `F$ ${resumir(valido(n))}`;

export function formatarTaxa(bruto: number): string {
  const n = valido(bruto);
  if (n < 10) return `+F$ ${(Math.floor(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/s`;
  return `+F$ ${resumir(n)}/s`;
}
