// Estado da tela da Fellas Inc.: tudo que o banco devolve fica ancorado no relógio DELE (server_now), não no do
// celular. O número anima com a mesma conta do banco (economia.ts acumular).
import type { IdleState } from '../shared/types';
import { catalogo } from './catalogo';
import { acumular, efeitosArvore, efeitosDe, estrategiasAtivas, type FatorTempo, VIRAL_MS } from './economia';
import { COMBO_MULT } from './dourados';
import { CAIXA_PADRAO, type Caixa } from './oportunidades';
import type { NomeCena } from './palco';
import { ERAS } from './nomes';

export type Fase = 'carregando' | 'sem_sessao' | 'antes' | 'abrindo' | 'jogando';
export type Ancora = { estado: IdleState; clienteMs: number; servidorMs: number };

export const ancorar = (estado: IdleState, clienteMs: number): Ancora => ({ estado, clienteMs, servidorMs: Date.parse(estado.server_now) });
export const agoraServidor = (a: Ancora, clienteMs: number) => a.servidorMs + (clienteMs - a.clienteMs);

/** Segunda 00:00 de Brasília da semana do estado, em ms (para `pendentes(..., inicioSemanaMs)`). */
export const inicioSemana = (estado: IdleState): number => Date.parse(estado.week_start + 'T00:00:00-03:00');

/** O que a árvore do estado faz (caixinha, eventos, horta…): a mesma conta do banco. */
export const efeitos = (estado: IdleState) => efeitosDe(catalogo, estado);
/** A caixinha de oportunidades: o tamanho vem da árvore; a validade é sempre a padrão (4h). */
export const caixa = (estado: IdleState): Caixa => ({ tamanho: efeitos(estado).caixinha, validadeS: CAIXA_PADRAO.validadeS });

/** Os bônus com tempo do estado que multiplicam a produção toda (0076): LinkedIn (o mult que o banco congelou) e Combo. */
export function fatoresTempo(s: Pick<IdleState, 'linkedin_ate' | 'linkedin_mult' | 'combo_ate'>): FatorTempo[] {
  const out: FatorTempo[] = [];
  if (s.linkedin_ate && s.linkedin_mult) out.push({ ateMs: Date.parse(s.linkedin_ate), mult: s.linkedin_mult });
  if (s.combo_ate) out.push({ ateMs: Date.parse(s.combo_ate), mult: COMBO_MULT });
  return out;
}

export function valuationAgora(a: Ancora, clienteMs: number): number {
  // os ×5 no ar (0062: cada um conta); a resposta de antes da 0062 só tem o boost_until
  const boost = a.estado.boosts ? a.estado.boosts.map(Date.parse) : a.estado.boost_until ? Date.parse(a.estado.boost_until) : null;
  const virais = (a.estado.viral ?? []).map(Date.parse); // Viralizou: ×10 cada (sem teto), igual ao banco
  const marmita = a.estado.marmita_ate ? Date.parse(a.estado.marmita_ate) : null; // Marmita da mãe: ×3 (0074)
  return acumular(a.estado.valuation, a.estado.rate, a.servidorMs, agoraServidor(a, clienteMs), boost, virais,
    VIRAL_MS * efeitos(a.estado).douradoDuracao, marmita, fatoresTempo(a.estado));
}

export function faseDoEstado(estado: IdleState, atual: Fase): Fase {
  if (!estado.started) return 'antes';
  return atual === 'abrindo' ? 'abrindo' : 'jogando';
}

export function cenaDoEstado(estado: IdleState, fase: Fase): NomeCena {
  if (fase === 'antes' || !estado.started) return 'cena-0-antes';
  if (estado.generators[29] > 0) return 'cena-6';
  return `cena-${Math.min(Math.max(estado.era, 1), 5)}` as NomeCena;
}

export function estrategiaPendente(estado: IdleState): number | null {
  return estado.started && estado.era >= 2 && estado.strategies[estado.era - 2] < 0 ? estado.era : null;
}

/** O editor de personagem abre sozinho até o primeiro "Bora": sem avatar salvo, sem fechar no X nesta sessão, sem rascunho
 *  aberto, fora da cena de abrir e sem a folha de estratégia por cima. */
export function deveAbrirEditor(estado: IdleState, fase: Fase, editorFechado: boolean, rascunhoAberto: boolean): boolean {
  if (estado.avatar || editorFechado || rascunhoAberto) return false;
  if (fase === 'antes') return true;
  return fase === 'jogando' && estrategiaPendente(estado) === null;
}

/** Quanto a oportunidade fica na cena (s): o maior entre o da estratégia (Rolê eterno) e o dos nós da árvore (Print de tudo). */
export function segundosOportunidade(estado: IdleState, arvore: readonly number[] = []): number {
  return Math.max(efeitosArvore(catalogo, arvore).oppSegundos, ...estrategiasAtivas(catalogo, estado).map((e) => e.oppSegundos));
}

/** Um contrato seu venceu (o relógio do servidor passou de muda_em): a taxa mudou e a tela precisa bater o ponto. */
export const vencido = (estado: IdleState, agoraServidorMs: number): boolean =>
  estado.muda_em !== null && agoraServidorMs >= Date.parse(estado.muda_em);

/** O nome da era: "Era 5 · Sede". Com o gerador 30 a cena vira a 6 ("em órbita") e o nome acompanha: "Era 6 · Em órbita"
 *  (no jogo continua a era 5: estratégias e conquistas não mudam). `curto` = só o nome ("Sede", "Em órbita"). */
export function rotuloEra(era: number, orbita: boolean, curto = false): string {
  const [n, nome] = orbita ? [6, 'Em órbita'] : [era, ERAS[era - 1]];
  return curto ? nome : `Era ${n} · ${nome}`;
}

