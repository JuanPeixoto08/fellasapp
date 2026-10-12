// A camisetaria (Fellas Inc., lugar 3 do Mapa do rolê): o catálogo (temas, estilos, peças, cores, influencers) e as contas
// puras de nota, procura, venda e nome. O banco faz as mesmas contas (teste de paridade): conta de nota é em inteiros
// (décimos) para bater bit a bit; o que é decimal (procura, preço) é só para mostrar e para o relatório.
import { semanaIdx } from './mapa';

export type Vibe = 'zoeira' | 'raiz' | 'fofo' | 'sombrio' | 'retro' | 'esporte' | 'nerd' | 'praia' | 'chique' | 'bruto' | 'urbano' | 'grana';
export type Tema = { id: number; nome: string; vibes: readonly Vibe[]; nivel: number };
export type Estilo = { id: number; nome: string; vibes: readonly Vibe[]; foco: readonly [number, number, number]; nivel: number };
export type Peca = { id: number; nome: string; custo: number; mult: number; gosta: readonly Vibe[]; odeia: readonly Vibe[]; nivel: number };
export type Cor = { id: number; nome: string; hex: string; forte: boolean; nivel: number };
export type Influencer = { id: number; nome: string; gosto: string };
export type Rotulo = 0 | 1 | 2 | 3 | 4; // péssima, ruim, ok, boa, ótima

/** Ajustados na Task 2 (camisetariaSim.test.ts, 16 sementes): 75 de público mantém a % de procura abaixo de 1000% (teto
 *  75 × 4 / 36 = 833%); o lote crescendo 1,35 por nível contra 1,55 do preço do nível acelera o começo e segura o fim
 *  (nível 10 no dia ~7, nível 25 no dia ~40); o preço a 6,5× o custo paga os ~9.200 cupons até o nível 10 em uma semana. */
export const PUBLICO_BASE = 75;
export const CRESCE = 1.35;
export const PRECO_MULT = 6.5;

const TODAS: readonly Vibe[] = ['zoeira', 'raiz', 'fofo', 'sombrio', 'retro', 'esporte', 'nerd', 'praia', 'chique', 'bruto', 'urbano', 'grana'];

/** Nível do lugar em que cada coisa chega (2 a 25); o que não está aqui já vem no nível 1. */
export const LIBERA: Readonly<Record<number, readonly string[]>> = {
  2: ['tema:7', 'estilo:4'], 3: ['tema:8', 'cor:5'], 4: ['tema:9', 'peca:3'], 5: ['tema:10', 'estilo:5'], 6: ['tema:11', 'cor:6'],
  7: ['tema:12', 'estilo:6'], 8: ['tema:13', 'peca:4'], 9: ['tema:14', 'cor:7'], 10: ['tema:15', 'estilo:7'], 11: ['tema:16', 'estilo:8'],
  12: ['tema:17', 'cor:8'], 13: ['tema:18', 'peca:5'], 14: ['tema:19', 'estilo:9'], 15: ['tema:20', 'cor:9'], 16: ['tema:21', 'estilo:10'],
  17: ['tema:22', 'cor:10'], 18: ['tema:23', 'estilo:11'], 19: ['tema:24', 'peca:6'], 20: ['tema:25', 'estilo:12'], 21: ['tema:26', 'cor:11'],
  22: ['tema:27', 'estilo:13'], 23: ['tema:28', 'cor:12'], 24: ['tema:29', 'estilo:14'], 25: ['tema:30', 'estilo:15'],
};

const NIVEL_DE = new Map<string, number>(Object.entries(LIBERA).flatMap(([n, itens]) => itens.map((i) => [i, Number(n)] as const)));
const nivelDe = (tipo: string, id: number): number => NIVEL_DE.get(`${tipo}:${id}`) ?? 1;

