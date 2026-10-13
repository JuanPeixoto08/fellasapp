// O copão (Fellas Inc., lugar 4 do Mapa do rolê): o catálogo (sabores, bases, misturas, extras, tamanhos, DJs) e as contas
// puras de nota, noite, venda, galera e nome. O banco faz as mesmas contas (teste de paridade): a nota e as partes dela
// são inteiras (bate bit a bit); o que é decimal (preço de referência, movimento, vendas, lucro, galera) segue a mesma
// ordem de operações nos dois lados.
import { semanaIdx } from './mapa';

export type Sabor =
  | 'neutro' | 'forte' | 'raiz' | 'doce' | 'herbal' | 'citrico' | 'tropical' | 'frutado' | 'cremoso' | 'amargo' | 'energia' | 'leve' | 'salgado';
export type Base = { id: number; nome: string; sabores: readonly Sabor[]; /** força ideal */ ponto: number; /** fichas por dose */ custo: number; nivel: number };
export type Mistura = { id: number; nome: string; sabores: readonly Sabor[]; nivel: number };
export type Extra = { id: number; nome: string; sabores: readonly Sabor[]; nivel: number };
export type Tamanho = { id: number; nome: string; doses: number; /** preço de referência em fichas (força 0) */ ref: number; nivel: number };
export type Dj = { id: number; nome: string; estilo: string; /** bases que combinam com o som dele */ bases: readonly number[]; nivel: number };
export type Rotulo = 0 | 1 | 2 | 3 | 4; // péssima, ruim, ok, boa, ótima
/** 0 = base × mistura, 1 = base × extra, 2 = mistura × extra */
export type TipoPar = 0 | 1 | 2;

/** Ajustados na simulação (copaoSim.test.ts): nível 10 entre o dia 5 e o 9, nível 25 entre o dia 35 e o 49. */
export const PUBLICO_BASE = 60;
export const CRESCE = 1.25;
/** Teto do bônus da galera no movimento (√galera/30 para de crescer aqui: no máximo 4× o público). */
export const GALERA_TETO = 3;

export const SABORES: readonly Sabor[] = [
  'neutro', 'forte', 'raiz', 'doce', 'herbal', 'citrico', 'tropical', 'frutado', 'cremoso', 'amargo', 'energia', 'leve', 'salgado',
];

export const CONFLITOS: readonly (readonly [Sabor, Sabor])[] = [
  ['cremoso', 'citrico'], ['herbal', 'doce'], ['energia', 'cremoso'], ['leve', 'forte'], ['salgado', 'doce'],
];

/** Nível do lugar em que cada coisa chega (2 a 21; do 22 ao 25 só rende mais); o que não está aqui já vem no nível 1.
 *  'vaga:n' = a n-ésima vaga do cardápio. */
export const LIBERA: Readonly<Record<number, readonly string[]>> = {
  2: ['base:4', 'mistura:5'], 3: ['extra:4', 'dj:3'], 4: ['mistura:6', 'base:5'], 5: ['extra:5', 'dj:4'], 6: ['base:6', 'mistura:7'],
  7: ['tamanho:3', 'extra:6'], 8: ['mistura:8', 'dj:5'], 9: ['base:7', 'extra:7'], 10: ['mistura:9', 'dj:6'], 11: ['base:8', 'extra:8'],
  12: ['vaga:4', 'mistura:10'], 13: ['base:9', 'dj:7'], 14: ['extra:9', 'mistura:11'], 15: ['base:10', 'dj:8'], 16: ['mistura:12', 'extra:10'],
  17: ['base:11', 'dj:9'], 18: ['mistura:13', 'extra:11'], 19: ['base:12', 'mistura:14'], 20: ['vaga:5', 'dj:10'], 21: ['extra:12', 'mistura:15'],
};

const NIVEL_DE = new Map<string, number>(Object.entries(LIBERA).flatMap(([n, itens]) => itens.map((i) => [i, Number(n)] as const)));
const nivelDe = (tipo: string, id: number): number => NIVEL_DE.get(`${tipo}:${id}`) ?? 1;

