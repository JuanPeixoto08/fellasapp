// Fórmulas da Fellas Inc. Iguais às do banco (0034, 0038, 0041): o banco decide, a tela só anima. Um teste de paridade
// (games/test/idleParidade.test.ts) compara as duas com estados de exemplo.
import type { Catalogo, Estrategia, Melhoria, No } from './catalogo';
import { CAIXA_PADRAO } from './oportunidades';

/** O que muda a produção pelos contratos ATIVOS: quantos você contratou e, para cada empresa que te contratou, quanto
 *  ela paga (3 se ela escolheu Cultura de startup). Sem isso (simulação, testes) = jogador sozinho. */
export type Social = { contratei: number; empregos: number[] };
export const SOLO: Social = { contratei: 0, empregos: [] };
/** O que é pra sempre (entrega 3): os nós da árvore que você comprou e quantas conquistas você tem (+1% cada). Sem
 *  isso (simulação, testes) = nenhum. */
export type Bonus = { arvore: number[]; conquistas: number };
export const SEM_BONUS: Bonus = { arvore: [], conquistas: 0 };
export type Estado = { generators: number[]; upgrades: number[]; strategies: number[]; social?: Social; bonus?: Bonus };

export const POR_CONTRATADO = 0.1;
export const POR_EMPREGO = 0.02;

export const POR_CONQUISTA = 0.01;
/** K do prestígio (medido em simulacao.test.ts): pontos totais = floor(cbrt(F$/s ÷ K)). Igual a idle_prestige_total. */
export const K_PRESTIGIO = 1e6;
const MAX_PONTOS = 1e9;

export const CRESCIMENTO = 1.15;
const VALUATION_INICIAL = 10;
/** Quanto uma oportunidade fica na cena (s) sem estratégia nem nó (igual ao padrão de opp_segundos do catálogo). */
export const OPP_SEGUNDOS_PADRAO = 10;

export function era(cat: Catalogo, gens: number[]): number {
  let e = 1;
  for (const g of cat.geradores) if (gens[g.id - 1] > 0) e = Math.max(e, g.era);
  return e;
}

/** Quanto um evento dourado fica na tela sem a árvore (igual a dourados.ts JANELA_S). */
const JANELA_DOURADO_S = 12;

/** O que os nós comprados fazem (igual a idle_arvore_efeitos na 0061). Sem nó: o jogo de sempre. Juntando nós do
 *  mesmo tipo: produção, Investidor e bônus das oportunidades multiplicam; +por dia soma; preço do contrato e amadurecer
 *  ficam o menor; o resto fica o maior. */
export type EfeitosArvore = {
  producao: number; caixinha: number; oppSegundos: number; oppExtra: number; oppBonus: number;
  contratoPreco: number; porContratado: number; contratoDias: number; empregoMult: number;
  inicioValuation: number; inicioNotebooks: number; inicioEra1: boolean; manterGerais: boolean;
  douradoFreq: number; douradoTela: number; douradoInvestidor: number; douradoDuracao: number;
  hortaAmadurece: number; hortaVida: number; hortaCruza: number; hortaMult: number; morangoChance: number;
};
const porNo = new WeakMap<Catalogo, Map<number, No>>();
export function efeitosArvore(cat: Catalogo, nos: readonly number[]): EfeitosArvore {
  let mapa = porNo.get(cat);
  if (!mapa) porNo.set(cat, (mapa = new Map(cat.arvore.map((n) => [n.id, n]))));
  const unicos = [...new Set(nos)]; // nó repetido não conta duas vezes
  const valores = (tipo: No['tipo']) => unicos.map((id) => mapa.get(id)).filter((n): n is No => n?.tipo === tipo).map((n) => n.valor);
  const mult = (tipo: No['tipo']) => valores(tipo).reduce((a, v) => a * v, 1);
  const max = (tipo: No['tipo'], padrao: number) => Math.max(padrao, ...valores(tipo));
  return {
    producao: mult('producao'),
    caixinha: max('caixinha', CAIXA_PADRAO.tamanho),
    oppSegundos: max('segundos', OPP_SEGUNDOS_PADRAO),
    oppExtra: valores('opp_extra').reduce((a, v) => a + v, 0),
    oppBonus: mult('opp_bonus'),
    contratoPreco: Math.min(1, ...valores('contrato_preco')),
    porContratado: max('por_contratado', POR_CONTRATADO),
    contratoDias: max('contrato_dias', 7),
    empregoMult: max('emprego_mult', 1),
    inicioValuation: max('inicio_valuation', VALUATION_INICIAL),
    inicioNotebooks: max('inicio_notebooks', 1),
    inicioEra1: valores('inicio_era1').length > 0,
    manterGerais: valores('manter_gerais').length > 0,
    douradoFreq: max('dourado_freq', 1),
    douradoTela: max('dourado_tela', JANELA_DOURADO_S),
    douradoInvestidor: mult('dourado_investidor'),
    douradoDuracao: max('dourado_duracao', 1),
    hortaAmadurece: Math.min(1, ...valores('horta_amadurece')),
    hortaVida: max('horta_vida', 1),
    hortaCruza: max('horta_cruza', 1),
    hortaMult: max('horta_mult', 1),
    morangoChance: max('morango_chance', 1),
  };
}
export const efeitosDe = (cat: Catalogo, s: Estado) => efeitosArvore(cat, s.bonus?.arvore ?? []);

