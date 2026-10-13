// Mapa do rolê (Fellas Inc.): o catálogo dos lugares, os marcos e as contas puras da tela. Quem decide abrir,
// subir de nível, pagar e mostrar o pódio é o banco (mesmo catálogo nas migrações: teste de paridade); aqui só se calcula e se mostra.

export type Faixa = 'barato' | 'medio' | 'caro';
export type TipoMarco = 'nivel' | 'lendario' | 'fas' | 'volume';
export type Marco = { id: number; lugar: number; tipo: TipoMarco; valor: number | null; bonus: number };
export type Lugar = {
  id: number; apelido: string; faixa: Faixa; horas: number; era: number; lote: number;
  custoBase: number; moeda: string | null; /** moeda com que o lugar abre (camisetaria: 1 lote médio de camiseta) */ moedaInicial: number;
  /** como o número do pódio aparece */ numero: 'pct' | 'nota' | 'estrelas' | null;
};

/** Último lote lançado. Lugar com lote maior ainda não existe para a pessoa. */
export const LOTE_ATUAL = 1;
export const NIVEL_MAX = 25;

export const LUGARES: readonly Lugar[] = [
  { id: 1, apelido: 'o samba', faixa: 'barato', horas: 2, era: 2, lote: 2, custoBase: 100, moeda: null, moedaInicial: 0, numero: null },
  { id: 2, apelido: 'o casarão', faixa: 'barato', horas: 2, era: 2, lote: 2, custoBase: 100, moeda: null, moedaInicial: 0, numero: null },
  { id: 3, apelido: 'a camisetaria', faixa: 'barato', horas: 2, era: 2, lote: 1, custoBase: 450, moeda: 'cupom', moedaInicial: 108, numero: 'pct' },
  { id: 4, apelido: 'o copão', faixa: 'medio', horas: 6, era: 3, lote: 1, custoBase: 150, moeda: 'ficha', moedaInicial: 0, numero: 'nota' },
  { id: 5, apelido: 'a loja 24h', faixa: 'medio', horas: 6, era: 3, lote: 2, custoBase: 150, moeda: null, moedaInicial: 0, numero: null },
  { id: 6, apelido: 'a sinuca', faixa: 'medio', horas: 6, era: 3, lote: 3, custoBase: 150, moeda: null, moedaInicial: 0, numero: null },
  { id: 7, apelido: 'o jantar', faixa: 'caro', horas: 16, era: 4, lote: 2, custoBase: 250, moeda: 'gorjeta', moedaInicial: 0, numero: 'estrelas' },
  { id: 8, apelido: 'a massa-mãe', faixa: 'caro', horas: 16, era: 4, lote: 3, custoBase: 250, moeda: null, moedaInicial: 0, numero: null },
  { id: 9, apelido: 'o corredor', faixa: 'caro', horas: 16, era: 4, lote: 3, custoBase: 250, moeda: null, moedaInicial: 0, numero: null },
];

const BONUS = [0.02, 0.02, 0.03, 0.03, 0.04, 0.03, 0.03, 0.02];
const LIMIARES: Record<number, { fas: number; volume: number }> = { 3: { fas: 115_000, volume: 50 }, 4: { fas: 1_000, volume: 30 }, 7: { fas: 2_000, volume: 100 } };
/** Oito marcos por lugar com mecânica (camisetaria e copão no lote 1; o jantar, no lote 2, já com os dele): cinco de
 *  nível, um lendário, o de fãs e o de volume. */
export const MARCOS: readonly Marco[] = Object.entries(LIMIARES).flatMap(([lugarTxt, lim]) => {
  const lugar = Number(lugarTxt);
  const tipos: [TipoMarco, number | null][] = [['nivel', 5], ['nivel', 10], ['nivel', 15], ['nivel', 20], ['nivel', 25], ['lendario', null], ['fas', lim.fas], ['volume', lim.volume]];
  return tipos.map(([tipo, valor], k) => ({ id: lugar * 10 + k + 1, lugar, tipo, valor, bonus: BONUS[k] }));
});

/** Lugar já lançado para a pessoa (o lote dele não passou do atual). */
export const lancado = (l: Lugar): boolean => l.lote <= LOTE_ATUAL;

/** Quanto custa abrir: o mesmo tempo da produção, em segundos, ao preço por segundo da pessoa. */
export function precoAbrir(l: Lugar, taxa: number): number {
  return l.horas * 3600 * taxa;
}

/** Custo para subir de `nivel` para `nivel + 1` (cresce 55% a cada nível); null no nível máximo. */
export function custoNivel(l: Lugar, nivel: number): number | null {
  if (nivel >= NIVEL_MAX) return null;
  return l.custoBase * 1.55 ** (nivel - 1);
}

/** Multiplicador do mapa: marcos (podem ser dobrados pelo Monopólio) + Marca forte por lugar aberto. */
export function multMapa(bonusMarcos: number, abertos: number, est: { marcosMult: number; porLugar: number }): number {
  return 1 + bonusMarcos * est.marcosMult + abertos * est.porLugar;
}

const MODULO32 = 4294967296n;
const SEMANA_0 = Date.UTC(2026, 0, 5);
/** Índice da rodada da semana (0 até n - 1), igual para a mesma semana e o mesmo lugar; o banco faz a mesma conta
 *  (idle_place_semana_idx). h = semana × 2654435761 + lugar × 2246822519 + sal × 3266489917 (mod 2³²) e o índice sai dos
 *  bits altos (⌊h·n / 2³²⌋): os baixos andam juntos de uma semana pra outra e de um lugar pro outro. */
export function semanaIdx(lugar: number, sal: number, n: number, semana: string): number {
  const [a, m, d] = semana.split('-').map(Number);
  const dias = (Date.UTC(a, m - 1, d) - SEMANA_0) / 86_400_000;
  const w = Math.floor(dias / 7);
  const x = BigInt(w) * 2654435761n + BigInt(lugar) * 2246822519n + BigInt(sal) * 3266489917n;
  const h = ((x % MODULO32) + MODULO32) % MODULO32;
  return Number((h * BigInt(Math.max(n, 1))) / MODULO32);
}

/** Nome da pessoa no mapa: sem espaço nas pontas, de 1 a 30 letras (emoji conta 1), sem quebra de linha (nem as do Unicode). */
export function nomeValido(nome: string): string | null {
  const t = nome.trim();
  if (!t || [...t].length > 30 || /[\r\n\u0085\u2028\u2029]/.test(t)) return null;
  return t;
}

/** Como o número do pódio aparece: porcentagem, nota inteira ou estrelas com uma casa. */
export function formatarNumero(l: Lugar, n: number): string {
  if (l.numero === 'pct') return `${Math.round(n)}%`;
  if (l.numero === 'nota') return String(Math.round(n));
  if (l.numero === 'estrelas') return n.toFixed(1).replace('.', ',');
  return String(n);
}

/** Posição genérica do pino quando o banco não tem a de verdade (mock, ou antes do carregar.sql): grade 3×3. */
export function posicaoGenerica(id: number): { x: number; y: number } {
  return { x: 30 + ((id - 1) % 3) * 50, y: 18 + Math.floor((id - 1) / 3) * 30 };
}
