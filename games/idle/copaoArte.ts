// A arte do copão (lugar 4 do Mapa do rolê), no estilo do bar à noite: preto, vermelho neon e branco (tema 4 de
// temasLugar.ts). Os pixels moram em copaoArte.json (gerado fora do repo por fellas-inc-esbocos/copao/arte.js); aqui ficam
// as cores do líquido de cada base e de cada mistura, a mistura das duas em camadas (a base embaixo, a mistura em cima, a
// força decide quanto de cada), o enfeite do extra, o sal e o açúcar na borda, a foto 48×48 que a moldura mostra, o fundo
// do bar e os balões do chat. Tudo é determinístico: as mesmas partes dão sempre a mesma foto.
// Os retratos dos DJs são PNGs à parte (assets/djs/dj-NN.png, por ativos.dj).
import arte from './copaoArte.json';
import { BASES, MISTURAS } from './copao';
import { TEMAS_LUGAR } from './temasLugar';

type RGB = readonly [number, number, number];

export const LADO_FOTO = 48;
export const LADO_EXTRA = 8;

type Recipiente = { liquido: number[]; enfeite: Record<Onde, number[]>; linhas: string[] };
type Onde = 'borda' | 'dentro' | 'topo';
const paleta = arte.paleta as Record<string, string>;
const recipientes = arte.recipientes as unknown as Record<string, Recipiente>;
const extras = arte.extras as unknown as Record<string, { onde: Onde; linhas: string[] }>;

const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const misturar = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as unknown as RGB;

const TEMA4 = TEMAS_LUGAR[4]!;
const PRETO = rgb(paleta.K);
const BRANCO = rgb(TEMA4.texto);
const GELO = rgb('#F8FCFF');
const CANUDO = rgb(TEMA4.acento);

/** A cor do líquido de cada base (na ordem de BASES). */
export const COR_BASE: readonly string[] = [
  '#D6E6F2', // Vodka: quase transparente, puxando pro gelo
  '#E0A84A', // Cachaça: âmbar
  '#7B2A2A', // Catuaba: vinho puxado pro marrom
  '#C4ECD9', // Gin: transparente esverdeado
  '#A0522D', // Rum: âmbar escuro
  '#C67A26', // Whisky de posto: caramelo
  '#EAD27A', // Tequila: ouro clarinho
  '#FFB07A', // Corote de pêssego: pêssego
  '#5A3420', // Licor de chocolate: chocolate
  '#EDE6CF', // Saquê: leitoso
  '#6FD04A', // Absinto: verde-fada
  '#5C1A4A', // Vinho de garrafão: roxo
];
/** A cor do líquido de cada mistura (na ordem de MISTURAS). */
export const COR_MISTURA: readonly string[] = [
  '#D8E45A', // Energético tradicional: amarelo-esverdeado
  '#E09A3C', // Refri de guaraná: dourado
  '#FF8A1E', // Suco de laranja
  '#3A1C12', // Refri de cola
  '#FF5C7A', // Energético de melancia: rosa
  '#F2D23A', // Suco de maracujá: amarelo
  '#CFE8FF', // Água tônica: azulada (brilha no neon)
  '#6A2A7A', // Energético de açaí: roxo
  '#C8F078', // Refri de limão: verde-limão
  '#D41E3A', // Xarope de groselha: vermelho
  '#8E5A2A', // Chá gelado: chá
  '#FF9F5A', // Energético tropical: laranja-pêssego
  '#5EC8FF', // Isotônico: azul
  '#F2E2B8', // Leite condensado: creme
  '#F0EDA0', // Energético sem açúcar: amarelo clarinho
];

/** Quanto do líquido é base (o resto é mistura): força 1 = 10%, força 10 = 90%. */
export function proporcaoBase(forca: number): number {
  return 0.1 + (0.8 * (Math.min(10, Math.max(1, forca)) - 1)) / 9;
}

