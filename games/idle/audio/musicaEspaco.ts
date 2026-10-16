// As músicas das eras 6 (Em órbita) e 7 (Lua), no estilo das trilhas de ficção científica do Hans Zimmer (pedido do Juan,
// 15/10): órgão, ostinato de arpejo que cresce aos poucos, pedal grave, tique-taque de relógio. Harmonias e melodias são
// daqui (nada copiado de tema dele). Só dados e contas, sem áudio: 16 compassos de 4 tempos por giro; o giro 0 é mais
// vazio, o 1 cresce e traz a melodia. Tudo humanizado com semente (força e tempo variam um pouco, igual em todo giro).
import type { Instrumento, Nota } from './musica';
import { aleatorio } from './sorte';

export const COMPASSOS_ESPACO = 16;
export const BATIDAS_ESPACO = COMPASSOS_ESPACO * 4;
export const BPM_ESPACO = { 6: 66, 7: 60 } as const;
export type EraEspaco = keyof typeof BPM_ESPACO;

/** Um compasso: o baixo e o acorde do órgão (MIDI, de baixo pra cima). */
export type Compasso = { readonly baixo: number; readonly orgao: readonly number[] };
const C = (baixo: number, ...orgao: number[]): Compasso => ({ baixo, orgao });

// Órbita, em Fá maior com a quarta aumentada (Lídio), leve: F(9) · C/E · Dm(9) · B♭(maj7♯11) · F/A · B♭ · Gm7 · Csus → C
const F9 = C(41, 53, 57, 60, 67);
const C_E = C(40, 52, 55, 60, 67);
const DM9 = C(38, 50, 57, 62, 64);
const BB711 = C(34, 46, 53, 57, 64);
const F_A = C(45, 53, 57, 60, 65);
const BB = C(46, 50, 53, 58, 64);
const GM7 = C(43, 50, 53, 58, 62);
const CSUS = C(48, 53, 55, 60, 65);
const DO = C(48, 52, 55, 60, 64);
export const FORMA_ORBITA: readonly Compasso[] = [F9, F9, C_E, C_E, DM9, DM9, BB711, BB711, F_A, F_A, BB, BB, GM7, GM7, CSUS, DO];

// Lua, em Ré menor, escura: Dm · B♭ · Gm/D · Asus → A · Dm · B♭ · F/C · Asus → A
const DM = C(38, 50, 53, 57, 62);
const BBL = C(34, 46, 50, 53, 58);
const GM_D = C(38, 46, 50, 55, 58);
const ASUS = C(33, 45, 50, 52, 57);
const LA = C(33, 45, 49, 52, 57);
const F_C = C(36, 48, 53, 57, 60);
export const FORMA_LUA: readonly Compasso[] = [DM, DM, BBL, BBL, GM_D, GM_D, ASUS, LA, DM, DM, BBL, BBL, F_C, F_C, ASUS, LA];

/** As melodias do giro 1 (compassos 9 a 16): [duração em tempos, altura MIDI ou null = pausa]. */
export type Frase = readonly (readonly [number, number | null])[];
export const MELODIA_ORBITA: readonly Frase[] = [
  [[4, 72]], [[2, 69], [2, 72]], [[4, 77]], [[2, 74], [2, 76]], [[4, 74]], [[2, 70], [2, 74]], [[4, 72]], [[4, null]],
];
export const MELODIA_LUA: readonly Frase[] = [
  [[4, 69]], [[2, 65], [2, 69]], [[4, 65]], [[4, 62]], [[4, 69]], [[2, 65], [2, 60]], [[4, 62]], [[4, 61]],
];
export const forma = (era: EraEspaco) => (era === 6 ? FORMA_ORBITA : FORMA_LUA);

/** As notas do arpejo no compasso: o acorde do órgão uma oitava acima (duas, se ficaria abaixo do Dó central). */
const tonsArpejo = (k: Compasso) => k.orgao.map((n) => (n + 12 < 60 ? n + 24 : n + 12)).sort((a, b) => a - b);
const COLCHEIAS = [0, 1, 2, 3, 2, 1, 2, 3] as const;
const SEMICOLCHEIAS = [0, 1, 2, 3, 1, 2, 3, 2, 0, 1, 2, 3, 2, 3, 1, 2] as const;

