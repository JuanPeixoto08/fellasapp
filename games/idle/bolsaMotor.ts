// Motor de preço da Bolsa da Fellas Inc. Um tick (1 minuto) de uma empresa é uma função pura dos sorteios (7 uniformes
// em [0,1)): o servidor (0043 idle_bolsa_tick, com random()) e esta cópia fazem a mesma conta (games/test/idleBolsa.test.ts
// confere). Esta cópia só serve à simulação que calibra o catálogo e aos testes; quem sorteia de verdade é o servidor.
// Preço em segundos de produção. Spec: docs/superpowers/specs/2026-10-11-fellas-inc-bolsa-design.md.

export type EmpresaBolsa = {
  /** gerador: o gerador ligado (o limite de ações da empresa cresce com quantos dele você tem). */
  id: number; codigo: string; nome: string; gerador: number; repouso: number; vol: number; pesos: readonly number[]; quebra: number;
};

/** Pesos dos humores: 0 parada · 1 sobe devagar · 2 cai devagar · 3 sobe forte · 4 despenca · 5 maluca. Mudou aqui:
 *  mude também o insert da 0043 (o teste de paridade compara). */
export const EMPRESAS_BOLSA: readonly EmpresaBolsa[] = [
  { id: 1, codigo: 'PSTL', nome: 'Pastel do Zé', gerador: 11, repouso: 30, vol: 0.6, pesos: [30, 30, 15, 10, 5, 10], quebra: 0.03 },
  { id: 2, codigo: 'ACAI', nome: 'Açaí Gourmet', gerador: 14, repouso: 120, vol: 0.5, pesos: [35, 30, 15, 8, 4, 8], quebra: 0.03 },
  { id: 3, codigo: 'COCH', nome: 'Coach Quântico', gerador: 16, repouso: 50, vol: 1.2, pesos: [10, 15, 10, 30, 25, 10], quebra: 0.15 },
  { id: 4, codigo: 'PRMO', nome: 'Cripto do Primo', gerador: 19, repouso: 20, vol: 1.6, pesos: [5, 10, 10, 15, 15, 45], quebra: 0.15 },
  { id: 5, codigo: 'JEGU', nome: 'Uber de Jegue', gerador: 15, repouso: 8, vol: 1.2, pesos: [15, 15, 20, 10, 15, 25], quebra: 0.15 },
  { id: 6, codigo: 'MEME', nome: 'NFT de Meme', gerador: 6, repouso: 5, vol: 1.6, pesos: [5, 10, 10, 15, 15, 45], quebra: 0.15 },
  { id: 7, codigo: 'IRMA', nome: 'Funerária 1 Irmão', gerador: 20, repouso: 80, vol: 0.3, pesos: [70, 10, 10, 4, 3, 3], quebra: 0.03 },
  { id: 8, codigo: 'SIMA', nome: 'Mecânica Simas', gerador: 8, repouso: 40, vol: 1.0, pesos: [20, 20, 20, 15, 15, 10], quebra: 0.06 },
];

export const BOLSA = {
  piso: 0.05, zonaRisco: 0.15, rj: 10, durMin: 10, durMax: 120, corretagem: 0.05, limiteBase: 100,
  historico: 60, retencao: 10080, maxAtraso: 1440,
} as const;

/** Melhorias da Bolsa: índice = nível (0 = sem). Custo do nível n (1..5) = custo[n − 1] segundos de produção. Iguais às
 *  funções idle_bolsa_corretagem/idle_bolsa_escritorio/idle_bolsa_custo da 0043. */
export const MELHORIAS_BOLSA = {
  corretor: {
    nomes: ['Primo que entende de ação', 'Assessor do banco', 'Mesa de operações', 'Robô de trade', 'Insider (shh)'],
    corretagem: [0.05, 0.04, 0.03, 0.02, 0.01, 0.005],
    custo: [1800, 3600, 7200, 14400, 28800],
  },
  escritorio: {
    nomes: ['Mesa na sala', 'Salinha comercial', 'Andar na Faria Lima', 'Prédio espelhado', 'Torre na Berrini'],
    bonus: [0, 25, 50, 100, 200, 400],
    custo: [3600, 7200, 14400, 28800, 57600],
  },
} as const;

export type Mercado = { valor: number; delta: number; humor: number; humorAte: number; geracao: number; rjAte: number | null };

