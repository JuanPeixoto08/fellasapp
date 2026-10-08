import { describe, expect, it } from 'vitest';

import { GameError } from '../shared/errors';
import type { PokerState, Wallet } from '../shared/types';
import { initial, reduce, WEEK_TURNED_POKER, type PokerUi } from './machine';

const table = (seq: number, o: Partial<PokerState> = {}): PokerState => ({
  seq,
  server_now: '2026-10-08T12:00:05.000Z',
  closed: false,
  next_hand_at: null,
  blinds: [5, 10],
  buyin: [200, 500],
  seats: [],
  hand: null,
  ...o,
});
const wallet = (week = '2026-10-05'): Wallet => ({
  balance: 700,
  fiado_count: 0,
  can_fiado: false,
  open_round_id: null,
  week_start: week,
  seated_stack: 300,
});
const NOW = Date.parse('2026-10-08T12:00:00.000Z');
const loaded = (s: PokerUi = initial) => reduce(s, { type: 'loaded', table: table(5, { me: { rathole_min: null } }), cards: null, wallet: wallet(), now: NOW });

describe('poker machine', () => {
  it('carrega: pronto, com a diferença para a hora do servidor', () => {
    const s = loaded();
    expect(s).toMatchObject({ phase: 'ready', offsetMs: 5000, busy: false, weekStart: '2026-10-05' });
  });

  it('ignora retrato mais velho', () => {
    const s = loaded();
    expect(reduce(s, { type: 'table', table: table(4), now: NOW }).table!.seq).toBe(5);
    expect(reduce(s, { type: 'table', table: table(6), now: NOW }).table!.seq).toBe(6);
  });

  it('retrato do tempo real (sem `me`) mantém o `me` que veio das funções', () => {
    const s = reduce(loaded(), { type: 'table', table: table(6), now: NOW });
    expect(s.table!.me).toEqual({ rathole_min: null });
  });

  it('régua fecha quando a vez muda', () => {
    const h = { id: 'h', action_no: 1 } as PokerState['hand'];
    let s = reduce(loaded(), { type: 'table', table: table(6, { hand: h }), now: NOW });
    s = reduce(s, { type: 'raise', to: 120 });
    expect(reduce(s, { type: 'table', table: table(7, { hand: h }), now: NOW }).raise).toBe(120);
    expect(reduce(s, { type: 'table', table: table(8, { hand: { ...h!, action_no: 2 } }), now: NOW }).raise).toBeNull();
  });

  it('pedido em andamento trava outro; erro vira aviso; sem sessão', () => {
    let s = reduce(loaded(), { type: 'request' });
    expect(s.busy).toBe(true);
    expect(reduce(s, { type: 'request' })).toBe(s);
    s = reduce(s, { type: 'failed', error: new GameError('stale_seq') });
    expect(s).toMatchObject({ busy: false, notice: 'A mesa mudou' });
    expect(reduce(initial, { type: 'failed', error: new GameError('no_session') }).phase).toBe('no_session');
  });

  it('feito: fecha folha e régua', () => {
    let s = reduce(loaded(), { type: 'sheet', sheet: { kind: 'sit', seat: 2, amount: 300 } });
    s = reduce(reduce(s, { type: 'raise', to: 80 }), { type: 'request' });
    expect(reduce(s, { type: 'done' })).toMatchObject({ busy: false, sheet: null, raise: null });
  });

  it('semana virou: avisa', () => {
    const s = reduce(loaded(), { type: 'wallet', wallet: wallet('2026-10-12') });
    expect(s.notice).toBe(WEEK_TURNED_POKER);
  });
});