/** Árvore e conquistas (igual a idle_bonus_mult na 0041): nós de produção × (1 + 1% por conquista). */
export function multBonus(cat: Catalogo, s: Estado): number {
  return efeitosDe(cat, s).producao * (1 + POR_CONQUISTA * (s.bonus?.conquistas ?? 0));
}

/** Quantos pontos de prestígio um F$/s vale: floor(cbrt(r ÷ K)), exato nos cubos (igual a idle_prestige_total). */
export function pontosTotais(r: number): number {
  if (!Number.isFinite(r) || r <= 0) return 0; // NaN, Infinity e nulo não valem nada
  if (r >= MAX_PONTOS ** 3 * K_PRESTIGIO) return MAX_PONTOS; // trava em 1e9 (cabe em int no banco), só para r finito
  let n = Math.floor(Math.cbrt(r / K_PRESTIGIO));
  while (n > 0 && n ** 3 * K_PRESTIGIO > r) n--; // sem divisão, como o banco: n³·K ≤ r
  while ((n + 1) ** 3 * K_PRESTIGIO <= r) n++;
  return n;
}

/** A empresa do "Abrir CNPJ" com os nós do Recomeço (igual a idle_start na 0041). `gerais`: as melhorias gerais que a
 *  venda manteve (só com "Leva o crachá"). */
export function abertura(cat: Catalogo, ef: EfeitosArvore, gerais: readonly number[] = []): { valuation: number; generators: number[]; upgrades: number[] } {
  const generators = Array(30).fill(0);
  generators[0] = ef.inicioNotebooks;
  if (ef.inicioEra1) for (const g of cat.geradores) if (g.era === 1) generators[g.id - 1] = Math.max(generators[g.id - 1], 1);
  return { valuation: ef.inicioValuation, generators, upgrades: ef.manterGerais ? [...gerais] : [] };
}

/** Preço do próximo contrato (igual a idle_hire_price): 30 min da produção × 1,5^(contratos ativos que você fez) × 2 com
 *  Abrir capital × o desconto da árvore. */
export function precoContrato(cat: Catalogo, s: Estado, ativos: number): number {
  const custo = estrategiasAtivas(cat, s).reduce((a, e) => a * (e.sociais.contratoCustoMult ?? 1), 1);
  return taxa(cat, s) * 1800 * 1.5 ** ativos * custo * efeitosDe(cat, s).contratoPreco;
}

export function estrategiasAtivas(cat: Catalogo, s: Estado): Estrategia[] {
  return cat.estrategias.filter((e) => s.strategies[e.era - 2] === e.opcao);
}

/** Quantas pegas uma oportunidade vale (igual a idle_claim_opportunity na 0063): "rendem o dobro" do Viralizar e da Xepa
 *  da feira multiplicam (2, ou 4 com os dois). O ×5 entra essa quantidade de vezes e a metade guarda essa quantidade. */
export function copiasOportunidade(cat: Catalogo, s: Estado): number {
  const m = estrategiasAtivas(cat, s).reduce((a, e) => a * e.oppBonusMult, efeitosDe(cat, s).oppBonus);
  return Math.max(1, Math.round(m));
}

/**
 * Multiplicador dos contratos ativos (igual a idle_social_mult na 0041):
 * 1 + efeito × (porContratado × contratei + Σ 2% × o que cada empresa paga × emprego). Ninguém te contratou = piso de
 * freela (2%, como 1 contrato). efeito = ×2 com Networking; porContratado = 10% (15% com Cultura de startup ou com o nó
 * Aniversariante do mês); emprego = ×2 com o nó Passe de craque.
 */
export function multContratos(cat: Catalogo, s: Estado): number {
  return partesContratos(cat, s).mult;
}

