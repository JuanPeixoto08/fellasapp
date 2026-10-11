// Eventos na tela (tipo cookie dourado): a cada segundo há chance 1/600 de aparecer um, pra quem está com o jogo
// aberto, e ele some em 12 s. A sorte tem semente (id do jogador + segundo) e é a mesma conta do banco
// (idle_dourado na 0045), que confere o clique. BigInt: os quadrados passam de 2^53.
import { semente } from './oportunidades';

export const TIPOS_DOURADO = ['investidor', 'promocao', 'viralizou', 'dupla'] as const;
/** 0 Investidor apressado · 1 Promoção relâmpago · 2 Viralizou · 3 dupla de Viralizou. */
export type TipoDourado = 0 | 1 | 2 | 3;
/** Quanto tempo o evento fica na tela (s); o banco aceita até 15 s (folga da rede). */
export const JANELA_S = 12;

const P = 2147483647n;
const K = 1013904223n;
const mistura = (x: bigint) => (x * x + K) % P;

function h1(uid: string, s: number): bigint {
  const b = BigInt(s);
  return (b * b * 48271n + b * 16807n + BigInt(semente(uid)) * 69621n + 12345n) % P;
}

/** O evento que aparece pro jogador no segundo `s` (epoch), ou null. */
export function douradoEm(uid: string, s: number): TipoDourado | null {
  const h2 = mistura(h1(uid, s));
  if (h2 % 600n !== 0n) return null;
  const r = Number(mistura(h2) % 100n);
  return r < 2 ? 3 : r < 20 ? 2 : r < 55 ? 1 : 0;
}

/** Onde aparece (fração da tela, longe das bordas); só da página. Na dupla, o lado 1 fica ao lado do 0. */
export function posicao(uid: string, s: number, lado = 0): { x: number; y: number } {
  const h = Number(mistura(mistura(mistura(h1(uid, s)))));
  const x = 0.08 + ((h % 1000) / 1000) * 0.7;
  const y = 0.15 + ((Math.floor(h / 1000) % 1000) / 1000) * 0.7;
  return { x: lado === 1 ? Math.min(0.92, x + 0.14) : x, y };
}
