import { describe, expect, it } from 'vitest';

import { GameError } from '../shared/errors';
import type { RoundState, Wallet } from '../shared/types';
import { canAct, createEpoch, initial, reduce, type MachineEvent, type MachineState } from './machine';

const wallet = (extra: Partial<Wallet> = {}): Wallet => ({
  balance: 1000,
  fiado_count: 0,
  can_fiado: false,
  open_round_id: null,
  week_start: '2026-10-05',
  ...extra,
});
const round = (extra: Partial<RoundState> = {}): RoundState => ({
  id: 'r1',
  status: 'playing',
  bet: 100,
  hands: [{ cards: [5, 8], bet: 100, doubled: false, from_split_aces: false, done: false, result: null }],
  active: 0,
  dealer: [12],
  dealer_total: 10,
  payout: 0,
  balance: 900,
  can_fiado: false,
  ...extra,
});
const run = (...events: MachineEvent[]) => events.reduce<MachineState>(reduce, initial);

describe('machine', () => {
  it('abre apostando, ou na mão aberta', () => {
    expect(run({ type: 'loaded', wallet: wallet(), round: null })).toMatchObject({ phase: 'betting', weekStart: '2026-10-05' });
    expect(run({ type: 'loaded', wallet: wallet({ open_round_id: 'r1' }), round: round() }).phase).toBe('playing');
  });

  it('fichas somam; não passa de 500 nem do saldo; limpar zera', () => {
    const s = run({ type: 'loaded', wallet: wallet({ balance: 600 }) , round: null }, { type: 'chip', value: 500 }, { type: 'chip', value: 100 }, { type: 'chip', value: 50 });
    expect(s.bet).toBe(500);
    expect(reduce(s, { type: 'clear' }).bet).toBe(0);
    const poor = run({ type: 'loaded', wallet: wallet({ balance: 60 }), round: null }, { type: 'chip', value: 50 }, { type: 'chip', value: 50 });
    expect(poor.bet).toBe(50);
  });

  it('pedido em voo trava tudo (toque duplo não conta duas vezes)', () => {
    const busy = run({ type: 'loaded', wallet: wallet(), round: null }, { type: 'chip', value: 100 }, { type: 'request' });
    expect(busy.phase).toBe('busy');
    expect(canAct(busy)).toBe(false);
    expect(reduce(busy, { type: 'request' })).toBe(busy);
    expect(reduce(busy, { type: 'chip', value: 10 })).toBe(busy);
  });

  it('mão que termina: fim, saldo novo, guarda a aposta para "Bora de novo"', () => {
    const s = run(
      { type: 'loaded', wallet: wallet(), round: null },
      { type: 'chip', value: 100 },
      { type: 'request' },
      { type: 'round', round: round() },
      { type: 'request' },
      { type: 'round', round: round({ status: 'done', payout: 200, balance: 1100 }) },
    );
    expect(s).toMatchObject({ phase: 'done', lastBet: 100 });
    expect(s.wallet?.balance).toBe(1100);
    expect(canAct(s)).toBe(true);
    const again = reduce(s, { type: 'again' });
    expect(again).toMatchObject({ phase: 'betting', bet: 100, round: null });
  });

  it('"Bora de novo" sem saldo para a mesma aposta começa do zero', () => {
    const s = run(
      { type: 'loaded', wallet: wallet({ balance: 100 }), round: null },
      { type: 'chip', value: 100 },
      { type: 'request' },
      { type: 'round', round: round({ status: 'done', balance: 0 }) },
      { type: 'again' },
    );
    expect(s.bet).toBe(0);
  });

  it('saldo mudou em outra aba: avisa e volta para onde estava', () => {
    const s = run(
      { type: 'loaded', wallet: wallet(), round: null },
      { type: 'chip', value: 500 },
      { type: 'request' },
      { type: 'failed', error: new GameError('insufficient_credits') },
    );
    expect(s).toMatchObject({ phase: 'betting', notice: 'Saldo não cobre essa aposta', bet: 500 });
  });

  it('sessão caiu: tela de entrar', () => {
    const s = run({ type: 'loaded', wallet: wallet(), round: null }, { type: 'request' }, { type: 'failed', error: new GameError('no_session') });
    expect(s.phase).toBe('no_session');
  });

  it('a semana virou com a mesa aberta', () => {
    const msg = 'A semana virou! Sua mão foi encerrada e todo mundo voltou pra 1.000.';
    const s = run(
      { type: 'loaded', wallet: wallet({ open_round_id: 'r1' }), round: round() },
      { type: 'request' },
      { type: 'failed', error: new GameError('round_done') },
      { type: 'loaded', wallet: wallet({ week_start: '2026-10-12' }), round: null },
    );
    expect(s).toMatchObject({ phase: 'betting', notice: msg, round: null, weekStart: '2026-10-12' });
    expect(reduce(run({ type: 'loaded', wallet: wallet(), round: null }), { type: 'wallet', wallet: wallet({ week_start: '2026-10-12' }) }).notice).toBe(msg);
  });

  it('quebrou na mesa: a resposta da mão já libera o fiado', () => {
    const s = run(
      { type: 'loaded', wallet: wallet({ balance: 500, can_fiado: false }), round: null },
      { type: 'chip', value: 500 },
      { type: 'request' },
      { type: 'round', round: round({ status: 'done', bet: 500, balance: 0, can_fiado: true }) },
    );
    expect(s.wallet).toMatchObject({ balance: 0, can_fiado: true });
  });

  it('recarga velha não desfaz jogada mais nova', () => {
    const epoch = createEpoch();
    const reloadStarted = epoch.now();
    epoch.bump(); // uma jogada começou depois
    expect(epoch.stale(reloadStarted)).toBe(true);
    expect(epoch.stale(epoch.now())).toBe(false);
  });

  it('fiado volta para a aposta com o saldo novo', () => {
    const s = run(
      { type: 'loaded', wallet: wallet({ balance: 0, can_fiado: true }), round: null },
      { type: 'request' },
      { type: 'wallet', wallet: wallet({ balance: 100, fiado_count: 1 }) },
    );
    expect(s).toMatchObject({ phase: 'betting', notice: null });
    expect(s.wallet?.balance).toBe(100);
  });
});
