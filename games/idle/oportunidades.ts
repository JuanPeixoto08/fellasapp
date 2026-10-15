// Oportunidades ("cookie dourado"): uma por janela de 10 min, o segundo e o tipo sorteados pela conta abaixo (igual ao
// banco: idle_opp_sorte / idle_opp_at / idle_opp_kind na 0049). Não precisa ser segredo: o banco confere a janela
// antes de pagar.
export const JANELA_S = 600;
export const VALIDADE_S = 4 * 3600;
/** Quantas oportunidades dá pra pegar por dia (igual ao banco). */
export const LIMITE_DIA = 10;

export const semente = (uid: string) => parseInt(uid.replace(/-/g, '').slice(0, 7), 16);

// a sorte da janela: a mesma mistura dos eventos na tela (dourados.ts), com outros pesos. BigInt: os quadrados passam
// de 2^53. Antes da 0049 era uma conta em sequência (o tipo girava 0, 1, 2 e o segundo andava 249 s por janela).
const P = 2147483647n;
const K = 1013904223n;
const mistura = (x: bigint) => (x * x + K) % P;
/** null com id que não é uuid ou janela que não é inteira (sem hora do servidor): aí nada aparece, como na conta antiga. */
function sorte(uid: string, w: number): bigint | null {
  const u = semente(uid);
  if (!Number.isInteger(w) || !Number.isInteger(u)) return null;
  const b = BigInt(w);
  return mistura(mistura((b * b * 69621n + b * 48271n + BigInt(u) * 16807n + 7n) % P));
}

/** Quando a oportunidade da janela w aparece (ms): um segundo sorteado entre 0 e 589 da janela. */
export const instante = (uid: string, w: number) => {
  const s = sorte(uid, w);
  return s === null ? NaN : (w * JANELA_S + Number(s % 590n)) * 1000;
};

/** 0 15 min de produção · 1 ×5 por 1 min · 2 próxima compra pela metade · 3 Chamar um dourado · 4 Cupom de primeira compra ·
 *  5 Adubo de farmácia · 6 Cashback · 7 Informação privilegiada (de 3 a 7 desde a 0076). */
export type TipoOportunidade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** A janela de corte (0076): as de antes continuam com 3 tipos (% 3), pra nada que já está na caixinha de alguém trocar
 *  de tipo; a partir dela, a roda de 8 (% 100). É a janela da meia-noite de Brasília depois do db push (o passo de
 *  publicar acerta o número, aqui e em idle_opp_kind). */
export const OPP_CORTE = 2_987_010;
/** Limites (exclusivos) de r = h % 100 de cada tipo, de 0 a 7: 0–17, 18–33, 34–49, 50–59, 60–71, 72–80, 81–90, 91–99. */
const RODA_OPP: readonly number[] = [18, 34, 50, 60, 72, 81, 91, 100];

/** O tipo da janela w, sorteado (igual a idle_opp_kind). */
export const tipo = (uid: string, w: number): TipoOportunidade => {
  const s = sorte(uid, w);
  if (s === null) return 0;
  const h = mistura(s);
  if (w < OPP_CORTE) return Number(h % 3n) as TipoOportunidade;
  const r = Number(h % 100n);
  return RODA_OPP.findIndex((lim) => r < lim) as TipoOportunidade;
};

export const TEXTO_TIPO: Record<TipoOportunidade, string> = {
  0: '15 minutos de produção na hora',
  1: 'Produção ×5 por 1 minuto',
  2: 'Próxima compra pela metade',
  3: 'Chamar um dourado',
  4: 'Cupom de primeira compra',
  5: 'Adubo de farmácia',
  6: 'Cashback',
  7: 'Informação privilegiada',
};

// os números das oportunidades novas (0076); com "rendem o dobro" (Xepa / Viralizar) cada um vale 2×
export const CUPONS_POR_OPP = 10;
export const CUPOM_FATOR = 0.75; // compra de gerador 25% mais barata
export const CASHBACK = 0.3; // devolve 30% do preço
export const CASHBACK_S = 120; // por 2 min (soma no fim do que já tem)
export const CHAMADOS_MAX = 3;
/** Cupom valendo na compra de gerador: tem cupom e a Promoção não está ligada (com ela o cupom fica guardado). */
export const cupomVale = (s: { cupons?: number; promo_ate: string | null }, agoraMs: number) =>
  (s.cupons ?? 0) > 0 && !(s.promo_ate !== null && Date.parse(s.promo_ate) > agoraMs);
/** Cashback valendo (toda compra devolve 30%). */
export const cashbackAtivo = (s: { cashback_ate?: string | null }, agoraMs: number) => !!s.cashback_ate && Date.parse(s.cashback_ate) > agoraMs;

/** Quantas a caixinha guarda e quanto tempo (s) uma guardada dura: 3 e 4h sem a árvore (ramo Oportunidades). */
export type Caixa = { tamanho: number; validadeS: number };
export const CAIXA_PADRAO: Caixa = { tamanho: 3, validadeS: VALIDADE_S };

/**
 * Caixinha (igual a idle_opp_list na 0041): as `tamanho` mais recentes que já apareceram, têm menos de `validadeS` e
 * não são de antes do início da semana; só depois tira as pegas. Pegar uma não puxa outra mais velha.
 */
export function pendentes(uid: string, agoraMs: number, pegas: number[], inicioSemanaMs = 0, caixa: Caixa = CAIXA_PADRAO): number[] {
  const ate = Math.floor(agoraMs / 1000 / JANELA_S);
  const de = Math.floor((agoraMs / 1000 - caixa.validadeS) / JANELA_S);
  const recentes: number[] = [];
  for (let w = ate; w >= de && recentes.length < caixa.tamanho; w--) {
    const t = instante(uid, w);
    if (t <= agoraMs && t >= agoraMs - caixa.validadeS * 1000 && t >= inicioSemanaMs) recentes.push(w);
  }
  return recentes.filter((w) => !pegas.includes(w));
}

/**
 * A janela cuja oportunidade está passando na tela agora (fica `duracaoS` segundos), ou null. Olha também a janela
 * anterior: com 30 s na tela, a de perto do fim da janela continua aparecendo depois da virada.
 */
export function aoVivo(uid: string, agoraMs: number, duracaoS: number): number | null {
  const atual = Math.floor(agoraMs / 1000 / JANELA_S);
  for (const w of [atual, atual - 1]) {
    const t = instante(uid, w);
    if (agoraMs >= t && agoraMs <= t + duracaoS * 1000) return w;
  }
  return null;
}

/**
 * Quando a oportunidade da janela w sai da caixinha (ms): a caixinha guarda só as `tamanho` mais recentes, então ela
 * sai quando aparece a `tamanho`-ésima mais nova (ou na validade, o que vier antes). O "some em" da tela usa isto.
 */
export const sai = (uid: string, w: number, tamanho = 3) =>
  Math.min(instante(uid, w) + VALIDADE_S * 1000, instante(uid, w + tamanho));
