# Fellas Inc.: som — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Música swing original por era, efeitos sonoros e as chaves Música / Efeitos / Avisos nas Configurações da Fellas Inc., tudo sintetizado no navegador.

**Architecture:** Tudo de áudio em `games/idle/audio/`: partitura pura (`musica.ts`), instrumentos sintetizados (`instrumentos.ts`), motor com barramentos e limitador (`motor.ts`), sequenciador com agenda à frente (`sequenciador.ts`), catálogo de efeitos (`efeitos.ts`), sons das mudanças de estado (`eventos.ts`) e a fachada (`index.ts`). O `main.ts` toca os efeitos quando a ação deu certo; a tela emite clique e abrir/fechar. Página de audição em `games/idle/audio/ouvir.html`.

**Tech Stack:** TypeScript, Web Audio API (sem dependência nova), Vite, Vitest + happy-dom (com um contexto de áudio de mentira).

**Spec:** `docs/superpowers/specs/2026-10-11-fellas-inc-som-design.md`

## Global Constraints

- Tudo de áudio numa pasta só: `games/idle/audio/`.
- Sem arquivo de áudio, sem banco, sem migração, sem dependência nova.
- Chaves no aparelho: `fellas:idle-musica`, `fellas:idle-efeitos`, `fellas:idle-avisos` ('0' = desligada), todas começam ligadas; a chave antiga `fellas:idle-som` sai.
- Avisos desligados escondem só o aviso de conquista (e o som dele); erros, a faixa de pó da Bolsa, bolinhas e selos ficam.
- Música: AABA de 32 compassos em Fá, swing de tercina; andamento por era 120/126/132/138/144 (era 0 = antes do CNPJ, no tempo do Quarto); troca de era no fim do giro; 2 giros (tema e solo).
- Efeitos: um por tipo a cada 60 ms; momentos grandes abaixam a música (~−8 dB) e ela volta.
- Áudio só liga no primeiro `pointerdown`/`keydown`; aba escondida = fade e `suspend()`.
- Texto em pt-BR no tom do jogo; Configurações com `role="switch"` + `aria-checked`.
- Suítes: `npx tsc --noEmit`, `npx vitest run --maxWorkers=4` (em games/), `npx tsc --noEmit` e `npx jest` na raiz. Matar o vite da 5199 de verdade no fim.
- Commits sem coautoria/marca de IA.

## Review Focus

- Clicar Máx/comprar sem parar: os sons não empilham nem estouram (limite de 60 ms, limitador no fim). Teste na Task 5.
- iPhone/sistema suspendeu o áudio (ligação, tela travada) e a pessoa toca de novo: volta a tocar. Teste na Task 6 (toque com o contexto suspenso retoma).
- Vender a startup faz a era cair pra 1: não pode tocar o som de "era nova". Teste na Task 6 (`sonsDaMudanca`).
- Desligar Avisos com um aviso de conquista na tela: some na hora. Feito na Task 7 (main zera `conquistaAviso`), conferido no navegador na Task 8.
- Página aberta sem nunca tocar na tela: nada toca e nada quebra (efeitos chamados antes do toque são ignorados). Teste na Task 6.

---

### Task 1: Partitura (`musica.ts`)

**Files:**
- Create: `games/idle/audio/musica.ts`
- Test: `games/idle/audio/musica.test.ts`

**Interfaces:**
- Produces: `type Instrumento`, `type Nota = { inst; t; dur; altura; forca }`, `COMPASSOS`, `BATIDAS_GIRO`, `eraMusica(era)`, `bpm(era)`, `segundosDoGiro(era)`, `swing(t)`, `acorde(cifra)`, `notasDoAcorde(a)`, `acordeEm(era, compasso, batida)`, `FORMA`, `TEMA`, `solo(era)`, `instrumentosDaEra(era)`, `notasDoGiro(era, giro)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import {
  acorde, acordeEm, BATIDAS_GIRO, bpm, COMPASSOS, FORMA, instrumentosDaEra, notasDoAcorde, notasDoGiro, segundosDoGiro,
  solo, swing, TEMA,
} from './musica';

const FAIXA: Partial<Record<string, readonly [number, number]>> = { baixo: [28, 55], piano: [50, 79], vibrafone: [62, 91], metais: [55, 84] };

/** Nos tempos 1 e 3 (posição 0 e 2 do compasso) a melodia está numa nota do acorde. */
function confereFrases(frases: readonly (readonly (readonly [number, number | null])[])[], era: number) {
  expect(frases).toHaveLength(COMPASSOS);
  frases.forEach((frase, c) => {
    expect(frase.reduce((s, [d]) => s + d, 0)).toBe(4);
    let pos = 0;
    for (const [d, n] of frase) {
      if (n !== null && (pos === 0 || pos === 2)) expect(notasDoAcorde(acordeEm(era, c, pos))).toContain(n % 12);
      pos += d;
    }
  });
}

describe('partitura', () => {
  it('forma AABA de 32 compassos, 1 ou 2 acordes por compasso, cifras conhecidas', () => {
    expect(FORMA).toHaveLength(32);
    for (const c of FORMA) {
      expect([1, 2]).toContain(c.length);
      c.forEach((x) => acorde(x));
    }
    expect(FORMA.slice(0, 6)).toEqual(FORMA.slice(8, 14)); // A1 e A2 começam iguais
    expect(FORMA.slice(0, 8)).toEqual(FORMA.slice(24, 32)); // A3 = A1
  });
  it('tema: todo compasso fecha em 4 tempos; nos tempos 1 e 3 a melodia está numa nota do acorde', () => {
    confereFrases(TEMA, 1);
  });
  it('solo (2º giro): as mesmas regras, sempre igual, inclusive com a Sede subindo um tom', () => {
    for (const era of [2, 5]) {
      expect(solo(era)).toEqual(solo(era));
      confereFrases(solo(era), era);
    }
  });
  it('swing de tercina e andamento por era', () => {
    expect(swing(1.5)).toBeCloseTo(1 + 2 / 3);
    expect(swing(2)).toBe(2);
    expect(swing(1 + 1 / 3)).toBeCloseTo(1 + 1 / 3);
    expect([0, 1, 2, 3, 4, 5].map(bpm)).toEqual([120, 120, 126, 132, 138, 144]);
    expect(BATIDAS_GIRO).toBe(128);
    expect(segundosDoGiro(1)).toBe(64);
  });
  it('as notas de cada era: dentro do giro, na faixa de cada instrumento, ordenadas, só instrumentos da era', () => {
    for (let era = 0; era <= 5; era++) {
      for (const giro of [0, 1]) {
        const ns = notasDoGiro(era, giro);
        ns.forEach((n, i) => {
          expect(n.t).toBeGreaterThanOrEqual(0);
          expect(n.t).toBeLessThan(BATIDAS_GIRO);
          expect(n.dur).toBeGreaterThan(0);
          expect(n.forca).toBeGreaterThan(0);
          expect(n.forca).toBeLessThanOrEqual(1);
          if (i) expect(n.t).toBeGreaterThanOrEqual(ns[i - 1].t);
          const f = FAIXA[n.inst];
          if (f) {
            expect(n.altura).toBeGreaterThanOrEqual(f[0]);
            expect(n.altura).toBeLessThanOrEqual(f[1]);
          } else expect(n.altura).toBe(0);
          expect(instrumentosDaEra(era)).toContain(n.inst);
        });
      }
    }
  });
  it('cada era tem pelo menos os instrumentos da anterior; o Quarto não tem melodia, a Garagem tem', () => {
    for (let e = 1; e <= 5; e++) for (const i of instrumentosDaEra(e - 1)) expect(instrumentosDaEra(e)).toContain(i);
    expect(notasDoGiro(1, 0).some((n) => n.inst === 'vibrafone')).toBe(false);
    expect(notasDoGiro(2, 0).some((n) => n.inst === 'vibrafone')).toBe(true);
    expect(instrumentosDaEra(0)).toEqual(['baixo', 'escovinha']);
  });
  it('baixo andando: 4 por compasso, a 1ª do compasso é a raiz', () => {
    const b = notasDoGiro(3, 0).filter((n) => n.inst === 'baixo');
    expect(b).toHaveLength(BATIDAS_GIRO);
    for (let c = 0; c < COMPASSOS; c++) expect(b[c * 4].altura % 12).toBe(acordeEm(3, c, 0).raiz);
  });
  it('Sede: a última A sobe um tom (baixo em Sol no compasso 25) e a volta (compasso 32) fica em Fá', () => {
    const baixo = (era: number, t: number) => notasDoGiro(era, 0).find((n) => n.inst === 'baixo' && n.t === t)!.altura % 12;
    expect(baixo(4, 96)).toBe(5);
    expect(baixo(5, 96)).toBe(7);
    expect(baixo(5, 124)).toBe(7); // Gm7 da volta, sem subir
    expect(baixo(5, 0)).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd games && npx vitest run idle/audio/musica.test.ts`
Expected: FAIL with "Failed to resolve import "./musica""

- [ ] **Step 3: Write the implementation**

```ts
// Partitura da música da Fellas Inc. (só dados e contas, sem áudio): um standard de swing original, AABA de 32
// compassos em Fá, que cresce por era (0 = antes do Abrir CNPJ, 1 Quarto … 5 Sede). Da referência do Juan ("Welcome
// to the Green Room", Toby Fox) só vem o balanço: tercina de swing, baixo andando, prato de condução. Melodia e
// harmonia são daqui.
export type Instrumento = 'baixo' | 'escovinha' | 'conducao' | 'bumbo' | 'caixa' | 'piano' | 'vibrafone' | 'metais';
/** Uma nota do giro: `t` e `dur` em batidas (já com o swing), `altura` MIDI (percussão: 0), `forca` de 0 a 1. */
export type Nota = { inst: Instrumento; t: number; dur: number; altura: number; forca: number };
/** Um compasso de melodia: [duração em tempos, altura MIDI ou null = pausa]. */
export type Frase = readonly (readonly [number, number | null])[];

export const COMPASSOS = 32;
export const BATIDAS_GIRO = COMPASSOS * 4;
const BPM = [120, 120, 126, 132, 138, 144] as const; // índice = era (0 = antes do CNPJ, no tempo do Quarto)
export const eraMusica = (era: number) => Math.max(0, Math.min(5, Math.floor(era)));
export const bpm = (era: number): number => BPM[eraMusica(era)];
export const segundosDoGiro = (era: number) => (BATIDAS_GIRO * 60) / bpm(era);

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

function aleatorio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}
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
];
export const instrumentosDaEra = (era: number): readonly Instrumento[] => INSTRUMENTOS_DA_ERA[eraMusica(era)];

/** Todas as notas de um giro (0 = tema, 1 = solo) da era, ordenadas no tempo. */
export function notasDoGiro(era: number, giro: number): Nota[] {
  const e = eraMusica(era);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd games && npx vitest run idle/audio/musica.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add games/idle/audio/musica.ts games/idle/audio/musica.test.ts
git commit -m "Fellas Inc.: partitura da música (swing AABA original em Fá, arranjo por era, tema e solo)"
```

