import { describe, expect, it } from 'vitest';

import type { PokerHand, PokerPlayer, PokerState } from '../shared/types';
import {
  buyinRange,
  clampRaise,
  isMyTurn,
  lastLabel,
  offer,
  readyCount,
  rebuyRange,
  snapAmount,
  resultLine,
  secondsLeft,
  statusLine,
  visualOf,
} from './rules';

const ME = 'me';
const pl = (o: Partial<PokerPlayer> = {}): PokerPlayer => ({
  user_id: 'x',
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
  players: { '0': pl({ user_id: ME, bet: 10 }), '1': pl({ user_id: 'bia', bet: 30 }) },
  pot: 40,
  current_bet: 30,
  min_raise_to: 50,
  to_act: 0,
  action_no: 3,
  deadline: '2026-10-08T12:00:30.000Z',
  button: 1,
  sb: 1,
  bb: 0,
  runout: false,
  results: null,
  shown: {},
  ...o,
});
const st = (o: Partial<PokerState> = {}): PokerState => ({
  seq: 1,
  server_now: '2026-10-08T12:00:00.000Z',
  closed: false,
  next_hand_at: null,
  blinds: [5, 10],
  buyin: [200, 500],
  seats: [
    { seat: 0, user_id: ME, stack: 290, status: 'playing', wait_bb: false, leaving: false, busted: false },
    { seat: 1, user_id: 'bia', stack: 270, status: 'playing', wait_bb: false, leaving: false, busted: false },
  ],
  hand: hand(),
  ...o,
});
const names = (id: string) => ({ bia: 'Bia', teteu: 'Teteu' })[id] ?? 'Alguém';

describe('offer', () => {
  it('pagar quanto, aumento mínimo, ½ pote e pote', () => {
    expect(offer(st(), ME)).toEqual({
      canCheck: false,
      toCall: 20,
      callAllIn: false,
      canRaise: true,
      minTo: 50,
      maxTo: 300,
      halfPotTo: 60, // 30 + (40 + 20) / 2
      potTo: 90, // 30 + 40 + 20
    });
  });

  it('fora da minha vez não oferece nada', () => {
    expect(offer(st({ hand: hand({ to_act: 1 }) }), ME)).toBeNull();
    expect(isMyTurn(st({ hand: hand({ status: 'done' }) }), ME)).toBe(false);
  });

  it('depois de all-in curto só paga; sem fichas para cobrir, pagar é all-in', () => {
    const capped = st({ hand: hand({ players: { '0': pl({ user_id: ME, bet: 10, capped: true }), '1': pl({ user_id: 'bia', bet: 30 }) } }) });
    expect(offer(capped, ME)!.canRaise).toBe(false);
    const short = st({ seats: [{ seat: 0, user_id: ME, stack: 15, status: 'playing', wait_bb: false, leaving: false, busted: false }] });
    expect(offer(short, ME)).toMatchObject({ toCall: 15, callAllIn: true, canRaise: false, maxTo: 25 });
  });

  it('régua: de 5 em 5, entre o mínimo e tudo', () => {
    const o = offer(st(), ME)!;
    expect(clampRaise(52, o)).toBe(50);
    expect(clampRaise(10, o)).toBe(50);
    expect(clampRaise(999, o)).toBe(300);
    expect(clampRaise(77, o)).toBe(75);
  });
});

describe('tela', () => {
  it('em pé eu fico embaixo; deitado os lugares são fixos', () => {
    expect(visualOf(3, 3, 'portrait')).toBe(0);
    expect(visualOf(4, 3, 'portrait')).toBe(1);
    expect(visualOf(2, 3, 'portrait')).toBe(5);
    expect(visualOf(4, 3, 'landscape')).toBe(4);
    expect(visualOf(4, null, 'portrait')).toBe(4);
  });

  it('relógio com a diferença para a hora do servidor', () => {
    const now = Date.parse('2026-10-08T12:00:00.000Z');
    expect(secondsLeft('2026-10-08T12:00:30.000Z', 0, now)).toBe(30);
    expect(secondsLeft('2026-10-08T12:00:30.000Z', 10_000, now)).toBe(20); // servidor 10 s na frente
    expect(secondsLeft('2026-10-08T12:00:30.000Z', 0, now + 60_000)).toBe(0);
    expect(secondsLeft(null, 0, now)).toBeNull();
  });

  it('o que cada um fez na rodada', () => {
    expect(lastLabel(pl({ last: 'call', bet: 40 }))).toBe('Pagou 40');
    expect(lastLabel(pl({ last: 'raise', bet: 120 }))).toBe('Aumentou p/ 120');
    expect(lastLabel(pl({ last: 'fold' }))).toBe('Correu');
    expect(lastLabel(pl({ last: 'check' }))).toBe('Mesa');
    expect(lastLabel(pl({ last: 'allin' }))).toBe('All-in');
    expect(lastLabel(pl({ last: null }))).toBeNull();
  });

  it('faixa de entrada: carteira e anti-rathole', () => {
    expect(buyinRange(st(), 740)).toEqual({ min: 200, max: 500, ok: true });
    expect(buyinRange(st(), 300)).toEqual({ min: 200, max: 300, ok: true });
    expect(buyinRange(st(), 150)).toEqual({ min: 200, max: 150, ok: false });
    expect(buyinRange(st({ me: { rathole_min: 735 } }), 2000)).toEqual({ min: 735, max: 735, ok: true });
  });
});

