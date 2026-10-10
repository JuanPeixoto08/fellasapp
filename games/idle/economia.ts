// Fórmulas da Fellas Inc. Iguais às do banco (0034): o banco decide, a tela só anima. Um teste de paridade
// (games/test/idleParidade.test.ts) compara as duas com estados de exemplo.
import type { Catalogo, Estrategia, Melhoria } from './catalogo';

export type Estado = { generators: number[]; upgrades: number[]; strategies: number[] };

export const CRESCIMENTO = 1.15;
export const TETO_SEGUNDOS = 8 * 3600;

export function era(cat: Catalogo, gens: number[]): number {
  let e = 1;
  for (const g of cat.geradores) if (gens[g.id - 1] > 0) e = Math.max(e, g.era);
  return e;
}

export function estrategiasAtivas(cat: Catalogo, s: Estado): Estrategia[] {
  return cat.estrategias.filter((e) => s.strategies[e.era - 2] === e.opcao);
}

const porId = new WeakMap<Catalogo, Map<number, Melhoria>>();
function melhoria(cat: Catalogo, id: number): Melhoria | undefined {
  let m = porId.get(cat);
  if (!m) porId.set(cat, (m = new Map(cat.melhorias.map((x) => [x.id, x]))));
  return m.get(id);
}

/** Quanto cada unidade de cada gerador rende (sem o multiplicador global) e o multiplicador global. */
export function fatores(cat: Catalogo, s: Estado): { porGerador: number[]; global: number } {
  const est = estrategiasAtivas(cat, s);
  const dobras = Array(30).fill(0);
  const sinergia = Array(30).fill(1);
  let global = 1;
  for (const id of s.upgrades) {
    const m = melhoria(cat, id);
    if (!m) continue;
    if (m.tipo === 'gerador') dobras[m.gerador - 1]++;
    else if (m.tipo === 'geral') global *= m.mult;
    else sinergia[m.alvo - 1] += m.porUnidade * s.generators[m.fonte - 1];
  }
  for (const e of est) global *= e.prodMult;
  const distintos = s.generators.filter((n) => n > 0).length;
  global *= 1 + est.reduce((a, e) => a + e.porGeradorDistinto, 0) * distintos;
  const porGerador = cat.geradores.map((g) => {
    let mult = 1;
    for (const e of est) if (e.genDe !== null && e.genAte !== null && g.id >= e.genDe && g.id <= e.genAte) mult *= e.genMult;
    return g.renda * 2 ** dobras[g.id - 1] * sinergia[g.id - 1] * mult;
  });
  return { porGerador, global };
}

export function taxa(cat: Catalogo, s: Estado): number {
  const f = fatores(cat, s);
  let soma = 0;
  for (let i = 0; i < 30; i++) soma += s.generators[i] * f.porGerador[i];
  return soma * f.global;
}

export function taxaPorUnidade(cat: Catalogo, s: Estado, gid: number): number {
  const f = fatores(cat, s);
  return f.porGerador[gid - 1] * f.global;
}

export function custoMult(cat: Catalogo, s: Estado): number {
  return estrategiasAtivas(cat, s).reduce((a, e) => a * e.custoMult, 1);
}

/** Preço de comprar k unidades tendo n: custo·1,15^n·(1,15^k − 1)/0,15·cm. */
export function preco(custo: number, n: number, k: number, cm: number): number {
  return ((custo * CRESCIMENTO ** n * (CRESCIMENTO ** k - 1)) / (CRESCIMENTO - 1)) * cm;
}

/** Quantas unidades dá pra comprar com v (nunca cobra mais do que v). */
export function maxCompra(custo: number, n: number, v: number, cm: number): number {
  if (v <= 0) return 0;
  let k = Math.floor(Math.log((v * (CRESCIMENTO - 1)) / (custo * CRESCIMENTO ** n * cm) + 1) / Math.log(CRESCIMENTO));
  while (k > 0 && preco(custo, n, k, cm) > v) k--;
  while (preco(custo, n, k + 1, cm) <= v) k++;
  return Math.max(k, 0);
}

export function podeComprarGerador(s: Estado, gid: number): boolean {
  return gid === 1 || s.generators[gid - 2] >= 1;
}

export function liberada(cat: Catalogo, m: Melhoria, s: Estado): boolean {
  if (m.tipo === 'gerador') return s.generators[m.gerador - 1] >= m.requer;
  if (m.tipo === 'geral') return era(cat, s.generators) >= m.requerEra;
  return s.generators[m.fonte - 1] >= m.requerFonte && s.generators[m.alvo - 1] >= m.requerAlvo;
}

/** Valuation depois de render de `desdeMs` até `ateMs` (teto de 8h; ×5 dentro do bônus que vai até `boostAteMs`). */
export function acumular(v: number, r: number, desdeMs: number, ateMs: number, boostAteMs: number | null): number {
  const dt = Math.min(Math.max((ateMs - desdeMs) / 1000, 0), TETO_SEGUNDOS);
  let boost = 0;
  if (boostAteMs !== null && boostAteMs > desdeMs) boost = Math.max(0, Math.min((Math.min(ateMs, boostAteMs) - desdeMs) / 1000, dt));
  return v + r * dt + r * 4 * boost;
}