---

### Task 2: Instrumentos sintetizados (`instrumentos.ts`) e o áudio de mentira dos testes

**Files:**
- Create: `games/idle/audio/instrumentos.ts`
- Create: `games/idle/audio/falso.ts` (só dos testes)
- Test: `games/idle/audio/instrumentos.test.ts`

**Interfaces:**
- Consumes: `type Instrumento` (Task 1).
- Produces: `type Toque = (ctx: BaseAudioContext, destino: AudioNode, t: number, altura: number, dur: number, forca: number) => void`, `hz(m)`, `ruido(ctx)`, `INSTRUMENTOS: Record<Instrumento | 'sininho' | 'moeda', Toque>`; `ContextoFalso`, `ParamFalso`, `OscFalso`, `comoContexto(c)`, `destinoFalso(c)`.

- [ ] **Step 1: Write the fake context**

```ts
// Áudio de mentira pros testes (o happy-dom não tem Web Audio): grava o que foi criado, agendado e ligado. Só dos
// testes: nada do jogo importa isto.
export class ParamFalso {
  value = 0;
  eventos: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) { this.eventos.push(['set', v, t]); this.value = v; return this; }
  linearRampToValueAtTime(v: number, t: number) { this.eventos.push(['lin', v, t]); this.value = v; return this; }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (v <= 0) throw new RangeError('rampa exponencial até 0');
    this.eventos.push(['exp', v, t]);
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number) { this.eventos.push(['alvo', v, t]); this.value = v; return this; }
  cancelScheduledValues(t: number) { this.eventos.push(['cancela', 0, t]); return this; }
}
export class NoFalso {
  ligados: unknown[] = [];
  connect<T>(x: T): T { this.ligados.push(x); return x; }
  disconnect() { this.ligados = []; }
}
export class GanhoFalso extends NoFalso {
  gain = new ParamFalso();
  constructor() { super(); this.gain.value = 1; }
}
export class OscFalso extends NoFalso {
  type = 'sine';
  frequency = new ParamFalso();
  detune = new ParamFalso();
  buffer: unknown = null;
  loop = false;
  inicio: number | null = null;
  fim: number | null = null;
  start(t = 0) { this.inicio = t; }
  stop(t = 0) { this.fim = t; }
}
class FiltroFalso extends NoFalso { type = 'lowpass'; frequency = new ParamFalso(); Q = new ParamFalso(); }
class CompressorFalso extends NoFalso {
  threshold = new ParamFalso(); knee = new ParamFalso(); ratio = new ParamFalso(); attack = new ParamFalso(); release = new ParamFalso();
}
export class ContextoFalso {
  currentTime = 0;
  sampleRate = 8000;
  state: AudioContextState = 'suspended';
  destination = new NoFalso();
  criados: NoFalso[] = [];
  resumidos = 0;
  private novo<T extends NoFalso>(n: T): T { this.criados.push(n); return n; }
  createGain() { return this.novo(new GanhoFalso()); }
  createOscillator() { return this.novo(new OscFalso()); }
  createBufferSource() { return this.novo(new OscFalso()); }
  createBiquadFilter() { return this.novo(new FiltroFalso()); }
  createDynamicsCompressor() { return this.novo(new CompressorFalso()); }
  createBuffer(_canais: number, n: number) { const d = new Float32Array(n); return { length: n, getChannelData: () => d }; }
  resume() { this.resumidos++; this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  osciladores() { return this.criados.filter((n): n is OscFalso => n instanceof OscFalso); }
  ganhos() { return this.criados.filter((n): n is GanhoFalso => n instanceof GanhoFalso); }
}
export const comoContexto = (c: ContextoFalso) => c as unknown as AudioContext;
export const destinoFalso = (c: ContextoFalso) => c.destination as unknown as AudioNode;
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { comoContexto, ContextoFalso, destinoFalso } from './falso';
import { hz, INSTRUMENTOS } from './instrumentos';

describe('instrumentos', () => {
  it('todo instrumento agenda no instante pedido e se desliga sozinho', () => {
    for (const [nome, toque] of Object.entries(INSTRUMENTOS)) {
      const c = new ContextoFalso();
      toque(comoContexto(c), destinoFalso(c), 1, 60, 0.5, 1);
      const os = c.osciladores();
      expect(os.length, nome).toBeGreaterThan(0);
      for (const o of os) {
        expect(o.inicio, nome).toBe(1);
        expect(o.fim!, nome).toBeGreaterThan(1);
        expect(o.fim!, nome).toBeLessThan(4);
      }
    }
  });
  it('volume de cada nota com folga (o limitador é a última defesa, não a primeira)', () => {
    for (const [nome, toque] of Object.entries(INSTRUMENTOS)) {
      const c = new ContextoFalso();
      toque(comoContexto(c), destinoFalso(c), 0, 60, 0.5, 1);
      for (const g of c.ganhos()) for (const [tipo, v] of g.gain.eventos) if (tipo === 'lin') expect(v, nome).toBeLessThanOrEqual(0.5);
    }
  });
  it('hz: Lá 440 e as oitavas', () => {
    expect(hz(69)).toBe(440);
    expect(hz(81)).toBe(880);
    expect(hz(57)).toBe(220);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd games && npx vitest run idle/audio/instrumentos.test.ts`
Expected: FAIL with "Failed to resolve import "./instrumentos""

- [ ] **Step 4: Write the implementation**

```ts
// Os instrumentos da música e dos efeitos, sintetizados na hora (sem arquivo): osciladores, ruído filtrado e
// envelopes. Cada um agenda uma nota em `t` (segundos do contexto) e se desliga sozinho.
import type { Instrumento } from './musica';

export type Toque = (ctx: BaseAudioContext, destino: AudioNode, t: number, altura: number, dur: number, forca: number) => void;
export const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

const ruidos = new WeakMap<BaseAudioContext, AudioBuffer>();
/** 1 s de ruído branco (sempre o mesmo), guardado por contexto. */
export function ruido(ctx: BaseAudioContext): AudioBuffer {
  let b = ruidos.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 1;
    for (let i = 0; i < d.length; i++) {
      s = (s * 16807) % 2147483647;
      d[i] = (s / 2147483647) * 2 - 1;
    }
    ruidos.set(ctx, b);
  }
  return b;
}

/** Ganho com ataque e queda exponencial até quase zero em `dura` segundos. */
function envelope(ctx: BaseAudioContext, destino: AudioNode | AudioParam, t: number, pico: number, ataque: number, dura: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(pico, 0.0002), t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dura, ataque + 0.01));
  g.connect(destino as AudioNode);
  return g;
}
function osc(ctx: BaseAudioContext, tipo: OscillatorType, f: number, destino: AudioNode | AudioParam, t: number, fim: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  o.connect(destino as AudioNode);
  o.start(t);
  o.stop(fim + 0.05);
  return o;
}
function ruidoEm(ctx: BaseAudioContext, destino: AudioNode, t: number, fim: number) {
  const s = ctx.createBufferSource();
  s.buffer = ruido(ctx);
  s.loop = true;
  s.connect(destino);
  s.start(t);
  s.stop(fim + 0.05);
}
function filtro(ctx: BaseAudioContext, tipo: BiquadFilterType, f: number, q: number, destino: AudioNode): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = tipo;
  b.frequency.value = f;
  b.Q.value = q;
  b.connect(destino);
  return b;
}

/** Baixo acústico: triângulo filtrado + seno, ataque de dedo. */
const baixo: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + Math.min(dur, 1.2) + 0.12;
  const g = envelope(ctx, d, t, 0.45 * f, 0.008, fim - t);
  osc(ctx, 'triangle', hz(m), filtro(ctx, 'lowpass', 800, 0.7, g), t, fim);
  osc(ctx, 'sine', hz(m), g, t, fim);
};
/** Piano elétrico: FM (o brilho do ataque cai rápido). */
const piano: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + dur + 0.5;
  const g = envelope(ctx, d, t, 0.13 * f, 0.004, fim - t);
  const portadora = osc(ctx, 'sine', hz(m), g, t, fim);
  const indice = ctx.createGain();
  indice.gain.setValueAtTime(hz(m) * 2.2, t);
  indice.gain.exponentialRampToValueAtTime(hz(m) * 0.2, t + 0.35);
  indice.connect(portadora.frequency);
  osc(ctx, 'sine', hz(m), indice, t, fim);
};
/** Vibrafone: seno com o parcial 4× no ataque e o tremolo do motorzinho. */
const vibrafone: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + dur + 0.9;
  const trem = ctx.createGain();
  trem.gain.setValueAtTime(1, t);
  trem.connect(d);
  const lfo = ctx.createGain();
  lfo.gain.setValueAtTime(0.22, t);
  lfo.connect(trem.gain);
  osc(ctx, 'sine', 5.5, lfo, t, fim);
  osc(ctx, 'sine', hz(m), envelope(ctx, trem, t, 0.2 * f, 0.003, fim - t), t, fim);
  osc(ctx, 'sine', hz(m) * 4, envelope(ctx, trem, t, 0.05 * f, 0.002, 0.25), t, t + 0.25);
};
/** Metais: dois dentes de serra desafinados, o filtro abre no ataque. */
const metais: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + dur + 0.15;
  const g = envelope(ctx, d, t, 0.09 * f, 0.03, fim - t);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(500, t);
  lp.frequency.linearRampToValueAtTime(2600, t + 0.05);
  lp.frequency.exponentialRampToValueAtTime(900, fim);
  lp.connect(g);
  for (const det of [-7, 7]) osc(ctx, 'sawtooth', hz(m), lp, t, fim).detune.setValueAtTime(det, t);
};
const escovinha: Toque = (ctx, d, t, _m, _dur, f) => {
  ruidoEm(ctx, filtro(ctx, 'bandpass', 3500, 0.6, envelope(ctx, d, t, 0.1 * f, 0.025, 0.22)), t, t + 0.25);
};
const conducao: Toque = (ctx, d, t, _m, _dur, f) => {
  ruidoEm(ctx, filtro(ctx, 'highpass', 6500, 0.5, envelope(ctx, d, t, 0.05 * f, 0.002, 0.5)), t, t + 0.5);
  osc(ctx, 'triangle', 3150, envelope(ctx, d, t, 0.015 * f, 0.002, 0.35), t, t + 0.35);
};
const bumbo: Toque = (ctx, d, t, _m, _dur, f) => {
  osc(ctx, 'sine', 115, envelope(ctx, d, t, 0.5 * f, 0.003, 0.3), t, t + 0.3).frequency.exponentialRampToValueAtTime(45, t + 0.12);
};
const caixa: Toque = (ctx, d, t, _m, _dur, f) => {
  ruidoEm(ctx, filtro(ctx, 'bandpass', 1800, 0.8, envelope(ctx, d, t, 0.22 * f, 0.002, 0.15)), t, t + 0.16);
  osc(ctx, 'triangle', 190, envelope(ctx, d, t, 0.08 * f, 0.002, 0.1), t, t + 0.1);
};
/** Só dos efeitos: sininho (sino com o parcial 2,76). */
const sininho: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + dur + 0.5;
  osc(ctx, 'sine', hz(m), envelope(ctx, d, t, 0.16 * f, 0.002, fim - t), t, fim);
  osc(ctx, 'sine', hz(m) * 2.76, envelope(ctx, d, t, 0.05 * f, 0.002, (fim - t) * 0.5), t, fim);
};
/** Só dos efeitos: moedinha de videogame (sobe uma quarta no meio). */
const moeda: Toque = (ctx, d, t, m, _dur, f) => {
  const o = osc(ctx, 'square', hz(m), filtro(ctx, 'lowpass', 3500, 0.7, envelope(ctx, d, t, 0.07 * f, 0.002, 0.28)), t, t + 0.28);
  o.frequency.setValueAtTime(hz(m + 5), t + 0.06);
};

export const INSTRUMENTOS: Record<Instrumento | 'sininho' | 'moeda', Toque> = {
  baixo, piano, vibrafone, metais, escovinha, conducao, bumbo, caixa, sininho, moeda,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd games && npx vitest run idle/audio/instrumentos.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add games/idle/audio/instrumentos.ts games/idle/audio/falso.ts games/idle/audio/instrumentos.test.ts
git commit -m "Fellas Inc.: instrumentos sintetizados (baixo, piano elétrico, vibrafone, metais, bateria, sininho, moeda)"
```

