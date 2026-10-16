// Catálogo dos efeitos (a tabela da spec), afinados em Fá como a música. Cada receita agenda as notas a partir de `t`
// e devolve quanto dura (pro "abaixa a música" dos momentos grandes).
import { hz, INSTRUMENTOS, ruido } from './instrumentos';

export const IDS_EFEITOS = [
  'compra', 'compraMuitas', 'no', 'acaoCompra', 'acaoVende', 'conquista', 'era', 'venda', 'contratado', 'po', 'oportunidade',
  'pegar', 'cnpj', 'erro', 'clique', 'abrir', 'fechar', 'dourado', 'douradoPego', 'plantar', 'mae', 'shopee', 'call', 'telaAzul', 'gol',
  'trend', 'linkedin', 'pix', 'tigreGira', 'tigrePaga', 'tigreCome', 'combo',
  'lixo', 'houston', 'conserto', 'zaratustra', 'valsa',
] as const;
export type IdEfeito = (typeof IDS_EFEITOS)[number];
export type OpcoesEfeito = { quantas?: number; lucro?: boolean };
/** Momentos grandes: a música abaixa enquanto tocam. */
export const GRANDES: ReadonlySet<IdEfeito> = new Set<IdEfeito>(['conquista', 'era', 'venda', 'cnpj', 'douradoPego', 'combo', 'zaratustra', 'valsa']);
export const INTERVALO_MS = 60;

type Receita = (ctx: BaseAudioContext, d: AudioNode, t: number, o: OpcoesEfeito) => number;
const { sininho, moeda, vibrafone, metais, caixa, bumbo, piano, baixo, grave, orgao, timpano } = INSTRUMENTOS;
const PENTA = [77, 79, 81, 84, 86, 89, 91, 93]; // Fá maior pentatônica, de cima
const FA6_PIANO = [57, 60, 62]; // Lá, Dó, Ré

function acorde(ctx: BaseAudioContext, d: AudioNode, t: number, notas: number[], dur: number, forca: number, toque = metais) {
  for (const n of notas) toque(ctx, d, t, n, dur, forca);
}
/** "Toc" de botão: uma nota senoidal curta que escorrega de `de` até `ate` Hz, ataque de 3 ms e queda rápida. Sem ruído:
 *  o chiado de antes (ruído passa-alta) soava como choque (o Juan, 15/10). */
