// Do retrato do banco para o que a mesa 3D mostra (TableView), e de uma vista para a outra em passos de animação.
// Puro: a cena (table.ts) só executa os passos.
import type { Orientation } from '../shared/table3d/layout';
import type { Card, PokerCards, PokerState } from '../shared/types';
import { playerOf, seatOf, visualOf } from './rules';

export type TableView = {
  handId: string | null;
  /** Lugares (na tela) com 2 cartas viradas para baixo — sem mim, que tenho as minhas embaixo. */
  dealt: number[];
  /** Minhas cartas, quando estou na mão e elas já chegaram. */
  mine: Card[] | null;
  board: Card[];
  /** Lugar na tela → cartas abertas (showdown ou "Mostrar"). */
  shown: Record<number, Card[]>;
  /** Apostas da rodada por lugar na tela. */
  bets: Record<number, number>;
  /** Fichas no meio (rodadas anteriores; no fim, tudo). */
  pot: number;
  button: number | null;
  payouts: Record<number, number> | null;
  runout: boolean;
};

export const EMPTY_VIEW: TableView = {
  handId: null,
  dealt: [],
  mine: null,
  board: [],
  shown: {},
  bets: {},
  pot: 0,
  button: null,
  payouts: null,
  runout: false,
};

export function buildView(s: PokerState | null, me: string | null, cards: PokerCards, o: Orientation): TableView {
  const h = s?.hand;
  if (!s || !h || h.status === 'void') return EMPTY_VIEW;
  const mine = playerOf(h, me);
  const mySeat = seatOf(s, me)?.seat ?? mine?.seat ?? null;
  const vis = (seat: number) => visualOf(seat, mySeat, o);
  const entries = Object.entries(h.players).map(([k, p]) => [Number(k), p] as const);
  const done = h.status === 'done';
  const bets: Record<number, number> = {};
  if (!done) for (const [k, p] of entries) if (p.bet > 0) bets[vis(k)] = p.bet;
  const onTable = Object.values(bets).reduce((a, b) => a + b, 0);
  const shown: Record<number, Card[]> = {};
  for (const [k, c] of Object.entries(h.shown)) if (!mine || Number(k) !== mine.seat) shown[vis(Number(k))] = c;
  return {
    handId: h.id,
    dealt: entries.filter(([k, p]) => !p.folded && !(mine && k === mine.seat)).map(([k]) => vis(k)),
    mine: mine && cards?.hand_id === h.id ? cards.cards : null,
    board: h.board,
    shown,
    bets,
    pot: h.pot - onTable,
    button: vis(h.button),
    payouts:
      done && h.results
        ? Object.fromEntries(Object.entries(h.results.payouts).map(([k, v]) => [vis(Number(k)), v]))
        : null,
    runout: h.runout,
  };
}

export type Step =
  | { kind: 'reset'; view: TableView }
  | { kind: 'deal'; seats: number[] }
  | { kind: 'mine'; cards: Card[] }
  | { kind: 'muck'; seat: number }
  | { kind: 'chips'; bets: Record<number, number>; pot: number }
  | { kind: 'board'; cards: Card[]; from: number; pause: boolean }
  | { kind: 'show'; seat: number; cards: Card[] }
  | { kind: 'pay'; payouts: Record<number, number> };

const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

export function diff(prev: TableView | null, next: TableView): Step[] {
  if (!prev) return [{ kind: 'reset', view: next }];
  if (prev.handId !== next.handId) {
    // mão que começou agora anima; entrar no meio de uma (ou mesa vazia) só desenha
    const fresh = next.handId !== null && next.board.length === 0 && !next.payouts;
    if (!fresh) return [{ kind: 'reset', view: next }];
    const steps: Step[] = [
      { kind: 'reset', view: { ...EMPTY_VIEW, handId: next.handId, button: next.button } },
      { kind: 'chips', bets: next.bets, pot: next.pot },
      { kind: 'deal', seats: next.dealt },
    ];
    if (next.mine) steps.push({ kind: 'mine', cards: next.mine });
    return steps;
  }
  const steps: Step[] = [];
  if (!prev.mine && next.mine) steps.push({ kind: 'mine', cards: next.mine });
  for (const v of prev.dealt) if (!next.dealt.includes(v) && !next.shown[v]) steps.push({ kind: 'muck', seat: v });
  if (!same(prev.bets, next.bets) || prev.pot !== next.pot) steps.push({ kind: 'chips', bets: next.bets, pot: next.pot });
  const shows: Step[] = Object.keys(next.shown)
    .map(Number)
    .filter((v) => !prev.shown[v])
    .map((v) => ({ kind: 'show', seat: v, cards: next.shown[v] }));
  if (next.runout) steps.push(...shows); // todos all-in: as mãos viram antes de abrir a mesa
  if (next.board.length > prev.board.length) {
    steps.push({ kind: 'board', cards: next.board.slice(prev.board.length), from: prev.board.length, pause: next.runout });
  }
  if (!next.runout) steps.push(...shows);
  if (!prev.payouts && next.payouts) steps.push({ kind: 'pay', payouts: next.payouts });
  return steps;
}
