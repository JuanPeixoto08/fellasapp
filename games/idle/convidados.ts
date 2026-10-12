// Convidados do PPP Podcast (minigame 3): o catálogo e as contas da página (puro). Quem decide é o banco (0051, mesmas
// contas: teste de paridade); aqui só se mostra. Spec: docs/superpowers/specs/2026-10-11-fellas-inc-convidados-design.md.
import { semente } from './oportunidades';

export type Convidado = { id: number; nome: string; bordao: string; bonus: string; defeito: string };

export const CONVIDADOS: readonly Convidado[] = [
  { id: 1, nome: 'Cristiano Ronaldo', bordao: 'SIUUU. Já falei hoje que eu sou o melhor da história?', bonus: 'produção +15%', defeito: 'melhorias 10% mais caras' },
  { id: 2, nome: 'Daniel Vorcaro', bordao: 'Rende 140% do CDI. Confia.', bonus: 'ações compradas com ele: o ganho conta 2× na venda', defeito: 'a perda também conta 2×' },
  { id: 3, nome: 'Gemaplys', bordao: 'O único canal de jogo que o jogo pede pra parar.', bonus: 'eventos dourados aparecem 2× mais', defeito: 'ficam metade do tempo na tela' },
  { id: 4, nome: 'Luva de Pedreiro', bordao: 'Receba!', bonus: '+5 oportunidades por dia', defeito: 'produção −5%' },
  { id: 5, nome: 'Hideo Kojima', bordao: 'Um podcast de Hideo Kojima. Uma cadeira de Hideo Kojima.', bonus: 'produção sobe até +40% em 24 h sentado', defeito: 'começa em −10%; trocar zera' },
  { id: 6, nome: 'Gabe Newell', bordao: 'Ele sabe contar até 2.', bonus: 'geradores 10% mais baratos', defeito: '−3 oportunidades por dia' },
  { id: 7, nome: 'Terry Crews', bordao: 'POWER! O peitoral dele tem CNPJ próprio.', bonus: 'plantas amadurecem 30% mais rápido', defeito: 'e vivem 20% menos' },
  { id: 8, nome: 'Viniccius13', bordao: 'Já fez uma réplica do estúdio no Minecraft. Ficou melhor.', bonus: 'cruzamento da Horta 2×', defeito: 'sementes 50% mais caras' },
  { id: 9, nome: 'MC V.V', bordao: 'Lançou o BONDA. O YouTube derrubou o BONDA.', bonus: 'a cada 2 h uma faixa: evento dourado garantido', defeito: '25% de chance de derrubada: produção −10% por 30 min' },
  { id: 10, nome: 'Ana Mary B', bordao: 'Maquiagem básica pro dia a dia.', bonus: 'Food truck rende 2× das 6h ao meio-dia', defeito: 'o resto do dia, produção −5%' },
  { id: 11, nome: 'VSauce', bordao: 'Hey, VSauce, Michael aqui. Ou não?', bonus: 'a Bolsa mostra pra onde cada ação tende', defeito: 'produção −5%' },
];
export const convidado = (id: number): Convidado => CONVIDADOS.find((c) => c.id === id)!;

export const CR = 1, VORCARO = 2, GEMAPLYS = 3, LUVA = 4, KOJIMA = 5, GABE = 6, TERRY = 7, VINI = 8, MCVV = 9, ANA = 10, VSAUCE = 11;

/** Força de cada cadeira (frente, meio, canto) e quantos PPP Podcasts (gerador 13) abrem cada uma. */
export const PESOS = [1, 0.5, 0.25] as const;
export const ABRE_COM = [1, 25, 50] as const;
export const NOME_CADEIRA = ['frente', 'meio', 'canto'] as const;
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

/** 06:00 ≤ hora < 12:00 em Brasília (UTC−3, sem horário de verão). */
export function manhaBrasilia(tMs: number): boolean {
  const h = Math.floor((((tMs / 1000 - 10800) % 86400) + 86400) % 86400 / 3600);
  return h >= 6 && h < 12;
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
/** Multiplicador da produção toda em t (sem a Ana da manhã, que vai só no Food truck). */
export function multProducao({ c, ppp, uid }: Ctx, tMs: number): number {
  let m = (1 + 0.15 * peso(c, ppp, CR)) * (1 - 0.05 * peso(c, ppp, LUVA)) * (1 - 0.05 * peso(c, ppp, VSAUCE));
  const pk = peso(c, ppp, KOJIMA);
  if (pk) m *= kojimaMult(pk, sentadoDesde(c, KOJIMA)!, tMs);
  const pa = peso(c, ppp, ANA);
  if (pa && !manhaBrasilia(tMs)) m *= 1 - 0.05 * pa;
  const pm = peso(c, ppp, MCVV);
  if (pm && derrubadaAte(uid, pm, sentadoDesde(c, MCVV)!, tMs) !== null) m *= 1 - 0.1 * pm;
  return m;
}
/** O Food truck (gerador 11) com a Ana de manhã. */
export function multFoodTruck({ c, ppp }: Omit<Ctx, 'uid'>, tMs: number): number {
  const pa = peso(c, ppp, ANA);
  return pa && manhaBrasilia(tMs) ? 1 + pa : 1;
}
export const custoGeradores = (c: Cadeiras, ppp: number) => 1 - 0.1 * peso(c, ppp, GABE);
export const custoMelhorias = (c: Cadeiras, ppp: number) => 1 + 0.1 * peso(c, ppp, CR);
export const deltaOportunidades = (c: Cadeiras, ppp: number) => Math.ceil(5 * peso(c, ppp, LUVA)) - Math.ceil(3 * peso(c, ppp, GABE));