function toc(ctx: BaseAudioContext, d: AudioNode, t: number, de: number, ate: number, dura: number, pico: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(pico, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
  g.connect(d);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(de, t);
  o.frequency.exponentialRampToValueAtTime(ate, t + dura);
  o.connect(g);
  o.start(t);
  o.stop(t + dura + 0.02);
}
/** Ruído curto filtrado: "fuu" (passa-banda que corre de `de` até `ate`) ou chiado (passa-baixa/alta). */
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

/** Bipe quadrado de alarme (o Houston): tom fixo, corte seco. */
function sirene(ctx: BaseAudioContext, d: AudioNode, t: number, f: number, dura: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.01);
  g.gain.setValueAtTime(0.05, t + dura - 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
  g.connect(d);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  lp.connect(g);
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(f, t);
  o.connect(lp);
  o.start(t);
  o.stop(t + dura + 0.02);
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
  clique: (c, d, t) => { // toc de madeira: grave, curtinho e baixo
    toc(c, d, t, 900, 450, 0.05, 0.09);
    return 0.06;
  },
  abrir: (c, d, t) => { // duas notinhas subindo (Dó → Fá)
    toc(c, d, t, 523, 500, 0.06, 0.07);
    toc(c, d, t + 0.05, 698, 670, 0.07, 0.07);
    return 0.13;
  },
  fechar: (c, d, t) => { // as mesmas descendo (Fá → Dó)
    toc(c, d, t, 698, 670, 0.06, 0.07);
    toc(c, d, t + 0.05, 523, 500, 0.07, 0.07);
    return 0.13;
  },
  dourado: (c, d, t) => {
    [77, 81, 84, 89, 93, 96].forEach((m, i) => sininho(c, d, t + i * 0.07, m, 0.2, 0.75));
    [96, 98, 96, 98, 96].forEach((m, i) => sininho(c, d, t + 0.45 + i * 0.06, m, 0.1, 0.35));
    return 1.3;
  },
  // eventos de era (14/10)
  mae: (c, d, t) => { // campainha de porta: dim-dom
    sininho(c, d, t, 84, 0.35, 0.8);
    sininho(c, d, t + 0.3, 79, 0.5, 0.8);
    return 0.9;
  },
  shopee: (c, d, t) => { // caixa caindo e abrindo
    bumbo(c, d, t, 0, 0.12, 0.5);
    ruidoFiltrado(c, d, t + 0.1, 'bandpass', 1800, 500, 0.15, 0.1);
    return 0.4;
  },
  call: (c, d, t) => { // "tutum" de sair da call
    sininho(c, d, t, 72, 0.12, 0.6);
    sininho(c, d, t + 0.14, 67, 0.2, 0.6);
    return 0.4;
  },
  telaAzul: (c, d, t) => { // bipe de erro do PC
    [70, 70, 70].forEach((m, i) => sininho(c, d, t + i * 0.18, m, 0.12, 0.5));
    return 0.6;
  },
  gol: (c, d, t) => { // apito + a torcida
    [96, 96].forEach((m, i) => sininho(c, d, t + i * 0.12, m, 0.08, 0.6));
    ruidoFiltrado(c, d, t + 0.25, 'bandpass', 900, 700, 0.6, 0.12);
    return 0.9;
  },
  plantar: (c, d, t) => {
    // "ploc" de terra: um baque grave que cai, com um chiado curto de terra
    bumbo(c, d, t, 0, 0.15, 0.45);
    ruidoFiltrado(c, d, t, 'lowpass', 900, 300, 0.12, 0.05);
    return 0.3;
  },
  douradoPego: (c, d, t) => {
    acorde(c, d, t, [69, 72, 77], 0.5, 0.9);
    [89, 93, 96, 101].forEach((m, i) => sininho(c, d, t + i * 0.05, m, 0.2, 0.7));
    return 1.1;
  },
  // dourados novos (0076), afinados em Fá
  trend: (c, d, t) => { // moedinha curta, uma por clique
    moeda(c, d, t, 89, 0.08, 0.6);
    return 0.15;
  },
  linkedin: (c, d, t) => { // plim de notificação
    sininho(c, d, t, 84, 0.12, 0.7);
    sininho(c, d, t + 0.09, 89, 0.3, 0.7);
    return 0.5;
  },
  pix: (c, d, t) => { // caixa registradora: o trinco e as moedas
    caixa(c, d, t, 0, 0.06, 0.5);
    moeda(c, d, t + 0.06, 96, 0.2, 0.8);
    moeda(c, d, t + 0.13, 101, 0.3, 0.7);
    return 0.5;
  },
  tigreGira: (c, d, t) => { // o rolo: notinhas subindo e voltando
    [77, 81, 84, 89, 84, 81, 77, 81, 84, 89].forEach((m, i) => moeda(c, d, t + i * 0.13, m, 0.06, 0.35));
    return 1.4;
  },
  tigrePaga: (c, d, t) => {
    acorde(c, d, t, [77, 81, 84], 0.4, 0.8);
    [89, 93, 96, 101].forEach((m, i) => sininho(c, d, t + 0.1 + i * 0.06, m, 0.25, 0.6));
    return 1.0;
  },
  tigreCome: (c, d, t) => { // trombone descendo
    metais(c, d, t, 70, 0.22, 0.6);
    metais(c, d, t + 0.24, 65, 0.5, 0.6);
    return 0.8;
  },
  combo: (c, d, t) => { // fanfarra curta: Fá, Si bemol, Dó, Fá
    acorde(c, d, t, [65, 69, 72], 0.1, 0.8);
    acorde(c, d, t + 0.12, [70, 74, 77], 0.1, 0.8);
    acorde(c, d, t + 0.24, [72, 76, 79], 0.1, 0.85);
    acorde(c, d, t + 0.38, [77, 81, 84], 0.7, 1);
    sininho(c, d, t + 0.38, 96, 0.5, 0.6);
    return 1.2;
  },
  // eventos das eras 6 e 7 (0078)
  lixo: (c, d, t) => { // "tum" de destroço desviado
    bumbo(c, d, t, 0, 0.2, 0.8);
    ruidoFiltrado(c, d, t, 'lowpass', 700, 200, 0.18, 0.06);
    return 0.3;
  },
  houston: (c, d, t) => { // o alarme da estação: dois tons alternando
    [81, 76, 81, 76].forEach((m, i) => sirene(c, d, t + i * 0.2, hz(m), 0.18));
    return 0.85;
  },
  conserto: (c, d, t) => { // a fita rasgando e o "pronto"
    ruidoFiltrado(c, d, t, 'highpass', 1500, 5000, 0.25, 0.07);
    sininho(c, d, t + 0.28, 84, 0.3, 0.6);
    return 0.7;
  },
  // eras 6–7 (0078): a fanfarra de "Assim Falou Zaratustra" (R. Strauss, 1896, domínio público) ao entrar na era 6 e o
  // começo do "Danúbio Azul" (J. Strauss II, 1867, domínio público) na melhoria da valsa
  zaratustra: (c, d, t) => {
    grave(c, d, t, 36, 5, 0.9); // o Dó grave segurando tudo
    orgao(c, d, t, 48, 5, 0.6);
    metais(c, d, t + 0.6, 60, 0.9, 0.7); // Dó
    metais(c, d, t + 1.5, 67, 0.9, 0.75); // Sol
    metais(c, d, t + 2.4, 72, 0.6, 0.85); // Dó
    acorde(c, d, t + 3.0, [64, 67, 72], 0.35, 0.9); // maior…
    acorde(c, d, t + 3.4, [63, 67, 72], 1.4, 0.95); // …que vira menor
    [0, 0.3, 0.6, 0.9, 1.2, 1.5].forEach((x, i) => timpano(c, d, t + 3.4 + x, i % 2 ? 31 : 36, 0.25, 0.8));
    return 6;
  },
  valsa: (c, d, t) => {
    const b = 0.3; // um tempo
    ([[41, 0], [36, 3], [41, 6]] as const).forEach(([m, k]) => baixo(c, d, t + k * b, m, 0.25, 0.7)); // o "um"
    for (const k of [1, 2, 4, 5, 7, 8]) acorde(c, d, t + k * b, [57, 60, 65], 0.18, 0.4, piano); // o "pa-pa"
    ([[0, 65, 0.28], [1, 69, 0.28], [2, 72, 0.28], [3, 72, 0.85], [7, 84, 0.25], [8, 84, 0.3]] as const)
      .forEach(([k, m, dur]) => vibrafone(c, d, t + k * b, m, dur, 0.75));
    return 2.9;
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
