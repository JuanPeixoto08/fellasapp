// Horta do Food truck (minigame 2): o catálogo das plantas e as contas da tela (puro). Quem decide plantar, colher,
// cruzar e morrer é o banco (0048, mesmo catálogo: teste de paridade); aqui só se mostra.

export type Especie = {
  id: number; nome: string;
  /** Preço da semente em segundos da produção atual. */
  custoS: number;
  /** Até amadurecer e quanto vive madura (s). */
  amadureceS: number; vidaS: number;
  /** Bônus quando madura (frações: 0,01 = 1%). Produção soma no multiplicador; geradores/melhorias são desconto. */
  producao: number; geradores: number; melhorias: number; oportunidades: number;
  /** O par que cruza (null = semente da loja desde o início, ou a rara). */
  pais: readonly [number, number] | null;
  rara: boolean;
};

const H = 3600;
export const ESPECIES: readonly Especie[] = [
  { id: 1, nome: 'Pé de Pix', custoS: 600, amadureceS: H, vidaS: 8 * H, producao: 0.01, geradores: 0, melhorias: 0, oportunidades: 0, pais: null, rara: false },
  { id: 2, nome: 'Couve do Coach', custoS: 600, amadureceS: H, vidaS: 8 * H, producao: 0, geradores: 0.01, melhorias: 0, oportunidades: 0, pais: null, rara: false },
  { id: 3, nome: 'Mandioca Turbo', custoS: 1800, amadureceS: 3 * H, vidaS: 12 * H, producao: 0.03, geradores: 0, melhorias: 0, oportunidades: 0, pais: [1, 1], rara: false },
  { id: 4, nome: 'Inhame do Primo Rico', custoS: 1800, amadureceS: 2 * H, vidaS: 10 * H, producao: 0, geradores: 0, melhorias: 0, oportunidades: 0.05, pais: [1, 2], rara: false },
  { id: 5, nome: 'Coentro', custoS: 1800, amadureceS: H, vidaS: 6 * H, producao: -0.01, geradores: 0, melhorias: 0.03, oportunidades: 0, pais: [2, 2], rara: false },
  { id: 6, nome: 'Abacate Proteico', custoS: 1800, amadureceS: 4 * H, vidaS: 12 * H, producao: 0.02, geradores: 0.02, melhorias: 0, oportunidades: 0, pais: [3, 4], rara: false },
  { id: 7, nome: 'Quiabo Escorregadio', custoS: 1800, amadureceS: 6 * H, vidaS: 16 * H, producao: 0, geradores: 0.04, melhorias: 0, oportunidades: 0, pais: [6, 2], rara: false },
  { id: 8, nome: 'Morango com Pescoço', custoS: 1800, amadureceS: 8 * H, vidaS: 24 * H, producao: 0.08, geradores: 0, melhorias: 0, oportunidades: 0, pais: null, rara: true },
];
export const especie = (id: number): Especie => ESPECIES.find((e) => e.id === id)!;

/** A grade é sempre lida numa 6 × 6 (canteiro = linha × 6 + coluna); o lado atual vem dos Food trucks. */
export const GRADE = 6;
/** O banco anda a horta em passos de 5 min (cruzamento e Morango). */
export const PASSO_S = 300;
const LIMIARES: readonly (readonly [number, number])[] = [[200, 6], [100, 5], [50, 4], [25, 3], [1, 2]];
/** Lado da grade pelos Food trucks (0 = sem horta). */
export const ladoDaGrade = (foodTrucks: number) => LIMIARES.find(([n]) => foodTrucks >= n)?.[1] ?? 0;
/** Quantos Food trucks pra liberar o lado seguinte (null = já no 6 × 6). */
export const proximoLado = (lado: number) => [...LIMIARES].reverse().find(([, l]) => l === lado + 1)?.[0] ?? null;
export const destrancado = (canteiro: number, lado: number) => Math.floor(canteiro / GRADE) < lado && canteiro % GRADE < lado;

export type FaseHorta = 'muda' | 'crescendo' | 'madura' | 'murchando' | 'morta';
/** A fase pela idade: muda (1º terço do amadurecer), crescendo, madura, murchando (última hora madura), morta. */
export function fase(e: Especie, inicioMs: number, agoraMs: number): FaseHorta {
  const t = (agoraMs - inicioMs) / 1000;
  if (t < e.amadureceS / 3) return 'muda';
  if (t < e.amadureceS) return 'crescendo';
  if (t < e.amadureceS + e.vidaS - H) return 'madura';
  if (t < e.amadureceS + e.vidaS) return 'murchando';
  return 'morta';
}
export const madura = (f: FaseHorta) => f === 'madura' || f === 'murchando';
/** Quanto falta pra amadurecer (ou, madura, pra morrer). */
export function falta(e: Especie, inicioMs: number, agoraMs: number): { ate: 'amadurecer' | 'morrer'; ms: number } {
  const amadurece = inicioMs + e.amadureceS * 1000;
  if (agoraMs < amadurece) return { ate: 'amadurecer', ms: amadurece - agoraMs };
  return { ate: 'morrer', ms: Math.max(0, amadurece + e.vidaS * 1000 - agoraMs) };
}
export const precoSemente = (e: Especie, taxa: number) => e.custoS * taxa;

export type BonusHorta = { producao: number; geradores: number; melhorias: number; oportunidades: number };
export type PlantaNaTela = { canteiro: number; especie: number; inicioMs: number };
/** Soma dos bônus das plantas maduras destrancadas (descontos com teto de 50%). Igual a idle_horta_bonus. */
export function bonusHorta(plantas: readonly PlantaNaTela[], lado: number, agoraMs: number): BonusHorta {
  const b: BonusHorta = { producao: 0, geradores: 0, melhorias: 0, oportunidades: 0 };
  for (const p of plantas) {
    const e = especie(p.especie);
    if (!destrancado(p.canteiro, lado) || !madura(fase(e, p.inicioMs, agoraMs))) continue;
    b.producao += e.producao;
    b.geradores += e.geradores;
    b.melhorias += e.melhorias;
    b.oportunidades += e.oportunidades;
  }
  return { ...b, geradores: Math.min(0.5, b.geradores), melhorias: Math.min(0.5, b.melhorias) };
}

const pctAbs = (x: number) => `${Math.round(Math.abs(x) * 1000) / 10}`.replace('.', ',');
/** "Produção +5% · Geradores −3% · Oportunidades +5%". */
export function resumoBonus(b: BonusHorta): string {
  const partes: string[] = [];
  if (b.producao) partes.push(`Produção ${b.producao > 0 ? '+' : '−'}${pctAbs(b.producao)}%`);
  if (b.geradores) partes.push(`Geradores −${pctAbs(b.geradores)}%`);
  if (b.melhorias) partes.push(`Melhorias −${pctAbs(b.melhorias)}%`);
  if (b.oportunidades) partes.push(`Oportunidades +${pctAbs(b.oportunidades)}%`);
  return partes.length ? partes.join(' · ') : 'Nada madura ainda';
}

/** Dica da coleção pra uma espécie não descoberta: aparece quando os dois pais já foram descobertos. */
export function dica(e: Especie, descobertas: readonly number[]): string | null {
  if (e.rara) return 'Tem gente que jura que viu';
  if (!e.pais || !e.pais.every((p) => descobertas.includes(p))) return null;
  const [a, b] = e.pais;
  return a === b ? `Nasce perto de dois ${especie(a).nome}` : `Nasce perto de ${especie(a).nome} e ${especie(b).nome}`;
}
