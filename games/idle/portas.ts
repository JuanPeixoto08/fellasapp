// O resumo de cada porta da bancada (a tela inicial): uma linha do que está acontecendo no minigame e um selo quando
// tem algo pra fazer. Puro: a tela só escreve o que sai daqui.
import type { BolsaEstado, HortaEstado, IdleState } from '../shared/types';
import { empresa, variacao } from './bolsa';
import { destrancada, MAX_TROCAS, trocasAgora } from './convidados';
import { daPlanta, fase, madura, resumoBonus } from './horta';

export type ResumoPorta = { st: string; badge: string | null; trancada: boolean };
const pct = (x: number) => `${x > 0 ? '+' : '−'}${(Math.round(Math.abs(x) * 1000) / 10).toLocaleString('pt-BR')}%`;

export function portaBolsa(s: IdleState, b: BolsaEstado | null): ResumoPorta {
  if ((s.generators[18] ?? 0) < 1) return { st: 'Compra 1 Grupo de trader pra abrir', badge: null, trancada: true };
  if (!b || !b.empresas.length) return { st: 'O mercado do grupo, ao vivo', badge: null, trancada: false };
  const vivas = b.empresas.filter((m) => m.rj_ate === null && m.historico.length > 1);
  const top = vivas.map((m) => ({ m, v: variacao(m.historico).hora })).sort((x, y) => Math.abs(y.v) - Math.abs(x.v))[0];
  const minhas = new Set(b.carteira.filter((p) => p.qtd > 0).map((p) => p.empresa)).size;
  const partes = [top ? `${empresa(top.m.id).codigo} ${pct(top.v)} na hora` : 'Mercado parado'];
  partes.push(minhas ? `${minhas === 1 ? '1 empresa sua' : `${minhas} empresas suas`}` : 'Nenhuma ação sua');
  return { st: partes.join(' · '), badge: b.viraram_po.length ? 'Virou pó' : null, trancada: false };
}

export function portaHorta(s: IdleState, h: HortaEstado | null, agoraMs: number): ResumoPorta {
  if ((s.generators[10] ?? 0) < 1) return { st: 'Compra 1 Food truck pra abrir', badge: null, trancada: true };
  // só o bônus principal (a lista toda passava do tamanho da porta; o resto está dentro da Horta)
  const bonus = (s.horta_bonus ? resumoBonus(s.horta_bonus) : 'Nada madura ainda').split(' · ')[0];
  if (!h) return { st: bonus, badge: null, trancada: false };
  const maduras = h.plantas.filter((p) => madura(fase(daPlanta(p), Date.parse(p.inicio), agoraMs))).length;
  const vazios = h.lado * h.lado - h.plantas.length;
  return {
    st: `${bonus} · coleção ${h.descobertas.length}/8`,
    badge: maduras ? (maduras === 1 ? '1 madura' : `${maduras} maduras`) : vazios > 0 ? `${vazios} vazios` : null,
    trancada: false,
  };
}

export function portaConvidados(s: IdleState, agoraMs: number): ResumoPorta {
  const ppp = s.generators[12] ?? 0;
  if (ppp < 1) return { st: 'Compra 1 PPP Podcast pra abrir', badge: null, trancada: true };
  const c = s.convidados;
  const sentados = c ? c.cadeira.filter((id, i) => id && destrancada(i, ppp)).length : 0;
  const abertas = [0, 1, 2].filter((i) => destrancada(i, ppp)).length;
  const tr = c ? trocasAgora(c, agoraMs).trocas : MAX_TROCAS;
  return {
    st: `${sentados === 1 ? '1 sentado' : `${sentados} sentados`} · trocas ${tr}/${MAX_TROCAS}`,
    badge: sentados < abertas && tr > 0 ? (sentados === 0 ? 'Estúdio vazio' : 'Cadeira vazia') : null,
    trancada: false,
  };
}
