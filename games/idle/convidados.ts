// Convidados do PPP Podcast (minigame 3): o catálogo e as contas da página (puro). Quem decide é o banco (0051, mesmas
// contas: teste de paridade); aqui só se mostra. Spec: docs/superpowers/specs/2026-10-11-fellas-inc-convidados-design.md.
import type { Garantido, IdleVisual } from '../shared/types';
import { catalogo } from './catalogo';
import { douradoEm, janelaS, tipoDourado, type TipoDourado } from './dourados';
import { efeitosArvore } from './economia';
import { semente } from './oportunidades';

export type Convidado = { id: number; nome: string; bordao: string; bonus: string; defeito: string };

export const CONVIDADOS: readonly Convidado[] = [
  { id: 1, nome: 'Cristiano Ronaldo', bordao: 'SIUUU. Já falei hoje que eu sou o melhor da história?', bonus: 'Produção +15%', defeito: 'Melhorias 10% mais caras' },
  { id: 2, nome: 'Daniel Vorcaro', bordao: 'Rende 140% do CDI. Confia.', bonus: 'Ações compradas com ele: o ganho conta 2× na venda', defeito: 'A perda também conta 2×' },
  { id: 3, nome: 'Gemaplys', bordao: 'O único canal de jogo que o jogo pede pra parar.', bonus: 'Eventos dourados aparecem 2× mais', defeito: 'Ficam metade do tempo na tela' },
  { id: 4, nome: 'Luva de Pedreiro', bordao: 'Receba!', bonus: '+5 oportunidades por dia', defeito: 'Produção −5%' },
  { id: 5, nome: 'Hideo Kojima', bordao: 'Um podcast de Hideo Kojima. Uma cadeira de Hideo Kojima.', bonus: 'Produção sobe até +40% em 24 h sentado', defeito: 'Começa em −10%; trocar zera' },
  { id: 6, nome: 'Gabe Newell', bordao: 'Ele sabe contar até 2.', bonus: 'Geradores 10% mais baratos', defeito: '−3 oportunidades por dia' },
  { id: 7, nome: 'Terry Crews', bordao: 'POWER! O peitoral dele tem CNPJ próprio.', bonus: 'Plantas amadurecem 30% mais rápido', defeito: 'E vivem 20% menos' },
  { id: 8, nome: 'Viniccius13', bordao: 'Já fez uma réplica do estúdio no Minecraft. Ficou melhor.', bonus: 'Cruzamento da Horta 2×', defeito: 'Sementes 50% mais caras' },
  { id: 9, nome: 'MC V.V', bordao: 'Lançou o BONDA. O YouTube derrubou o BONDA.', bonus: 'A cada 2 h uma faixa: evento dourado garantido', defeito: '25% de chance de derrubada: produção −10% por 30 min' },
  { id: 10, nome: 'Toby Fox', bordao: 'Mandou o cachorro no lugar dele. Ninguém percebeu a diferença.', bonus: 'Produção sobe +2% por hora sentado, até +40%', defeito: 'Melhorias 10% mais caras; trocar ou tirar zera' },
  { id: 11, nome: 'VSauce', bordao: 'Hey, VSauce, Michael aqui. Ou não?', bonus: 'A Bolsa mostra pra onde cada ação tende', defeito: 'Produção −5%' },
];
export const convidado = (id: number): Convidado => CONVIDADOS.find((c) => c.id === id)!;

export const CR = 1, VORCARO = 2, GEMAPLYS = 3, LUVA = 4, KOJIMA = 5, GABE = 6, TERRY = 7, VINI = 8, MCVV = 9, TOBY = 10, VSAUCE = 11;

/** Força de cada cadeira (frente, meio, canto) e quantos PPP Podcasts (gerador 13) abrem cada uma. */
export const PESOS = [1, 0.5, 0.25] as const;
export const ABRE_COM = [1, 25, 50] as const;
export const NOME_CADEIRA = ['frente', 'meio', 'canto'] as const;
/** "da frente", "do meio", "do canto". */
export const DA_CADEIRA = ['da frente', 'do meio', 'do canto'] as const;
export const MAX_TROCAS = 3;
export const RECARGA_S = 3600;
const H = 3_600_000;