const temas: [string, Vibe[]][] = [
  ['Meme', ['zoeira', 'nerd']], ['Praia', ['praia', 'raiz']], ['Futebol de várzea', ['esporte', 'raiz', 'bruto']], ['Forró', ['raiz', 'retro']],
  ['Gato', ['fofo', 'zoeira']], ['Café', ['chique', 'urbano']], ['Signo', ['chique', 'fofo']], ['Anime', ['nerd', 'fofo']],
  ['Crise financeira', ['grana', 'zoeira', 'sombrio']], ['Cuscuz', ['raiz', 'zoeira']], ['Cachorro caramelo', ['fofo', 'raiz']],
  ['Carro rebaixado', ['bruto', 'urbano', 'zoeira']], ['Boleto', ['grana', 'sombrio']], ['Academia', ['esporte', 'bruto']],
  ['Caveira', ['sombrio', 'bruto']], ['Skate', ['urbano', 'esporte']], ['Jacaré', ['praia', 'bruto']], ['Coach quântico', ['grana', 'zoeira']],
  ['Pix', ['grana', 'urbano']], ['Ressaca', ['zoeira', 'sombrio']], ['Game', ['nerd', 'retro']], ['Tubarão', ['praia', 'sombrio']],
  ['Caju', ['raiz', 'praia']], ['Astronauta', ['nerd', 'retro']], ['Dinossauro', ['retro', 'fofo']], ['Pagode', ['raiz', 'zoeira']],
  ['Flor', ['fofo', 'chique']], ['Jampa raiz', ['raiz', 'praia', 'urbano']], ['Crush', ['fofo', 'zoeira']], ['Rock', ['sombrio', 'retro', 'bruto']],
];
export const TEMAS: readonly Tema[] = temas.map(([nome, vibes], k) => ({ id: k + 1, nome, vibes, nivel: nivelDe('tema', k + 1) }));

const estilos: [string, Vibe[], [number, number, number]][] = [
  ['Minimalista', ['chique', 'urbano'], [3, 5, 2]], ['Rabisco de caneta', ['zoeira', 'nerd'], [6, 1, 3]], ['Pixel', ['nerd', 'retro'], [6, 2, 2]],
  ['Grafite', ['urbano', 'bruto'], [5, 2, 3]], ['Vintage desbotado', ['retro', 'raiz'], [3, 5, 2]], ['Estêncil', ['urbano', 'sombrio'], [5, 3, 2]],
  ['Tie-dye', ['praia', 'fofo'], [2, 6, 2]], ['Xilogravura de cordel', ['raiz', 'retro', 'zoeira'], [6, 3, 1]], ['Neon', ['urbano', 'zoeira'], [4, 1, 5]],
  ['Bordado', ['fofo', 'raiz', 'chique'], [2, 7, 1]], ['Pop art', ['zoeira', 'retro'], [5, 1, 4]], ['Colagem', ['zoeira', 'urbano'], [4, 2, 4]],
  ['Aquarela', ['fofo', 'praia', 'chique'], [6, 3, 1]], ['Gótico', ['sombrio', 'bruto'], [4, 4, 2]], ['Y2K', ['retro', 'fofo', 'zoeira'], [3, 2, 5]],
];
export const ESTILOS: readonly Estilo[] = estilos.map(([nome, vibes, foco], k) => ({ id: k + 1, nome, vibes, foco, nivel: nivelDe('estilo', k + 1) }));

const pecas: [string, number, number, Vibe[], Vibe[]][] = [
  ['Camiseta', 3, 1.0, ['zoeira'], []],
  ['Ecobag', 2, 0.8, ['fofo', 'chique', 'raiz'], ['bruto', 'esporte']],
  ['Regata', 3, 0.9, ['praia', 'esporte'], ['chique', 'sombrio']],
  ['Boné', 4, 0.7, ['esporte', 'urbano', 'raiz'], ['fofo']],
  ['Cropped', 3, 0.8, ['fofo', 'chique', 'zoeira'], ['bruto', 'esporte']],
  ['Moletom', 6, 0.5, ['sombrio', 'nerd'], TODAS.filter((v) => v !== 'sombrio' && v !== 'nerd')],
];
export const PECAS: readonly Peca[] = pecas.map(([nome, custo, mult, gosta, odeia], k) => ({ id: k + 1, nome, custo, mult, gosta, odeia, nivel: nivelDe('peca', k + 1) }));

