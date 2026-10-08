// Onde cada coisa fica na mesa, em unidades do mundo 3D (x para a direita, z para perto da câmera, y para cima).
// A mesa tem 10 de largura, centrada na origem; a banca fica no fundo (z negativo), o jogador na frente.
export type Orientation = 'portrait' | 'landscape';
export type Who = 'dealer' | 'player';
export type Slot = { x: number; y: number; z: number };

export const CARD_W = 0.9;
export const CARD_D = 1.26;
export const CARD_T = 0.012;
/** Passo do leque: a carta seguinte cobre a anterior, mas deixa o índice do canto de cima à mostra. */
export const FAN_STEP = 0.55;

/** Celular deitado, tablet deitado e PC usam a mesa larga; o resto, a mesa do celular em pé. */
export function orientationOf(w: number, h: number): Orientation {
  return w >= 700 && w > h ? 'landscape' : 'portrait';
}

const ROWS: Record<Orientation, Record<Who, number>> = {
  portrait: { dealer: -2.2, player: 1.6 },
  landscape: { dealer: -2.05, player: 1.3 },
};
const SPLIT_X: Record<Orientation, number> = { portrait: 1.6, landscape: 1.8 };

/** i-ésima carta da mão `hand` (de `hands` mãos) de quem joga. */
export function cardSlot(o: Orientation, who: Who, hand: number, hands: number, i: number): Slot {
  const center = who === 'player' && hands === 2 ? (hand === 0 ? -SPLIT_X[o] : SPLIT_X[o]) : 0;
  return { x: center + (i - 0.5) * FAN_STEP, y: 0.02 + i * (CARD_T + 0.004), z: ROWS[o][who] };
}

/** Ponto embaixo da mão onde a plaquinha do total fica presa. */
export function tagPoint(o: Orientation, who: Who, hand: number, hands: number): Slot {
  const first = cardSlot(o, who, hand, hands, 0);
  return { x: first.x + FAN_STEP / 2, y: 0, z: first.z + CARD_D / 2 + 0.3 };
}

export const SHOE: Record<Orientation, Slot> = {
  portrait: { x: 2.9, y: 0.3, z: -3.3 },
  landscape: { x: 3.6, y: 0.3, z: -2.6 },
};
export const POT: Record<Orientation, Slot> = {
  portrait: { x: 0, y: 0, z: -0.25 },
  landscape: { x: 0, y: 0, z: -0.3 },
};

export function camera(o: Orientation): { fov: number; pos: [number, number, number]; look: [number, number, number] } {
  return o === 'portrait'
    ? { fov: 50, pos: [0, 9.5, 6.5], look: [0, 0, -0.2] }
    : { fov: 40, pos: [0, 6.4, 6.2], look: [0, 0, -0.35] };
}
