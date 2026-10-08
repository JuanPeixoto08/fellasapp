// Estado da tela do poker. A mesa em si vem pronta do banco (retrato); aqui fica só o que é da tela: carregando,
// pedido em andamento, folha aberta, régua do aumento, aviso, conexão e a diferença de relógio.
import { ERROR_TEXT, type GameError } from '../shared/errors';
import type { PokerCards, PokerState, Wallet } from '../shared/types';

export type Sheet = null | { kind: 'sit'; seat: number; amount: number } | { kind: 'rebuy'; amount: number } | { kind: 'history' };

export type PokerUi = {
  phase: 'loading' | 'ready' | 'no_session';
  table: PokerState | null;
  cards: PokerCards;
  wallet: Wallet | null;
  busy: boolean;
  online: boolean;
  /** Hora do servidor menos a local, em ms. */
  offsetMs: number;
  sheet: Sheet;
  /** Valor da régua aberta (null = fechada). */
  raise: number | null;
  notice: string | null;
  weekStart: string | null;
};

export type UiEvent =
  | { type: 'loaded'; table: PokerState; cards: PokerCards; wallet: Wallet; now: number }
  | { type: 'table'; table: PokerState; now: number }
  | { type: 'cards'; cards: PokerCards }
  | { type: 'wallet'; wallet: Wallet }
  | { type: 'request' }
  | { type: 'done' }
  | { type: 'failed'; error: GameError }
  | { type: 'online'; online: boolean }
  | { type: 'sheet'; sheet: Sheet }
  | { type: 'raise'; to: number | null }
  | { type: 'dismiss' };

export const WEEK_TURNED_POKER = 'A semana virou! Todo mundo foi levantado e as fichas voltaram pra carteira.';

export const initial: PokerUi = {
  phase: 'loading',
  table: null,
  cards: null,
  wallet: null,
  busy: false,
  online: true,
  offsetMs: 0,
  sheet: null,
  raise: null,
  notice: null,
  weekStart: null,
};

const offset = (t: PokerState, now: number) => Date.parse(t.server_now) - now;
const turned = (s: PokerUi, w: Wallet) => s.weekStart !== null && w.week_start !== s.weekStart;

export function reduce(s: PokerUi, e: UiEvent): PokerUi {
  switch (e.type) {
    case 'loaded':
      return {
        ...s,
        phase: 'ready',
        table: e.table,
        cards: e.cards,
        wallet: e.wallet,
        offsetMs: offset(e.table, e.now),
        weekStart: e.wallet.week_start,
        notice: turned(s, e.wallet) ? WEEK_TURNED_POKER : s.notice,
        busy: false,
      };
    case 'table': {
      if (s.table && e.table.seq < s.table.seq) return s; // retrato velho chegou depois
      const sameTurn = e.table.hand?.id === s.table?.hand?.id && e.table.hand?.action_no === s.table?.hand?.action_no;
      return {
        ...s,
        table: { ...e.table, me: e.table.me ?? s.table?.me },
        offsetMs: offset(e.table, e.now),
        raise: sameTurn ? s.raise : null,
      };
    }
    case 'cards':
      return { ...s, cards: e.cards };
    case 'wallet':
      return { ...s, wallet: e.wallet, weekStart: e.wallet.week_start, notice: turned(s, e.wallet) ? WEEK_TURNED_POKER : s.notice };
    case 'request':
      return s.busy ? s : { ...s, busy: true, notice: null };
    case 'done':
      return { ...s, busy: false, sheet: null, raise: null };
    case 'failed':
      if (e.error.code === 'no_session') return { ...s, phase: 'no_session', busy: false };
      return { ...s, busy: false, notice: ERROR_TEXT[e.error.code] };
    case 'online':
      return { ...s, online: e.online };
    case 'sheet':
      return { ...s, sheet: e.sheet };
    case 'raise':
      return { ...s, raise: e.to };
    case 'dismiss':
      return { ...s, notice: null };
  }
}
