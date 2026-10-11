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
    sininho(c, d, t, 84, 0.2, 0.9);
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
    ruidoFiltrado(c, d, t, 'highpass', 2500, 2500, 0.03, 0.07);
    return 0.05;
  },
  abrir: (c, d, t) => {
    ruidoFiltrado(c, d, t, 'bandpass', 600, 2400, 0.18, 0.08);
    return 0.2;
  },
  fechar: (c, d, t) => {
    ruidoFiltrado(c, d, t, 'bandpass', 2400, 600, 0.18, 0.08);
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
