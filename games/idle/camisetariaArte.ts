// A arte da camisetaria (lugar 3 do Mapa do rolê), no estilo de rua: desenho chapado, contorno preto grosso de adesivo
// e respingo de spray nas cores do tema 3 (temasLugar.ts). Os pixels moram em camisetariaArte.json (gerado fora do repo
// por fellas-inc-esbocos/camisetaria/arte.js); aqui ficam os 15 estilos, que são tratamento por código em cima do
// desenho do tema, a troca de cor da peça e a foto 48×48 (peça a 2× + estampa 16×16 a 1×) que a moldura mostra.
// Tudo é determinístico: as mesmas partes dão sempre a mesma foto.
import arte from './camisetariaArte.json';
import { CORES } from './camisetaria';
import { TEMAS_LUGAR } from './temasLugar';

type RGB = readonly [number, number, number];
/** Uma grade L×L (linha a linha) de cor ou vazio. */
type Grade = (RGB | null)[];

export const LADO_ESTAMPA = 16;
export const LADO_PECA = 24;
export const LADO_FOTO = 48;

const L = LADO_ESTAMPA;
const paleta = arte.paleta as Record<string, string>;
const estampas = arte.estampas as Record<string, string[]>;
const pecas = arte.pecas as Record<string, { estampa: number[]; linhas: string[] }>;
const avatares = arte.avatares as Record<string, string[]>;

const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const mistura = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as unknown as RGB;
const luz = (c: RGB): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const igual = (a: RGB, b: RGB): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const dist = (a: RGB, b: RGB): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

const TEMA3 = TEMAS_LUGAR[3]!;
const PRETO = rgb(paleta.K);
const BRANCO = rgb(paleta.W);
const ACENTO = rgb(TEMA3.acento);
const ACENTO2 = rgb(TEMA3.acento2);
const PAPEL = rgb('#E8E0CC');
const TINTA_CANETA = rgb('#2B3A8C');
const FUNDO_NEON = rgb('#15141B');
const ROSA = rgb('#FF4FA3');
const ROSA_ESCURO = rgb('#B0145F');
const TIE_DYE = ['#FF8FB8', '#FFD25E', '#5EC8FF', '#B8A2FF'].map(rgb);
const POP = ['#FFD25E', '#E0454B', '#2F6FD0', '#F4F1EA', '#0B0A0E', '#FF8FB8', '#5ED18A'].map(rgb);
const POP_FUNDO: readonly (readonly [RGB, RGB])[] = [[rgb('#FFD25E'), rgb('#E0454B')], [rgb('#FF8FB8'), rgb('#D9578A')], [rgb('#5EC8FF'), rgb('#2F6FD0')]];
const RECORTES = [rgb('#E8E0CC'), rgb('#FF8FB8'), rgb('#5EC8FF')];
const CROMADO = ['#F4F6FF', '#B4C4F0', '#4A5A8C', '#D8E0FF', '#8DA2D9'].map(rgb);

/** Número pseudoaleatório fixo por posição (o mesmo desenho sempre). */
const sorte = (x: number, y: number, s: number): number =>
  ((Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663) ^ Math.imul(s + 3, 83492791)) >>> 0) % 1000;

