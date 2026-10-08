// Onde cada coisa fica na mesa de poker (mundo 3D: x para a direita, z para perto de quem olha, y para cima).
// Câmera quase de cima. Em pé: mesa comprida no z e eu sempre embaixo (lugar 0 na tela). Deitado: mesa comprida
// no x, lugares fixos (como no mockup do PC) e as minhas cartas embaixo, no meio da mesa.
import type { Orientation } from '../shared/table3d/layout';

export type P2 = { x: number; z: number };
export type Slot = P2 & { scale: number };

/** Meia largura (x) e meio comprimento (z) do feltro. */
export const FELT: Record<Orientation, { rx: number; rz: number }> = {
  portrait: { rx: 2.75, rz: 4.3 },
  landscape: { rx: 4.9, rz: 2.75 },
};

/** Lugares na tela, no sentido horário. Em pé: 0 embaixo. Deitado: 0 à esquerda (o lugar 0 do banco). */
export const SEATS: Record<Orientation, P2[]> = {
  portrait: [
    { x: 0, z: 4.55 },
    { x: -2.95, z: 2.2 },
    { x: -2.95, z: -1.9 },
    { x: 0, z: -4.55 },
    { x: 2.95, z: -1.9 },
    { x: 2.95, z: 2.2 },
  ],
  landscape: [
    { x: -5.2, z: 0 },
    { x: -2.6, z: -3.05 },
    { x: 2.6, z: -3.05 },
    { x: 5.2, z: 0 },
    { x: 2.6, z: 3.05 },
    { x: -2.6, z: 3.05 },
  ],
};

const toward = (p: P2, k: number): P2 => ({ x: p.x * (1 - k), z: p.z * (1 - k) });

/** As 2 cartas viradas de um lugar: pequenas, um pouco para dentro da mesa. */
export function holeSlot(o: Orientation, v: number, i: number): Slot {
  const c = toward(SEATS[o][v], 0.3);
  return { x: c.x + (i - 0.5) * 0.42, z: c.z, scale: 0.55 };
}

/** As minhas 2 cartas: embaixo, no meio da mesa, grandes. */
export function myCardSlot(o: Orientation, i: number): Slot {
  return o === 'portrait'
    ? { x: (i - 0.5) * 1.15, z: 2.85, scale: 1.25 }
    : { x: (i - 0.5) * 1.05, z: 1.75, scale: 1.1 };
}

/** As 5 cartas da mesa, em fila no meio. */
export function boardSlot(o: Orientation, i: number): Slot {
  return { x: (i - 2) * 0.98, z: o === 'portrait' ? -0.15 : -0.35, scale: 0.98 };
}

/** Fichas apostadas na rodada: entre o lugar e o meio. */
export function betSpot(o: Orientation, v: number): P2 {
  return toward(SEATS[o][v], 0.45);
}

/** Botão do dealer: ao lado das cartas do lugar. */
export function buttonSpot(o: Orientation, v: number): P2 {
  const p = toward(SEATS[o][v], 0.25);
  return { x: p.x + 0.65, z: p.z + 0.15 };
}

/** Pote (acima das cartas da mesa) e o baralho de onde as cartas saem (no meio). */
export const POT: Record<Orientation, P2> = { portrait: { x: 0, z: -1.55 }, landscape: { x: 0, z: -1.55 } };
export const DECK: Record<Orientation, P2> = { portrait: { x: 0, z: -0.15 }, landscape: { x: 0, z: -0.35 } };

export function camera(o: Orientation): { fov: number; pos: [number, number, number]; look: [number, number, number] } {
  return o === 'portrait'
    ? { fov: 50, pos: [0, 12.6, 1.6], look: [0, 0, 0.1] }
    : { fov: 40, pos: [0, 11.5, 3.6], look: [0, 0, 0.15] };
}
