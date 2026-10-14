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
export type Tamanho = { id: number; nome: string; doses: number; nivel: number };
export type Dj = { id: number; nome: string; estilo: string; /** bases que combinam com o som dele */ bases: readonly number[]; nivel: number };
export type Rotulo = 0 | 1 | 2 | 3 | 4; // péssima, ruim, ok, boa, ótima
/** 0 = base × mistura, 1 = base × extra, 2 = mistura × extra */
export type TipoPar = 0 | 1 | 2;

/** Ajustados na simulação (copaoSim.test.ts): nível 10 entre o dia 5 e o 9, nível 25 entre o dia 35 e o 49, para quem cobra o
 *  preço que dá mais lucro ao cardápio (perto da referência: de ~0,6× nas bases baratas a ~1× nas caras). */
export const PUBLICO_BASE = 35;
export const CRESCE = 1.35;
/** Quanto o preço espanta a galera: cada copão vende × (referência / preço)^ELASTICIDADE. */
export const ELASTICIDADE = 1.25;
/** O preço de referência = o custo da venda × MARKUP + TAXA por dose (precoRef). MARKUP com uma casa decimal e TAXA com
 *  duas, no máximo: 100 × a referência fica inteiro e o custo-benefício sai em inteiros (igual no banco). */
export const MARKUP = 1.5;
export const TAXA = 7.5;
/** Recipiente maior vende menos unidades: as vendas de um copão são divididas por doses^ALFA (o balde rende mais por
 *  venda, mas sai menos). */
export const ALFA = 0.9;
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

const tamanhos: [string, number][] = [['Copo', 1], ['Copão', 3], ['Balde', 10]];
export const TAMANHOS: readonly Tamanho[] = tamanhos.map(([nome, doses], k) => ({ id: k + 1, nome, doses, nivel: nivelDe('tamanho', k + 1) }));

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