const bases: [string, Sabor[], number, number][] = [
  ['Vodka', ['neutro', 'forte'], 5, 2], ['Cachaça', ['forte', 'raiz'], 4, 1], ['Catuaba', ['doce', 'raiz'], 6, 1],
  ['Gin', ['herbal', 'citrico'], 5, 3], ['Rum', ['doce', 'tropical'], 5, 2], ['Whisky de posto', ['forte', 'amargo'], 4, 2],
  ['Tequila', ['citrico', 'forte'], 4, 3], ['Corote de pêssego', ['doce', 'frutado'], 7, 1], ['Licor de chocolate', ['doce', 'cremoso'], 6, 3],
  ['Saquê', ['neutro', 'leve'], 7, 3], ['Absinto', ['herbal', 'forte', 'amargo'], 3, 4], ['Vinho de garrafão', ['frutado', 'doce', 'raiz'], 6, 1],
];
export const BASES: readonly Base[] = bases.map(([nome, sabores, ponto, custo], k) => ({ id: k + 1, nome, sabores, ponto, custo, nivel: nivelDe('base', k + 1) }));

const misturas: [string, Sabor[]][] = [
  ['Energético tradicional', ['doce', 'energia']], ['Refri de guaraná', ['doce', 'raiz']], ['Suco de laranja', ['citrico', 'frutado']],
  ['Refri de cola', ['doce', 'amargo']], ['Energético de melancia', ['frutado', 'energia']], ['Suco de maracujá', ['citrico', 'tropical']],
  ['Água tônica', ['amargo', 'leve']], ['Energético de açaí', ['frutado', 'energia', 'cremoso']], ['Refri de limão', ['citrico', 'leve']],
  ['Xarope de groselha', ['doce', 'frutado']], ['Chá gelado', ['herbal', 'leve']], ['Energético tropical', ['tropical', 'energia']],
  ['Isotônico', ['leve', 'neutro']], ['Leite condensado', ['cremoso', 'doce']], ['Energético sem açúcar', ['energia', 'leve']],
];
export const MISTURAS: readonly Mistura[] = misturas.map(([nome, sabores], k) => ({ id: k + 1, nome, sabores, nivel: nivelDe('mistura', k + 1) }));

const extras: [string, Sabor[]][] = [
  ['Limão', ['citrico']], ['Gelo de coco', ['tropical', 'cremoso']], ['Morango', ['frutado', 'doce']], ['Maracujá', ['tropical', 'citrico']],
  ['Hortelã', ['herbal', 'leve']], ['Bala de goma', ['doce']], ['Abacaxi', ['tropical', 'frutado']], ['Canela', ['raiz', 'doce']],
  ['Pimenta', ['forte']], ['Sal na borda', ['salgado']], ['Açúcar na borda', ['doce']], ['Fruta vermelha', ['frutado']],
];
export const EXTRAS: readonly Extra[] = extras.map(([nome, sabores], k) => ({ id: k + 1, nome, sabores, nivel: nivelDe('extra', k + 1) }));

const tamanhos: [string, number, number][] = [['Copo', 1, 8], ['Copão', 3, 22], ['Balde', 10, 60]];
export const TAMANHOS: readonly Tamanho[] = tamanhos.map(([nome, doses, ref], k) => ({ id: k + 1, nome, doses, ref, nivel: nivelDe('tamanho', k + 1) }));

const djs: [string, string, number[]][] = [
  ['DJ Vaqueiro', 'piseiro', [2, 3, 12]], ['DJ Ramemes', 'funk', [1, 6, 8]], ['Neiff', 'brega-funk', [8, 3, 9]],
  ['DJ Robson Caetano', 'eletrônica', [1, 4, 11]], ['Ana Castela', 'sertanejo', [6, 2, 7]], ['Kannário', 'pagodão', [2, 3, 5]],
  ['Wesley Safadão', 'forró eletrônico', [6, 1, 2]], ['Veigh', 'trap', [4, 7, 9]], ['Ferrugem', 'pagode', [5, 2, 10]],
  ['Jane Remover', 'shoegaze', [11, 10, 12]],
];
export const DJS: readonly Dj[] = djs.map(([nome, estilo, bs], k) => ({ id: k + 1, nome, estilo, bases: bs, nivel: nivelDe('dj', k + 1) }));

export function liberado(tipo: 'base' | 'mistura' | 'extra' | 'tamanho' | 'dj', id: number, nivel: number): boolean {
  return nivel >= nivelDe(tipo, id);
}

/** Vagas no cardápio no nível dado: 3, mais as que o LIBERA já trouxe (4 no nível 12, 5 no 20). */
export function vagas(nivel: number): number {
  let n = 3;
  while (NIVEL_DE.has(`vaga:${n + 1}`) && nivel >= nivelDe('vaga', n + 1)) n++;
  return n;
}

