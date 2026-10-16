// Partitura da música da Fellas Inc. (só dados e contas, sem áudio): um standard de swing original, AABA de 32
// compassos em Fá, que cresce por era (0 = antes do Abrir CNPJ, 1 Quarto … 5 Sede). Da referência do Juan ("Welcome
// to the Green Room", Toby Fox) só vem o balanço: tercina de swing, baixo andando, prato de condução. Melodia e
// harmonia são daqui.
// As eras 6 e 7 tocam outra música (musicaEspaco.ts): órgão, arpejo e tique-taque, no estilo das trilhas do Hans Zimmer.
import { BATIDAS_ESPACO, BPM_ESPACO, notasEspaco } from './musicaEspaco';
import { aleatorio } from './sorte';

export type Instrumento =
  | 'baixo' | 'escovinha' | 'conducao' | 'bumbo' | 'caixa' | 'piano' | 'vibrafone' | 'metais'
  | 'orgao' | 'arpejo' | 'grave' | 'pad' | 'tique' | 'ar';
/** Uma nota do giro: `t` e `dur` em batidas (já com o swing), `altura` MIDI (percussão: 0), `forca` de 0 a 1. */
export type Nota = { inst: Instrumento; t: number; dur: number; altura: number; forca: number };
/** Um compasso de melodia: [duração em tempos, altura MIDI ou null = pausa]. */
export type Frase = readonly (readonly [number, number | null])[];

export const COMPASSOS = 32;
export const BATIDAS_GIRO = COMPASSOS * 4;
const BPM = [120, 120, 126, 132, 138, 144] as const; // índice = era (0 = antes do CNPJ, no tempo do Quarto)
export const eraMusica = (era: number) => Math.max(0, Math.min(7, Math.floor(era)));
export const bpm = (era: number): number => {
  const e = eraMusica(era);
  return e >= 6 ? BPM_ESPACO[e as 6 | 7] : BPM[e];
};
/** Quantas batidas tem o giro: 128 no swing (eras 0–5), 64 nas eras 6 e 7. */
export const batidasDoGiro = (era: number) => (eraMusica(era) >= 6 ? BATIDAS_ESPACO : BATIDAS_GIRO);
export const segundosDoGiro = (era: number) => (batidasDoGiro(era) * 60) / bpm(era);

/** Swing de tercina: a colcheia de cima (x,5) cai a 2/3 do tempo. */
export function swing(t: number): number {
  const b = Math.floor(t + 1e-9);
  return Math.abs(t - b - 0.5) < 1e-9 ? b + 2 / 3 : t;
}