const pos = (x: number, y: number): number => y * L + x;
const dentro = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < L && y < L;
const V4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const V8 = [...V4, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

function vizinhos(i: number, dirs: readonly (readonly [number, number])[]): number[] {
  const x = i % L, y = (i - x) / L;
  return dirs.filter(([dx, dy]) => dentro(x + dx, y + dy)).map(([dx, dy]) => pos(x + dx, y + dy));
}

/** Os pixels vazios encostados (4 lados) no que está cheio. */
function anel(cheio: readonly boolean[]): number[] {
  const r: number[] = [];
  for (let i = 0; i < L * L; i++) if (!cheio[i] && vizinhos(i, V4).some((j) => cheio[j])) r.push(i);
  return r;
}

/** A cor do vizinho cheio mais perto (4 lados, depois diagonais). */
function corPerto(g: Grade, i: number): RGB {
  for (const dirs of [V4, V8]) for (const j of vizinhos(i, dirs)) { const c = g[j]; if (c) return c; }
  return PRETO;
}

/** O desenho do tema (12×12) no meio da estampa, com 2 px de margem para o contorno. */
function motivo(tema: number): Grade {
  const linhas = estampas[String(tema)];
  if (!linhas) throw new Error(`tema sem estampa: ${tema}`);
  const g: Grade = new Array(L * L).fill(null);
  linhas.forEach((linha, y) => [...linha].forEach((ch, x) => { if (ch !== '.') g[pos(x + 2, y + 2)] = rgb(paleta[ch]); }));
  return g;
}

/** A cor que mais aparece no desenho (sem contar os detalhes escuros). */
function principal(m: Grade): RGB {
  const conta = new Map<string, [RGB, number]>();
  for (const c of m) if (c && luz(c) > 70) { const k = c.join(); conta.set(k, [c, (conta.get(k)?.[1] ?? 0) + 1]); }
  let melhor: [RGB, number] = [BRANCO, 0];
  for (const v of conta.values()) if (v[1] > melhor[1]) melhor = v;
  return melhor[0];
}

/** detalhe = bem mais escuro que a cor principal (olho, boca); destaque = detalhe ou bem mais claro (dente, roda, barriga):
 *  os estilos de uma cor só (estêncil, gótico) vazam o destaque para a figura não virar um borrão. */
type Ctx = {
  m: Grade; cheio: boolean[]; a1: number[]; a2: number[]; main: RGB; tema: number;
  detalhe: (c: RGB) => boolean; destaque: (c: RGB) => boolean;
};

function contexto(tema: number): Ctx {
  const m = motivo(tema);
  const cheio = m.map((c) => c !== null);
  const a1 = anel(cheio);
  const com1 = cheio.slice();
  for (const i of a1) com1[i] = true;
  const a2 = anel(com1);
  const main = principal(m);
  const lim = luz(main) * 0.6;
  const claro = luz(main) + 60;
  return { m, cheio, a1, a2, main, tema, detalhe: (c) => luz(c) < lim, destaque: (c) => luz(c) < lim || luz(c) > claro };
}

const pintar = (g: Grade, idx: readonly number[], c: RGB | ((i: number) => RGB | null)): void => {
  for (const i of idx) g[i] = typeof c === 'function' ? c(i) : c;
};
const xy = (i: number): [number, number] => [i % L, Math.floor(i / L)];
const motivoIdx = (cx: Ctx): number[] => cx.m.flatMap((c, i) => (c ? [i] : []));

// --------------------------------------------------------------------------------------------- os 15 estilos
const ESTILO: Record<number, (cx: Ctx) => Grade> = {
  // 1 Minimalista: duas cores (a principal e o preto), contorno fino
  1: (cx) => {
    const g: Grade = cx.m.map((c) => (c ? (cx.detalhe(c) ? PRETO : cx.main) : null));
    pintar(g, cx.a1, PRETO);
    return g;
  },
  // 2 Rabisco de caneta: cor de marca-texto, detalhes e contorno tremido em caneta azul
  2: (cx) => {
    const g: Grade = cx.m.map((c) => (c ? (cx.detalhe(c) ? TINTA_CANETA : mistura(c, BRANCO, 0.35)) : null));
    const fora = new Set(cx.a2);
    for (const i of cx.a1) {
      const [x, y] = xy(i);
      if (sorte(x, y, 2) % 10 < 7) { g[i] = TINTA_CANETA; continue; }
      const out = vizinhos(i, V4).find((j) => fora.has(j));
      if (out !== undefined) g[out] = TINTA_CANETA;
      else g[i] = TINTA_CANETA;
    }
    for (const i of cx.a2) { const [x, y] = xy(i); if (sorte(x, y, 22) % 9 === 0) g[i] = TINTA_CANETA; }
    return g;
  },
  // 3 Pixel: o desenho como é, com o contorno preto de 2 px de adesivo
  3: (cx) => {
    const g: Grade = cx.m.slice();
    pintar(g, cx.a1, PRETO);
    pintar(g, cx.a2, PRETO);
    return g;
  },
  // 4 Grafite: contorno preto + contorno de cor (grosso), brilho em cima, respingo e escorrido
  4: (cx) => {
    // o contorno de cor é o acento que mais destoa da cor principal do desenho; o respingo, o outro
    const [tinta, outra] = dist(cx.main, ACENTO) >= dist(cx.main, ACENTO2) ? [ACENTO, ACENTO2] : [ACENTO2, ACENTO];
    const g: Grade = cx.m.map((c, i) => {
      if (!c) return null;
      const [x, y] = xy(i);
      const topo = !dentro(x, y - 1) || !cx.m[pos(x, y - 1)] || !dentro(x - 1, y) || !cx.m[pos(x - 1, y)];
      return topo && !cx.detalhe(c) ? mistura(c, BRANCO, 0.35) : c;
    });
    pintar(g, cx.a1, PRETO);
    pintar(g, cx.a2, tinta);
    for (let i = 0; i < L * L; i++) {
      if (g[i]) continue;
      const [x, y] = xy(i);
      if (sorte(x, y, 4) % 7 === 0) g[i] = outra;
    }
    for (let x = 0; x < L; x++) {
      let fundo = -1;
      for (let y = L - 1; y >= 0; y--) if (g[pos(x, y)] && igual(g[pos(x, y)]!, tinta) && cx.a2.includes(pos(x, y))) { fundo = y; break; }
      if (fundo < 0 || sorte(x, 0, 44) % 3) continue;
      for (let k = 1; k <= 1 + (sorte(x, 1, 45) % 2) && dentro(x, fundo + k); k++) g[pos(x, fundo + k)] = tinta;
    }
    return g;
  },
  // 5 Vintage desbotado: cor lavada puxando pro creme e a tinta rachada (falhas)
  5: (cx) => {
    const g: Grade = cx.m.map((c, i) => {
      if (!c) return null;
      const [x, y] = xy(i);
      const racha = sorte(x, y, 5) % 6 === 0 || ((y + (sorte(x, 0, 55) % 2)) % 5 === 0 && sorte(x, y, 56) % 2 === 0);
      if (racha) return null;
      const cinza = luz(c);
      return mistura(mistura(c, [cinza, cinza, cinza], 0.5), PAPEL, 0.3);
    });
    const marrom = rgb(paleta.d);
    for (const i of cx.a1) { const [x, y] = xy(i); if (sorte(x, y, 57) % 4) g[i] = marrom; }
    return g;
  },
  // 6 Estêncil: uma cor só, detalhes e destaques vazados, pontes cortando e respingo de spray em volta
  6: (cx) => {
    const tinta = mistura(cx.main, PRETO, 0.5);
    const g: Grade = cx.m.map((c) => (c && !cx.destaque(c) ? tinta : null));
    const ponte = 9;
    for (let y = 0; y < L; y++) {
      const i = pos(ponte, y);
      if (g[i] && g[pos(ponte - 1, y)] && g[pos(ponte + 1, y)]) g[i] = null;
    }
    for (const i of [...cx.a1, ...cx.a2]) { const [x, y] = xy(i); if (sorte(x, y, 6) % 5 === 0) g[i] = tinta; }
    return g;
  },
  // 7 Tie-dye: fundo redondo em espiral colorida, o desenho por cima com contorno
  7: (cx) => {
    const g: Grade = new Array(L * L).fill(null);
    for (let i = 0; i < L * L; i++) {
      const [x, y] = xy(i);
      const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy);
      if (r > 8) continue;
      const a = Math.atan2(dy, dx) / (2 * Math.PI);
      g[i] = TIE_DYE[(((Math.floor(a * 4 + r / 2.2)) % 4) + 4) % 4];
    }
    pintar(g, motivoIdx(cx), (i) => cx.m[i]);
    pintar(g, cx.a1, PRETO);
    return g;
  },
  // 8 Xilogravura de cordel: papel com moldura, a figura em preto chapado, os detalhes e o claro entalhados (papel) e
  // a hachura dos talhos no miolo do preto. Desenho claro (caveira, bola) fica ao contrário: papel com detalhe preto.
  8: (cx) => {
    const escuro = luz(cx.main) <= 200;
    const tom = (c: RGB): RGB => {
      if (cx.detalhe(c)) return escuro ? PAPEL : PRETO;
      if (luz(c) > 200) return PAPEL;
      return escuro ? PRETO : PAPEL;
    };
    const g: Grade = new Array(L * L).fill(PAPEL);
    for (let i = 0; i < L * L; i++) {
      const [x, y] = xy(i);
      if (x === 0 || y === 0 || x === L - 1 || y === L - 1) g[i] = PRETO;
      if (cx.m[i]) g[i] = tom(cx.m[i]!);
    }
    for (let i = 0; i < L * L; i++) {
      const [x, y] = xy(i);
      const miolo = cx.m[i] && vizinhos(i, V8).length === 8 && vizinhos(i, V8).every((j) => cx.m[j] && g[j] === PRETO);
      if (miolo && g[i] === PRETO && (x - y + 32) % 4 === 0) g[i] = PAPEL;
    }
    pintar(g, cx.a1, PRETO);
    return g;
  },
  // 9 Neon: placa escura, a borda do desenho acesa e o brilho vazando em volta
  9: (cx) => {
    const aceso = (c: RGB): RGB => {
      const mx = Math.max(...c, 1);
      return mistura([c[0] * 255 / mx, c[1] * 255 / mx, c[2] * 255 / mx].map(Math.round) as unknown as RGB, BRANCO, 0.15);
    };
    const g: Grade = new Array(L * L).fill(FUNDO_NEON);
    for (const [x, y] of [[0, 0], [L - 1, 0], [0, L - 1], [L - 1, L - 1]]) g[pos(x, y)] = null;
    for (let i = 0; i < L * L; i++) {
      const c = cx.m[i];
      if (!c) continue;
      if (luz(c) < 60) continue;
      const borda = vizinhos(i, V4).some((j) => !cx.m[j] || luz(cx.m[j]!) < 60);
      g[i] = borda ? aceso(c) : mistura(aceso(c), FUNDO_NEON, 0.6);
    }
    for (const i of cx.a1) g[i] = mistura(aceso(corPerto(cx.m, i)), FUNDO_NEON, 0.55);
    return g;
  },
  // 10 Bordado: ponto em X (xadrez de linha clara e escura) e contorno de pesponto
  10: (cx) => {
    const g: Grade = cx.m.map((c, i) => {
      if (!c) return null;
      const [x, y] = xy(i);
      return (x + y) % 2 === 0 ? c : mistura(c, luz(c) < 50 ? BRANCO : PRETO, 0.25); // linha escura ganha o tom claro
    });
    for (const i of cx.a1) { const [x, y] = xy(i); if ((x + y) % 2 === 0) g[i] = mistura(corPerto(cx.m, i), PRETO, 0.55); }
    return g;
  },
  // 11 Pop art: fundo de retícula, cores de gibi, contorno preto e sombra deslocada
  11: (cx) => {
    const [fundo, ponto] = POP_FUNDO[cx.tema % 3];
    const g: Grade = new Array(L * L).fill(null);
    for (let i = 0; i < L * L; i++) { const [x, y] = xy(i); g[i] = x % 2 === 0 && y % 2 === 0 ? ponto : fundo; }
    const perto = (c: RGB): RGB => POP.reduce((a, b) => (dist(b, c) < dist(a, c) ? b : a));
    const sombra = new Set(cx.a2.filter((i) => { const [x, y] = xy(i); return dentro(x - 1, y - 1) && (cx.cheio[pos(x - 1, y - 1)] || cx.a1.includes(pos(x - 1, y - 1))); }));
    for (const i of sombra) g[i] = PRETO;
    pintar(g, motivoIdx(cx), (i) => perto(cx.m[i]!));
    pintar(g, cx.a1, PRETO);
    return g;
  },
  // 12 Colagem: o desenho cortado em dois recortes (metade de cima e de baixo) deslocados para os lados, cada um com a
  // margem do papel de onde saiu (jornal em cima, rosa embaixo) e o contorno preto em volta de tudo
  12: (cx) => {
    const g: Grade = new Array(L * L).fill(null);
    const corte = 8;
    for (const [k, d] of [[0, -1], [1, 1]] as const) {
      const meu = cx.cheio.map((c, i) => c && (xy(i)[1] < corte) === (k === 0));
      const margem = anel(meu);
      const papel = RECORTES[k];
      for (const i of margem) {
        const [x, y] = xy(i);
        if ((y < corte) !== (k === 0)) continue; // no corte não tem margem: os dois recortes se encostam
        if (!dentro(x + d, y)) continue;
        const jornal = k === 0 && y % 2 === 0 && sorte(x, y, 12) % 2 === 0;
        g[pos(x + d, y)] = jornal ? mistura(papel, PRETO, 0.3) : papel;
      }
      for (let i = 0; i < L * L; i++) if (meu[i]) { const [x, y] = xy(i); if (dentro(x + d, y)) g[pos(x + d, y)] = cx.m[i]; }
    }
    pintar(g, anel(g.map((c) => c !== null)), PRETO);
    return g;
  },
  // 13 Aquarela: cores aguadas, tinta acumulando embaixo e a borda manchando pra fora (sem contorno)
  13: (cx) => {
    const g: Grade = cx.m.map((c, i) => {
      if (!c) return null;
      const [x, y] = xy(i);
      if (cx.detalhe(c)) return mistura(c, BRANCO, 0.15);
      const baixo = !dentro(x, y + 1) || !cx.m[pos(x, y + 1)];
      if (baixo) return mistura(c, PRETO, 0.12);
      return mistura(c, BRANCO, sorte(x, y, 13) % 4 === 0 ? 0.55 : 0.35);
    });
    const manchou = new Set<number>();
    for (const i of cx.a1) { const [x, y] = xy(i); if (sorte(x, y, 31) % 10 < 6) { g[i] = mistura(corPerto(cx.m, i), BRANCO, 0.6); manchou.add(i); } }
    for (const i of cx.a2) {
      const [x, y] = xy(i);
      if (sorte(x, y, 32) % 10 < 3 && vizinhos(i, V4).some((j) => manchou.has(j))) g[i] = mistura(corPerto(g, i), BRANCO, 0.3);
    }
    return g;
  },
  // 14 Gótico: preto chapado, detalhes, destaques e contorno em branco, e uma volta preta por fora
  14: (cx) => {
    const g: Grade = cx.m.map((c) => (c ? (cx.destaque(c) ? BRANCO : PRETO) : null));
    pintar(g, cx.a1, BRANCO);
    pintar(g, cx.a2, PRETO);
    return g;
  },
  // 15 Y2K: cromado em faixas, detalhes e contorno rosa-choque e brilhinhos
  15: (cx) => {
    const g: Grade = cx.m.map((c, i) => {
      if (!c) return null;
      if (cx.detalhe(c)) return ROSA_ESCURO;
      const t = (xy(i)[1] - 2) / 11;
      return CROMADO[t < 0.25 ? 0 : t < 0.45 ? 1 : t < 0.55 ? 2 : t < 0.8 ? 3 : 4];
    });
    pintar(g, cx.a1, ROSA);
    for (const [x, y] of [[13, 2], [2, 13], [13, 12]]) {
      const cruz = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => pos(x + dx, y + dy));
      if (cruz.every((i) => !g[i])) cruz.forEach((i, k) => { g[i] = k === 0 ? BRANCO : ROSA; });
    }
    return g;
  },
};