const NOME_TIPO: Record<string, string> = { base: 'Base', mistura: 'Mistura', extra: 'Extra', tamanho: 'Tamanho', dj: 'DJ' };
const LISTA: Record<string, readonly { nome: string }[]> = { base: BASES, mistura: MISTURAS, extra: EXTRAS, tamanho: TAMANHOS, dj: DJS };

/** O que o nível `n` libera, para o botão de subir nível ("Base: Gin", "Vaga no cardápio: 4ª"). */
export function liberaTextos(n: number): string[] {
  return (LIBERA[n] ?? []).map((i) => {
    const [tipo, id] = i.split(':');
    if (tipo === 'vaga') return `Vaga no cardápio: ${id}ª`;
    return `${NOME_TIPO[tipo]}: ${LISTA[tipo][Number(id) - 1].nome}`;
  });
}

// ===== a nota (0 a 999, inteira) = sabor (0–399) + custo-benefício (0–250) + moda (0–150) + aguenta (0–199) =====

const emConflito = (a: Sabor, b: Sabor): boolean => CONFLITOS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Quão bem dois ingredientes se dão: 2 por sabor em comum, -2 por par em conflito, e um empurrãozinho fixo de -1, 0 ou +1
 *  ((ia·31 + ib·17 + tipo·7) mod 3 − 1). Mesmos cortes da camisetaria. */
export function rotuloPar(sabA: readonly Sabor[], sabB: readonly Sabor[], ia: number, ib: number, tipo: TipoPar): Rotulo {
  const comum = sabA.filter((s) => sabB.includes(s)).length;
  const conflitos = sabA.reduce((soma, a) => soma + sabB.filter((b) => emConflito(a, b)).length, 0);
  const s = 2 * comum - 2 * conflitos + (((ia * 31 + ib * 17 + tipo * 7) % 3) - 1);
  if (s >= 3) return 4;
  if (s === 2) return 3;
  if (s >= 0) return 2;
  if (s >= -2) return 1;
  return 0;
}

/** Os três rótulos do copão: [base × mistura, base × extra, mistura × extra]. */
export function rotulos(base: number, mistura: number, extra: number): [Rotulo, Rotulo, Rotulo] {
  const b = BASES[base - 1].sabores;
  const m = MISTURAS[mistura - 1].sabores;
  const e = EXTRAS[extra - 1].sabores;
  return [rotuloPar(b, m, base, mistura, 0), rotuloPar(b, e, base, extra, 1), rotuloPar(m, e, mistura, extra, 2)];
}

/** Pontos de sabor por rótulo (péssima a ótima). */
export const PONTOS: readonly number[] = [0, 40, 75, 105, 133];

export function sabor(base: number, mistura: number, extra: number): number {
  return rotulos(base, mistura, extra).reduce<number>((s, r) => s + PONTOS[r], 0);
}

/** Preço de referência (fichas; decimal): ref do tamanho · (20 + força) / 20. */
export function precoRef(tamanho: number, forca: number): number {
  return (TAMANHOS[tamanho - 1].ref * (20 + forca)) / 20;
}

/** Faixa do preço (inteiro): de ceil(0,5 · referência) a floor(2 · referência). */
export function precoFaixa(tamanho: number, forca: number): [number, number] {
  const ref = precoRef(tamanho, forca);
  return [Math.ceil(0.5 * ref), Math.floor(2 * ref)];
}

export function precoValido(tamanho: number, forca: number, preco: number): boolean {
  const [lo, hi] = precoFaixa(tamanho, forca);
  return Number.isInteger(preco) && preco >= lo && preco <= hi;
}

/** round(250 · clamp((2 − preço/ref) / 1,5, 0, 1)) com round = floor(x + 0,5), feita em inteiros para bater com o banco:
 *  com D = ref do tamanho · (20 + força), preço/ref = 20·preço/D e (2 − 20·preço/D)/1,5 = (4D − 40·preço)/(3D) = num/den;
 *  250·num/den + 0,5 = (500·num + den)/(2·den). Bate com a conta em double em todo preço válido (teste). */
export function custoBeneficio(tamanho: number, forca: number, preco: number): number {
  const d = TAMANHOS[tamanho - 1].ref * (20 + forca);
  const num = 4 * d - 40 * preco;
  const den = 3 * d;
  if (num <= 0) return 0;
  if (num >= den) return 250;
  return Math.floor((500 * num + den) / (2 * den));
}

