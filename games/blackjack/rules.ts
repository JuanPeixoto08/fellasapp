// O que a tela precisa saber das cartas. Quem decide de verdade (pagar, banca, validar) é o banco.
import type { Action, Card, Hand, RoundState } from '../shared/types';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const CHIPS = [10, 50, 100, 500] as const;
export type Chip = (typeof CHIPS)[number];
export const MIN_BET = 10;
export const MAX_BET = 500;

export const rankLabel = (c: Card) => RANKS[c % 13];
export const suitSymbol = (c: Card) => SUITS[Math.floor(c / 13)];
export const isRed = (c: Card) => {
  const suit = Math.floor(c / 13);
  return suit === 1 || suit === 2;
};

function cardValue(c: Card): number {
  const r = c % 13;
  return r === 0 ? 1 : r >= 9 ? 10 : r + 1;
}

export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  const hard = cards.reduce((sum, c) => sum + cardValue(c), 0);
  const soft = cards.some((c) => c % 13 === 0) && hard + 10 <= 21;
  return { total: soft ? hard + 10 : hard, soft };
}

const activeHand = (round: RoundState): Hand | undefined =>
  round.status === 'playing' ? round.hands[round.active] : undefined;

export function canDouble(round: RoundState, balance: number): boolean {
  const h = activeHand(round);
  return !!h && h.cards.length === 2 && !h.from_split_aces && balance >= h.bet;
}

export function canSplit(round: RoundState, balance: number): boolean {
  const h = activeHand(round);
  return (
    !!h &&
    round.hands.length === 1 &&
    h.cards.length === 2 &&
    cardValue(h.cards[0]) === cardValue(h.cards[1]) &&
    balance >= h.bet
  );
}

export function chipEnabled(value: number, bet: number, balance: number): boolean {
  return bet + value <= Math.min(MAX_BET, balance);
}

export type Delta = { kind: 'card'; hand: number; i: number; card: Card } | { kind: 'none' } | { kind: 'split' };

/**
 * O que mudou na mesa com a jogada, se a resposta bate com o que a tela tinha. null = não bate (outra aba jogou
 * antes): a tela redesenha a mão inteira em vez de animar uma carta que não é a dela.
 */
export function actionDelta(prev: RoundState, next: RoundState, action: Action): Delta | null {
  const a = prev.active;
  const before = prev.hands[a]?.cards.length ?? -1;
  if (action === 'split') return prev.hands.length === 1 && next.hands.length === 2 ? { kind: 'split' } : null;
  if (next.hands.length !== prev.hands.length) return null;
  const after = next.hands[a]?.cards.length ?? -1;
  if (action === 'stand') return after === before ? { kind: 'none' } : null;
  return after === before + 1 ? { kind: 'card', hand: a, i: before, card: next.hands[a].cards[before] } : null;
}

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Resultado da mão com o lucro dela (a aposta volta junto e não entra no número). */
export function resultLabel(h: Hand): string {
  switch (h.result) {
    case 'blackjack':
      return `Blackjack! +${fmt((h.bet * 3) / 2)}`;
    case 'win':
      return `Ganhou +${fmt(h.bet)}`;
    case 'push':
      return `Empate, volta ${fmt(h.bet)}`;
    case 'bust':
      return 'Estourou';
    case 'lose':
      return 'Banca ganhou';
    default:
      return '';
  }
}
