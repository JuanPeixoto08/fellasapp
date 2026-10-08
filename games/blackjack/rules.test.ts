import { describe, expect, it } from 'vitest';

import type { Hand, RoundState } from '../shared/types';
import { canDouble, canSplit, chipEnabled, handTotal, isRed, rankLabel, resultLabel, suitSymbol } from './rules';

// mesma numeração do banco: rank = c % 13 (0 Ás … 9 = 10, 12 K); naipe = c / 13 (♠ ♥ ♦ ♣)
const As = 0, Ah = 13, s6 = 5, s9 = 8, c9 = 47, h10 = 22, Kc = 51, Ks = 12;

const hand = (cards: number[], extra: Partial<Hand> = {}): Hand => ({
  cards,
  bet: 100,
  doubled: false,
  from_split_aces: false,
  done: false,
  result: null,
  ...extra,
});
const round = (hands: Hand[], extra: Partial<RoundState> = {}): RoundState => ({
  id: 'r1',
  status: 'playing',
  bet: 100,
  hands,
  active: 0,
  dealer: [s9],
  dealer_total: 9,
  payout: 0,
  balance: 900,
  ...extra,
});

describe('cartas', () => {
  it('nome e naipe', () => {
    expect([rankLabel(As), rankLabel(h10), rankLabel(Ks)]).toEqual(['A', '10', 'K']);
    expect([suitSymbol(As), suitSymbol(Ah), suitSymbol(Kc)]).toEqual(['♠', '♥', '♣']);
    expect([isRed(Ah), isRed(As), isRed(26)]).toEqual([true, false, true]);
  });
});

describe('handTotal', () => {
  it('Ás vale 11 quando cabe', () => {
    expect(handTotal([As, s6])).toEqual({ total: 17, soft: true });
    expect(handTotal([As, s6, s9])).toEqual({ total: 16, soft: false });
    expect(handTotal([As, Ah, c9])).toEqual({ total: 21, soft: true });
    expect(handTotal([])).toEqual({ total: 0, soft: false });
  });
});

describe('o que pode', () => {
  it('dobrar: 2 cartas, não veio de ases divididos, saldo cobre', () => {
    expect(canDouble(round([hand([s6, s9])]), 100)).toBe(true);
    expect(canDouble(round([hand([s6, s9])]), 90)).toBe(false);
    expect(canDouble(round([hand([s6, s9, As])]), 1000)).toBe(false);
    expect(canDouble(round([hand([As, s9], { from_split_aces: true })]), 1000)).toBe(false);
    expect(canDouble(round([hand([s6, s9])], { status: 'done' }), 1000)).toBe(false);
  });

  it('dividir: par de mesmo valor (10 e K), uma vez, saldo cobre', () => {
    expect(canSplit(round([hand([h10, Kc])]), 100)).toBe(true);
    expect(canSplit(round([hand([h10, Kc])]), 50)).toBe(false);
    expect(canSplit(round([hand([h10, s9])]), 1000)).toBe(false);
    expect(canSplit(round([hand([h10, s9]), hand([Kc, s9])]), 1000)).toBe(false);
  });

  it('ficha: aposta não passa de 500 nem do saldo', () => {
    expect(chipEnabled(500, 0, 450)).toBe(false);
    expect(chipEnabled(100, 450, 1000)).toBe(false);
    expect(chipEnabled(50, 450, 1000)).toBe(true);
    expect(chipEnabled(10, 0, 10)).toBe(true);
  });
});

describe('resultLabel', () => {
  it('lucro da mão, na voz do app', () => {
    expect(resultLabel(hand([As, Kc], { result: 'blackjack', bet: 150 }))).toBe('Blackjack! +225');
    expect(resultLabel(hand([h10, s9], { result: 'win', bet: 200 }))).toBe('Ganhou +200');
    expect(resultLabel(hand([h10, s9], { result: 'push' }))).toBe('Empate, volta 100');
    expect(resultLabel(hand([h10, s9, Kc], { result: 'bust' }))).toBe('Estourou');
    expect(resultLabel(hand([h10, s6], { result: 'lose' }))).toBe('Banca ganhou');
    expect(resultLabel(hand([h10, s6]))).toBe('');
  });
});
