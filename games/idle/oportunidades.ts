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

/** O tipo da janela w (0, 1 ou 2), sorteado. */
export const tipo = (uid: string, w: number) => {
  const s = sorte(uid, w);
  return (s === null ? 0 : Number(mistura(s) % 3n)) as 0 | 1 | 2;
};

export const TEXTO_TIPO: Record<0 | 1 | 2, string> = {
  0: '15 minutos de produção na hora',
  1: 'Produção ×5 por 1 minuto',
  2: 'Próxima compra pela metade',
};

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