/** As partes de multContratos (a caixinha dos contratos mostra cada uma): já com o efeito da estratégia. */
export function partesContratos(cat: Catalogo, s: Estado): { contratei: number; empregos: number; efeito: number; mult: number } {
  const est = estrategiasAtivas(cat, s);
  const soc = s.social ?? SOLO;
  const ef = efeitosDe(cat, s);
  const pors = est.map((e) => e.sociais.porContratado).filter((x) => x !== undefined);
  const por = Math.max(pors.length ? Math.max(...pors) : POR_CONTRATADO, ef.porContratado);
  const efeito = est.reduce((a, e) => a * (e.sociais.contratoEfeitoMult ?? 1), 1);
  const empregos = soc.empregos.length ? soc.empregos.reduce((a, m) => a + POR_EMPREGO * m * ef.empregoMult, 0) : POR_EMPREGO;
  return { contratei: efeito * por * soc.contratei, empregos: efeito * empregos, efeito, mult: 1 + efeito * (por * soc.contratei + empregos) };
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
  global *= multContratos(cat, s);
  global *= multBonus(cat, s);
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

/** Quanto dura um Viralizou sem a árvore (ms): a janela é [fim − 60 s, fim); com o Hype, × douradoDuracao. */
export const VIRAL_MS = 60_000;

/** Os fins dos ×5 da oportunidade: uma lista (0062: cada um conta sozinho), um fim só ou nenhum (null). */
export type Boosts = number | null | readonly number[];
const listaBoosts = (b: Boosts): readonly number[] => (b === null ? [] : typeof b === 'number' ? [b] : b);

/**
 * r × Σ(multiplicador × tempo) entre `a` e `b` (ms): os ×5 das oportunidades no ar SOMAM entre si (dois = ×10, três =
 * ×15) e o total multiplica com os Viralizou (×10 cada, dois = ×100), sem teto (dois ×5 com dois Viralizou = ×1.000);
 * divide nos pontos em que um começa ou acaba. Igual a idle_settle na 0064. Os ×5 começaram antes de `a` (pegar fecha a conta), então só o fim de cada um importa.
 */
export function produzido(
  r: number, a: number, b: number, boostAteMs: Boosts, virais: readonly number[] = [], viralMs = VIRAL_MS,
): number {
  if (b <= a) return 0;
  const boosts = listaBoosts(boostAteMs);
  const pontos = [a, b];
  for (const f of boosts) if (f > a && f < b) pontos.push(f);
  for (const f of virais) for (const x of [f - viralMs, f]) if (x > a && x < b) pontos.push(x);
  pontos.sort((x, y) => x - y);
  let total = 0;
  for (let i = 0; i + 1 < pontos.length; i++) {
    const p = pontos[i];
    const q = pontos[i + 1];
    if (q <= p) continue;
    const meio = (p + q) / 2;
    const k = virais.filter((f) => f - viralMs <= meio && f > meio).length;
    const kb = boosts.filter((f) => f > meio).length;
    const m = (kb ? 5 * kb : 1) * 10 ** k; // ×5 somam (×10, ×15); Viralizou multiplica (×100, ×1000); ×5 e ×10 = ×50
    total += (r * m * (q - p)) / 1000;
  }
  return total;
}

/** Valuation depois de render de `desdeMs` até `ateMs`, sem limite (desde 13/10 o jogo fechado rende tudo); ×5 dentro
 *  do bônus que vai até `boostAteMs`; ×10 por Viralizou ativo (`virais` = os fins, cada um dura `viralMs`). */
export function acumular(
  v: number, r: number, desdeMs: number, ateMs: number, boostAteMs: Boosts, virais: readonly number[] = [], viralMs = VIRAL_MS,
): number {
  return v + produzido(r, desdeMs, Math.max(ateMs, desdeMs), boostAteMs, virais, viralMs);
}

/**
 * Como `acumular`, mas a taxa troca no meio (um contrato vencendo): `trechos` = [{ desdeMs, r }] em ordem, o primeiro
 * começando em `desdeMs`. Igual a idle_settle: ×5 e ×10 em cada trecho.
 */
export function acumularTrechos(
  v: number, trechos: { desdeMs: number; r: number }[], desdeMs: number, ateMs: number, boostAteMs: Boosts,
  virais: readonly number[] = [], viralMs = VIRAL_MS,
): number {
  for (let i = 0; i < trechos.length; i++) {
    const a = Math.max(trechos[i].desdeMs, desdeMs);
    const b = Math.min(i + 1 < trechos.length ? trechos[i + 1].desdeMs : ateMs, ateMs);
    v += produzido(trechos[i].r, a, b, boostAteMs, virais, viralMs);
  }
  return v;
}
