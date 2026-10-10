// Oportunidades ("cookie dourado"): uma por janela de 10 min, num segundo sorteado pela conta abaixo (igual ao
// banco: idle_opp_at / idle_opp_kind na 0034). Não precisa ser segredo: o banco confere a janela antes de pagar.
export const JANELA_S = 600;
export const VALIDADE_S = 4 * 3600;

export const semente = (uid: string) => parseInt(uid.replace(/-/g, '').slice(0, 7), 16);

/** Quando a oportunidade da janela w aparece (ms). */
export const instante = (uid: string, w: number) => (w * JANELA_S + ((semente(uid) * 31 + w * 7919) % 590)) * 1000;

export const tipo = (uid: string, w: number) => ((semente(uid) + w * 13) % 3) as 0 | 1 | 2;

export const TEXTO_TIPO: Record<0 | 1 | 2, string> = {
  0: '15 minutos de produção na hora',
  1: 'Produção ×5 por 1 minuto',
  2: 'Próxima compra pela metade',
};

/**
 * Caixinha (igual a idle_opp_list): as 3 mais recentes que já apareceram, têm menos de 4h e não são de antes do
 * início da semana; só depois tira as pegas. Pegar uma não puxa outra mais velha.
 */
export function pendentes(uid: string, agoraMs: number, pegas: number[], inicioSemanaMs = 0): number[] {
  const ate = Math.floor(agoraMs / 1000 / JANELA_S);
  const de = Math.floor((agoraMs / 1000 - VALIDADE_S) / JANELA_S);
  const recentes: number[] = [];
  for (let w = ate; w >= de && recentes.length < 3; w--) {
    const t = instante(uid, w);
    if (t <= agoraMs && t >= agoraMs - VALIDADE_S * 1000 && t >= inicioSemanaMs) recentes.push(w);
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