/** As vagas que ainda vão chegar depois do nível dado: [vaga, nível em que libera], em ordem. */
export function vagasFuturas(nivel: number): [number, number][] {
  const out: [number, number][] = [];
  for (let n = vagas(nivel) + 1; NIVEL_DE.has(`vaga:${n}`); n++) out.push([n, nivelDe('vaga', n)]);
  return out;
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

/** O que cada venda gasta de base (fichas; decimal): doses · custo da base · (0,5 + força/10). */
export function custoVenda(base: number, tamanho: number, forca: number): number {
  return TAMANHOS[tamanho - 1].doses * BASES[base - 1].custo * (0.5 + forca / 10);
}

/** Preço de referência (fichas; decimal): doses · custo da base · (0,5 + força/10) · MARKUP + doses · TAXA (nessa ordem; o
 *  banco faz igual). Base cara e força alta pedem mais; o tamanho multiplica pelas doses. */
export function precoRef(base: number, tamanho: number, forca: number): number {
  const doses = TAMANHOS[tamanho - 1].doses;
  return doses * BASES[base - 1].custo * (0.5 + forca / 10) * MARKUP + doses * TAXA;
}

/** 100 × a referência, em inteiros: doses · (custo · (5 + força) · 10·MARKUP + 100·TAXA). */
function refCentesimos(base: number, tamanho: number, forca: number): number {
  return TAMANHOS[tamanho - 1].doses * (BASES[base - 1].custo * (5 + forca) * Math.round(MARKUP * 10) + Math.round(TAXA * 100));
}

/** Faixa do preço (inteiro): de ceil(0,5 · referência) a floor(2 · referência). */
export function precoFaixa(base: number, tamanho: number, forca: number): [number, number] {
  const ref = precoRef(base, tamanho, forca);
  return [Math.ceil(0.5 * ref), Math.floor(2 * ref)];
}

export function precoValido(base: number, tamanho: number, forca: number, preco: number): boolean {
  const [lo, hi] = precoFaixa(base, tamanho, forca);
  return Number.isInteger(preco) && preco >= lo && preco <= hi;
}

/** round(250 · clamp((2 − preço/ref) / 1,5, 0, 1)) com round = floor(x + 0,5), feita em inteiros para bater com o banco:
 *  com D = 100 · ref (inteiro, refCentesimos), preço/ref = 100·preço/D e (2 − 100·preço/D)/1,5 = (4D − 200·preço)/(3D) =
 *  num/den; 250·num/den + 0,5 = (500·num + den)/(2·den). Bate com a conta em double em todo preço válido (teste). */
export function custoBeneficio(base: number, tamanho: number, forca: number, preco: number): number {
  const d = refCentesimos(base, tamanho, forca);
  const num = 4 * d - 200 * preco;
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

/** A semente do PT de um copão: a receita (base, mistura, extra e tamanho), não o copão. Tirar e pôr de novo a mesma
 *  receita não muda a sorte da noite (como a novidade, que também é da receita). */
export function sementePT(base: number, mistura: number, extra: number, tamanho: number): number {
  return base * 4096 + mistura * 256 + extra * 16 + tamanho;
}

/** Deu PT na noite? Sorte fixa por (semente, noite): reabrir dá o mesmo. `semente` = sementePT da receita; `noite` =
 *  noiteIdx do início da noite. */
export function deuPT(semente: number, noite: number, chance: number): boolean {
  return (semente * 7919 + noite * 104729 + 4) % 100 < chance;
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
  const cb = custoBeneficio(c.base, c.tamanho, c.forca, c.preco);
  const m = moda(c.base, c.mistura, semana);
  const a = aguenta(c.forca, ponto);
  return { rotulos: rs, sabor: s, custoBeneficio: cb, moda: m, aguenta: a, nota: s + cb + m + a, chancePT: chancePT(c.forca, ponto) };
}

export function nota(c: Copao, semana: string): number {
  return avaliar(c, semana).nota;
}

// ===== provar (0069): a galera prova uma receita sem ela ir pro cardápio =====

const H = 3600_000;
const DIA = 24 * H;
/** A nota da prova sai 5 min depois. */
export const PROVA_MS = 5 * 60_000;

// ===== as noites: o bar abre das 18h às 2h de Brasília (UTC−3 fixo), todo dia =====

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

/** O PT de um copão só conta se ele ficou no cardápio pelo menos PT_MIN_MS da noite (tirado antes não derruba a galera). */
export const PT_MIN_MS = H;
/** O PT do copão conta nessa noite? `saiuMs` = quando saiu do cardápio (null = ficou). */
export function ptConta(inicioMs: number, saiuMs: number | null): boolean {
  return saiuMs === null || saiuMs - inicioMs >= PT_MIN_MS;
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

export type NoCardapio = {
  base: number; mistura: number; tamanho: number; forca: number; preco: number; nota: number; /** noites no cardápio */ noites: number;
};
export type Noite = { nivel: number; galera: number; sexta: boolean; /** DJ escolhido (null = nenhum) */ dj: number | null };

/** Quantos copões cada um do cardápio vende na noite inteira (na ordem do cardápio): movimento · atração_i / Σ atração ·
 *  participação · preço_i, com atração = (nota/999)² · novidade · canibal (0,7 se outro do cardápio tem a mesma base e
 *  mistura), participação = min(1, Σ atração) e preço_i = (precoRef(base, tamanho, força) / preço)^ELASTICIDADE /
 *  doses^ALFA (o recipiente maior sai menos). Sexta ×2, e na sexta o DJ escolhido dá ×1,2 nos copões das bases que ele
 *  curte. Ordem das contas (o banco faz igual):
 *  ((mov · atr_i) / Σatr) · participação · ((ref_i / preço_i)^ELASTICIDADE / doses_i^ALFA) · (sexta ? 2 : 1) · (curte ? 1,2 : 1). */
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
    const preco = (precoRef(c.base, c.tamanho, c.forca) / c.preco) ** ELASTICIDADE / TAMANHOS[c.tamanho - 1].doses ** ALFA;
    return ((mov * atracao[i]) / soma) * participacao * preco * (n.sexta ? 2 : 1) * curte;
  });
}