---

### Task 3: Motor (`motor.ts`)

**Files:**
- Create: `games/idle/audio/motor.ts`
- Test: `games/idle/audio/motor.test.ts`

**Interfaces:**
- Consumes: `ContextoFalso`, `comoContexto`, `ParamFalso` (Task 2, só no teste).
- Produces: `VOL_MUSICA`, `VOL_EFEITOS`, `type Saida = { musica: GainNode; efeitos: GainNode; geral: GainNode }`, `montarSaida(ctx)`, `type Motor = { ligar(); ligado(); ctx(); saida(); musica(ligada); visivel(sim); abaixarMusica(segundos) }`, `criarMotor(fabrica: () => AudioContext): Motor`.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { comoContexto, ContextoFalso, type ParamFalso } from './falso';
import { criarMotor, VOL_MUSICA } from './motor';

const volume = (m: ReturnType<typeof criarMotor>) => (m.saida()!.musica.gain as unknown as ParamFalso);

afterEach(() => vi.useRealTimers());

describe('motor', () => {
  it('nada antes do primeiro toque; ligar cria o contexto uma vez e retoma', () => {
    let criados = 0;
    const c = new ContextoFalso();
    const m = criarMotor(() => {
      criados++;
      return comoContexto(c);
    });
    expect(m.ligado()).toBe(false);
    expect(m.ctx()).toBeNull();
    m.ligar();
    m.ligar();
    expect(criados).toBe(1);
    expect(c.state).toBe('running');
    expect(volume(m).value).toBe(VOL_MUSICA); // entrou com fade
  });
  it('aba escondida: a música apaga e o contexto suspende; voltou, retoma e a música volta', () => {
    vi.useFakeTimers();
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    m.visivel(false);
    expect(volume(m).value).toBe(0);
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('suspended');
    m.visivel(true);
    expect(c.state).toBe('running');
    expect(volume(m).value).toBe(VOL_MUSICA);
  });
  it('voltou antes do suspend: não suspende', () => {
    vi.useFakeTimers();
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    m.visivel(false);
    m.visivel(true);
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('running');
  });
  it('música desligada: volume vai a zero e abaixar não mexe nela', () => {
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    m.musica(false);
    expect(volume(m).value).toBe(0);
    m.abaixarMusica(2);
    expect(volume(m).value).toBe(0);
  });
  it('momento grande: a música abaixa (~−8 dB) e volta depois de `segundos`', () => {
    const c = new ContextoFalso();
    const m = criarMotor(() => comoContexto(c));
    m.ligar();
    c.currentTime = 10;
    m.abaixarMusica(2);
    const alvos = volume(m).eventos.filter((e) => e[0] === 'alvo');
    expect(alvos.at(-2)).toEqual(['alvo', VOL_MUSICA * 0.4, 10]);
    expect(alvos.at(-1)).toEqual(['alvo', VOL_MUSICA, 12]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd games && npx vitest run idle/audio/motor.test.ts`
Expected: FAIL with "Failed to resolve import "./motor""

- [ ] **Step 3: Write the implementation**

```ts
// Motor de áudio: o contexto (criado no 1º toque: o navegador não deixa antes), os barramentos música / efeitos /
// geral até o limitador, o fade com a aba e o "abaixa a música" dos momentos grandes.
export const VOL_MUSICA = 0.32;
export const VOL_EFEITOS = 0.8;
const ABAIXADA = 0.4; // ~−8 dB

export type Saida = { musica: GainNode; efeitos: GainNode; geral: GainNode };

/** A cadeia de saída (também usada no render offline da página de audição). */
export function montarSaida(ctx: BaseAudioContext): Saida {
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -10;
  lim.knee.value = 6;
  lim.ratio.value = 12;
  lim.attack.value = 0.003;
  lim.release.value = 0.25;
  lim.connect(ctx.destination);
  const geral = ctx.createGain();
  geral.gain.value = 0.9;
  geral.connect(lim);
  const musica = ctx.createGain();
  musica.gain.value = VOL_MUSICA;
  musica.connect(geral);
  const efeitos = ctx.createGain();
  efeitos.gain.value = VOL_EFEITOS;
  efeitos.connect(geral);
  return { musica, efeitos, geral };
}

export type Motor = {
  /** Cria (ou retoma) o contexto: só funciona dentro de um toque/tecla. */
  ligar(): void;
  ligado(): boolean;
  ctx(): BaseAudioContext | null;
  saida(): Saida | null;
  /** Chave da música (o volume segue chave + aba visível). */
  musica(ligada: boolean): void;
  visivel(sim: boolean): void;
  abaixarMusica(segundos: number): void;
};

export function criarMotor(fabrica: () => AudioContext): Motor {
  let ctx: AudioContext | null = null;
  let s: Saida | null = null;
  let musicaLigada = true;
  let aVista = true;
  const alvo = () => (musicaLigada && aVista ? VOL_MUSICA : 0);
  const fade = (segundos: number) => {
    if (!ctx || !s) return;
    const g = s.musica.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(alvo(), t, segundos / 3);
  };
  return {
    ligar() {
      if (!ctx) {
        ctx = fabrica();
        s = montarSaida(ctx);
        s.musica.gain.value = 0;
      }
      if (ctx.state !== 'running') void ctx.resume();
      fade(1.5);
    },
    ligado: () => ctx !== null,
    ctx: () => ctx,
    saida: () => s,
    musica(ligada) {
      musicaLigada = ligada;
      fade(ligada ? 1.5 : 0.4);
    },
    visivel(sim) {
      aVista = sim;
      if (!ctx) return;
      const c = ctx;
      if (sim) {
        void c.resume();
        fade(1.5);
      } else {
        fade(0.3);
        setTimeout(() => {
          if (!aVista) void c.suspend();
        }, 350);
      }
    },
    abaixarMusica(segundos) {
      if (!ctx || !s || alvo() === 0) return;
      const g = s.musica.gain;
      const t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(VOL_MUSICA * ABAIXADA, t, 0.05);
      g.setTargetAtTime(alvo(), t + segundos, 0.3);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd games && npx vitest run idle/audio/motor.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add games/idle/audio/motor.ts games/idle/audio/motor.test.ts
git commit -m "Fellas Inc.: motor de áudio (contexto no 1º toque, barramentos, limitador, aba e abaixar a música)"
```

---

### Task 4: Sequenciador (`sequenciador.ts`)

**Files:**
- Create: `games/idle/audio/sequenciador.ts`
- Test: `games/idle/audio/sequenciador.test.ts`

**Interfaces:**
- Consumes: `notasDoGiro`, `bpm`, `eraMusica`, `BATIDAS_GIRO`, `type Nota`, `type Instrumento` (Task 1); `INSTRUMENTOS`, `type Toque` (Task 2).
- Produces: `type Fonte = { ctx(): BaseAudioContext | null; destino(): AudioNode | null }`, `type Sequenciador = { tocar(era); mudarEra(era); parar(); tocando(); passo() }`, `criarSequenciador(f, opcoes?: { notas?; toques?; relogio?: boolean })`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { comoContexto, ContextoFalso, destinoFalso } from './falso';
import type { Toque } from './instrumentos';
import type { Instrumento, Nota } from './musica';
import { criarSequenciador } from './sequenciador';

function montar(comCtx = true) {
  const c = new ContextoFalso();
  c.state = 'running';
  const tocadas: { inst: string; t: number }[] = [];
  const nomes: Instrumento[] = ['baixo', 'escovinha', 'conducao', 'bumbo', 'caixa', 'piano', 'vibrafone', 'metais'];
  const toques = Object.fromEntries(nomes.map((k) => [k, ((_c, _d, t) => tocadas.push({ inst: k, t })) as Toque])) as Record<Instrumento, Toque>;
  const giros: [number, number][] = [];
  const notas = (era: number, giro: number): Nota[] => {
    giros.push([era, giro]);
    return [{ inst: 'baixo', t: 0, dur: 1, altura: 41, forca: 1 }, { inst: 'baixo', t: 64, dur: 1, altura: 41, forca: 1 }];
  };
  const s = criarSequenciador({ ctx: () => (comCtx ? comoContexto(c) : null), destino: () => destinoFalso(c) }, { notas, toques, relogio: false });
  return { c, s, tocadas, giros };
}

describe('sequenciador', () => {
  it('agenda só o que cai na janela à frente (no relógio do áudio)', () => {
    const { c, s, tocadas } = montar();
    c.currentTime = 10;
    s.tocar(1); // 120 bpm: 0,5 s por batida; começa 0,1 s à frente
    expect(tocadas).toEqual([{ inst: 'baixo', t: 10.1 }]);
    c.currentTime = 42.05;
    s.passo();
    expect(tocadas).toHaveLength(2);
    expect(tocadas[1].t).toBeCloseTo(42.1);
  });
  it('troca de era só no fim do giro, alternando tema (0) e solo (1)', () => {
    const { c, s, giros } = montar();
    s.tocar(1);
    s.mudarEra(3);
    c.currentTime = 50;
    s.passo();
    expect(giros).toEqual([[1, 0]]);
    c.currentTime = 64.05;
    s.passo();
    expect(giros).toEqual([[1, 0], [3, 1]]);
  });
  it('tocar de novo com a música já tocando só marca a era nova (não reinicia)', () => {
    const { s, giros } = montar();
    s.tocar(1);
    s.tocar(4);
    expect(giros).toEqual([[1, 0]]);
    expect(s.tocando()).toBe(true);
  });
  it('depois de um engasgo não despeja as notas atrasadas de uma vez', () => {
    const { c, s, tocadas } = montar();
    s.tocar(1);
    c.currentTime = 40; // a nota de 32,1 s passou faz 7,9 s
    s.passo();
    expect(tocadas).toHaveLength(1);
  });
  it('parado não agenda nada; sem contexto nem começa', () => {
    const a = montar();
    a.s.tocar(1);
    a.s.parar();
    a.c.currentTime = 32.05;
    a.s.passo();
    expect(a.tocadas).toHaveLength(1);
    const b = montar(false);
    b.s.tocar(1);
    expect(b.s.tocando()).toBe(false);
    expect(b.tocadas).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd games && npx vitest run idle/audio/sequenciador.test.ts`
Expected: FAIL with "Failed to resolve import "./sequenciador""

- [ ] **Step 3: Write the implementation**

```ts
// Toca a partitura: agenda as notas um pouco à frente no relógio do áudio (o setInterval só acorda; quem marca o tempo
// é o contexto) e troca de era no fim do giro, alternando o tema e o solo.
import { INSTRUMENTOS, type Toque } from './instrumentos';
import { BATIDAS_GIRO, bpm, eraMusica, notasDoGiro, type Instrumento, type Nota } from './musica';

export const ADIANTE_S = 0.12;
export const PASSO_MS = 25;
const ATRASO_MAX_S = 0.1; // nota que já passou disso fica de fora (não sai tudo junto depois de um engasgo)

export type Fonte = { ctx(): BaseAudioContext | null; destino(): AudioNode | null };
export type Sequenciador = { tocar(era: number): void; mudarEra(era: number): void; parar(): void; tocando(): boolean; passo(): void };

export function criarSequenciador(
  f: Fonte,
  opcoes: { notas?: (era: number, giro: number) => Nota[]; toques?: Record<Instrumento, Toque>; relogio?: boolean } = {},
): Sequenciador {
  const notas = opcoes.notas ?? notasDoGiro;
  const toques = opcoes.toques ?? INSTRUMENTOS;
  let ativo = false;
  let era = 1;
  let eraNova = 1;
  let giro = 0;
  let inicio = 0;
  let lista: Nota[] = [];
  let i = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const spb = () => 60 / bpm(era);

  function passo() {
    const ctx = f.ctx();
    const dest = f.destino();
    if (!ativo || !ctx || !dest) return;
    const agora = ctx.currentTime;
    const ate = agora + ADIANTE_S;
    for (;;) {
      while (i < lista.length && inicio + lista[i].t * spb() < ate) {
        const n = lista[i++];
        const quando = inicio + n.t * spb();
        if (quando < agora - ATRASO_MAX_S) continue;
        toques[n.inst](ctx, dest, Math.max(quando, agora), n.altura, n.dur * spb(), n.forca);
      }
      const fim = inicio + BATIDAS_GIRO * spb();
      if (i < lista.length || fim >= ate) break;
      inicio = fim;
      giro = 1 - giro;
      era = eraNova;
      lista = notas(era, giro);
      i = 0;
    }
  }

  return {
    tocar(e) {
      if (ativo) {
        eraNova = eraMusica(e);
        return;
      }
      const ctx = f.ctx();
      if (!ctx) return;
      era = eraNova = eraMusica(e);
      ativo = true;
      giro = 0;
      lista = notas(era, giro);
      i = 0;
      inicio = ctx.currentTime + 0.1;
      passo();
      if (opcoes.relogio !== false) timer = setInterval(passo, PASSO_MS);
    },
    mudarEra(e) {
      eraNova = eraMusica(e);
    },
    parar() {
      ativo = false;
      if (timer) clearInterval(timer);
      timer = null;
    },
    tocando: () => ativo,
    passo,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd games && npx vitest run idle/audio/sequenciador.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add games/idle/audio/sequenciador.ts games/idle/audio/sequenciador.test.ts
git commit -m "Fellas Inc.: sequenciador da música (agenda à frente, troca de era no fim do giro)"
```

---

### Task 5: Catálogo de efeitos (`efeitos.ts`)

**Files:**
- Create: `games/idle/audio/efeitos.ts`
- Test: `games/idle/audio/efeitos.test.ts`

**Interfaces:**
- Consumes: `INSTRUMENTOS`, `hz`, `ruido` (Task 2).
- Produces: `IDS_EFEITOS`, `type IdEfeito`, `type OpcoesEfeito = { quantas?: number; lucro?: boolean }`, `GRANDES`, `INTERVALO_MS`, `RECEITAS: Record<IdEfeito, (ctx, destino, t, o) => number>`, `criarLimite(ms?) => (id, agoraMs) => boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { criarLimite, GRANDES, IDS_EFEITOS, RECEITAS, type IdEfeito, type OpcoesEfeito } from './efeitos';
import { comoContexto, ContextoFalso, destinoFalso } from './falso';

const tocar = (id: IdEfeito, o: OpcoesEfeito = {}) => {
  const c = new ContextoFalso();
  const dura = RECEITAS[id](comoContexto(c), destinoFalso(c), 1, o);
  return { c, dura };
};

describe('efeitos', () => {
  it('todos os momentos da spec têm receita; cada uma agenda, se desliga e diz quanto dura', () => {
    expect([...IDS_EFEITOS].sort()).toEqual(
      ['abrir', 'acaoCompra', 'acaoVende', 'cnpj', 'clique', 'compra', 'compraMuitas', 'conquista', 'contratado', 'dourado',
        'douradoPego', 'era', 'erro', 'fechar', 'no', 'oportunidade', 'pegar', 'po', 'venda'].sort(),
    );
    for (const id of IDS_EFEITOS) {
      const { c, dura } = tocar(id);
      expect(c.osciladores().length, id).toBeGreaterThan(0);
      expect(dura, id).toBeGreaterThan(0);
      expect(dura, id).toBeLessThan(3);
      for (const o of c.osciladores()) expect(o.fim!, id).toBeLessThan(1 + 4);
    }
  });
  it('mais compras, cascata maior (de 3 a 8 moedas)', () => {
    const moedas = (quantas: number) => tocar('compraMuitas', { quantas }).c.osciladores().length;
    expect(moedas(10)).toBeLessThan(moedas(1000));
    expect(moedas(1)).toBe(3);
    expect(moedas(1e9)).toBe(8);
  });
  it('vender com lucro e com prejuízo soam diferente', () => {
    const notas = (lucro: boolean) => tocar('acaoVende', { lucro }).c.osciladores().map((o) => o.frequency.eventos[0][1]);
    expect(notas(true)).not.toEqual(notas(false));
  });
  it('limite: o mesmo efeito no máximo a cada 60 ms; outro efeito não espera', () => {
    const pode = criarLimite();
    expect(pode('clique', 0)).toBe(true);
    expect(pode('clique', 30)).toBe(false);
    expect(pode('compra', 30)).toBe(true);
    expect(pode('clique', 60)).toBe(true);
  });
  it('momentos grandes', () => {
    expect([...GRANDES].sort()).toEqual(['cnpj', 'conquista', 'douradoPego', 'era', 'venda']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd games && npx vitest run idle/audio/efeitos.test.ts`
Expected: FAIL with "Failed to resolve import "./efeitos""

- [ ] **Step 3: Write the implementation**

```ts
// Catálogo dos efeitos (a tabela da spec), afinados em Fá como a música. Cada receita agenda as notas a partir de `t`
// e devolve quanto dura (pro "abaixa a música" dos momentos grandes).
import { hz, INSTRUMENTOS, ruido } from './instrumentos';

export const IDS_EFEITOS = [
  'compra', 'compraMuitas', 'no', 'acaoCompra', 'acaoVende', 'conquista', 'era', 'venda', 'contratado', 'po', 'oportunidade',
  'pegar', 'cnpj', 'erro', 'clique', 'abrir', 'fechar', 'dourado', 'douradoPego',
] as const;
export type IdEfeito = (typeof IDS_EFEITOS)[number];
export type OpcoesEfeito = { quantas?: number; lucro?: boolean };
/** Momentos grandes: a música abaixa enquanto tocam. */
export const GRANDES: ReadonlySet<IdEfeito> = new Set<IdEfeito>(['conquista', 'era', 'venda', 'cnpj', 'douradoPego']);
export const INTERVALO_MS = 60;

type Receita = (ctx: BaseAudioContext, d: AudioNode, t: number, o: OpcoesEfeito) => number;
const { sininho, moeda, vibrafone, metais, caixa, bumbo, piano } = INSTRUMENTOS;
const PENTA = [77, 79, 81, 84, 86, 89, 91, 93]; // Fá maior pentatônica, de cima
const FA6_PIANO = [57, 60, 62]; // Lá, Dó, Ré

function acorde(ctx: BaseAudioContext, d: AudioNode, t: number, notas: number[], dur: number, forca: number, toque = metais) {
  for (const n of notas) toque(ctx, d, t, n, dur, forca);
}
/** Ruído curto filtrado: clique (passa-alta) ou "fuu" (passa-banda que corre de `de` até `ate`). */
function ruidoFiltrado(ctx: BaseAudioContext, d: AudioNode, t: number, tipo: BiquadFilterType, de: number, ate: number, dura: number, pico: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(pico, t + Math.min(0.004, dura / 4) + (tipo === 'bandpass' ? dura * 0.4 : 0));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
  g.connect(d);
  const f = ctx.createBiquadFilter();
  f.type = tipo;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(de, t);
  f.frequency.exponentialRampToValueAtTime(ate, t + dura);
  f.connect(g);
  const s = ctx.createBufferSource();
  s.buffer = ruido(ctx);
  s.loop = true;
  s.connect(f);
  s.start(t);
  s.stop(t + dura + 0.05);
}

export const RECEITAS: Record<IdEfeito, Receita> = {
  compra: (c, d, t) => {
    moeda(c, d, t, 84, 0.2, 0.9);
    return 0.3;
  },
  compraMuitas: (c, d, t, o) => {
    const n = Math.min(8, Math.max(3, Math.floor(Math.log2(Math.max(1, o.quantas ?? 10))) + 2));
    for (let i = 0; i < n; i++) moeda(c, d, t + i * 0.055, PENTA[i], 0.15, 0.8);
    return n * 0.055 + 0.3;
  },
  no: (c, d, t) => {
    [65, 69, 72, 76].forEach((m, i) => vibrafone(c, d, t + i * 0.07, m, 0.5, 0.8));
    sininho(c, d, t + 0.28, 81, 0.4, 0.6);
    return 1.2;
  },
  acaoCompra: (c, d, t) => {
    caixa(c, d, t, 0, 0.1, 0.5);
    sininho(c, d, t + 0.05, 88, 0.15, 0.7);
    sininho(c, d, t + 0.12, 93, 0.3, 0.6);
    return 0.8;
  },
  acaoVende: (c, d, t, o) => {
    if (o.lucro === false) {
      sininho(c, d, t, 76, 0.1, 0.6);
      sininho(c, d, t + 0.1, 72, 0.15, 0.5);
      return 0.6;
    }
    sininho(c, d, t, 81, 0.12, 0.7);
    sininho(c, d, t + 0.1, 88, 0.35, 0.8);
    return 0.9;
  },
  conquista: (c, d, t) => {
    acorde(c, d, t, [65, 69, 72], 0.14, 0.8);
    acorde(c, d, t + 0.18, [69, 72, 77], 0.5, 0.9);
    sininho(c, d, t + 0.18, 89, 0.4, 0.5);
    return 1.0;
  },
  era: (c, d, t) => {
    [0, 0.08, 0.16, 0.24].forEach((x, i) => caixa(c, d, t + x, 0, 0.1, 0.4 + i * 0.12));
    bumbo(c, d, t + 0.32, 0, 0.3, 0.9);
    acorde(c, d, t + 0.32, [65, 69, 72, 77], 1, 0.9);
    acorde(c, d, t + 0.32, FA6_PIANO, 1.2, 0.6, piano);
    return 1.8;
  },
  venda: (c, d, t) => {
    acorde(c, d, t, [60, 64, 67, 70], 0.22, 0.8);
    acorde(c, d, t + 0.3, [62, 65, 69, 72], 0.22, 0.85);
    [0.5, 0.54, 0.58].forEach((x) => caixa(c, d, t + x, 0, 0.1, 0.5));
    acorde(c, d, t + 0.6, [65, 69, 72, 77], 1.3, 1);
    sininho(c, d, t + 0.6, 89, 0.5, 0.6);
    sininho(c, d, t + 0.75, 96, 0.6, 0.5);
    return 2.3;
  },
  contratado: (c, d, t) => {
    sininho(c, d, t, 81, 0.25, 0.8);
    sininho(c, d, t + 0.25, 77, 0.5, 0.8);
    return 1.2;
  },
  po: (c, d, t) => {
    [70, 69, 68].forEach((m, i) => metais(c, d, t + i * 0.32, m, 0.26, 0.7));
    metais(c, d, t + 0.96, 67, 0.9, 0.7);
    return 2.1;
  },
  oportunidade: (c, d, t) => {
    sininho(c, d, t, 84, 0.2, 0.5);
    return 0.7;
  },
  pegar: (c, d, t) => {
    [84, 88, 91, 96].forEach((m, i) => sininho(c, d, t + i * 0.05, m, 0.15, 0.7));
    return 0.9;
  },
  cnpj: (c, d, t) => {
    acorde(c, d, t, FA6_PIANO, 1.2, 0.8, piano);
    acorde(c, d, t, [65, 69, 72], 0.8, 0.8);
    bumbo(c, d, t + 0.5, 0, 0.3, 1);
    caixa(c, d, t + 0.5, 0, 0.15, 0.9);
    return 1.6;
  },
  erro: (c, d, t) => {
    bumbo(c, d, t, 0, 0.2, 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    g.connect(d);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.connect(g);
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(hz(43), t);
    o.frequency.exponentialRampToValueAtTime(hz(38), t + 0.12);
    o.connect(lp);
    o.start(t);
    o.stop(t + 0.16);
    return 0.3;
  },
  clique: (c, d, t) => {
    ruidoFiltrado(c, d, t, 'highpass', 2500, 2500, 0.03, 0.04);
    return 0.05;
  },
  abrir: (c, d, t) => {
    ruidoFiltrado(c, d, t, 'bandpass', 600, 2400, 0.18, 0.04);
    return 0.2;
  },
  fechar: (c, d, t) => {
    ruidoFiltrado(c, d, t, 'bandpass', 2400, 600, 0.18, 0.04);
    return 0.2;
  },
  dourado: (c, d, t) => {
    [77, 81, 84, 89, 93, 96].forEach((m, i) => sininho(c, d, t + i * 0.07, m, 0.2, 0.75));
    [96, 98, 96, 98, 96].forEach((m, i) => sininho(c, d, t + 0.45 + i * 0.06, m, 0.1, 0.35));
    return 1.3;
  },
  douradoPego: (c, d, t) => {
    acorde(c, d, t, [69, 72, 77], 0.5, 0.9);
    [89, 93, 96, 101].forEach((m, i) => sininho(c, d, t + i * 0.05, m, 0.2, 0.7));
    return 1.1;
  },
};

/** Cada efeito no máximo a cada `ms` (clicar rápido não empilha som). */
export function criarLimite(ms = INTERVALO_MS) {
  const ultimo = new Map<IdEfeito, number>();
  return (id: IdEfeito, agoraMs: number): boolean => {
    const u = ultimo.get(id);
    if (u !== undefined && agoraMs - u < ms) return false;
    ultimo.set(id, agoraMs);
    return true;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd games && npx vitest run idle/audio/efeitos.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add games/idle/audio/efeitos.ts games/idle/audio/efeitos.test.ts
git commit -m "Fellas Inc.: catálogo dos efeitos sonoros (compras, momentos grandes, oportunidade, interface, dourado)"
```

---

### Task 6: Fachada (`index.ts`) e os sons das mudanças (`eventos.ts`)

**Files:**
- Create: `games/idle/audio/index.ts`
- Create: `games/idle/audio/eventos.ts`
- Test: `games/idle/audio/index.test.ts`
- Test: `games/idle/audio/eventos.test.ts`

**Interfaces:**
- Consumes: `criarMotor` (Task 3), `criarSequenciador` (Task 4), `RECEITAS`, `GRANDES`, `criarLimite`, `IdEfeito`, `OpcoesEfeito` (Task 5).
- Produces: `type ChavesSom = { musica: boolean; efeitos: boolean }`, `type Audio = { tocar(id, o?); era(era); chaves(c) }`, `criarAudio(fabrica?, alvo?: Document): Audio`; `sonsDaMudanca(antes: IdleState | null, depois: IdleState): IdEfeito[]`, `quantasCompradas(antes, depois, tipo, id): number`.

- [ ] **Step 1: Write the failing tests**

`games/idle/audio/eventos.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { IdleState } from '../../shared/types';
import { quantasCompradas, sonsDaMudanca } from './eventos';

const estado = (x: Partial<IdleState> = {}) => ({ user_id: 'u', era: 2, chefes: [], generators: [5, 2, 0], ...x }) as unknown as IdleState;

describe('sons das mudanças de estado', () => {
  it('primeira carga não toca nada', () => {
    expect(sonsDaMudanca(null, estado({ era: 3 }))).toEqual([]);
  });
  it('era nova toca; vender a startup (era volta pra 1) não toca "era"', () => {
    expect(sonsDaMudanca(estado({ era: 2 }), estado({ era: 3 }))).toEqual(['era']);
    expect(sonsDaMudanca(estado({ era: 4 }), estado({ era: 1 }))).toEqual([]);
  });
  it('chefe novo = alguém te contratou; chefe que já estava não toca de novo', () => {
    const b = { user_id: 'b', cargo: 'sócio', mult: 1, ate: 'x' };
    expect(sonsDaMudanca(estado(), estado({ chefes: [b] } as Partial<IdleState>))).toEqual(['contratado']);
    expect(sonsDaMudanca(estado({ chefes: [b] } as Partial<IdleState>), estado({ chefes: [b] } as Partial<IdleState>))).toEqual([]);
  });
  it('quantas unidades a compra levou (gerador); melhoria e sem antes = 1', () => {
    expect(quantasCompradas(estado(), estado({ generators: [15, 2, 0] }), 'gerador', 1)).toBe(10);
    expect(quantasCompradas(null, estado(), 'gerador', 1)).toBe(1);
    expect(quantasCompradas(estado(), estado(), 'melhoria', 3)).toBe(1);
  });
});
```

`games/idle/audio/index.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { comoContexto, ContextoFalso, type ParamFalso } from './falso';
import { criarAudio } from './index';

afterEach(() => vi.useRealTimers());

function montar() {
  const c = new ContextoFalso();
  const doc = document.implementation.createHTMLDocument('x');
  const audio = criarAudio(() => comoContexto(c), doc);
  const tocar = () => doc.dispatchEvent(new Event('pointerdown'));
  return { c, audio, tocar };
}

describe('som da Fellas Inc.', () => {
  it('antes do primeiro toque: efeito não toca e nada quebra', () => {
    const { c, audio } = montar();
    audio.tocar('compra');
    expect(c.criados).toHaveLength(0);
  });
  it('depois do toque: efeito toca; efeitos desligados não', () => {
    const { c, audio, tocar } = montar();
    audio.chaves({ musica: false, efeitos: true });
    tocar();
    const antes = c.osciladores().length;
    audio.tocar('compra');
    expect(c.osciladores().length).toBeGreaterThan(antes);
    audio.chaves({ musica: false, efeitos: false });
    const depois = c.osciladores().length;
    audio.tocar('pegar');
    expect(c.osciladores().length).toBe(depois);
  });
  it('clicar rápido não empilha o mesmo efeito', () => {
    const { c, audio, tocar } = montar();
    audio.chaves({ musica: false, efeitos: true });
    tocar();
    audio.tocar('clique');
    const um = c.osciladores().length;
    audio.tocar('clique');
    expect(c.osciladores().length).toBe(um);
  });
  it('música ligada agenda notas depois do toque; desligada não agenda nada', () => {
    vi.useFakeTimers();
    const a = montar();
    a.audio.era(1);
    a.tocar();
    vi.advanceTimersByTime(100);
    expect(a.c.osciladores().length).toBeGreaterThan(0);
    const b = montar();
    b.audio.chaves({ musica: false, efeitos: true });
    b.tocar();
    vi.advanceTimersByTime(100);
    expect(b.c.osciladores()).toHaveLength(0);
  });
  it('o sistema suspendeu o áudio (ligação, tela travada): o próximo toque retoma', () => {
    const { c, tocar } = montar();
    tocar();
    expect(c.resumidos).toBe(1);
    tocar(); // já tocando: não faz nada
    expect(c.resumidos).toBe(1);
    c.state = 'suspended';
    tocar();
    expect(c.resumidos).toBe(2);
    expect(c.state).toBe('running');
  });
  it('momento grande abaixa a música', () => {
    const { c, audio, tocar } = montar();
    tocar();
    audio.tocar('conquista');
    const musica = c.ganhos().find((g) => (g.gain as ParamFalso).eventos.some((e) => e[0] === 'alvo' && e[1] < 0.32 && e[1] > 0))!;
    expect(musica).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd games && npx vitest run idle/audio/eventos.test.ts idle/audio/index.test.ts`
Expected: FAIL with "Failed to resolve import "./eventos"" and "./index"

- [ ] **Step 3: Write the implementations**

`games/idle/audio/eventos.ts`:

```ts
// Sons que a chegada de um estado novo pede: o que mudou sem ser um clique seu (era nova, alguém te contratou), e o
// tamanho de uma compra (pra cascata de moedas).
import type { IdleState } from '../../shared/types';
import type { IdEfeito } from './efeitos';

export function sonsDaMudanca(antes: IdleState | null, depois: IdleState): IdEfeito[] {
  if (!antes || antes.user_id !== depois.user_id) return [];
  const sons: IdEfeito[] = [];
  if (depois.era > antes.era) sons.push('era'); // vender a startup volta a era: isso tem o som da venda
  const chefes = new Set(antes.chefes.map((c) => c.user_id));
  if (depois.chefes.some((c) => !chefes.has(c.user_id))) sons.push('contratado');
  return sons;
}

export function quantasCompradas(antes: IdleState | null, depois: IdleState, tipo: 'gerador' | 'melhoria', id: number): number {
  if (!antes || tipo !== 'gerador') return 1;
  return Math.max(1, (depois.generators[id - 1] ?? 0) - (antes.generators[id - 1] ?? 0));
}
```

`games/idle/audio/index.ts`:

```ts
// O som da Fellas Inc. pro resto do jogo: liga no 1º toque (e retoma se o sistema suspendeu), segue as chaves, a aba
// e a era, e toca os efeitos.
import { criarLimite, GRANDES, RECEITAS, type IdEfeito, type OpcoesEfeito } from './efeitos';
import { criarMotor } from './motor';
import { criarSequenciador } from './sequenciador';

export type { IdEfeito, OpcoesEfeito } from './efeitos';
export type ChavesSom = { musica: boolean; efeitos: boolean };
export type Audio = {
  tocar(id: IdEfeito, o?: OpcoesEfeito): void;
  /** Era da música (0 = antes do Abrir CNPJ); troca no fim do giro. */
  era(era: number): void;
  chaves(c: ChavesSom): void;
};

export function criarAudio(fabrica: () => AudioContext = () => new AudioContext(), alvo: Document = document): Audio {
  const motor = criarMotor(fabrica);
  const seq = criarSequenciador({ ctx: motor.ctx, destino: () => motor.saida()?.musica ?? null });
  const limite = criarLimite();
  let chaves: ChavesSom = { musica: true, efeitos: true };
  let eraAtual = 0;
  const ajustarMusica = () => {
    motor.musica(chaves.musica);
    if (!chaves.musica) seq.parar();
    else if (motor.ligado() && !alvo.hidden) seq.tocar(eraAtual);
  };
  const toque = () => {
    if (motor.ctx()?.state === 'running') return;
    motor.ligar();
    ajustarMusica();
  };
  alvo.addEventListener('pointerdown', toque);
  alvo.addEventListener('keydown', toque);
  alvo.addEventListener('visibilitychange', () => {
    motor.visivel(!alvo.hidden);
    if (!alvo.hidden) ajustarMusica();
  });
  return {
    tocar(id, o = {}) {
      const ctx = motor.ctx();
      const s = motor.saida();
      if (!chaves.efeitos || !ctx || !s || ctx.state !== 'running') return;
      if (!limite(id, performance.now())) return;
      const dura = RECEITAS[id](ctx, s.efeitos, ctx.currentTime + 0.01, o);
      if (GRANDES.has(id)) motor.abaixarMusica(dura);
    },
    era(e) {
      eraAtual = e;
      seq.mudarEra(e);
    },
    chaves(c) {
      chaves = c;
      ajustarMusica();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd games && npx vitest run idle/audio/`
Expected: PASS (all audio tests)

- [ ] **Step 5: Commit**

```bash
git add games/idle/audio/index.ts games/idle/audio/eventos.ts games/idle/audio/index.test.ts games/idle/audio/eventos.test.ts
git commit -m "Fellas Inc.: o som pro jogo (liga no 1º toque, chaves, aba, era) e os sons das mudanças de estado"
```

---

### Task 7: Configurações (Música / Efeitos / Avisos), ligações na tela e no main, patch note

**Files:**
- Modify: `games/idle/preferencias.ts` (chaves no lugar de `lerSom`/`gravarSom`)
- Modify: `games/idle/tela.ts` (Modelo `chaves`, Acoes `chave` e `efeito`, folha de Configurações, clique e abrir/fechar)
- Modify: `games/idle/main.ts` (estado das chaves, o `criarAudio` e os efeitos nas ações)
- Modify: `games/idle/novidades.ts` (entrada "Som na firma")
- Test: `games/idle/novidades.test.ts`, `games/idle/tela.test.ts`

**Interfaces:**
- Consumes: `criarAudio`, `IdEfeito` (Task 6); `sonsDaMudanca`, `quantasCompradas` (Task 6).
- Produces: `type ChaveSom = 'musica' | 'efeitos' | 'avisos'`, `lerChave(q)`, `gravarChave(q, ligada)`; Modelo `chaves: Record<ChaveSom, boolean>`; Acoes `chave(qual: ChaveSom, ligada: boolean)`, `efeito(id: IdEfeito)`.

- [ ] **Step 1: Write the failing tests**

In `games/idle/novidades.test.ts`, replace the import of `lerSom`/`gravarSom` and the "som começa ligado" test, and make the Bolsa note test look up by id:

```ts
import { gravarChave, lerChave, lerVista, marcarVista } from './preferencias';
```

```ts
  it('música, efeitos e avisos começam ligados e cada um lembra o desligado', () => {
    for (const q of ['musica', 'efeitos', 'avisos'] as const) {
      expect(lerChave(q)).toBe(true);
      gravarChave(q, false);
      expect(lerChave(q)).toBe(false);
      gravarChave(q, true);
      expect(lerChave(q)).toBe(true);
    }
    gravarChave('musica', false);
    expect(lerChave('efeitos')).toBe(true);
    expect(localStorage.getItem('fellas:idle-musica')).toBe('0');
  });
```

```ts
  it('a nota da Bolsa explica a ligação com os geradores', () => {
    expect(NOVIDADES.find((n) => n.id === '2026-10-11-bolsa')!.itens).toContain('Cada empresa da Bolsa é ligada a um gerador: quanto mais dele, mais ações você pode ter.');
  });
  it('a mais nova é o som', () => {
    expect(NOVIDADES[0].id).toBe('2026-10-11-som');
    expect(NOVIDADES[0].titulo).toBe('Som na firma');
  });
```

In `games/idle/tela.test.ts`: the `modelo()` default gets `chaves: { musica: true, efeitos: true, avisos: true }` (instead of `som: true`); `acoes` gets `chave: vi.fn<Acoes['chave']>(), efeito: vi.fn<Acoes['efeito']>()` (instead of `som`); and the Configurações test becomes:

```ts
  it('Configurações: Música, Efeitos sonoros e Avisos (cada um liga/desliga), Mudar visual e Patch notes', () => {
    const tela = criarTela(root, acoes);
    expect(root.querySelector('.modal-config')!.hasAttribute('hidden')).toBe(true);
    tela.renderizar(modelo({ config: 'menu', chaves: { musica: true, efeitos: false, avisos: true }, novidadeNova: true }));
    const modal = root.querySelector<HTMLElement>('.modal-config')!;
    expect(modal.hasAttribute('hidden')).toBe(false);
    expect([...modal.querySelectorAll('.config-item .rotulo')].map((x) => x.textContent)).toEqual(['Música', 'Efeitos sonoros', 'Avisos', 'Mudar visual', 'Patch notes']);
    const chaves = [...modal.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
    expect(chaves.map((c) => [c.getAttribute('aria-label'), c.getAttribute('aria-checked'), c.textContent])).toEqual([
      ['Música', 'true', 'Ligada'], ['Efeitos sonoros', 'false', 'Desligados'], ['Avisos', 'true', 'Ligados'],
    ]);
    chaves[0].click();
    chaves[1].click();
    chaves[2].click();
    expect(acoes.chave.mock.calls).toEqual([['musica', false], ['efeitos', true], ['avisos', false]]);
    const item = (t: string) => [...modal.querySelectorAll<HTMLButtonElement>('button.config-item')].find((b) => b.querySelector('.rotulo')!.textContent === t)!;
    expect(item('Patch notes').querySelector('.ponto')!.hasAttribute('hidden')).toBe(false);
    item('Patch notes').click();
    expect(acoes.config).toHaveBeenCalledWith('notas');
    item('Mudar visual').click();
    expect(acoes.config).toHaveBeenCalledWith('fechada');
    expect(acoes.editor).toHaveBeenCalledWith('abrir');
    modal.querySelector<HTMLButtonElement>('.fechar')!.click();
    expect(acoes.config).toHaveBeenLastCalledWith('fechada');
  });
  it('som da interface: clique em aba e em chave; comprar não clica (a compra tem o som dela); folha abrindo e fechando', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    root.querySelector<HTMLButtonElement>('.aba')!.click();
    expect(acoes.efeito).toHaveBeenCalledWith('clique');
    acoes.efeito.mockClear();
    root.querySelector<HTMLButtonElement>('.gerador button[data-qtd="1"]')!.click();
    expect(acoes.efeito).not.toHaveBeenCalled();
    tela.renderizar(modelo({ caixaAberta: true }));
    expect(acoes.efeito).toHaveBeenLastCalledWith('abrir');
    tela.renderizar(modelo({ caixaAberta: false }));
    expect(acoes.efeito).toHaveBeenLastCalledWith('fechar');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd games && npx vitest run idle/novidades.test.ts idle/tela.test.ts`
Expected: FAIL (`gravarChave` não existe; rótulos "Som" no lugar de "Música"; `acoes.efeito` nunca chamado)

- [ ] **Step 3: Implement preferências e patch note**

`games/idle/preferencias.ts`: replace the `SOM` constant and `lerSom`/`gravarSom` with:

```ts
export type ChaveSom = 'musica' | 'efeitos' | 'avisos';
const CHAVES: Record<ChaveSom, string> = { musica: 'fellas:idle-musica', efeitos: 'fellas:idle-efeitos', avisos: 'fellas:idle-avisos' };
/** Cada chave começa ligada; '0' = desligada. */
export const lerChave = (q: ChaveSom) => ler(CHAVES[q]) !== '0';
export const gravarChave = (q: ChaveSom, ligada: boolean) => gravar(CHAVES[q], ligada ? '1' : '0');
```

and the header comment becomes `// Preferências da Fellas Inc. guardadas no aparelho (nada no banco): música, efeitos, avisos e a última patch note lida.`

`games/idle/novidades.ts`: new first entry of `NOVIDADES`:

```ts
  {
    id: '2026-10-11-som',
    titulo: 'Som na firma',
    data: '2026-10-11',
    itens: [
      'Música swing que cresce junto com a empresa: cada era tem a sua.',
      'Efeitos pra compra, venda, conquista, era nova, oportunidade e mais.',
      'Nas Configurações: música, efeitos e avisos, cada um liga e desliga separado.',
    ],
  },
```

- [ ] **Step 4: Implement the screen (`tela.ts`)**

- Imports: `import type { IdEfeito } from './audio';` and `import type { ChaveSom } from './preferencias';`.
- `Modelo`: replace `som: boolean` (and its doc comment) with `/** Chaves de som e avisos (guardadas no aparelho). */ chaves: Record<ChaveSom, boolean>;`.
- `Acoes`: replace `som(ligado: boolean): void;` with `chave(qual: ChaveSom, ligada: boolean): void; efeito(id: IdEfeito): void;`.
- After `const app = el('div', 'app idle');` and the `escalar` block, add the interface click:

```ts
  // som da interface: navegação clica (comprar, vender e pegar têm o som do que deu certo, no main)
  const CLIQUE = '.aba, .seg button, .gaveta, .fechar, .config-item, .chave, .acao, .voltar-config, .no-arvore, .conquista, .topo-config';
  app.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest(CLIQUE)) a.efeito('clique');
  });
  // folha abrindo e fechando ("fuu" subindo e descendo); a 1ª vez só registra
  const folhaVisivel = new WeakMap<HTMLElement, boolean>();
  const mostrarFolha = (modal: HTMLElement, visivel: boolean) => {
    const antes = folhaVisivel.get(modal);
    folhaVisivel.set(modal, visivel);
    mostrar(modal, visivel);
    if (antes !== undefined && antes !== visivel) a.efeito(visivel ? 'abrir' : 'fechar');
  };
```

- In `renderizar`, change `mostrar(modalC, …)`, `mostrar(modalV, …)`, `mostrar(modalP, …)`, `mostrar(modalCfg, …)` to `mostrarFolha(…)` with the same conditions.
- In the Configurações menu, replace the single "Som" row with three switch rows:

```ts
        const chaveSom = (qual: ChaveSom, rotulo: string, ligado: string, desligado: string) => {
          const linha = el('div', 'config-item');
          const on = m.chaves[qual];
          const b = button(on ? ligado : desligado, `chave${on ? ' ligada' : ''}`, () => a.chave(qual, !on));
          b.setAttribute('role', 'switch');
          b.setAttribute('aria-checked', String(on));
          b.setAttribute('aria-label', rotulo);
          linha.append(el('span', 'rotulo', rotulo), b);
          return linha;
        };
```

and `folha.append(topoCfg, chaveSom('musica', 'Música', 'Ligada', 'Desligada'), chaveSom('efeitos', 'Efeitos sonoros', 'Ligados', 'Desligados'), chaveSom('avisos', 'Avisos', 'Ligados', 'Desligados'), item('Mudar visual', …), item('Patch notes', …));` (the two `item(...)` calls stay as they are).

- [ ] **Step 5: Wire `main.ts`**

- Imports: `import { criarAudio } from './audio';`, `import { quantasCompradas, sonsDaMudanca } from './audio/eventos';`, and in the `./preferencias` import replace `gravarSom, lerSom` with `gravarChave, lerChave, type ChaveSom`.
- State: replace `let som = lerSom();` with:

```ts
let chaves: Record<ChaveSom, boolean> = { musica: lerChave('musica'), efeitos: lerChave('efeitos'), avisos: lerChave('avisos') };
// o som: liga no 1º toque; a música segue a era (0 = antes do Abrir CNPJ)
const audio = criarAudio();
audio.chaves(chaves);
let vivoSoou: number | null = null;
```

- `filaAvisos`: avisos desligados = sem aviso e sem som:

```ts
const filaAvisos = criarFilaAvisos((texto) => {
  conquistaAviso = chaves.avisos ? texto : null;
  if (texto && chaves.avisos) audio.tocar('conquista');
  render();
});
```

- Acoes: replace `som: (ligado) => {…}` with:

```ts
  chave: (qual, ligada) => {
    chaves = { ...chaves, [qual]: ligada };
    gravarChave(qual, ligada);
    audio.chaves(chaves);
    if (qual === 'avisos' && !ligada) conquistaAviso = null; // some na hora
    render();
  },
  efeito: (id) => audio.tocar(id),
```

- Ações que deram certo:

```ts
  comprar: (tipo, id, qtd) => void guard(async () => {
    const antes = ancora?.estado ?? null;
    const s = await api.idleBuy(tipo, id, qtd);
    aplicar(s);
    const n = quantasCompradas(antes, s, tipo, id);
    audio.tocar(n > 1 ? 'compraMuitas' : 'compra', { quantas: n });
  }),
  pegar: (w) => void guard(async () => {
    aplicar(await api.idleClaim(w));
    audio.tocar('pegar');
  }),
```

`comprarNo` → after `aplicar(...)`, `audio.tocar('no')`. `melhorar` → after `aplicar(r)`, `audio.tocar('compra')`. `negociar`:

```ts
  negociar: (empresa, lado, qtd, tick) => void guard(async () => {
    const p = bolsa?.carteira.find((x) => x.empresa === empresa);
    const m = bolsa?.empresas.find((x) => x.id === empresa);
    const lucro = !p || !m || m.valor >= p.custo / p.qtd;
    const r = await api.idleBolsaNegociar(empresa, lado, qtd, tick);
    receberBolsa(r.bolsa);
    aplicar(r);
    audio.tocar(lado === 'comprar' ? 'acaoCompra' : 'acaoVende', { lucro });
  }),
```

`vender` confirmar: after `aplicar(await api.idlePrestige());` add `audio.tocar('venda');`. `abrirCnpj()`: after `const estado = await api.idleStart();` add `audio.tocar('cnpj');`. `receberBolsa`: at the end, `if (b.viraram_po.length) audio.tocar('po');`. `guard` catch, in the `else` branch (not `no_session`), first line: `audio.tocar('erro');`.

- `aplicar(estado)`: first line `const antes = ancora?.estado ?? null;`; after `render();` add:

```ts
  for (const id of sonsDaMudanca(antes, estado)) audio.tocar(id);
  audio.era(fase === 'antes' ? 0 : estado.era);
```

- Oportunidade nova (no `setInterval` de 100 ms, antes do `if (vivoAgora(...) !== vivoAtual) render();`):

```ts
  const vivo = vivoAgora(ancora.estado, agoraSrv());
  if (vivo !== null && vivo !== vivoSoou) {
    vivoSoou = vivo;
    audio.tocar('oportunidade');
  }
```

- `render()`: replace `som` in the model with `chaves`.

- [ ] **Step 6: Run the tests and the type check**

Run: `cd games && npx tsc --noEmit -p . && npx vitest run idle/ --maxWorkers=4`
Expected: tsc clean; all idle tests PASS

- [ ] **Step 7: Commit**

```bash
git add games/idle/preferencias.ts games/idle/tela.ts games/idle/main.ts games/idle/novidades.ts games/idle/novidades.test.ts games/idle/tela.test.ts
git commit -m "Fellas Inc.: chaves de Música, Efeitos e Avisos nas Configurações e os sons ligados no jogo"
```

---

### Task 8: Página de audição, medição dos picos e conferência

**Files:**
- Create: `games/idle/audio/ouvir.html`, `games/idle/audio/ouvir.ts`, `games/idle/audio/ouvir.css`
- Modify: `games/vite.config.ts` (entrada `ouvir`)

**Interfaces:**
- Consumes: `criarAudio` (Task 6), `IDS_EFEITOS`, `RECEITAS` (Task 5), `INSTRUMENTOS` (Task 2), `montarSaida` (Task 3), `notasDoGiro`, `segundosDoGiro`, `bpm` (Task 1).
- Produces: a página `/games/idle/audio/ouvir.html` e `window.__medir(): Promise<{ nome: string; picoDb: number; segundos: number }[]>`.

- [ ] **Step 1: Write the page**

`games/idle/audio/ouvir.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta name="theme-color" content="#121212" />
    <title>Ouvir · Fellas Inc.</title>
    <link rel="icon" href="/favicon.png" />
    <link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;600&family=Jersey+10&display=swap" rel="stylesheet" />
  </head>
  <body>
    <main id="ouvir"></main>
    <script type="module" src="./ouvir.ts"></script>
  </body>
</html>
```

`games/idle/audio/ouvir.css`:

```css
/* Página de audição: escura, letra pixel nos títulos, botões no jeito do jogo (contorno de pixel, roxo quando tocando). */
:root { color-scheme: dark; }
body { margin: 0; background: #121212; color: #F4F1EA; font: 15px/1.45 'Golos Text', system-ui, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; display: grid; gap: 24px; }
h1, h2 { margin: 0; font-family: 'Jersey 10', monospace; font-weight: 400; }
h1 { font-size: 34px; }
h2 { font-size: 25px; }
p { margin: 4px 0 0; color: #A8A398; }
section { display: grid; gap: 10px; }
.grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
button { min-height: 44px; padding: 0 12px; border: 0; border-radius: 0; background: #22202B; color: #F4F1EA; cursor: pointer;
  font: 400 19px 'Jersey 10', monospace; --c: #34323F;
  box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c); }
button:hover { --c: #B8A2FF; }
button:focus-visible { outline: 2px solid #B8A2FF; outline-offset: 4px; }
button.ativo { background: #5B3FD9; --c: #8C75FF; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
td, th { padding: 4px 8px; text-align: left; border-bottom: 1px solid #34323F; }
.ruim { color: #FF8F8F; }
```

`games/idle/audio/ouvir.ts`:

```ts
// Página de audição (/games/idle/audio/ouvir.html): ouvir cada era e cada efeito e pedir ajustes. Não precisa de login
// e não mexe na empresa. "Medir" renderiza tudo sem tocar (OfflineAudioContext) e mostra o pico de cada um.
import './ouvir.css';
import { IDS_EFEITOS, RECEITAS, type IdEfeito, type OpcoesEfeito } from './efeitos';
import { criarAudio } from './index';
import { INSTRUMENTOS } from './instrumentos';
import { montarSaida } from './motor';
import { bpm, notasDoGiro, segundosDoGiro } from './musica';

const ERAS = ['Antes do CNPJ', 'Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede'];
const EFEITOS: [string, IdEfeito, OpcoesEfeito?][] = [
  ['Comprar 1', 'compra'], ['Comprar 10', 'compraMuitas', { quantas: 10 }], ['Comprar Máx (1000)', 'compraMuitas', { quantas: 1000 }],
  ['Nó da árvore', 'no'], ['Comprar ação', 'acaoCompra'], ['Vender com lucro', 'acaoVende', { lucro: true }],
  ['Vender com prejuízo', 'acaoVende', { lucro: false }], ['Conquista', 'conquista'], ['Era nova', 'era'], ['Vender a startup', 'venda'],
  ['Te contrataram', 'contratado'], ['Ações viraram pó', 'po'], ['Oportunidade nova', 'oportunidade'], ['Pegar oportunidade', 'pegar'],
  ['Abrir CNPJ', 'cnpj'], ['Erro', 'erro'], ['Clique', 'clique'], ['Abrir folha', 'abrir'], ['Fechar folha', 'fechar'],
  ['Dourado apareceu', 'dourado'], ['Pegou o dourado', 'douradoPego'],
];

const raiz = document.getElementById('ouvir')!;
const audio = criarAudio();
audio.chaves({ musica: false, efeitos: true });

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, texto = '') => {
  const e = document.createElement(tag);
  e.textContent = texto;
  return e;
};
const botao = (texto: string, aoTocar: () => void) => {
  const b = el('button', texto);
  b.type = 'button';
  b.addEventListener('click', aoTocar);
  return b;
};

const cab = el('section');
cab.append(el('h1', 'Ouvir o som da Fellas Inc.'), el('p', 'Toca num botão pra ligar o som. No jogo, a era troca no fim do giro (uns 50 s a 1 min).'));

const musica = el('section');
const comecar = el('div');
comecar.className = 'grade';
const mudar = el('div');
mudar.className = 'grade';
const ativos: HTMLButtonElement[] = [];
ERAS.forEach((nome, era) => {
  const b = botao(nome, () => {
    audio.era(era);
    audio.chaves({ musica: false, efeitos: true });
    audio.chaves({ musica: true, efeitos: true }); // recomeça já na era escolhida
    ativos.forEach((x) => x.classList.toggle('ativo', x === b));
  });
  ativos.push(b);
  comecar.append(b);
  mudar.append(botao(`→ ${nome}`, () => audio.era(era)));
});
const parar = botao('Parar a música', () => {
  audio.chaves({ musica: false, efeitos: true });
  ativos.forEach((x) => x.classList.remove('ativo'));
});
musica.append(el('h2', 'Música'), el('p', 'Começar numa era:'), comecar, el('p', 'Trocar como no jogo (no fim do giro):'), mudar, parar);

const efeitos = el('section');
const grade = el('div');
grade.className = 'grade';
for (const [nome, id, o] of EFEITOS) grade.append(botao(nome, () => audio.tocar(id, o)));
efeitos.append(el('h2', 'Efeitos'), grade);

const medir = el('section');
const tabela = el('table');
medir.append(el('h2', 'Medir'), el('p', 'Renderiza cada era (os dois giros) e cada efeito sem tocar e mostra o pico (precisa ficar abaixo de 0 dB).'),
  botao('Medir picos', () => void mostrarMedidas()), tabela);

raiz.append(cab, musica, efeitos, medir);

type Medida = { nome: string; picoDb: number; segundos: number };
const SR = 22050;
async function renderizar(segundos: number, tocar: (ctx: OfflineAudioContext, s: ReturnType<typeof montarSaida>) => void): Promise<number> {
  const ctx = new OfflineAudioContext(1, Math.ceil(SR * segundos), SR);
  tocar(ctx, montarSaida(ctx));
  const buf = await ctx.startRendering();
  let pico = 0;
  for (const v of buf.getChannelData(0)) pico = Math.max(pico, Math.abs(v));
  return 20 * Math.log10(Math.max(pico, 1e-9));
}
async function medirTudo(): Promise<Medida[]> {
  const out: Medida[] = [];
  for (let era = 0; era <= 5; era++) {
    for (const giro of [0, 1]) {
      const spb = 60 / bpm(era);
      const segundos = segundosDoGiro(era);
      const picoDb = await renderizar(segundos + 2, (ctx, s) => {
        for (const n of notasDoGiro(era, giro)) INSTRUMENTOS[n.inst](ctx, s.musica, n.t * spb, n.altura, n.dur * spb, n.forca);
      });
      out.push({ nome: `${ERAS[era]} · giro ${giro + 1}`, picoDb, segundos });
    }
  }
  for (const [nome, id, o] of EFEITOS) {
    let dura = 0;
    const picoDb = await renderizar(3.5, (ctx, s) => {
      dura = RECEITAS[id](ctx, s.efeitos, 0.05, o ?? {});
    });
    out.push({ nome, picoDb, segundos: dura });
  }
  return out;
}
async function mostrarMedidas() {
  tabela.replaceChildren(el('tr'));
  const cabecalho = tabela.firstElementChild!;
  cabecalho.append(el('th', 'O quê'), el('th', 'Pico (dB)'), el('th', 'Duração (s)'));
  for (const m of await medirTudo()) {
    const tr = el('tr');
    const pico = el('td', m.picoDb.toFixed(1));
    if (m.picoDb >= 0) pico.className = 'ruim';
    tr.append(el('td', m.nome), pico, el('td', m.segundos.toFixed(1)));
    tabela.append(tr);
  }
}
(window as unknown as { __medir: typeof medirTudo }).__medir = medirTudo;
```

`games/vite.config.ts`: in `rollupOptions.input`, add `ouvir: resolve(import.meta.dirname, 'idle/audio/ouvir.html'),`.

- [ ] **Step 2: Type check and build**

Run: `cd games && npx tsc --noEmit -p . && npx vite build`
Expected: clean; `dist/games/idle/audio/ouvir.html` exists

- [ ] **Step 3: Measure in Chrome**

Start `npx vite --port 5199 --strictPort` (games/, in background), open `http://localhost:5199/games/idle/audio/ouvir.html` and run `await __medir()` in the page.
Expected: every `picoDb` < 0 (no clipping); each era's `segundos` = 64 / 60.95 / 58.18 / 55.65 / 53.33 (eras 1–5; era 0 = 64). If any peak ≥ 0 dB, lower that instrument's/recipe's `forca` and re-measure (ledger the change).

- [ ] **Step 4: Visual check of Configurações (celular 390×760 e PC 1280×760, `?mock`)**

Open the gear: three switches (Música, Efeitos sonoros, Avisos) + Mudar visual + Patch notes ("Som na firma" no topo, bolinha acesa de novo). Turn Avisos off while a conquest notice shows (`__pontos`/compras no mock): the notice disappears at once. Fix what looks wrong in one batch.

- [ ] **Step 5: Full suites, stop vite, commit**

Run: `cd games && npx tsc --noEmit -p . && npx vitest run --maxWorkers=4 && npx vite build`, then `cd .. && npx tsc --noEmit && npx jest`
Expected: all green. Stop the vite on 5199 for real (`Get-CimInstance Win32_Process | ? { $_.CommandLine -like '*vite*--port 5199*' } | % { Stop-Process -Id $_.ProcessId -Force }`).

```bash
git add games/idle/audio/ouvir.html games/idle/audio/ouvir.ts games/idle/audio/ouvir.css games/vite.config.ts
git commit -m "Fellas Inc.: página de audição do som (eras, efeitos e a medição dos picos)"
```