/** O que o banco manda das cadeiras (idle_json.convidados). */
export type Cadeiras = {
  cadeira: (number | null)[]; desde: (string | null)[]; trocas: number; trocas_t: string | null;
  /** o que a árvore grande muda (idle_conv_json na 0082); ausente = o de sempre */
  trocas_max?: number; recarga_s?: number; pesos?: readonly number[]; queda?: number; efeito?: number;
};
/** A força das 3 cadeiras, quantas trocas cabem e quanto cada uma leva pra voltar (s): o que o banco mandou, ou o de sempre. */
export const pesosDe = (c: Partial<Cadeiras>): readonly number[] => c.pesos ?? PESOS;
export const trocasMax = (c: Partial<Cadeiras>): number => c.trocas_max ?? MAX_TROCAS;
export const recargaS = (c: Partial<Cadeiras>): number => c.recarga_s ?? RECARGA_S;

export const destrancada = (cadeira: number, ppp: number) => ppp >= ABRE_COM[cadeira];

/** O peso do convidado: o da cadeira em que ele está, se ela está aberta (0 se não está sentado). */
export function peso(c: Cadeiras, ppp: number, id: number): number {
  const i = c.cadeira.indexOf(id);
  return i >= 0 && destrancada(i, ppp) ? pesosDe(c)[i] : 0;
}
/** Desde quando o convidado está sentado (ms), ou null. */
export function sentadoDesde(c: Cadeiras, id: number): number | null {
  const i = c.cadeira.indexOf(id);
  const d = i >= 0 ? c.desde[i] : null;
  return d ? Date.parse(d) : null;
}

/** Trocas agora e quando volta a próxima (null = cheio). Cada troca gasta volta em `recargaS` (1 h sem a árvore), uma por vez. */
export function trocasAgora(c: Pick<Cadeiras, 'trocas' | 'trocas_t' | 'trocas_max' | 'recarga_s'>, agoraMs: number): { trocas: number; proximaMs: number | null } {
  const max = trocasMax(c);
  const passo = recargaS(c) * 1000;
  if (c.trocas >= max || !c.trocas_t) return { trocas: max, proximaMs: null };
  const t = Date.parse(c.trocas_t);
  const k = Math.max(0, Math.floor((agoraMs - t) / passo));
  const n = Math.min(max, c.trocas + k);
  return n >= max ? { trocas: max, proximaMs: null } : { trocas: n, proximaMs: t + (k + 1) * passo };
}

/** Kojima: −10% ao sentar, +50%/24 a cada hora inteira, até +40% em 24 h (× o peso); a subida × (1 + efeito da árvore). */
export function kojimaMult(p: number, desdeMs: number, tMs: number, efeito = 0): number {
  const h = Math.max(0, Math.floor((tMs - desdeMs) / H));
  return 1 + p * (-0.1 + ((0.5 * Math.min(24, h)) / 24) * (1 + efeito));
}

/** Toby Fox ("já já sai o Chapter 6"): +2% a cada hora inteira sentado, até +40% em 20 h (× o peso × (1 + efeito)). */
export function tobyMult(p: number, desdeMs: number, tMs: number, efeito = 0): number {
  const h = Math.max(0, Math.floor((tMs - desdeMs) / H));
  return 1 + p * 0.02 * Math.min(20, h) * (1 + efeito);
}

/** MC V.V: uma faixa a cada 2 h / peso; a derrubada dura 30 min. */
export const faixaS = (p: number) => 7200 / p;
export const DERRUBADA_S = 1800;

const P = 2147483647n;
/** Sorte em [0, 1): a mesma conta de idle_horta_sorte (0048) com canteiro c, passo t e sorteio k. */
export function sorte(uid: string, c: number, t: number, k: number): number {
  const b = BigInt(t);
  const h = (b * b * 48271n + b * 16807n + BigInt(semente(uid)) * 69621n + BigInt(c) * 1013n + BigInt(k) * 7919n + 12345n) % P;
  return Number((h * h + 1013904223n) % P) / Number(P);
}
/** A faixa k (1, 2, …) de quem sentou em `desdeS` foi derrubada? (25%; a árvore baixa pra 15% ou 5%: o banco manda) */
export const derrubada = (uid: string, desdeS: number, k: number, chance = 0.25) => sorte(uid, 50, desdeS + k, 9) < chance;