describe('linhas de estado', () => {
  const now = Date.parse('2026-10-08T12:00:12.000Z');

  it('vez de outro fella, com o relógio', () => {
    expect(statusLine(st({ hand: hand({ to_act: 1 }) }), ME, names, 0, now)).toBe('Vez de Bia · 18 s');
    expect(statusLine(st(), ME, names, 0, now)).toBeNull(); // minha vez: os botões falam
  });

  it('esperando gente, esperando a cega grande, saindo, sem fichas, mesa fechada', () => {
    const alone = st({ hand: null, seats: [st().seats[0]] });
    expect(readyCount(alone)).toBe(1);
    expect(statusLine(alone, ME, names, 0, now)).toBe('Esperando mais 1 fella pra começar');
    expect(statusLine(st({ hand: null, seats: [] }), null, names, 0, now)).toBe('Esperando mais 2 fellas pra começar');
    const waiting = st({
      seats: [...st().seats, { seat: 2, user_id: 'teteu', stack: 300, status: 'playing', wait_bb: true, leaving: false, busted: false }],
    });
    expect(statusLine(waiting, 'teteu', names, 0, now)).toBe('Você entra quando a cega grande chegar em você');
    const leaving = st({ seats: [{ ...st().seats[0], leaving: true }, st().seats[1]] });
    expect(statusLine(leaving, ME, names, 0, now)).toBe('Você sai no fim dessa mão');
    const busted = st({ hand: hand({ status: 'done' }), seats: [{ ...st().seats[0], stack: 0, busted: true }, st().seats[1]] });
    expect(statusLine(busted, ME, names, 0, now)).toBe('Acabaram suas fichas. Completa em até 1 minuto ou você levanta.');
    expect(statusLine(st({ hand: hand({ status: 'done' }), closed: true }), ME, names, 0, now)).toBe(
      'A mesa fecha pro reset. Volta 00:00.',
    );
  });

  it('resultado: eu levei, outro levou, dividiram, potes diferentes', () => {
    const done = (payouts: Record<string, number>, winners: number[][]) =>
      hand({
        status: 'done',
        results: { showdown: true, payouts, hands: {}, pots: winners.map((w) => ({ amount: 1, winners: w, name: null })) },
      });
    expect(resultLine(done({ '0': 240 }, [[0]]), ME, names)).toBe('Você levou 240');
    expect(resultLine(done({ '1': 1240 }, [[1]]), ME, names)).toBe('Bia levou 1.240');
    expect(resultLine(done({ '0': 150, '1': 150 }, [[0, 1]]), ME, names)).toBe('Você e Bia dividiram 300');
    expect(resultLine(done({ '0': 300, '1': 200 }, [[0], [1]]), ME, names)).toBe('Você levou 300 · Bia levou 200');
    expect(resultLine(hand(), ME, names)).toBeNull();
  });
});

describe('folhas', () => {
  it('completar: de 10 em 10 até 500 na mesa e até a carteira', () => {
    expect(rebuyRange(295, 500, 1000)).toEqual({ min: 10, max: 200, ok: true });
    expect(rebuyRange(100, 500, 155)).toEqual({ min: 10, max: 150, ok: true });
    expect(rebuyRange(495, 500, 1000)).toEqual({ min: 10, max: 0, ok: false });
  });

  it('valor da régua da folha: o mínimo exato (anti-rathole) ou de 10 em 10', () => {
    expect(snapAmount(735, { min: 735, max: 900 })).toBe(735);
    expect(snapAmount(745, { min: 735, max: 900 })).toBe(750);
    expect(snapAmount(305, { min: 200, max: 500 })).toBe(310);
    expect(snapAmount(999, { min: 200, max: 500 })).toBe(500);
    expect(snapAmount(100, { min: 200, max: 500 })).toBe(200);
  });
});

describe('valores que o banco aceita (revisão final)', () => {
  it('entrada máxima de 10 em 10 quando a carteira é quebrada', () => {
    expect(buyinRange(st(), 255)).toEqual({ min: 200, max: 250, ok: true });
    expect(buyinRange(st({ me: { rathole_min: 735 } }), 2005)).toEqual({ min: 735, max: 735, ok: true });
  });

  it('½ pote e pote de 5 em 5 mesmo com aposta quebrada na mesa', () => {
    const odd = st({ hand: hand({ current_bet: 33, min_raise_to: 56, pot: 66 }) });
    const o = offer(odd, ME)!;
    expect(o.halfPotTo % 5).toBe(0);
    expect(o.potTo % 5).toBe(0);
    expect(o.potTo).toBe(120); // 33 + 66 + 23 = 122 → 120
  });
});