function imagem(g: Grade, w: number, h: number): ImageData {
  const img = new ImageData(w, h);
  g.forEach((c, i) => { if (c) img.data.set([c[0], c[1], c[2], 255], i * 4); });
  return img;
}

/** Estampas já feitas (são 450 no máximo; a tela da bancada redesenha a prévia a cada clique). */
const feitas = new Map<string, Uint8ClampedArray>();

/** A estampa 16×16 do tema no estilo (os dois de 1 em diante, como em TEMAS e ESTILOS). Cada chamada devolve uma
 *  imagem nova (quem recebe pode mexer nela sem estragar a guardada). */
export function estampa(tema: number, estilo: number): ImageData {
  const k = `${tema},${estilo}`;
  let dados = feitas.get(k);
  if (!dados) {
    const f = ESTILO[estilo];
    if (!f) throw new Error(`estilo sem arte: ${estilo}`);
    dados = imagem(f(contexto(tema)), L, L).data;
    feitas.set(k, dados);
  }
  const img = new ImageData(L, L);
  img.data.set(dados);
  return img;
}

/** A peça 24×24 com o tecido na cor (c = a cor, s = sombra, h = luz; o resto vem da paleta). */
export function pecaComCor(peca: number, hex: string): ImageData {
  const p = pecas[String(peca)];
  if (!p) throw new Error(`peça sem arte: ${peca}`);
  const cor = rgb(hex);
  const escura = luz(cor) < 60;
  const tecido: Record<string, RGB> = { c: cor, s: mistura(cor, PRETO, 0.3), h: mistura(cor, BRANCO, escura ? 0.3 : 0.22) };
  const g: Grade = [];
  p.linhas.forEach((linha) => [...linha].forEach((ch) => g.push(ch === '.' ? null : tecido[ch] ?? rgb(paleta[ch]))));
  return imagem(g, LADO_PECA, LADO_PECA);
}

