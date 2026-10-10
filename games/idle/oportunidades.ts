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

/** As até 3 mais recentes que já apareceram, têm menos de 4h e não foram pegas (igual a idle_opp_list). */
export function pendentes(uid: string, agoraMs: number, pegas: number[]): number[] {
  const ate = Math.floor(agoraMs / 1000 / JANELA_S);
  const de = Math.floor((agoraMs / 1000 - VALIDADE_S) / JANELA_S);
  const out: number[] = [];
  for (let w = ate; w >= de && out.length < 3; w--) {
    const t = instante(uid, w);
    if (t <= agoraMs && t >= agoraMs - VALIDADE_S * 1000 && !pegas.includes(w)) out.push(w);
  }
  return out;
}

/** A janela cuja oportunidade está passando na tela agora (fica `duracaoS` segundos), ou null. */
export function aoVivo(uid: string, agoraMs: number, duracaoS: number): number | null {
  const w = Math.floor(agoraMs / 1000 / JANELA_S);
  const t = instante(uid, w);
  return agoraMs >= t && agoraMs <= t + duracaoS * 1000 ? w : null;
}