/** O copão da moda da semana (segunda 'YYYY-MM-DD'): uma base e uma mistura, as mesmas para todo mundo, igual no banco. */
export function modaDaSemana(semana: string): { base: number; mistura: number } {
  return { base: 1 + semanaIdx(4, 1, 12, semana), mistura: 1 + semanaIdx(4, 2, 15, semana) };
}

/** 150 se base e mistura são as da moda, 75 se uma, 0 se nenhuma. */
export function moda(base: number, mistura: number, semana: string): number {
  const m = modaDaSemana(semana);
  return 75 * ((base === m.base ? 1 : 0) + (mistura === m.mistura ? 1 : 0));
}

/** Se a galera aguenta: 199 um acima do ponto da base, 170 no ponto, 140 um abaixo; mais longe cai (45 por ponto acima,
 *  35 por ponto abaixo), piso 0. */
export function aguenta(forca: number, ponto: number): number {
  const f = forca - ponto;
  if (f === 1) return 199;
  if (f === 0) return 170;
  if (f === -1) return 140;
  if (f >= 2) return Math.max(0, 170 - 45 * f);
  return Math.max(0, 140 + 35 * (f + 1));
}

/** Chance de PT por noite, em %: (força − ponto) · 10 acima do ponto da base. */
export function chancePT(forca: number, ponto: number): number {
  return Math.max(0, forca - ponto) * 10;
}

/** Deu PT na noite? Sorte fixa por (copão, noite): reabrir dá o mesmo. `noite` = noiteIdx do início da noite. */
export function deuPT(copaoId: number, noite: number, chance: number): boolean {
  return (copaoId * 7919 + noite * 104729 + 4) % 100 < chance;
}

export type Copao = { base: number; mistura: number; extra: number; tamanho: number; forca: number; preco: number };
export type Avaliacao = {
  rotulos: [Rotulo, Rotulo, Rotulo]; sabor: number; custoBeneficio: number; moda: number; aguenta: number; nota: number; chancePT: number;
};

/** A nota e as partes dela (moda da semana em que o copão entrou no cardápio). */
export function avaliar(c: Copao, semana: string): Avaliacao {
  const rs = rotulos(c.base, c.mistura, c.extra);
  const ponto = BASES[c.base - 1].ponto;
  const s = rs.reduce<number>((t, r) => t + PONTOS[r], 0);
  const cb = custoBeneficio(c.tamanho, c.forca, c.preco);
  const m = moda(c.base, c.mistura, semana);
  const a = aguenta(c.forca, ponto);
  return { rotulos: rs, sabor: s, custoBeneficio: cb, moda: m, aguenta: a, nota: s + cb + m + a, chancePT: chancePT(c.forca, ponto) };
}

export function nota(c: Copao, semana: string): number {
  return avaliar(c, semana).nota;
}

// ===== as noites: o bar abre das 18h às 2h de Brasília (UTC−3 fixo), todo dia =====

const H = 3600_000;
const DIA = 24 * H;
export const NOITE_MS = 8 * H;
/** 2026-01-05 (uma segunda) às 18h de Brasília: a noite 0. */
const NOITE_0 = Date.UTC(2026, 0, 5, 21);

/** Início da noite do dia 'YYYY-MM-DD': 18h de Brasília (21h UTC). */
export function inicioNoite(dia: string): number {
  const [a, m, d] = dia.split('-').map(Number);
  return Date.UTC(a, m - 1, d, 21);
}

export function fimNoite(inicioMs: number): number {
  return inicioMs + NOITE_MS;
}

/** Número da noite: dias desde 2026-01-05 do dia (em Brasília) em que ela começa. */
export function noiteIdx(inicioMs: number): number {
  return Math.floor((inicioMs - NOITE_0) / DIA);
}

/** Inícios das noites em [aMs, bMs), em ordem. */
export function noitesEntre(aMs: number, bMs: number): number[] {
  const out: number[] = [];
  for (let t = NOITE_0 + Math.ceil((aMs - NOITE_0) / DIA) * DIA; t < bMs; t += DIA) out.push(t);
  return out;
}

/** A noite abre se a pessoa passou pelo jogo desde 24 h antes do início (desde a noite anterior); senão ninguém abriu o bar. */
export function abreNoite(inicioMs: number, vistoMs: number | null): boolean {
  return vistoMs !== null && vistoMs >= inicioMs - DIA;
}

/** A noite que começa na sexta 18h (vai até sábado 2h). */
export function ehSexta(inicioMs: number): boolean {
  return new Date(inicioMs - 3 * H).getUTCDay() === 5;
}