const cores: [string, string, boolean][] = [
  ['Preto', '#1B1B1F', false], ['Branco', '#F4F1EA', false], ['Amarelo', '#F2C230', true], ['Cinza mescla', '#8D8F93', false],
  ['Off-white', '#E8E0CC', false], ['Vermelho', '#D23A3A', true], ['Verde-bandeira', '#1F8A4C', false], ['Azul-marinho', '#23315A', false],
  ['Rosa', '#E98BB3', true], ['Laranja', '#EE7A2D', true], ['Roxo', '#7A4FC4', true], ['Verde-limão', '#A6D93A', true],
];
export const CORES: readonly Cor[] = cores.map(([nome, hex, forte], k) => ({ id: k + 1, nome, hex, forte, nivel: nivelDe('cor', k + 1) }));

export const INFLUENCERS: readonly Influencer[] = [
  { id: 1, nome: '@hojetemjp', gosto: 'Página de moda: gosta do tema que está em alta na semana' },
  { id: 2, nome: '@SuperMauro64', gosto: 'Gosta de Vintage desbotado, de Bordado e de cor forte' },
  { id: 3, nome: '@mcresenha', gosto: 'Só usa camisa de time: Futebol de várzea ou nada' },
  { id: 4, nome: '@luisviton', gosto: 'O crítico chato: só se rende a uma combinação ótima bem no foco' },
];

export const CONFLITOS: readonly (readonly [Vibe, Vibe])[] = [
  ['fofo', 'sombrio'], ['fofo', 'bruto'], ['chique', 'bruto'], ['chique', 'zoeira'], ['nerd', 'esporte'], ['praia', 'sombrio'],
];

export const NOME_ROTULO: readonly string[] = ['Combinação péssima', 'Combinação ruim', 'Combinação ok', 'Combinação boa', 'Combinação ótima!'];

export function liberado(tipo: 'tema' | 'estilo' | 'peca' | 'cor', id: number, nivel: number): boolean {
  return nivel >= nivelDe(tipo, id);
}

const emConflito = (a: Vibe, b: Vibe): boolean => CONFLITOS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Quão bem o tema e o estilo se dão: 2 por vibe em comum, -2 por par em conflito, e um empurrãozinho fixo de -1, 0 ou +1. */
export function rotulo(tema: number, estilo: number): Rotulo {
  const t = TEMAS[tema - 1].vibes;
  const e = ESTILOS[estilo - 1].vibes;
  const comum = t.filter((v) => e.includes(v)).length;
  const conflitos = t.reduce((soma, a) => soma + e.filter((b) => emConflito(a, b)).length, 0);
  const s = 2 * comum - 2 * conflitos + (((tema * 31 + estilo * 17) % 3) - 1);
  if (s >= 3) return 4;
  if (s === 2) return 3;
  if (s >= 0) return 2;
  if (s >= -2) return 1;
  return 0;
}

/** +1 se a peça combina com o tema, -1 se brigam, 0 no resto. */
export function pecaTema(peca: number, tema: number): -1 | 0 | 1 {
  const p = PECAS[peca - 1];
  const vibes = TEMAS[tema - 1].vibes;
  if (vibes.some((v) => p.gosta.includes(v))) return 1;
  if (vibes.some((v) => p.odeia.includes(v))) return -1;
  return 0;
}

/** Distância entre o foco da pessoa (arte, tecido, divulgação) e o ideal do estilo: (|Δa|+|Δt|+|Δd|)/2, inteira (os dois somam 10). */
export function distanciaFoco(estilo: number, foco: readonly [number, number, number]): number {
  const ideal = ESTILOS[estilo - 1].foco;
  return Math.floor((Math.abs(foco[0] - ideal[0]) + Math.abs(foco[1] - ideal[1]) + Math.abs(foco[2] - ideal[2])) / 2);
}