/** Normal(0, 1) por Box-Muller; `1 − a` porque o sorteio é [0,1) e ln(0) não existe. */
export const normal = (a: number, b: number) => Math.sqrt(-2 * Math.log(1 - a)) * Math.cos(2 * Math.PI * b);

/** O humor sorteado pelos pesos (u em [0,1)). */
export function escolherHumor(pesos: readonly number[], u: number): number {
  const total = pesos.reduce((a, p) => a + p, 0);
  let x = u * total;
  for (let i = 0; i < pesos.length; i++) {
    if (x < pesos[i]) return i;
    x -= pesos[i];
  }
  return pesos.length - 1;
}

/** Empresa nova no mercado: no repouso, humor vencido (sorteia no primeiro tick). */
export const inicial = (e: EmpresaBolsa, t: number): Mercado => ({ valor: e.repouso, delta: 0, humor: 0, humorAte: t, geracao: 0, rjAte: null });

/** Empurrão de cada humor no embalo (delta), já calibrado pela simulação de 30 dias (Task 1): parada · sobe devagar · cai
 *  devagar · sobe forte · despenca; a maluca usa um sorteio (MALUCA). */
const EMPURRAO = [0, 0.00015, -0.00015, 0.0008, -0.0008];
const MALUCA = 0.015;
/** Ruído de todo minuto, quanto do embalo fica pro minuto seguinte e a força de volta ao repouso. */
const RUIDO = 0.002;
const DECAI = 0.9;
const VOLTA = 0.003;

/**
 * Um minuto. u: [n1a, n1b, n2a, n2b, humor, duração, quebra]. Em recuperação judicial: preço parado no repouso; no tick
 * da volta, sai da recuperação (humor vencido). Igual a 0043 idle_bolsa_tick.
 */
export function tick(m: Mercado, e: EmpresaBolsa, t: number, u: readonly number[]): Mercado {
  if (m.rjAte !== null) {
    if (t >= m.rjAte) return { ...m, valor: e.repouso, delta: 0, humor: 0, humorAte: t, rjAte: null };
    return { ...m, valor: e.repouso, delta: 0, humor: 0 };
  }
  let humor = m.humor;
  let humorAte = m.humorAte;
  if (t >= humorAte) {
    humor = escolherHumor(e.pesos, u[4]);
    humorAte = t + BOLSA.durMin + Math.floor(u[5] * (BOLSA.durMax - BOLSA.durMin + 1));
  }
  const n1 = normal(u[0], u[1]);
  const n2 = normal(u[2], u[3]);
  const empurrao = humor === 5 ? n2 * MALUCA : EMPURRAO[humor];
  const delta = Math.max(-0.08, Math.min(0.08, m.delta * DECAI + empurrao * e.vol + n1 * RUIDO * e.vol));
  const valor = Math.max(m.valor * (1 + delta) + (e.repouso - m.valor) * VOLTA, BOLSA.piso * e.repouso);
  if (valor < BOLSA.zonaRisco * e.repouso && u[6] < e.quebra) {
    return { valor: e.repouso, delta: 0, humor: 0, humorAte: t + BOLSA.rj, geracao: m.geracao + 1, rjAte: t + BOLSA.rj };
  }
  return { valor, delta, humor, humorAte, geracao: m.geracao, rjAte: null };
}

/** Sorteio com semente (mulberry32), só para a simulação. */
function rng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** `ticks` minutos de mercado com semente: quebras por empresa, a série de preços e se estava em recuperação. */
export function simular(semente: number, ticks: number) {
  const r = rng(semente);
  const quebras = EMPRESAS_BOLSA.map(() => 0);
  const series = EMPRESAS_BOLSA.map(() => [] as number[]);
  const rj = EMPRESAS_BOLSA.map(() => [] as boolean[]);
  const m = EMPRESAS_BOLSA.map((e) => inicial(e, 0));
  for (let t = 1; t <= ticks; t++) {
    EMPRESAS_BOLSA.forEach((e, i) => {
      const antes = m[i].geracao;
      m[i] = tick(m[i], e, t, [r(), r(), r(), r(), r(), r(), r()]);
      if (m[i].geracao > antes) quebras[i]++;
      series[i].push(m[i].valor);
      rj[i].push(m[i].rjAte !== null);
    });
  }
  return { quebras, series, rj };
}