/** Lucro de cada venda (fichas): preço − custoVenda (doses · custo da base · (0,5 + força/10)). Pode ser negativo e soma assim. */
export function lucroVenda(c: Pick<Copao, 'base' | 'tamanho' | 'forca' | 'preco'>): number {
  return c.preco - custoVenda(c.base, c.tamanho, c.forca);
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

/** O começo do nome pelo tamanho: "Balde" só no balde; nada de "Copão" num copo. */
const PREFIXO: Readonly<Record<number, readonly string[]>> = {
  1: ['Copo', 'Dose', 'Batidinha', 'Bomba'],
  2: ['Copão', 'Copão', 'Batidão', 'Bomba'],
  3: ['Balde', 'Balde', 'Baldão', 'Bomba'],
};
const SUFIXO = ['', ' da Casa', ' do Grau', ' Sem Freio', ' de Respeito', ' Proibidão'];

/** Nome de copão para a pessoa não ficar travada; no máximo 30 letras (cai pro sem sufixo, depois só a base). */
export function nomeSugerido(base: number, mistura: number, extra: number, tamanho: number, n: number): string {
  const nome = BASES[base - 1].nome;
  const prefixo = (PREFIXO[tamanho] ?? PREFIXO[2])[(base + n) % 4];
  const cheio = `${prefixo} de ${nome}${SUFIXO[(mistura + extra + 2 * n) % 6]}`;
  if ([...cheio].length <= 30) return cheio;
  const semSufixo = `${prefixo} de ${nome}`;
  return [...semSufixo].length <= 30 ? semSufixo : nome;
}

// ===== o que a tela do copão (copaoTela.ts) recebe e usa =====

/** Um copão do cardápio (idle_cup_json → cardapio). Nota, partes, rótulos e chance de PT só depois que ele vendeu uma noite
 *  aberta inteira (`revelado`; antes, null). Horários em ISO. vendido e fichas = o que ele fez em todas as noites;
 *  vendido_hoje e fichas_hoje = o que já fez na noite de hoje (null = não está nela). noites = as noites da receita. */
export type CopaoCup = {
  id: number; nome: string; base: number; mistura: number; extra: number; tamanho: number; forca: number; preco: number; nivel: number;
  entrou_em: string; primeira_noite: string; saiu_em: string | null; revelado: boolean; noites: number; vendido: number; fichas: number;
  nota: number | null; sabor: number | null; cb: number | null; moda: number | null; aguenta: number | null;
  rotulos: number[] | null; chance_pt: number | null; vendido_hoje: number | null; fichas_hoje: number | null;
};
/** A noite em andamento ou a próxima. aberta: a linha da noite diz (antes de começar, true: a pessoa está aqui); dj = o
 *  gravado quando a noite foi contada (só vale na sexta); vendido/fichas = o que o banco já contou até agora (com o que
 *  os copões que já saíram venderam antes de sair). */
export type HojeCup = {
  inicio: string; fim: string; sexta: boolean; aberta: boolean; dj: number | null; vendido_ate_agora: number; fichas_ate_agora: number;
};
/** O que um copão fez numa noite (ultima_noite.copoes). */
export type CopaoNaNoite = {
  id: number; nome: string; base: number; mistura: number; extra: number; tamanho: number; forca: number; preco: number; nota: number;
  vendidos: number; fichas: number; pt: boolean;
};
/** A última noite aberta que fechou (a tela mostra o chat dela uma vez). chat_seed = o número da noite; copoes = os
 *  revelados (quem saiu antes do fim da primeira noite não aparece); saiu_antes = quantos copões da noite saíram antes
 *  da nota (as vendas e as fichas da noite contam as deles). */
export type UltimaNoite = {
  inicio: string; fim: string; sexta: boolean; dj: number | null; vendas: number; fichas: number; pt: boolean; galera_delta: number;
  chat_seed: number; copoes: CopaoNaNoite[]; saiu_antes: number;
};
/** Um dos últimos 10 copões revelados (o mais novo primeiro), mesmo os que já saíram do cardápio. */
export type HistoricoCup = {
  id: number; nome: string; base: number; mistura: number; extra: number; tamanho: number; forca: number; preco: number; nota: number;
  sabor: number; cb: number; moda: number; aguenta: number; primeira_noite: string; saiu_em: string | null; noites: number; vendido: number; fichas: number;
};
/** Uma das últimas 10 provas (a mais nova primeiro; idle_cup_json → provas). A receita aparece sempre; a nota, as partes e
 *  os rótulos só quando fica pronta (`pronta`; antes, null). Horários em ISO. */
export type ProvaCup = {
  id: number; base: number; mistura: number; extra: number; tamanho: number; forca: number; preco: number;
  criado_em: string; pronta_em: string; pronta: boolean;
  nota: number | null; sabor: number | null; cb: number | null; moda: number | null; aguenta: number | null; rotulos: number[] | null;
};
/** `LugarEstado.mecanica` do lugar 4 (idle_cup_json). moda = o copão da moda desta semana; dj = o DJ escolhido pra sexta;
 *  noite_fechada = a última noite que fechou sem ninguém abrir o bar, se é mais nova que a ultima_noite. provas = as
 *  últimas 10; provas_hoje = as feitas nas últimas 24 h; provas_max = null (sem limite, 0070). */
export type EstadoCup = {
  moda: { base: number; mistura: number }; dj: number | null; vagas: number; cardapio: CopaoCup[]; hoje: HojeCup;
  ultima_noite: UltimaNoite | null; noite_fechada: { inicio: string; fim: string } | null; historico: HistoricoCup[];
  provas: ProvaCup[]; provas_hoje: number; provas_max: number | null;
};

export const NOME_ROTULO: readonly string[] = ['péssima', 'ruim', 'ok', 'boa', 'ótima'];

/** A chave do par no caderninho (a mesma do idle_cup_depois): base × mistura = base·100 + mistura; base × extra = 10000 +
 *  base·100 + extra; mistura × extra = 20000 + mistura·100 + extra. */
export function chavePar(tipo: TipoPar, a: number, b: number): number {
  return tipo * 10000 + a * 100 + b;
}

/** O caderninho do copão: os pares testados (chave → rótulo) e, por base, o aguenta de cada força testada. */
export type CadernoCup = { pares: Map<number, Rotulo>; aguenta: Map<number, Map<number, number>> };

export function cadernoCup(itens: readonly { tipo: string; a: number; b: number; rotulo: number }[]): CadernoCup {
  const c: CadernoCup = { pares: new Map(), aguenta: new Map() };
  for (const i of itens) {
    if (i.tipo === 'par') c.pares.set(i.a, i.rotulo as Rotulo);
    else if (i.tipo === 'aguenta') {
      const m = c.aguenta.get(i.a) ?? new Map<number, number>();
      m.set(i.b, i.rotulo);
      c.aguenta.set(i.a, m);
    }
  }
  return c;
}

/** As distâncias do ponto (força − ponto, de −9 a 9) que dão esse aguenta. Quase sempre uma só; 35 pode ser 3 acima ou 4
 *  abaixo e 0 é "longe" (4 ou mais acima, 5 ou mais abaixo). */
export function distanciasAguenta(v: number): number[] {
  const out: number[] = [];
  for (let d = -9; d <= 9; d++) if (aguenta(d, 0) === v) out.push(d);
  return out;
}

/** Os pontos (1 a 10) que batem com tudo que o caderninho sabe da base (força → aguenta). Sem teste: os 10. */
export function pontosPossiveis(testes: ReadonlyMap<number, number> | undefined): number[] {
  const out: number[] = [];
  for (let p = 1; p <= 10; p++) if (![...(testes ?? new Map<number, number>()).entries()].some(([f, v]) => aguenta(f, p) !== v)) out.push(p);
  return out;
}

const distTexto = (d: number) => (d === 0 ? 'no ponto' : `${Math.abs(d)} ${d > 0 ? 'acima' : 'abaixo'} do ponto`);

/** Quão longe do ponto a força testada ficou, em palavras: "no ponto", "1 acima do ponto", "3 acima ou 4 abaixo do ponto",
 *  "longe do ponto". Com o ponto já descoberto (`ponto`), a distância exata. */
export function distanciaTexto(forca: number, v: number, ponto: number | null = null): string {
  if (ponto !== null) return distTexto(forca - ponto);
  const ds = distanciasAguenta(v);
  if (ds.length === 1) return distTexto(ds[0]);
  if (ds.length === 2) return `${Math.abs(Math.max(...ds))} acima ou ${Math.abs(Math.min(...ds))} abaixo do ponto`;
  return 'longe do ponto';
}

const curta = (d: number) => (d === 0 ? '0' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`);
/** A distância do ponto em poucas letras (o chip do caderninho): "0", "+1", "−2", "+3/−4" (um dos dois), "longe". */
export function distanciaCurta(forca: number, v: number, ponto: number | null = null): string {
  if (ponto !== null) return curta(forca - ponto);
  const ds = distanciasAguenta(v);
  if (ds.length === 1) return curta(ds[0]);
  if (ds.length === 2) return `${curta(Math.max(...ds))}/${curta(Math.min(...ds))}`;
  return 'longe';
}

/** O ponto da base, se o caderninho já fecha num só. */
export function pontoDescoberto(testes: ReadonlyMap<number, number> | undefined): number | null {
  if (!testes?.size) return null;
  const ps = pontosPossiveis(testes);
  return ps.length === 1 ? ps[0] : null;
}

/** O que o caderninho diz de uma força numa base: { texto, v } ou null se nunca testou essa força. */
export function forcaTestada(cad: CadernoCup, base: number, forca: number): { texto: string; aguenta: number } | null {
  const testes = cad.aguenta.get(base);
  const v = testes?.get(forca);
  if (v === undefined) return null;
  return { texto: distanciaTexto(forca, v, pontoDescoberto(testes)), aguenta: v };
}

const H_BR = 3 * H; // Brasília = UTC−3 fixo

/** A estreia de um copão posto em `tMs`: a primeira noite que começa em t ou depois (às 18h em ponto conta a de agora). */
export function proximaNoite(tMs: number): number {
  return NOITE_0 + Math.ceil((tMs - NOITE_0) / DIA) * DIA;
}

/** O dia (em Brasília) de um instante, como número de dias desde 1970 (pra comparar "hoje", "amanhã", "ontem"). */
export function diaBR(tMs: number): number {
  return Math.floor((tMs - H_BR) / DIA);
}

/** As bases que pedem "a" (a vodka, a cachaça, a catuaba, a tequila); as outras pedem "o" (o gin, o corote...). */
const BASES_FEMININAS = new Set([1, 2, 3, 7]);
/** "a Vodka" / "o Gin". */
export const aBase = (id: number) => `${BASES_FEMININAS.has(id) ? 'a' : 'o'} ${BASES[id - 1].nome}`;
/** "da Vodka" / "do Gin". */
export const daBase = (id: number) => `${BASES_FEMININAS.has(id) ? 'da' : 'do'} ${BASES[id - 1].nome}`;