export type Lancamento = {
  id: number; tema: number; estilo: number; peca: number; cor: number; foco: readonly [number, number, number]; lote: 0 | 1 | 2;
  nivel: number; fas: number; tendencia: number; ultimas: readonly { tema: number; estilo: number }[];
};

const BASE10 = [25, 40, 60, 75, 90];

/** As quatro notas (1 a 10) na ordem dos INFLUENCERS. Tudo em décimos inteiros; a nota é floor((total10 + 5) / 10). */
export function notas(l: Lancamento): [number, number, number, number] {
  const rot = rotulo(l.tema, l.estilo);
  const dist = distanciaFoco(l.estilo, l.foco);
  const ultima = l.ultimas[0];
  const ultimas3 = l.ultimas.slice(0, 3);
  let rep10 = 0;
  if (ultimas3.some((u) => u.tema === l.tema && u.estilo === l.estilo)) rep10 = -20;
  else if (ultima && (ultima.tema === l.tema || ultima.estilo === l.estilo)) rep10 = -10;
  const base10 = BASE10[rot] + 10 * pecaTema(l.peca, l.tema) - 3 * dist + rep10 + (l.tema === l.tendencia ? 10 : 0);
  const gosto = [
    l.tema === l.tendencia ? 1 : 0,
    (l.estilo === 5 || l.estilo === 10 || CORES[l.cor - 1].forte) ? 1 : 0,
    l.tema === 3 ? 2 : -1,
    rot === 4 && dist <= 1 ? 1 : -1,
  ];
  return gosto.map((g, k) => {
    const sorte10 = ((l.id * 7919 + (k + 1) * 104729) % 11) - 5;
    const total10 = base10 + 10 * g + sorte10;
    return Math.min(10, Math.max(1, Math.floor((total10 + 5) / 10)));
  }) as [number, number, number, number];
}

/** Peças de um lote (0 pequeno, 1 médio, 2 grande) no nível dado. */
export function pecasLote(nivel: number, lote: 0 | 1 | 2): number {
  return Math.round(12 * CRESCE ** (nivel - 1)) * [1, 3, 7][lote];
}

/** Quanta gente passa por aqui querendo camisa no nível dado. */
export function publico(nivel: number): number {
  return PUBLICO_BASE * CRESCE ** (nivel - 1);
}

/** Teto do bônus de fãs na procura (√fãs/30 para de crescer aqui: no máximo 4× o público). */
export const FAS_TETO = 3;

/** Quantas peças a freguesia quer: público × (média/10)² × bônus de fãs × a pegada da peça. */
export function procura(l: Lancamento, ns: readonly number[]): number {
  const media = ns.reduce((a, b) => a + b, 0) / 4;
  return publico(l.nivel) * (media / 10) ** 2 * (1 + Math.min(Math.sqrt(l.fas) / 30, FAS_TETO)) * PECAS[l.peca - 1].mult;
}

/** Fãs que a coleção traz pela nota ao ser revelada: com média 7 ou mais, 10% do público do nível por ponto acima de 6. */
export function fasNota(media: number, nivel: number): number {
  return media >= 7 ? Math.round(publico(nivel) * 0.1 * (media - 6)) : 0;
}

/** Fãs que a procura que sobrou (depois de esgotar) traz no fim da venda: metade da sobra, até 20% do público do nível. */
export function fasExcesso(procuraTotal: number, estoque: number, nivel: number): number {
  return Math.min(0.5 * Math.max(0, procuraTotal - estoque), publico(nivel) * 0.2);
}

/** A procura em % do lote médio (100% = vende o lote médio inteiro). */
export function pctProcura(l: Lancamento, ns: readonly number[]): number {
  return (procura(l, ns) / pecasLote(l.nivel, 1)) * 100;
}

export function custoLote(peca: number, nivel: number, lote: 0 | 1 | 2): number {
  return PECAS[peca - 1].custo * pecasLote(nivel, lote);
}

export function precoPeca(peca: number): number {
  return PECAS[peca - 1].custo * PRECO_MULT;
}

