// Eventos de era (14/10): um por era, separados dos dourados. Sorte com semente (id do jogador + segundo), igual ao banco
// (idle_evento_era na 0074), que confere o clique e paga. O evento de uma era entra na roda quando você chega nela e
// continua depois; o da sua era atual pesa 3, os antigos 1. BigInt: os quadrados passam de 2^53.
import type { EventoPago } from '../shared/types';
import { formatarValor } from './formatar';
import { semente } from './oportunidades';

export type TipoEventoEra = 1 | 2 | 3 | 4 | 5;
/** A última era que tem evento (as eras 6+ trazem os delas nas entregas seguintes). */
export const ULTIMA_ERA_COM_EVENTO = 5;
export const CHANCE_EVENTO = 1800; // 1 em 1800 por segundo
export const NOME_EVENTO_ERA: Record<TipoEventoEra, string> = {
  1: 'Desce pra almoçar!', 2: 'Pacote da Shopee', 3: 'Reunião que podia ser um e-mail', 4: 'Tela azul', 5: 'Jogo do Brasil',
};
/** Quanto tempo cada um fica na tela (s); o banco aceita 3 s a mais (rede). */
export const JANELA_EVENTO_S: Record<TipoEventoEra, number> = { 1: 8, 2: 12, 3: 12, 4: 5, 5: 30 };
export const MAX_GOLS = 7;

const P = 2147483647n;
const K = 1013904223n;
const mistura = (x: bigint) => (x * x + K) % P;

function h2(uid: string, s: number): bigint {
  const b = BigInt(s);
  return mistura((b * b * 16807n + b * 69621n + BigInt(semente(uid)) * 48271n + 4242n) % P);
}

/** O evento de era do segundo `s` pra quem está na era `era`, ou null. */
export function eventoEraEm(uid: string, s: number, era: number): TipoEventoEra | null {
  const h = h2(uid, s);
  if (h % BigInt(CHANCE_EVENTO) !== 0n) return null;
  const ate = Math.max(1, Math.min(era, ULTIMA_ERA_COM_EVENTO));
  const total = ate - 1 + 3; // os antigos pesam 1, o da sua era 3
  let r = Number(mistura(h) % BigInt(total));
  for (let e = 1; e <= ate; e++) {
    r -= e === ate ? 3 : 1;
    if (r < 0) return e as TipoEventoEra;
  }
  return ate as TipoEventoEra;
}

/** O que sai na caixa da Shopee: 0 = 1 h de produção menos 20%, 1 = Promoção por 1 min, 2 = ×5 por 2 min. */
export function premioShopee(uid: string, s: number): 0 | 1 | 2 {
  const r = Number(mistura(h2(uid, s) + 31337n) % 100n);
  return r < 50 ? 0 : r < 85 ? 1 : 2;
}

/** Onde aparece (fração da tela, longe das bordas); `i` = o pulo da bola no Jogo do Brasil. Só da página. */
export function posicaoEvento(uid: string, s: number, i = 0): { x: number; y: number } {
  const h = Number(mistura(mistura(h2(uid, s) + BigInt(i * 7919 + 1))));
  return { x: 0.1 + ((h % 1000) / 1000) * 0.7, y: 0.18 + ((Math.floor(h / 1000) % 1000) / 1000) * 0.6 };
}

// ---------- o que está valendo ----------
export const MARMITA_MULT = 3;
export const DESCONTO_MELHORIA = 0.75;
const vale = (iso: string | null | undefined, agoraMs: number) => !!iso && Date.parse(iso) > agoraMs;
/** Marmita da mãe valendo (produção ×3). */
export const marmitaAtiva = (s: { marmita_ate?: string | null }, agoraMs: number) => vale(s.marmita_ate, agoraMs);
/** Atualização instalada valendo (melhorias −25%). */
export const descontoAtivo = (s: { upg_desc_ate?: string | null }, agoraMs: number) => vale(s.upg_desc_ate, agoraMs);

// ---------- textos ----------
/** Quanto entra em F$ na hora, com a produção `rate` de agora: Shopee (se sair F$), a call e 1 gol. */
export function ganhoEventoAgora(tipo: TipoEventoEra, rate: number): number {
  return tipo === 2 ? rate * 3600 * 0.8 : tipo === 3 ? rate * 1800 : tipo === 5 ? rate * 300 : 0;
}

/** O texto que sobe quando pega (com o que o banco mandou em `evento`). */
export function textoEventoPegou(e: EventoPago): string {
  if (e.tipo === 1) return 'Marmita da mãe! ×3 por 3 min';
  if (e.tipo === 2) {
    if (e.premio === 1) return 'Promoção! Tudo pela metade por 1 min';
    if (e.premio === 2) return '×5 por 2 min';
    return `+${formatarValor(e.ganho)} (Taxa das blusinhas: −20%)`;
  }
  if (e.tipo === 3) return `Fugiu da call! +${formatarValor(e.ganho)}`;
  if (e.tipo === 4) return 'Atualização instalada! Melhorias −25%';
  return `${e.gols} ${e.gols === 1 ? 'gol' : 'gols'}! +${formatarValor(e.ganho)}`;
}
