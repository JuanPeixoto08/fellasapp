// Convidados do PPP Podcast (minigame 3): o catálogo e as contas da página (puro). Quem decide é o banco (0051, mesmas
// contas: teste de paridade); aqui só se mostra. Spec: docs/superpowers/specs/2026-10-11-fellas-inc-convidados-design.md.
import type { IdleVisual } from '../shared/types';
import { douradoEm, janelaS, tipoDourado, type TipoDourado } from './dourados';
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
export type Cadeiras = { cadeira: (number | null)[]; desde: (string | null)[]; trocas: number; trocas_t: string | null };

export const destrancada = (cadeira: number, ppp: number) => ppp >= ABRE_COM[cadeira];

/** O peso do convidado: o da cadeira em que ele está, se ela está aberta (0 se não está sentado). */
export function peso(c: Cadeiras, ppp: number, id: number): number {
  const i = c.cadeira.indexOf(id);
  return i >= 0 && destrancada(i, ppp) ? PESOS[i] : 0;
}
/** Desde quando o convidado está sentado (ms), ou null. */
export function sentadoDesde(c: Cadeiras, id: number): number | null {
  const i = c.cadeira.indexOf(id);
  const d = i >= 0 ? c.desde[i] : null;
  return d ? Date.parse(d) : null;
}

/** Trocas agora e quando volta a próxima (null = cheio). Cada troca gasta volta em 1 h, uma por vez. */
export function trocasAgora(c: Pick<Cadeiras, 'trocas' | 'trocas_t'>, agoraMs: number): { trocas: number; proximaMs: number | null } {
  if (c.trocas >= MAX_TROCAS || !c.trocas_t) return { trocas: MAX_TROCAS, proximaMs: null };
  const t = Date.parse(c.trocas_t);
  const k = Math.max(0, Math.floor((agoraMs - t) / (RECARGA_S * 1000)));
  const n = Math.min(MAX_TROCAS, c.trocas + k);
  return n >= MAX_TROCAS ? { trocas: MAX_TROCAS, proximaMs: null } : { trocas: n, proximaMs: t + (k + 1) * RECARGA_S * 1000 };
}

/** Kojima: −10% ao sentar, +50%/24 a cada hora inteira, até +40% em 24 h (× o peso). */
export function kojimaMult(p: number, desdeMs: number, tMs: number): number {
  const h = Math.max(0, Math.floor((tMs - desdeMs) / H));
  return 1 + p * (-0.1 + (0.5 * Math.min(24, h)) / 24);
}