/** Quanto do total da noite já vendeu em `tMs`: linear nas 8 h, preso nas pontas. */
export function vendidoNaNoite(total: number, inicioMs: number, tMs: number): number {
  const t = Math.min(Math.max(tMs - inicioMs, 0), NOITE_MS);
  return (total * t) / NOITE_MS;
}

// ===== movimento, vendas, lucro e galera =====

/** Quanta gente passa pelo bar numa noite no nível dado (sem a galera). */
export function publico(nivel: number): number {
  return PUBLICO_BASE * CRESCE ** (nivel - 1);
}

/** O movimento da noite: público do nível × bônus da galera (1 + min(√galera/30, 3)). */
export function movimento(nivel: number, galera: number): number {
  return publico(nivel) * (1 + Math.min(Math.sqrt(galera) / 30, GALERA_TETO));
}

/** A novidade cai 10% por noite no cardápio, até 30%. */
export function novidade(noites: number): number {
  return Math.max(0.3, 1 - 0.1 * noites);
}

export type NoCardapio = { base: number; mistura: number; nota: number; /** noites no cardápio */ noites: number };
export type Noite = { nivel: number; galera: number; sexta: boolean; /** DJ escolhido (null = nenhum) */ dj: number | null };

/** Quantos copões cada um do cardápio vende na noite inteira (na ordem do cardápio): movimento · atração_i / Σ atração ·
 *  participação, com atração = (nota/999)² · novidade · canibal (0,7 se outro do cardápio tem a mesma base e mistura) e
 *  participação = min(1, Σ atração). Sexta ×2, e na sexta o DJ escolhido dá ×1,2 nos copões das bases que ele curte. */
export function vendasNoite(cardapio: readonly NoCardapio[], n: Noite): number[] {
  const atracao = cardapio.map((c, i) => {
    const canibal = cardapio.some((o, j) => j !== i && o.base === c.base && o.mistura === c.mistura) ? 0.7 : 1;
    return (c.nota / 999) ** 2 * novidade(c.noites) * canibal;
  });
  const soma = atracao.reduce((s, a) => s + a, 0);
  if (soma <= 0) return cardapio.map(() => 0);
  const mov = movimento(n.nivel, n.galera);
  const participacao = Math.min(1, soma);
  const dj = n.sexta && n.dj !== null ? DJS[n.dj - 1] : null;
  return cardapio.map((c, i) => {
    const curte = dj !== null && dj.bases.includes(c.base) ? 1.2 : 1;
    return ((mov * atracao[i]) / soma) * participacao * (n.sexta ? 2 : 1) * curte;
  });
}

/** Lucro de cada venda (fichas): preço − doses · custo da base · (0,5 + força/10). Pode ser negativo e soma assim. */
export function lucroVenda(c: Pick<Copao, 'base' | 'tamanho' | 'forca' | 'preco'>): number {
  return c.preco - TAMANHOS[c.tamanho - 1].doses * BASES[c.base - 1].custo * (0.5 + c.forca / 10);
}

/** A galera no fim de uma noite aberta: + round(público do nível · 0,02 · média/999) com a média das notas do cardápio
 *  ≥ 600, −5% abaixo de 300; depois −15% se alguém deu PT (uma vez por noite, por mais copões em PT); piso 0. */
export function galeraNoite(galera: number, nivel: number, notas: readonly number[], pt: boolean): number {
  let g = galera;
  if (notas.length > 0) {
    const media = notas.reduce((s, x) => s + x, 0) / notas.length;
    if (media >= 600) g = g + Math.floor(publico(nivel) * 0.02 * (media / 999) + 0.5);
    else if (media < 300) g = g * 0.95;
  }
  if (pt) g = g * 0.85;
  return Math.max(0, g);
}

const PREFIXO = ['Copão', 'Balde', 'Batidão', 'Bomba'];
const SUFIXO = ['', ' da Casa', ' do Grau', ' Sem Freio', ' de Respeito', ' Proibidão'];

/** Nome de copão para a pessoa não ficar travada; no máximo 30 letras (cai pro sem sufixo, depois só a base). */
export function nomeSugerido(base: number, mistura: number, extra: number, n: number): string {
  const nome = BASES[base - 1].nome;
  const prefixo = PREFIXO[(base + n) % 4];
  const cheio = `${prefixo} de ${nome}${SUFIXO[(mistura + extra + 2 * n) % 6]}`;
  if ([...cheio].length <= 30) return cheio;
  const semSufixo = `${prefixo} de ${nome}`;
  return [...semSufixo].length <= 30 ? semSufixo : nome;
}