/** A cor do líquido na linha y: a base embaixo, a mistura em cima e 4 px de degradê (em quartos) onde as duas se encontram. */
export function corLiquido(base: number, mistura: number, forca: number, y: number, [topo, fundo]: readonly number[]): RGB {
  const cb = COR_BASE[base - 1], cm = COR_MISTURA[mistura - 1];
  if (!cb) throw new Error(`base sem cor: ${base}`);
  if (!cm) throw new Error(`mistura sem cor: ${mistura}`);
  const altura = fundo - topo + 1;
  const t = (fundo - y + 0.5) / altura; // 0 no fundo, 1 em cima
  const d = (t - proporcaoBase(forca)) * altura; // em pixels, negativo = abaixo da divisa
  const k = Math.round(Math.min(1, Math.max(0, (d + 2) / 4)) * 4) / 4;
  return misturar(rgb(cb), rgb(cm), k);
}

/** O que cada letra do líquido faz com a cor dele. */
const NO_LIQUIDO: Record<string, (c: RGB) => RGB> = {
  L: (c) => c,
  F: (c) => misturar(c, BRANCO, 0.22), // a superfície
  H: (c) => misturar(c, BRANCO, 0.4), // a luz do vidro
  S: (c) => misturar(c, PRETO, 0.25), // a sombra, os gomos, os frisos
  C: (c) => misturar(CANUDO, c, 0.45), // o canudo visto pelo líquido
  I: (c) => misturar(c, GELO, 0.55), // o gelo
  J: (c) => misturar(c, GELO, 0.85),
  j: (c) => misturar(c, GELO, 0.3),
};

function receita(tamanho: number): Recipiente {
  const r = recipientes[String(tamanho)];
  if (!r) throw new Error(`tamanho sem arte: ${tamanho}`);
  return r;
}

function pintar(img: ImageData, x: number, y: number, c: RGB): void {
  img.data.set([c[0], c[1], c[2], 255], (y * img.width + x) * 4);
}

/** O recipiente 48×48 do tamanho com o líquido da base e da mistura na força dada (sem o extra). */
export function recipiente(tamanho: number, base: number, mistura: number, forca: number): ImageData {
  const r = receita(tamanho);
  const img = new ImageData(LADO_FOTO, LADO_FOTO);
  r.linhas.forEach((linha, y) => {
    const liq = corLiquido(base, mistura, forca, y, r.liquido);
    [...linha].forEach((ch, x) => {
      if (ch === '.') return;
      const f = NO_LIQUIDO[ch];
      pintar(img, x, y, f ? f(liq) : rgb(paleta[ch]));
    });
  });
  return img;
}

/** O enfeite 8×8 do extra (na ordem de EXTRAS). */
export function extraImagem(extra: number): ImageData {
  const e = extras[String(extra)];
  if (!e) throw new Error(`extra sem arte: ${extra}`);
  const img = new ImageData(LADO_EXTRA, LADO_EXTRA);
  e.linhas.forEach((l, y) => [...l].forEach((ch, x) => { if (ch !== '.') pintar(img, x, y, rgb(paleta[ch])); }));
  return img;
}

/** Onde o enfeite do extra entra na foto do tamanho (canto de cima à esquerda). */
export function cantoExtra(tamanho: number, extra: number): [number, number] {
  const e = extras[String(extra)];
  if (!e) throw new Error(`extra sem arte: ${extra}`);
  const [x, y] = receita(tamanho).enfeite[e.onde];
  return [x, y];
}

/** Sal (10) e açúcar (11) cobrem a borda: as cores dos grãos, pela posição. */
const SAL = [rgb('#F4F1EA'), rgb('#C9C4B8')];
const ACUCAR = [rgb('#FFF8E8'), rgb('#FFE9A8'), rgb('#FFF8E8'), rgb('#FF8FB8')];
export const EXTRA_SAL = 10;
export const EXTRA_ACUCAR = 11;