/** Se o instante t está numa derrubada do MC V.V: o fim dela (ms); senão null. */
export function derrubadaAte(uid: string, p: number, desdeMs: number, tMs: number, chance = 0.25): number | null {
  if (p <= 0) return null;
  const passo = faixaS(p) * 1000;
  const k = Math.floor((tMs - desdeMs) / passo);
  if (k < 1) return null;
  const ini = desdeMs + k * passo;
  return tMs < ini + DERRUBADA_S * 1000 && derrubada(uid, Math.floor(desdeMs / 1000), k, chance) ? ini + DERRUBADA_S * 1000 : null;
}

type Ctx = { c: Cadeiras; ppp: number; uid: string };
/** Multiplicador da produção toda em t. */
export function multProducao({ c, ppp, uid }: Ctx, tMs: number): number {
  const e = c.efeito ?? 0; // a árvore grande (PPP 5, 9, ∞): só os bônus de produção
  let m = (1 + 0.15 * peso(c, ppp, CR) * (1 + e)) * (1 - 0.05 * peso(c, ppp, LUVA)) * (1 - 0.05 * peso(c, ppp, VSAUCE));
  const pk = peso(c, ppp, KOJIMA);
  if (pk) m *= kojimaMult(pk, sentadoDesde(c, KOJIMA)!, tMs, e);
  const pt = peso(c, ppp, TOBY);
  if (pt) m *= tobyMult(pt, sentadoDesde(c, TOBY)!, tMs, e);
  const pm = peso(c, ppp, MCVV);
  if (pm && derrubadaAte(uid, pm, sentadoDesde(c, MCVV)!, tMs, c.queda) !== null) m *= 1 - 0.1 * pm;
  return m;
}
export const custoGeradores = (c: Cadeiras, ppp: number) => 1 - 0.1 * peso(c, ppp, GABE);
export const custoMelhorias = (c: Cadeiras, ppp: number) => (1 + 0.1 * peso(c, ppp, CR)) * (1 + 0.1 * peso(c, ppp, TOBY));
export const deltaOportunidades = (c: Cadeiras, ppp: number) => Math.ceil(5 * peso(c, ppp, LUVA)) - Math.ceil(3 * peso(c, ppp, GABE));

// ---------- eventos na tela: Gemaplys (mais eventos, menos tempo) e as faixas do MC V.V ----------
/** A faixa do MC V.V no segundo `seg` (epoch): o tipo do evento, ou null (não é faixa ou foi derrubada). */
export function faixaEm(uid: string, c: Cadeiras, ppp: number, seg: number): TipoDourado | null {
  const p = peso(c, ppp, MCVV);
  const d = sentadoDesde(c, MCVV);
  if (!p || d === null) return null;
  const dS = Math.floor(d / 1000);
  const passo = faixaS(p);
  const k = (seg - dS) / passo;
  if (k < 1 || !Number.isInteger(k) || derrubada(uid, dS, k, c.queda)) return null;
  const t = tipoDourado(uid, seg);
  return t === 7 ? 0 : t; // a faixa nunca é Tigrinho (0076)
}

type ComCadeiras = {
  user_id: string; generators: number[]; convidados?: Cadeiras; bonus?: { arvore: number[] }; garantidos?: readonly Garantido[];
};
export const SEM_CADEIRAS: Cadeiras = { cadeira: [null, null, null], desde: [null, null, null], trocas: MAX_TROCAS, trocas_t: null };
const SEM = SEM_CADEIRAS;
const ctx = (s: ComCadeiras) => ({ c: s.convidados ?? SEM, ppp: s.generators[12] ?? 0 });

export type EventoDourado = { tipo: TipoDourado; janelaS: number; dobro: boolean };
/** O evento da sorte do segundo `seg` (a sorte com o Gemaplys e o ramo Dourados, ou a faixa do MC V.V), sem os garantidos,
 *  e quanto fica na tela. A frequência da árvore entra como peso a mais no extra do Gemaplys (igual a idle_dourado_pegar). */