/** Quantos compassos o acorde que começa em `c` fica (até o próximo diferente). */
function compassosDoAcorde(f: readonly Compasso[], c: number): number {
  let n = 1;
  while (c + n < f.length && f[c + n] === f[c]) n++;
  return n;
}

/** Humaniza com semente (o mesmo giro soa igual toda vez): força × 0,86–1 e tempo ± 0,02 batida; o tique-taque, que marca
 *  o tempo, só varia a força. */
export function humanizar(notas: readonly Nota[], semente: number): Nota[] {
  const r = aleatorio(semente);
  return notas
    .map((n) => {
      const forca = n.forca * (0.86 + 0.14 * r());
      const desvio = n.inst === 'tique' ? 0 : (r() - 0.5) * 0.04;
      return { ...n, t: Math.max(0, n.t + desvio), forca };
    })
    .sort((a, b) => a.t - b.t);
}

/** Todas as notas de um giro (0 = mais vazio, 1 = cresce e tem a melodia) da era 6 ou 7, humanizadas e ordenadas. */
export function notasEspaco(era: EraEspaco, giro: number): Nota[] {
  const f = forma(era);
  const cheio = giro === 1;
  const out: Nota[] = [];
  const nota = (inst: Instrumento, t: number, dur: number, altura: number, forca: number) => out.push({ inst, t, dur, altura, forca });
  for (let c = 0; c < COMPASSOS_ESPACO; c++) {
    const t0 = c * 4;
    const k = f[c];
    if (c === 0 || f[c - 1] !== k) {
      // o acorde: o pedal grave, o órgão segurando e (no giro 1, ou na 2ª metade da Órbita) o pad abrindo o filtro
      const dur = compassosDoAcorde(f, c) * 4;
      nota('grave', t0, dur, k.baixo, era === 7 ? 0.6 : 0.5);
      for (const n of k.orgao) nota('orgao', t0, dur, n, era === 7 ? (cheio ? 0.46 : 0.38) : cheio ? 0.5 : 0.42);
      if (cheio || (era === 6 && c >= 8)) for (const n of k.orgao.slice(1)) nota('pad', t0, dur, n + 12, 0.5);
    }
    if (c % 4 === 0) nota('ar', t0, 16, 0, 0.8);
    // o arpejo que cresce: na Órbita, semínimas → colcheias → semicolcheias; na Lua, só no fim do giro 1, bem baixo
    const tons = tonsArpejo(k);
    if (era === 6) {
      if (!cheio && c < 4) [0, 1, 2, 3].forEach((i) => nota('arpejo', t0 + i, 0.9, tons[i], 0.22));
      else if (!cheio || c < 8) COLCHEIAS.forEach((i, j) => nota('arpejo', t0 + j / 2, 0.45, tons[i], c < 8 && !cheio ? 0.26 : 0.3));
      else SEMICOLCHEIAS.forEach((i, j) => nota('arpejo', t0 + j / 4, 0.25, tons[i], 0.34));
    } else if (cheio && c >= 8) [0, 1, 2, 3].forEach((i) => nota('arpejo', t0 + i, 0.9, tons[i], 0.2));
    // a Lua marca o tempo: tique (1) e taque (0) em cada batida; no giro 1 o 1º tempo do compasso pesa mais
    if (era === 7) for (let b = 0; b < 4; b++) nota('tique', t0 + b, 0.1, b % 2 === 0 ? 1 : 0, cheio && b === 0 ? 0.62 : 0.5);
  }
  if (cheio) {
    (era === 6 ? MELODIA_ORBITA : MELODIA_LUA).forEach((frase, i) => {
      let pos = 0;
      for (const [dur, n] of frase) {
        if (n !== null) nota('orgao', (8 + i) * 4 + pos, dur, n, 0.5);
        pos += dur;
      }
    });
  }
  return humanizar(out, 20261015 + era * 10 + giro);
}