/** A foto 48×48 das partes [base, mistura, extra, tamanho, força]: o recipiente montado com o líquido e o enfeite. */
export function fotoImagem(partes: readonly number[]): ImageData {
  const [base, mistura, extra, tamanho, forca] = partes;
  const img = recipiente(tamanho, base, mistura, forca);
  if (extra === EXTRA_SAL || extra === EXTRA_ACUCAR) {
    const graos = extra === EXTRA_SAL ? SAL : ACUCAR;
    receita(tamanho).linhas.forEach((l, y) => [...l].forEach((ch, x) => {
      if (ch === 'r' || ch === 'R') pintar(img, x, y, graos[(x * 3 + y) % graos.length]);
    }));
  }
  const e = extraImagem(extra);
  const [ex, ey] = cantoExtra(tamanho, extra);
  for (let y = 0; y < LADO_EXTRA; y++) for (let x = 0; x < LADO_EXTRA; x++) {
    const o = (y * LADO_EXTRA + x) * 4;
    if (e.data[o + 3] && ex + x < LADO_FOTO && ey + y < LADO_FOTO) img.data.set(e.data.subarray(o, o + 4), ((ey + y) * LADO_FOTO + ex + x) * 4);
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

/** A foto do copão (contrato de Mecanica.foto): canvas 48×48. */
export function foto(partes: readonly number[]): HTMLCanvasElement {
  return canvasDe(fotoImagem(partes));
}

/** O fundo do bar (128×72): parede escura, garrafas sem rótulo, neon vermelho e o balcão. */
export function fundoBar(): ImageData {
  const linhas = arte.fundo as string[];
  const img = new ImageData(linhas[0].length, linhas.length);
  linhas.forEach((l, y) => [...l].forEach((ch, x) => pintar(img, x, y, rgb(paleta[ch]))));
  return img;
}

// ===== balões do chat =====
export type TipoBalao = 'galera' | 'pt' | 'dj';
/** Altura da cauda do balão (embaixo, fora do corpo). */
export const CAUDA_BALAO = 3;
/** A cor do texto em cima de qualquer balão. */
export const TINTA_BALAO = paleta.K;
const COR_BALAO: Record<TipoBalao, readonly [RGB, RGB]> = {
  galera: [BRANCO, rgb('#C9C4B8')],
  pt: [rgb(TEMA4.acento), rgb('#C23B53')],
  dj: [rgb(TEMA4.acento2), rgb('#B8561C')],
};

/** O balão de w×h (o corpo; mínimo 8×6) com a cauda embaixo, do lado de quem fala: contorno preto, cantos cortados,
 *  sombra na última linha. A imagem tem w × (h + CAUDA_BALAO). */
export function balao(w: number, h: number, lado: 'esq' | 'dir', tipo: TipoBalao): ImageData {
  if (w < 8 || h < 6) throw new Error(`balão pequeno demais: ${w}×${h}`);
  const [cor, sombra] = COR_BALAO[tipo];
  const img = new ImageData(w, h + CAUDA_BALAO);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue; // canto cortado
    const borda = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    pintar(img, x, y, borda ? PRETO : y === h - 2 ? sombra : cor);
  }
  // a cauda (desenhada pra esquerda; a da direita é o espelho): [dx a partir de x = 3, dy a partir da borda de baixo, cor]
  const CAUDA: readonly [number, number, RGB][] = [
    [1, 0, sombra], [2, 0, sombra],
    [0, 1, PRETO], [1, 1, sombra], [2, 1, sombra], [3, 1, PRETO],
    [-1, 2, PRETO], [0, 2, sombra], [1, 2, PRETO], [2, 2, PRETO],
    [-2, 3, PRETO], [-1, 3, PRETO],
  ];
  for (const [dx, dy, c] of CAUDA) {
    const x = lado === 'esq' ? 3 + dx : w - 4 - dx;
    pintar(img, x, h - 1 + dy, c);
  }
  return img;
}