export function eventoDaSorte(s: ComCadeiras, seg: number): EventoDourado | null {
  const { c, ppp } = ctx(s);
  const gema = peso(c, ppp, GEMAPLYS);
  const ef = efeitosArvore(catalogo, s.bonus?.arvore ?? []);
  const tipo = douradoEm(s.user_id, seg, gema + ef.douradoFreq - 1) ?? faixaEm(s.user_id, c, ppp, seg);
  return tipo === null ? null : { tipo, janelaS: janelaS(gema, ef.douradoTela), dobro: false };
}
/** O evento do segundo `seg`: um garantido (Pix devolvido, Chamar; 0076) primeiro, com o tipo e o dobro dele; senão a sorte. */
export function eventoEm(s: ComCadeiras, seg: number): EventoDourado | null {
  const g = s.garantidos?.find((x) => x.seg === seg);
  if (!g) return eventoDaSorte(s, seg);
  const { c, ppp } = ctx(s);
  const ef = efeitosArvore(catalogo, s.bonus?.arvore ?? []);
  return { tipo: g.tipo as TipoDourado, janelaS: janelaS(peso(c, ppp, GEMAPLYS), ef.douradoTela), dobro: g.dobro };
}
/** Os eventos de [de, ate) (s), pra agendar o som com a aba escondida. */
export function eventosEntre(s: ComCadeiras, de: number, ate: number): { seg: number; tipo: TipoDourado }[] {
  const out: { seg: number; tipo: TipoDourado }[] = [];
  for (let x = de; x < ate; x++) {
    const e = eventoEm(s, x);
    if (e) out.push({ seg: x, tipo: e.tipo });
  }
  return out;
}

