// Estado da tela da Fellas Inc.: tudo que o banco devolve fica ancorado no relógio DELE (server_now), não no do
// celular. O número anima com a mesma conta do banco (economia.ts acumular).
import type { IdleState } from '../shared/types';
import { catalogo } from './catalogo';
import { acumular, estrategiasAtivas } from './economia';
import type { NomeCena } from './palco';

export type Fase = 'carregando' | 'sem_sessao' | 'antes' | 'abrindo' | 'jogando';
export type Ancora = { estado: IdleState; clienteMs: number; servidorMs: number };

export const ancorar = (estado: IdleState, clienteMs: number): Ancora => ({ estado, clienteMs, servidorMs: Date.parse(estado.server_now) });
export const agoraServidor = (a: Ancora, clienteMs: number) => a.servidorMs + (clienteMs - a.clienteMs);

/** Segunda 00:00 de Brasília da semana do estado, em ms (para `pendentes(..., inicioSemanaMs)`). */
export const inicioSemana = (estado: IdleState): number => Date.parse(estado.week_start + 'T00:00:00-03:00');

export function valuationAgora(a: Ancora, clienteMs: number): number {
  const boost = a.estado.boost_until ? Date.parse(a.estado.boost_until) : null;
  return acumular(a.estado.valuation, a.estado.rate, a.servidorMs, agoraServidor(a, clienteMs), boost);
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

export function segundosOportunidade(estado: IdleState): number {
  return Math.max(10, ...estrategiasAtivas(catalogo, estado).map((e) => e.oppSegundos));
}

/** Um contrato seu venceu (o relógio do servidor passou de muda_em): a taxa mudou e a tela precisa bater o ponto. */
export const vencido = (estado: IdleState, agoraServidorMs: number): boolean =>
  estado.muda_em !== null && agoraServidorMs >= Date.parse(estado.muda_em);