/** Onde a estampa entra na foto da peça (canto de cima à esquerda, na foto 48×48). */
export function cantoEstampa(peca: number): [number, number] {
  const [x, y] = pecas[String(peca)].estampa;
  return [x, y];
}

/** A foto 48×48 das partes [tema, estilo, peça, cor]: a peça na cor a 2× e a estampa no estilo a 1× no peito. */
export function fotoImagem(partes: readonly number[]): ImageData {
  const [tema, estilo, peca, cor] = partes;
  const hex = CORES[cor - 1]?.hex;
  if (!hex) throw new Error(`cor sem arte: ${cor}`);
  const img = new ImageData(LADO_FOTO, LADO_FOTO);
  const p = pecaComCor(peca, hex);
  for (let y = 0; y < LADO_FOTO; y++) for (let x = 0; x < LADO_FOTO; x++) {
    const o = ((y >> 1) * LADO_PECA + (x >> 1)) * 4;
    if (p.data[o + 3]) img.data.set(p.data.subarray(o, o + 4), (y * LADO_FOTO + x) * 4);
  }
  const e = estampa(tema, estilo);
  const [ex, ey] = cantoEstampa(peca);
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const o = (y * L + x) * 4;
    if (e.data[o + 3]) img.data.set(e.data.subarray(o, o + 4), ((ey + y) * LADO_FOTO + ex + x) * 4);
  }
  return img;
}

/** Um canvas do tamanho da imagem, já pintado (o CSS amplia com image-rendering: pixelated). */
export function canvasDe(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')?.putImageData(img, 0, 0);
  return c;
}

/** A foto da produção (contrato de Mecanica.foto): canvas 48×48. */
export function foto(partes: readonly number[]): HTMLCanvasElement {
  return canvasDe(fotoImagem(partes));
}

/** O avatar 16×16 do influencer (1 a 4, na ordem de INFLUENCERS). */
export function avatar(influencer: number): ImageData {
  const linhas = avatares[String(influencer)];
  if (!linhas) throw new Error(`influencer sem avatar: ${influencer}`);
  const g: Grade = linhas.flatMap((linha) => [...linha].map((ch) => (ch === '.' ? null : rgb(paleta[ch]))));
  return imagem(g, 16, 16);
}

/** A parede da bancada (128×72): tijolo com grafite genérico e respingo de spray. */
export function fundoBancada(): ImageData {
  const linhas = arte.fundo as string[];
  const g: Grade = linhas.flatMap((linha) => [...linha].map((ch) => rgb(paleta[ch])));
  return imagem(g, linhas[0].length, linhas.length);
}
