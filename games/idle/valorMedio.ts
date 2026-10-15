// Quanto vale, em média, um dourado e uma oportunidade da Caixinha, em minutos da sua produção: hoje (antes da entrega 5)
// e com os tipos novos. É o modelo que trava o ritmo (spec, seção Testes: o ganho médio não sobe mais de 15%). Jogador que
// pega tudo o que aparece, sem árvore nem Xepa. As hipóteses estão em HIPOTESES; mexer nelas muda a conta. O Combo fica
// fora (é o prêmio de quem pega 3 seguidos olhando a tela; ver as decisões do plano da entrega 5).
import { LINKEDIN_MULT, PIX_FICAR_S, TIGRE_PAGA_S, TREND_MAX } from './dourados';
import { CASHBACK, CASHBACK_S, CUPOM_FATOR, CUPONS_POR_OPP } from './oportunidades';

export const HIPOTESES = {
  promocao: 10, // 30 s de tudo pela metade ≈ 10 min de produção economizados
  compra: 5, // uma compra típica de gerador ≈ 5 min de produção
  saldo: 5, // o que a pessoa tem na mão quando o cashback liga
  moedinhas: 15, // moedinhas pegas num Trend (caem ~25)
  fatiaLinkedin: 0.2, // a parte média do gerador sorteado (entre os 5 que mais produzem)
  adubo: 5, // amadurecer na hora a planta mais perto ≈ 5 min de produção
  info: 5, // espiar o humor de uma empresa ≈ 5 min de produção
} as const;

/** Pesos de cada tipo (índice = tipo). */
export const RODA_DOURADO_HOJE = [45, 35, 18, 2] as const;
export const RODA_DOURADO_NOVA = [25, 18, 13, 2, 12, 12, 10, 8] as const;
export const RODA_OPP_HOJE = [1, 1, 1] as const;
export const RODA_OPP_NOVA = [18, 16, 16, 10, 12, 9, 10, 9] as const;

const H = HIPOTESES;
const media = (pesos: readonly number[], valor: (t: number) => number) =>
  pesos.reduce((a, p, t) => a + p * valor(t), 0) / pesos.reduce((a, p) => a + p, 0);

/** Um dourado do tipo `t`, em minutos de produção; `d` = 2 no dobro do Pix devolvido. */
function dourado(t: number, d: number): number {
  switch (t) {
    case 0: return 20 * d; // Investidor
    case 1: return H.promocao * d;
    case 2: return 9 * d; // ×10 por 1 min = 9 min a mais
    case 3: return 99 * d; // os dois lados: ×100 por 1 min
    case 4: return Math.min(H.moedinhas, TREND_MAX) * d;
    case 5: return (LINKEDIN_MULT - 1) * H.fatiaLinkedin * d;
    case 6: return Math.max(PIX_FICAR_S / 60, garantido(2)); // fica ou devolve, o que valer mais
    default: return TIGRE_PAGA_S / 60; // quase ninguém passa das 3 grátis do dia
  }
}

/** O dourado garantido (Pix devolvido com d = 2, Chamar com d = 1): a roda nova sem Pix nem Tigrinho (viram Investidor). */
export function garantido(d: number): number {
  const p: number[] = [...RODA_DOURADO_NOVA];
  p[0] += p[6] + p[7];
  p[6] = 0;
  p[7] = 0;
  return media(p, (t) => (t >= 6 ? 0 : dourado(t, d)));
}

export const mediaDourado = (roda: readonly number[]) => media(roda, (t) => dourado(t, 1));

/** Uma oportunidade (sem a Xepa); `tem` = se a pessoa tem Horta (com planta crescendo) e Bolsa. */
export function mediaOportunidade(roda: readonly number[], tem: { horta: boolean; bolsa: boolean }): number {
  return media(roda, (t) => {
    switch (t) {
      case 0: return 15;
      case 1: return 4; // ×5 por 1 min
      case 2: return H.compra / 2; // a próxima compra pela metade
      case 3: return garantido(1);
      case 4: return CUPONS_POR_OPP * (1 - CUPOM_FATOR) * H.compra;
      case 5: return tem.horta ? H.adubo : 15;
      case 6: return CASHBACK * (H.saldo + CASHBACK_S / 60);
      default: return tem.bolsa ? H.info : 15;
    }
  });
}
