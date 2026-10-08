// Estados da mesa, sem efeitos: main.ts chama o banco e manda o resultado como evento.
import { ERROR_TEXT, type GameError } from '../shared/errors';
import type { RoundState, Wallet } from '../shared/types';
import { chipEnabled, MAX_BET } from './rules';

export type Phase = 'loading' | 'no_session' | 'betting' | 'busy' | 'playing' | 'done';
export type MachineState = {
  phase: Phase;
  wallet: Wallet | null;
  round: RoundState | null;
  bet: number;
  lastBet: number;
  notice: string | null;
  weekStart: string | null;
  /** Fase de antes do pedido em voo, para voltar se der erro. */
  back: Phase | null;
};
export type MachineEvent =
  | { type: 'loaded'; wallet: Wallet; round: RoundState | null }
  | { type: 'chip'; value: number }
  | { type: 'clear' }
  | { type: 'request' }
  | { type: 'round'; round: RoundState }
  | { type: 'wallet'; wallet: Wallet }
  | { type: 'again' }
  | { type: 'failed'; error: GameError };

export const WEEK_TURNED = 'A semana virou! Sua mão foi encerrada e todo mundo voltou pra 1.000.';

export const initial: MachineState = {
  phase: 'loading',
  wallet: null,
  round: null,
  bet: 0,
  lastBet: 0,
  notice: null,
  weekStart: null,
  back: null,
};

const turned = (s: MachineState, w: Wallet) => s.weekStart !== null && w.week_start !== s.weekStart;

export function reduce(s: MachineState, e: MachineEvent): MachineState {
  if (s.phase === 'busy' && (e.type === 'request' || e.type === 'chip' || e.type === 'clear' || e.type === 'again')) {
    return s;
  }
  switch (e.type) {
    case 'loaded': {
      if (turned(s, e.wallet)) {
        return { ...s, phase: 'betting', wallet: e.wallet, round: null, bet: 0, notice: WEEK_TURNED, weekStart: e.wallet.week_start, back: null };
      }
      const playing = e.round?.status === 'playing';
      return {
        ...s,
        phase: playing ? 'playing' : 'betting',
        wallet: e.wallet,
        round: playing ? e.round : null,
        bet: playing ? s.bet : 0,
        weekStart: e.wallet.week_start,
        back: null,
      };
    }
    case 'chip':
      if (s.phase !== 'betting' || !s.wallet || !chipEnabled(e.value, s.bet, s.wallet.balance)) return s;
      return { ...s, bet: s.bet + e.value, notice: null };
    case 'clear':
      return s.phase === 'betting' ? { ...s, bet: 0 } : s;
    case 'request':
      return { ...s, phase: 'busy', back: s.phase, notice: null };
    case 'round': {
      const done = e.round.status === 'done';
      const wallet = s.wallet && { ...s.wallet, balance: e.round.balance, open_round_id: done ? null : e.round.id };
      return { ...s, phase: done ? 'done' : 'playing', round: e.round, wallet, lastBet: done ? e.round.bet : s.lastBet, back: null };
    }
    case 'wallet':
      if (turned(s, e.wallet)) {
        return { ...s, phase: 'betting', wallet: e.wallet, round: null, bet: 0, notice: WEEK_TURNED, weekStart: e.wallet.week_start, back: null };
      }
      return { ...s, wallet: e.wallet, phase: s.phase === 'busy' ? (s.back ?? 'betting') : s.phase, back: null };
    case 'again': {
      const balance = s.wallet?.balance ?? 0;
      const bet = s.lastBet <= Math.min(MAX_BET, balance) ? s.lastBet : 0;
      return { ...s, phase: 'betting', round: null, bet, notice: null };
    }
    case 'failed':
      if (e.error.code === 'no_session') return { ...s, phase: 'no_session', back: null };
      return { ...s, phase: s.phase === 'busy' ? (s.back ?? 'betting') : s.phase, notice: ERROR_TEXT[e.error.code], back: null };
  }
}

export const canAct = (s: MachineState) => s.phase === 'betting' || s.phase === 'playing' || s.phase === 'done';
