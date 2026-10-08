import { describe, expect, it } from 'vitest';

import type { PokerHand, PokerPlayer, PokerState } from '../shared/types';
import { buildView, diff, EMPTY_VIEW, type TableView } from './tableDiff';

const pl = (user_id: string, o: Partial<PokerPlayer> = {}): PokerPlayer => ({
  user_id,
  bet: 0,
  total: 0,
  folded: false,
  all_in: false,
  acted: false,
  capped: false,
  last: null,
  timed_out: false,
  ...o,
});
const hand = (o: Partial<PokerHand> = {}): PokerHand => ({
  id: 'h1',
  no: 1,
  status: 'betting',
  street: 'preflop',
  board: [],
  players: { '1': pl('bia', { bet: 5, total: 5 }), '3': pl('me', { bet: 10, total: 10 }), '4': pl('teteu', { bet: 10, total: 30 }) },
  pot: 45,
  current_bet: 10,
  min_raise_to: 20,
  to_act: 4,
  action_no: 0,
  deadline: null,
  button: 4,
  sb: 1,
  bb: 3,
  runout: false,
  results: null,
  shown: {},
  ...o,
});
const st = (h: PokerHand | null): PokerState => ({
  seq: 1,
  server_now: '2026-10-08T12:00:00Z',
  closed: false,
  next_hand_at: null,
  blinds: [5, 10],
  buyin: [200, 500],
  seats: [
    { seat: 1, user_id: 'bia', stack: 295, status: 'playing', wait_bb: false, leaving: false, busted: false },
    { seat: 3, user_id: 'me', stack: 290, status: 'playing', wait_bb: false, leaving: false, busted: false },
    { seat: 4, user_id: 'teteu', stack: 270, status: 'playing', wait_bb: false, leaving: false, busted: false },
  ],
  hand: h,
});
const CARDS = { hand_id: 'h1', cards: [0, 13] };

describe('buildView', () => {
  it('em pé: eu (lugar 3) embaixo; os outros giram junto', () => {
    const v = buildView(st(hand()), 'me', CARDS, 'portrait');
    expect(v).toMatchObject({ handId: 'h1', mine: [0, 13], button: 1, dealt: [4, 1], bets: { 4: 5, 0: 10, 1: 10 }, pot: 20 });
  });

  it('deitado: lugares fixos; cartas de outra mão não aparecem', () => {
    const v = buildView(st(hand()), 'me', { hand_id: 'velha', cards: [1, 2] }, 'landscape');
    expect(v).toMatchObject({ mine: null, button: 4, dealt: [1, 4], bets: { 1: 5, 3: 10, 4: 10 } });
  });

  it('mão acabada: apostas no pote e quem levou', () => {
    const h = hand({ status: 'done', results: { showdown: false, pots: [], payouts: { '3': 45 }, hands: {} } });
    expect(buildView(st(h), 'me', CARDS, 'landscape')).toMatchObject({ bets: {}, pot: 45, payouts: { 3: 45 } });
  });

  it('sem mão ou mão anulada: mesa vazia', () => {
    expect(buildView(st(null), 'me', null, 'portrait')).toEqual(EMPTY_VIEW);
    expect(buildView(st(hand({ status: 'void' })), 'me', null, 'portrait')).toEqual(EMPTY_VIEW);
  });
});

describe('diff', () => {
  const base: TableView = { ...EMPTY_VIEW, handId: 'h1', dealt: [1, 4], mine: [0, 13], bets: { 0: 10 }, pot: 20, button: 1 };

  it('primeira vez: desenha tudo', () => {
    expect(diff(null, base)).toEqual([{ kind: 'reset', view: base }]);
  });

  it('mão nova: limpa, fichas, distribui, minhas cartas', () => {
    const fresh: TableView = { ...base, handId: 'h2' };
    expect(diff(base, fresh)).toEqual([
      { kind: 'reset', view: { ...EMPTY_VIEW, handId: 'h2', button: 1 } },
      { kind: 'chips', bets: { 0: 10 }, pot: 20 },
      { kind: 'deal', seats: [1, 4] },
      { kind: 'mine', cards: [0, 13] },
    ]);
  });

  it('correu: as cartas dele saem; apostas mudam', () => {
    expect(diff(base, { ...base, dealt: [4], bets: { 0: 10, 4: 30 } })).toEqual([
      { kind: 'muck', seat: 1 },
      { kind: 'chips', bets: { 0: 10, 4: 30 }, pot: 20 },
    ]);
  });

  it('nova rua: apostas para o pote e 3 cartas sem pausa', () => {
    expect(diff(base, { ...base, bets: {}, pot: 60, board: [5, 6, 7] })).toEqual([
      { kind: 'chips', bets: {}, pot: 60 },
      { kind: 'board', cards: [5, 6, 7], from: 0, pause: false },
    ]);
  });

  it('all-in: as mãos viram antes, a mesa sai com pausa, depois paga', () => {
    const end: TableView = { ...base, bets: {}, pot: 600, board: [5, 6, 7, 8, 9], shown: { 4: [20, 21] }, runout: true, payouts: { 0: 600 } };
    expect(diff(base, end)).toEqual([
      { kind: 'chips', bets: {}, pot: 600 },
      { kind: 'show', seat: 4, cards: [20, 21] },
      { kind: 'board', cards: [5, 6, 7, 8, 9], from: 0, pause: true },
      { kind: 'pay', payouts: { 0: 600 } },
    ]);
  });

  it('nada mudou: nada a fazer', () => {
    expect(diff(base, { ...base })).toEqual([]);
  });
});