// ---------- textos (o efeito na cadeira, por extenso) ----------
const pct = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString('pt-BR')}%`;
const vz = (x: number) => `${x.toLocaleString('pt-BR')}×`;
/** Bônus e defeito do convidado numa cadeira de peso `p`, por extenso ("Geradores 10% mais baratos"), com maiúscula.
 *  `a` = o que a árvore grande mudou (efeito nos bônus de produção, chance de derrubada): o texto diz o número de agora. */
export function efeitosTexto(id: number, p: number, a: Pick<Cadeiras, 'efeito' | 'queda'> = {}): [string, string] {
  const [b, d] = efeitosCru(id, p, a.efeito ?? 0, a.queda ?? 0.25);
  const mai = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  return [mai(b), mai(d)];
}
function efeitosCru(id: number, p: number, e: number, queda: number): [string, string] {
  switch (id) {
    case CR: return [`produção +${pct(0.15 * p * (1 + e))}`, `melhorias ${pct(0.1 * p)} mais caras`];
    case VORCARO: return [`ações compradas agora: o ganho conta ${vz(1 + p)} na venda`, `a perda também conta ${vz(1 + p)}`];
    case GEMAPLYS: return [`eventos dourados ${vz(1 + p)} mais frequentes`, `ficam ${pct(p / 2)} menos tempo na tela`];
    case LUVA: return [`+${Math.ceil(5 * p)} oportunidades por dia`, `produção −${pct(0.05 * p)}`];
    case KOJIMA: return [`produção sobe até +${pct(p * (0.4 + 0.5 * e))} em 24 h sentado`, `começa em −${pct(0.1 * p)}; trocar zera`];
    case GABE: return [`geradores ${pct(0.1 * p)} mais baratos`, `−${Math.ceil(3 * p)} oportunidades por dia`];
    case TERRY: return [`plantas novas amadurecem ${pct(0.3 * p)} mais rápido`, `e vivem ${pct(0.2 * p)} menos`];
    case VINI: return [`cruzamento da Horta ${vz(1 + p)}`, `sementes ${pct(0.5 * p)} mais caras`];
    case MCVV: return [`uma faixa a cada ${faixaS(p) / 3600} h: evento dourado garantido`, `${pct(queda)} de derrubada: produção −${pct(0.1 * p)} por 30 min`];
    case TOBY: return [`produção sobe +${pct(0.02 * p * (1 + e))} por hora sentado, até +${pct(0.4 * p * (1 + e))}`, `melhorias ${pct(0.1 * p)} mais caras; trocar ou tirar zera`];
    case VSAUCE: return ['a Bolsa mostra pra onde cada ação tende', `produção −${pct(0.05 * p)}`];
    default: return ['', ''];
  }
}

const hm = (ms: number) => {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
};
/** A linha "ao vivo" do convidado sentado (Kojima, MC V.V, Ana), ou null. */
export function aoVivo(id: number, p: number, desdeMs: number, uid: string, agoraMs: number, c: Pick<Cadeiras, 'queda' | 'efeito'> = {}): string | null {
  if (p <= 0) return null;
  if (id === KOJIMA) {
    const m = kojimaMult(p, desdeMs, agoraMs, c.efeito) - 1;
    const h = Math.floor((agoraMs - desdeMs) / 3_600_000);
    return `Agora: produção ${m >= 0 ? '+' : '−'}${pct(Math.abs(m))}${h < 24 ? ` · sobe em ${hm(desdeMs + (h + 1) * 3_600_000 - agoraMs)}` : ' (no máximo)'}`;
  }
  if (id === MCVV) {
    const ate = derrubadaAte(uid, p, desdeMs, agoraMs, c.queda);
    if (ate !== null) return `Derrubada por copyright · volta em ${hm(ate - agoraMs)}`;
    const passo = faixaS(p) * 1000;
    const k = Math.floor((agoraMs - desdeMs) / passo) + 1;
    return `Próxima faixa em ${hm(desdeMs + k * passo - agoraMs)}`;
  }
  if (id === TOBY) {
    const m = tobyMult(p, desdeMs, agoraMs, c.efeito) - 1;
    const h = Math.floor((agoraMs - desdeMs) / 3_600_000);
    return `Agora: produção +${pct(m)}${h < 20 ? ` · sobe em ${hm(desdeMs + (h + 1) * 3_600_000 - agoraMs)}` : ' (no máximo)'}`;
  }
  return null;
}

/** O que os convidados fazem com a produção de uma unidade do gerador `gid` agora (pra mostrar na Loja). */
export function multGerador(s: ComCadeiras, gid: number, tMs: number): number {
  const { c, ppp } = ctx(s);
  void gid; // nenhum convidado mexe num gerador só (desde que a Ana saiu)
  return multProducao({ c, ppp, uid: s.user_id }, tMs);
}
/** Custo dos geradores e das melhorias com os convidados agora (Gabe; Cristiano e Toby). */
export const custosConv = (s: ComCadeiras) => {
  const { c, ppp } = ctx(s);
  return { geradores: custoGeradores(c, ppp), melhorias: custoMelhorias(c, ppp) };
};

/** Como cada convidado aparece na cena do PPP Podcast (de costas, na vaga "ppp-convidado"): o visual do kit de
 *  personagens (pele, cabelo, cor, roupa, cor da roupa, acessório, cor do acessório). */
export const VISUAL_CONVIDADO: Record<number, IdleVisual> = {
  1: { pele: 3, cabelo: 0, cor_cabelo: 0, roupa: 1, cor_roupa: 3, acessorio: 0, cor_acessorio: 0 },
  2: { pele: 4, cabelo: 5, cor_cabelo: 1, roupa: 2, cor_roupa: 0, acessorio: 0, cor_acessorio: 0 },
  3: { pele: 5, cabelo: 3, cor_cabelo: 0, roupa: 0, cor_roupa: 0, acessorio: 3, cor_acessorio: 0 },
  4: { pele: 1, cabelo: 0, cor_cabelo: 0, roupa: 1, cor_roupa: 0, acessorio: 0, cor_acessorio: 0 },
  5: { pele: 4, cabelo: 2, cor_cabelo: 0, roupa: 1, cor_roupa: 0, acessorio: 3, cor_acessorio: 0 },
  6: { pele: 5, cabelo: 4, cor_cabelo: 4, roupa: 1, cor_roupa: 0, acessorio: 3, cor_acessorio: 0 },
  7: { pele: 0, cabelo: 1, cor_cabelo: 0, roupa: 1, cor_roupa: 1, acessorio: 0, cor_acessorio: 0 },
  8: { pele: 4, cabelo: 0, cor_cabelo: 0, roupa: 1, cor_roupa: 3, acessorio: 2, cor_acessorio: 1 },
  9: { pele: 2, cabelo: 1, cor_cabelo: 0, roupa: 0, cor_roupa: 3, acessorio: 4, cor_acessorio: 0 },
  10: { pele: 5, cabelo: 0, cor_cabelo: 1, roupa: 0, cor_roupa: 0, acessorio: 0, cor_acessorio: 0 },
  11: { pele: 4, cabelo: 1, cor_cabelo: 1, roupa: 1, cor_roupa: 0, acessorio: 3, cor_acessorio: 0 },
};
/** O convidado da cadeira da frente na cena (id da vaga → visual), se a cadeira está aberta. */
export function naCena(s: ComCadeiras): Record<string, IdleVisual> {
  const { c, ppp } = ctx(s);
  const id = c.cadeira[0];
  return id && destrancada(0, ppp) ? { 'ppp-convidado': VISUAL_CONVIDADO[id] } : {};
}