/** "O fornecedor fia": sem coleção rodando e sem cupom para o lote pequeno da peça escolhida, o lote pequeno sai de graça,
 *  no máximo uma vez a cada 24 h (ultimoFiadoMs null = nunca fiou). Assim ninguém fica travado sem cupom. */
export function podeFiar(semColecaoAtiva: boolean, moeda: number, custoPequeno: number, ultimoFiadoMs: number | null, agoraMs: number): boolean {
  if (!semColecaoAtiva || moeda >= custoPequeno) return false;
  return ultimoFiadoMs === null || agoraMs - ultimoFiadoMs >= 24 * 3600_000;
}

export function producaoMs(lote: 0 | 1 | 2): number {
  return [1, 2, 4][lote] * 3600_000;
}

export const VENDA_MS = 12 * 3600_000;

const H = 3600_000;
const DIA = 24 * H;
const SEMANA = 7 * DIA;
/** Brasília é UTC−3 fixo. O epoch foi numa quinta (a segunda veio 4 dias depois); contamos a semana a partir da segunda 00h de Brasília. */
const DESLOCA = -(4 * DIA + 3 * H);
/** Janelas de show em ms desde a segunda 00h de Brasília: sexta 18h-sábado 2h e sábado 18h-domingo 2h. */
const SHOWS: readonly (readonly [number, number])[] = [[4 * DIA + 18 * H, 5 * DIA + 2 * H], [5 * DIA + 18 * H, 6 * DIA + 2 * H]];
const EXTRA_SEMANA = SHOWS.reduce((s, [a, b]) => s + (b - a), 0);

/** Peso acumulado desde o epoch (peso 1 sempre, mais 1 por ms dentro de um show). */
function acumulado(t: number): number {
  const s = t + DESLOCA;
  const semanas = Math.floor(s / SEMANA);
  const u = s - semanas * SEMANA;
  const extra = SHOWS.reduce((soma, [a, b]) => soma + Math.max(0, Math.min(u, b) - a), 0);
  return semanas * (SEMANA + EXTRA_SEMANA) + u + extra;
}

/** Integral do peso da venda entre dois instantes, em ms: 1 no resto da semana, 2 nos shows. */
export function pesoVenda(aMs: number, bMs: number): number {
  return acumulado(bMs) - acumulado(aMs);
}

/** Quanto do lote já vendeu em `tMs`: o total reparte-se pelas 12 h na proporção do peso (t preso entre o pronto e o fim). */
export function vendidoAte(total: number, prontaMs: number, tMs: number): number {
  const t = Math.min(Math.max(tMs, prontaMs), prontaMs + VENDA_MS);
  return (total * pesoVenda(prontaMs, t)) / pesoVenda(prontaMs, prontaMs + VENDA_MS);
}

/** Tema em alta na semana (segunda 'YYYY-MM-DD'): o mesmo para todo mundo, igual no banco. */
export function tendencia(semana: string): number {
  return 1 + semanaIdx(3, 1, 30, semana);
}

const PREFIXO = ['Drop', 'Coleção', 'Linha', 'Edição'];
const SUFIXO = ['', ' Vol. 2', ' Raiz', ' do Caos', ' Premium', ' que Ninguém Pediu'];

/** Nome de coleção para a pessoa não ficar travada; no máximo 30 letras (cai pro sem sufixo, depois só o tema). */
export function nomeSugerido(tema: number, estilo: number, n: number): string {
  const nome = TEMAS[tema - 1].nome;
  const cheio = `${PREFIXO[(tema + n) % 4]} ${nome}${SUFIXO[(estilo + 2 * n) % 6]}`;
  if ([...cheio].length <= 30) return cheio;
  const semSufixo = `${PREFIXO[(tema + n) % 4]} ${nome}`;
  return [...semSufixo].length <= 30 ? semSufixo : nome;
}

/** Preço do relatório dos influencers no nível dado: 50 × CRESCE^(nível−1). */
export function precoRelatorio(nivel: number): number {
  return 50 * CRESCE ** (nivel - 1);
}