// ---------- harmonia ----------
const NOTAS: Record<string, number> = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const QUALIDADES: Record<string, readonly number[]> = {
  '6': [0, 4, 7, 9], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], m6: [0, 3, 7, 9], dim7: [0, 3, 6, 9],
};
export type Acorde = { raiz: number; intervalos: readonly number[] };
export function acorde(cifra: string): Acorde {
  const m = /^([A-G](?:b|#)?)(.*)$/.exec(cifra);
  if (!m || NOTAS[m[1]] === undefined || !QUALIDADES[m[2]]) throw new Error(`cifra desconhecida: ${cifra}`);
  return { raiz: NOTAS[m[1]], intervalos: QUALIDADES[m[2]] };
}
/** As classes de altura (0–11) do acorde. */
export const notasDoAcorde = (a: Acorde) => a.intervalos.map((i) => (a.raiz + i) % 12);
const transpor = (a: Acorde, n: number): Acorde => ({ raiz: (a.raiz + n + 12) % 12, intervalos: a.intervalos });

// um compasso = 1 acorde (4 tempos) ou 2 (2 + 2)
const A_INICIO = [['F6'], ['Am7', 'Abdim7'], ['Gm7'], ['C7'], ['Am7', 'D7'], ['Gm7', 'C7']];
const A_VOLTA = [['F6', 'D7'], ['Gm7', 'C7']]; // volta pro começo
const A_PONTE = [['F6'], ['Cm7', 'F7']]; // prepara a ponte (Si bemol)
const B = [['Bbmaj7'], ['Bbm6'], ['Am7'], ['D7'], ['G7'], ['G7'], ['Gm7'], ['C7']];
export const FORMA: readonly (readonly string[])[] = [...A_INICIO, ...A_VOLTA, ...A_INICIO, ...A_PONTE, ...B, ...A_INICIO, ...A_VOLTA];

// na Sede o fim da ponte e a última A (menos a volta) sobem um tom
const SOBE_DE = 23;
const SOBE_ATE = 30;
const deslocamento = (era: number, compasso: number) => (eraMusica(era) === 5 && compasso >= SOBE_DE && compasso <= SOBE_ATE ? 2 : 0);

/** O acorde que soa no tempo `batida` (0–3) do compasso (dá a volta no giro), já com a subida da Sede. */
export function acordeEm(era: number, compasso: number, batida: number): Acorde {
  const c = ((compasso % COMPASSOS) + COMPASSOS) % COMPASSOS;
  const cifras = FORMA[c];
  const cifra = cifras.length === 2 && batida >= 2 ? cifras[1] : cifras[0];
  return transpor(acorde(cifra), deslocamento(era, c));
}

// ---------- melodia (vibrafone) ----------
const T_A: Frase[] = [
  [[0.5, null], [0.5, 69], [0.5, 72], [0.5, 74], [1.5, 77], [0.5, null]],
  [[1, 76], [0.5, 74], [0.5, 72], [1, 71], [1, null]],
  [[0.5, null], [0.5, 70], [0.5, 74], [0.5, 77], [1.5, 79], [0.5, null]],
  [[1, 76], [0.5, 74], [0.5, 72], [2, 70]],
  [[0.5, 69], [0.5, 72], [0.5, 76], [0.5, 79], [1, 78], [1, 74]],
  [[0.5, null], [0.5, 79], [0.5, 77], [0.5, 74], [1, 76], [0.5, 72], [0.5, 76]],
];
const T_VOLTA: Frase[] = [
  [[1.5, 77], [0.5, null], [1, 78], [0.5, 81], [0.5, null]],
  [[1, 79], [0.5, 77], [0.5, 74], [2, 76]],
];
const T_PONTE: Frase[] = [
  [[2, 77], [2, null]],
  [[1, 75], [0.5, 74], [0.5, 72], [2, 69]],
];
const T_B: Frase[] = [
  [[1.5, 74], [0.5, 77], [2, 81]],
  [[1.5, 73], [0.5, 77], [2, 79]],
  [[1, 76], [0.5, 79], [0.5, 76], [2, 72]],
  [[0.5, 74], [0.5, 76], [0.5, 78], [0.5, 81], [2, 84]],
  [[1.5, 83], [0.5, 81], [1, 79], [1, 77]],
  [[1, 74], [0.5, 77], [0.5, 79], [2, 71]],
  [[1, 70], [0.5, 74], [0.5, 77], [1, 79], [0.5, 81], [0.5, 82]],
  [[1, 84], [0.5, 82], [0.5, 79], [2, 76]],
];
/** O tema (1º giro), em Fá; a Sede sobe um tom nos compassos da subida. */
export const TEMA: readonly Frase[] = [...T_A, ...T_VOLTA, ...T_A, ...T_PONTE, ...T_B, ...T_A, ...T_VOLTA];

// ---------- solo (2º giro): frases por regra fixa ----------
const RITMOS: readonly (readonly (readonly [number, boolean])[])[] = [
  [[0.5, true], [0.5, true], [0.5, true], [0.5, true], [0.5, true], [0.5, true], [0.5, true], [0.5, true]],
  [[1, true], [0.5, true], [0.5, true], [1, true], [1, false]],
  [[0.5, false], [0.5, true], [0.5, true], [0.5, true], [1.5, true], [0.5, false]],
  [[1.5, true], [0.5, true], [0.5, true], [0.5, true], [1, true]],
];
const FIM_DE_FRASE: readonly (readonly [number, boolean])[] = [[2, true], [2, false]];
const ESCALA_FA = [5, 7, 9, 10, 0, 2, 4];
const MEL_MIN = 65;
const MEL_MAX = 86;

function maisPerto(de: number, pcs: readonly number[]): number {
  let melhor = de;
  let dist = Infinity;
  for (let m = MEL_MIN; m <= MEL_MAX; m++) {
    if (pcs.includes(m % 12) && Math.abs(m - de) < dist) {
      melhor = m;
      dist = Math.abs(m - de);
    }
  }
  return melhor;
}
function passo(de: number, pcs: readonly number[], dir: number): number {
  for (const d of [dir, -dir]) for (let m = de + d; m >= MEL_MIN && m <= MEL_MAX; m += d) if (pcs.includes(m % 12)) return m;
  return de;
}

/** O "solo" do 2º giro: sempre o mesmo; nota do acorde nos tempos 1 e 3, escala (e o acorde) no meio. */
export function solo(era: number): Frase[] {
  const r = aleatorio(20261011);
  let atual = 72;
  let dir = 1;
  const frases: Frase[] = [];
  for (let c = 0; c < COMPASSOS; c++) {
    const ritmo = c % 8 === 7 ? FIM_DE_FRASE : RITMOS[Math.floor(r() * RITMOS.length)];
    const frase: [number, number | null][] = [];
    let pos = 0;
    for (const [dur, toca] of ritmo) {
      if (toca) {
        const a = acordeEm(era, c, Math.floor(pos));
        const forte = pos === 0 || pos === 2;
        const escala = ESCALA_FA.map((p) => (p + deslocamento(era, c)) % 12);
        atual = forte ? maisPerto(atual, notasDoAcorde(a)) : passo(atual, [...new Set([...escala, ...notasDoAcorde(a)])], dir);
        if (atual >= MEL_MAX - 2) dir = -1;
        else if (atual <= MEL_MIN + 2) dir = 1;
        else if (r() < 0.2) dir = -dir;
        frase.push([dur, atual]);
      } else frase.push([dur, null]);
      pos += dur;
    }
    frases.push(frase);
  }
  return frases;
}

// ---------- baixo, acordes do piano e dos metais ----------
const BAIXO_MIN = 31;
const BAIXO_MAX = 55;
function grave(pc: number, perto: number): number {
  let melhor = BAIXO_MIN;
  let dist = Infinity;
  for (let m = BAIXO_MIN; m <= BAIXO_MAX; m++) {
    if (m % 12 === pc && Math.abs(m - perto) < dist) {
      melhor = m;
      dist = Math.abs(m - perto);
    }
  }
  return melhor;
}
/** Baixo andando: raiz quando o acorde entra, terça e quinta no meio, aproximação de meio tom antes do próximo. */
function linhaDoBaixo(era: number): number[] {
  const notas: number[] = [];
  let ultimo = 41;
  for (let c = 0; c < COMPASSOS; c++) {
    const dois = FORMA[c].length === 2;
    for (let b = 0; b < 4; b++) {
      const a = acordeEm(era, c, b);
      const muda = b === 0 || (dois && b === 2);
      const prox = b === 3 ? acordeEm(era, c + 1, 0) : dois && b === 1 ? acordeEm(era, c, 2) : null;
      let pc: number;
      if (muda) pc = a.raiz;
      else if (prox) pc = (prox.raiz + ((c + b) % 2 === 0 ? 1 : 11)) % 12;
      else pc = (a.raiz + a.intervalos[b === 1 ? 1 : 2]) % 12;
      ultimo = grave(pc, muda ? 40 : ultimo);
      notas.push(ultimo);
    }
  }
  return notas;
}
/** Acorde sem a raiz (o baixo já toca), as notas numa oitava a partir de `min`. */
function voz(a: Acorde, min = 53): number[] {
  return a.intervalos
    .filter((i) => i !== 0)
    .map((i) => min + ((((a.raiz + i) % 12) - (min % 12) + 12) % 12))
    .sort((x, y) => x - y);
}

// ---------- arranjo por era ----------
const INSTRUMENTOS_DA_ERA: readonly (readonly Instrumento[])[] = [
  ['baixo', 'escovinha'],
  ['baixo', 'escovinha', 'piano'],
  ['baixo', 'escovinha', 'piano', 'vibrafone'],
  ['baixo', 'escovinha', 'piano', 'vibrafone', 'conducao', 'bumbo'],
  ['baixo', 'escovinha', 'piano', 'vibrafone', 'conducao', 'bumbo', 'metais', 'caixa'],
  ['baixo', 'escovinha', 'piano', 'vibrafone', 'conducao', 'bumbo', 'metais', 'caixa'],
  ['grave', 'orgao', 'pad', 'ar', 'arpejo'],
  ['grave', 'orgao', 'pad', 'ar', 'arpejo', 'tique'],
];
export const instrumentosDaEra = (era: number): readonly Instrumento[] => INSTRUMENTOS_DA_ERA[eraMusica(era)];

/** Todas as notas de um giro (0 = tema, 1 = solo) da era, ordenadas no tempo. */
export function notasDoGiro(era: number, giro: number): Nota[] {
  const e = eraMusica(era);
  if (e >= 6) return notasEspaco(e as 6 | 7, giro);
  const tem = new Set(instrumentosDaEra(e));
  const out: Nota[] = [];
  const nota = (inst: Instrumento, t: number, dur: number, altura: number, forca: number) => out.push({ inst, t, dur, altura, forca });
  const baixinho = e === 0 ? 0.5 : 1; // antes do CNPJ: tudo mais baixo
  if (tem.has('baixo')) linhaDoBaixo(e).forEach((n, i) => nota('baixo', i, 0.9, n, (i % 4 === 0 ? 0.75 : 0.6) * baixinho));
  for (let c = 0; c < COMPASSOS; c++) {
    const t0 = c * 4;
    const dois = FORMA[c].length === 2;
    if (tem.has('escovinha')) {
      nota('escovinha', t0 + 1, 0.3, 0, 0.45 * baixinho);
      nota('escovinha', t0 + 3, 0.3, 0, 0.45 * baixinho);
      if (e >= 2) nota('escovinha', t0 + swing(3.5), 0.2, 0, 0.2);
    }
    if (tem.has('conducao')) {
      for (const [x, f] of [[0, 0.5], [1, 0.6], [1.5, 0.35], [2, 0.5], [3, 0.6], [3.5, 0.35]] as const) nota('conducao', t0 + swing(x), 0.4, 0, f);
    }
    if (tem.has('bumbo')) {
      nota('bumbo', t0, 0.3, 0, 0.3);
      nota('bumbo', t0 + 2, 0.3, 0, 0.3);
    }
    if (tem.has('caixa')) {
      if (c % 8 === 7) for (const [x, f] of [[3, 0.35], [3 + 1 / 3, 0.45], [3 + 2 / 3, 0.55]] as const) nota('caixa', t0 + x, 0.2, 0, f);
      if (e === 5 && c % 8 === 3) nota('caixa', t0 + swing(1.5), 0.2, 0, 0.4);
    }
    if (tem.has('piano')) {
      const cheio = e >= 3 || (e === 2 && giro === 1);
      const a1 = acordeEm(e, c, 0);
      if (dois) {
        for (const [b, a] of [[0, a1], [2, acordeEm(e, c, 2)]] as const) for (const n of voz(a)) nota('piano', t0 + b, cheio ? 1 : 1.8, n, 0.35);
      } else if (cheio) {
        for (const n of voz(a1)) {
          nota('piano', t0, 0.8, n, 0.4);
          nota('piano', t0 + swing(1.5), 0.5, n, 0.3);
        }
      } else for (const n of voz(a1)) nota('piano', t0, 3.5, n, 0.3);
    }
    if (tem.has('metais')) {
      const hits: number[] = [];
      if (c >= 16 && c < 23 && c % 2 === 0) hits.push(0);
      if (e === 5 && c >= 24 && c < 30 && c % 2 === 0) hits.push(swing(1.5));
      for (const x of hits) for (const n of voz(acordeEm(e, c, Math.floor(x)), 60)) nota('metais', t0 + x, 0.4, n, 0.55);
      if (c === 23) for (const n of voz(acordeEm(e, 24, 0), 60)) nota('metais', t0 + swing(3.5), 0.4, n, 0.6);
    }
  }
  if (tem.has('vibrafone')) {
    const frases = giro === 0 ? TEMA : solo(e);
    frases.forEach((frase, c) => {
      let pos = 0;
      for (const [dur, n] of frase) {
        if (n !== null) {
          const ini = swing(pos);
          nota('vibrafone', c * 4 + ini, swing(pos + dur) - ini, n + (giro === 0 ? deslocamento(e, c) : 0), 0.5);
        }
        pos += dur;
      }
    });
  }
  return out.sort((x, y) => x.t - y.t);
}
