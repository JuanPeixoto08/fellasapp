// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { PokerHand, PokerPlayer, PokerSeat, PokerState, Wallet } from '../shared/types';
import { initial, type PokerUi } from './machine';
import { createView, type Extras, type ViewHandlers } from './view';

const seat = (n: number, user_id: string, o: Partial<PokerSeat> = {}): PokerSeat => ({
  seat: n,
  user_id,
  stack: 300,
  status: 'playing',
  wait_bb: false,
  leaving: false,
  busted: false,
  ...o,
});
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
  no: 3,
  status: 'betting',
  street: 'preflop',
  board: [],
  players: { '0': pl('me', { bet: 10 }), '1': pl('bia', { bet: 30, last: 'raise' }) },
  pot: 40,
  current_bet: 30,
  min_raise_to: 50,
  to_act: 0,
  action_no: 2,
  deadline: '2026-10-08T12:00:30.000Z',
  button: 1,
  sb: 1,
  bb: 0,
  runout: false,
  results: null,
  shown: {},
  ...o,
});
const table = (o: Partial<PokerState> = {}): PokerState => ({
  seq: 9,
  server_now: '2026-10-08T12:00:00.000Z',
  closed: false,
  next_hand_at: null,
  blinds: [5, 10],
  buyin: [200, 500],
  seats: [seat(0, 'me', { stack: 290 }), seat(1, 'bia', { stack: 270 })],
  hand: hand(),
  me: { rathole_min: null },
  ...o,
});
const wallet: Wallet = { balance: 740, fiado_count: 0, can_fiado: false, open_round_id: null, week_start: '2026-10-05', seated_stack: 290 };
const ui = (o: Partial<PokerUi> = {}): PokerUi => ({ ...initial, phase: 'ready', table: table(), wallet, weekStart: '2026-10-05', ...o });
const anchors = {
  seatAnchor: (v: number) => ({ x: v * 10, y: v * 10 }),
  potAnchor: () => ({ x: 50, y: 50 }),
  mineAnchor: () => ({ x: 50, y: 90 }),
  orientation: () => 'portrait' as const,
};
const extras = (o: Partial<Extras> = {}): Extras => ({
  me: 'me',
  fella: (id) => ({ bia: { id: 'bia', name: 'Bia', avatarUrl: null } })[id],
  history: [],
  board: [],
  tab: 'hands',
  now: Date.parse('2026-10-08T12:00:12.000Z'),
  ...o,
});

let h: { [K in keyof ViewHandlers]: Mock<ViewHandlers[K]> };
let root: HTMLElement;
const byLabel = (name: string) =>
  [...root.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
  ) as HTMLButtonElement | undefined;
const visible = (e: Element | null | undefined) => !!e && !(e as HTMLElement).closest('[hidden]');
const text = () => root.textContent ?? '';

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
  h = {
    openSit: vi.fn(),
    sheetAmount: vi.fn(),
    confirmSheet: vi.fn(),
    closeSheet: vi.fn(),
    act: vi.fn(),
    openRaise: vi.fn(),
    raiseTo: vi.fn(),
    confirmRaise: vi.fn(),
    closeRaise: vi.fn(),
    leave: vi.fn(),
    back: vi.fn(),
    openRebuy: vi.fn(),
    show: vi.fn(),
    openHistory: vi.fn(),
    tab: vi.fn(),
    retry: vi.fn(),
  };
});

describe('poker view', () => {
  it('sem lugar: os vazios viram Sentar e abrem a folha do lugar certo', () => {
    const v = createView(root, h);
    v.render(ui({ table: table({ seats: [seat(1, 'bia')], hand: null }) }), anchors, extras({ me: 'eu' }));
    const empties = [...root.querySelectorAll('button.seat.empty')].filter(visible);
    expect(empties).toHaveLength(5);
    (empties[2] as HTMLButtonElement).click();
    expect(h.openSit).toHaveBeenCalledWith(3);
    expect(text()).toContain('Toca num lugar vazio pra sentar');
  });

  it('minha vez: moedas acesas e Pagar com o valor', () => {
    const v = createView(root, h);
    v.render(ui(), anchors, extras());
    const call = byLabel('Pagar 20')!;
    expect(visible(call)).toBe(true);
    expect(call.disabled).toBe(false);
    expect(call.textContent).toContain('20');
    byLabel('Correr')!.click();
    expect(h.act).toHaveBeenCalledWith('fold');
    byLabel('Aumentar')!.click();
    expect(h.openRaise).toHaveBeenCalled();
  });

  it('fora da vez: moedas apagadas e a linha diz de quem é a vez', () => {
    const v = createView(root, h);
    v.render(ui({ table: table({ hand: hand({ to_act: 1 }) }) }), anchors, extras());
    expect(byLabel('Correr')!.disabled).toBe(true);
    expect(text()).toContain('Vez de Bia · 18 s');
  });

  it('régua: atalhos, confirmar e voltar', () => {
    const v = createView(root, h);
    v.render(ui({ raise: 50 }), anchors, extras());
    expect(text()).toContain('½ pote 60');
    expect(text()).toContain('Pote 90');
    byLabel('Pote 90')!.click();
    expect(h.raiseTo).toHaveBeenCalledWith(90);
    byLabel('Aumentar para 50')!.click();
    expect(h.confirmRaise).toHaveBeenCalled();
    byLabel('Voltar aos botões')!.click();
    expect(h.closeRaise).toHaveBeenCalled();
  });

  it('ausente: faixa e Voltar pra mesa', () => {
    const v = createView(root, h);
    v.render(ui({ table: table({ seats: [seat(0, 'me', { status: 'away' }), seat(1, 'bia')], hand: null }) }), anchors, extras());
    expect(text()).toContain('Você ficou ausente: as mãos seguem sem você.');
    byLabel('Voltar pra mesa')!.click();
    expect(h.back).toHaveBeenCalled();
    expect(visible(byLabel('Correr'))).toBe(false);
  });

  it('folha de sentar: faixa da carteira; sem carteira, explica e trava', () => {
    const v = createView(root, h);
    const away = table({ seats: [seat(1, 'bia')], hand: null });
    v.render(ui({ table: away, sheet: { kind: 'sit', seat: 2, amount: 300 } }), anchors, extras({ me: 'eu' }));
    const range = root.querySelector<HTMLInputElement>('input[type=range]')!;
    expect([range.min, range.max, range.value]).toEqual(['200', '500', '300']);
    expect(byLabel('Sentar com 300')!.disabled).toBe(false);
    v.render(
      ui({ table: away, wallet: { ...wallet, balance: 150 }, sheet: { kind: 'sit', seat: 2, amount: 300 } }),
      anchors,
      extras({ me: 'eu' }),
    );
    expect(text()).toContain('Você precisa de pelo menos 200 na carteira.');
    expect(byLabel('Sentar com 200')!.disabled).toBe(true);
  });

  it('resultado em dourado e nome do fella como texto', () => {
    const v = createView(root, h);
    const done = hand({ status: 'done', to_act: null, results: { showdown: false, pots: [{ amount: 40, winners: [1], name: null }], payouts: { '1': 40 }, hands: {} } });
    v.render(
      ui({ table: table({ hand: done }) }),
      anchors,
      extras({ fella: () => ({ id: 'bia', name: '<b>Bia</b>', avatarUrl: null }) }),
    );
    expect(text()).toContain('<b>Bia</b> levou 40');
    expect(root.querySelector('.tags b')).toBeNull();
  });
});