/** Toby Fox ("Chapter 5 ano que vem"): +2% a cada hora inteira sentado, até +40% em 20 h (× o peso). */
export function tobyMult(p: number, desdeMs: number, tMs: number): number {
  const h = Math.max(0, Math.floor((tMs - desdeMs) / H));
  return 1 + p * 0.02 * Math.min(20, h);
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
/** A faixa k (1, 2, …) de quem sentou em `desdeS` foi derrubada? (25%) */
export const derrubada = (uid: string, desdeS: number, k: number) => sorte(uid, 50, desdeS + k, 9) < 0.25;

/** Se o instante t está numa derrubada do MC V.V: o fim dela (ms); senão null. */
export function derrubadaAte(uid: string, p: number, desdeMs: number, tMs: number): number | null {
  if (p <= 0) return null;
  const passo = faixaS(p) * 1000;
  const k = Math.floor((tMs - desdeMs) / passo);
  if (k < 1) return null;
  const ini = desdeMs + k * passo;
  return tMs < ini + DERRUBADA_S * 1000 && derrubada(uid, Math.floor(desdeMs / 1000), k) ? ini + DERRUBADA_S * 1000 : null;
}

type Ctx = { c: Cadeiras; ppp: number; uid: string };
/** Multiplicador da produção toda em t. */
export function multProducao({ c, ppp, uid }: Ctx, tMs: number): number {
  let m = (1 + 0.15 * peso(c, ppp, CR)) * (1 - 0.05 * peso(c, ppp, LUVA)) * (1 - 0.05 * peso(c, ppp, VSAUCE));
  const pk = peso(c, ppp, KOJIMA);
  if (pk) m *= kojimaMult(pk, sentadoDesde(c, KOJIMA)!, tMs);
  const pt = peso(c, ppp, TOBY);
  if (pt) m *= tobyMult(pt, sentadoDesde(c, TOBY)!, tMs);
  const pm = peso(c, ppp, MCVV);
  if (pm && derrubadaAte(uid, pm, sentadoDesde(c, MCVV)!, tMs) !== null) m *= 1 - 0.1 * pm;
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
  if (k < 1 || !Number.isInteger(k) || derrubada(uid, dS, k)) return null;
  return tipoDourado(uid, seg);
}

type ComCadeiras = { user_id: string; generators: number[]; convidados?: Cadeiras };
export const SEM_CADEIRAS: Cadeiras = { cadeira: [null, null, null], desde: [null, null, null], trocas: MAX_TROCAS, trocas_t: null };
const SEM = SEM_CADEIRAS;
const ctx = (s: ComCadeiras) => ({ c: s.convidados ?? SEM, ppp: s.generators[12] ?? 0 });

/** O evento do segundo `seg` pra esse estado (a sorte, com o Gemaplys, ou a faixa do MC V.V) e quanto fica na tela. */
export function eventoEm(s: ComCadeiras, seg: number): { tipo: TipoDourado; janelaS: number } | null {
  const { c, ppp } = ctx(s);
  const gema = peso(c, ppp, GEMAPLYS);
  const tipo = douradoEm(s.user_id, seg, gema) ?? faixaEm(s.user_id, c, ppp, seg);
  return tipo === null ? null : { tipo, janelaS: janelaS(gema) };
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
/** Bônus e defeito do convidado numa cadeira de peso `p`, por extenso ("Geradores 10% mais baratos"), com maiúscula. */
export function efeitosTexto(id: number, p: number): [string, string] {
  const [b, d] = efeitosCru(id, p);
  const mai = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  return [mai(b), mai(d)];
}
function efeitosCru(id: number, p: number): [string, string] {
  switch (id) {
    case CR: return [`produção +${pct(0.15 * p)}`, `melhorias ${pct(0.1 * p)} mais caras`];
    case VORCARO: return [`ações compradas agora: o ganho conta ${vz(1 + p)} na venda`, `a perda também conta ${vz(1 + p)}`];
    case GEMAPLYS: return [`eventos dourados ${vz(1 + p)} mais frequentes`, `ficam ${(janelaS(p)).toLocaleString('pt-BR')} s na tela (eram 12)`];
    case LUVA: return [`+${Math.ceil(5 * p)} oportunidades por dia`, `produção −${pct(0.05 * p)}`];
    case KOJIMA: return [`produção sobe até +${pct(0.4 * p)} em 24 h sentado`, `começa em −${pct(0.1 * p)}; trocar zera`];
    case GABE: return [`geradores ${pct(0.1 * p)} mais baratos`, `−${Math.ceil(3 * p)} oportunidades por dia`];
    case TERRY: return [`plantas novas amadurecem ${pct(0.3 * p)} mais rápido`, `e vivem ${pct(0.2 * p)} menos`];
    case VINI: return [`cruzamento da Horta ${vz(1 + p)}`, `sementes ${pct(0.5 * p)} mais caras`];
    case MCVV: return [`uma faixa a cada ${faixaS(p) / 3600} h: evento dourado garantido`, `25% de derrubada: produção −${pct(0.1 * p)} por 30 min`];
    case TOBY: return [`produção sobe +${pct(0.02 * p)} por hora sentado, até +${pct(0.4 * p)}`, `melhorias ${pct(0.1 * p)} mais caras; trocar ou tirar zera`];
    case VSAUCE: return ['a Bolsa mostra pra onde cada ação tende', `produção −${pct(0.05 * p)}`];
    default: return ['', ''];
  }
}

const hm = (ms: number) => {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
};
/** A linha "ao vivo" do convidado sentado (Kojima, MC V.V, Ana), ou null. */
export function aoVivo(id: number, p: number, desdeMs: number, uid: string, agoraMs: number): string | null {
  if (p <= 0) return null;
  if (id === KOJIMA) {
    const m = kojimaMult(p, desdeMs, agoraMs) - 1;
    const h = Math.floor((agoraMs - desdeMs) / 3_600_000);
    return `Agora: produção ${m >= 0 ? '+' : '−'}${pct(Math.abs(m))}${h < 24 ? ` · sobe em ${hm(desdeMs + (h + 1) * 3_600_000 - agoraMs)}` : ' (no máximo)'}`;
  }
  if (id === MCVV) {
    const ate = derrubadaAte(uid, p, desdeMs, agoraMs);
    if (ate !== null) return `Derrubada por copyright · volta em ${hm(ate - agoraMs)}`;
    const passo = faixaS(p) * 1000;
    const k = Math.floor((agoraMs - desdeMs) / passo) + 1;
    return `Próxima faixa em ${hm(desdeMs + k * passo - agoraMs)}`;
  }
  if (id === TOBY) {
    const m = tobyMult(p, desdeMs, agoraMs) - 1;
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
