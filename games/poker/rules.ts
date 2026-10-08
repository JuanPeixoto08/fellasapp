// O que a tela do poker pode oferecer e o que ela escreve. Quem decide é o banco (0030); aqui só não se oferece
// o que ele recusaria, para o toque não voltar com erro.
import type { Orientation } from '../shared/table3d/layout';
import type { PokerHand, PokerPlayer, PokerSeat, PokerState } from '../shared/types';

export const STEP = 5;
const down = (n: number) => Math.floor(n / STEP) * STEP;
const fmt = (n: number) => n.toLocaleString('pt-BR');

export function seatOf(s: PokerState | null, me: string | null): PokerSeat | null {
  return (me && s?.seats.find((x) => x.user_id === me)) || null;
}

/** Meu lugar na mão (aberta ou a última), pelo user_id gravado nela. */
export function playerOf(hand: PokerHand | null, me: string | null): { seat: number; p: PokerPlayer } | null {
  if (!hand || !me) return null;
  for (const [k, p] of Object.entries(hand.players)) if (p.user_id === me) return { seat: Number(k), p };
  return null;
}

export function isMyTurn(s: PokerState | null, me: string | null): boolean {
  const h = s?.hand ?? null;
  const mine = playerOf(h, me);
  return !!h && h.status === 'betting' && !!mine && h.to_act === mine.seat;
}

export type Offer = {
  canCheck: boolean;
  toCall: number;
  callAllIn: boolean;
  canRaise: boolean;
  minTo: number;
  maxTo: number;
  halfPotTo: number;
  potTo: number;
};

export function offer(s: PokerState | null, me: string | null): Offer | null {
  if (!s || !isMyTurn(s, me)) return null;
  const h = s.hand!;
  const { p } = playerOf(h, me)!;
  const stack = seatOf(s, me)?.stack ?? 0;
  const toCall = Math.min(Math.max(h.current_bet - p.bet, 0), stack);
  const maxTo = p.bet + stack;
  const minTo = Math.min(h.min_raise_to, maxTo);
  const clamp = (to: number) => Math.min(Math.max(to, minTo), maxTo);
  const potAfterCall = h.pot + toCall;
  return {
    canCheck: p.bet >= h.current_bet,
    toCall,
    callAllIn: toCall > 0 && toCall === stack,
    canRaise: !p.capped && maxTo > h.current_bet,
    minTo,
    maxTo,
    // de 5 em 5 no total (a aposta na mesa pode estar quebrada depois de um empate com ficha sobrando)
    halfPotTo: clamp(down(h.current_bet + potAfterCall / 2)),
    potTo: clamp(down(h.current_bet + potAfterCall)),
  };
}

/** Valor da régua: de 5 em 5, entre o mínimo e tudo (tudo pode ser quebrado). */
export function clampRaise(to: number, o: Offer): number {
  if (to >= o.maxTo) return o.maxTo;
  return Math.max(o.minTo, down(to));
}

/** Posição na tela (0 = embaixo, depois no sentido horário). Em pé eu fico embaixo; deitado os lugares são fixos. */
export function visualOf(seat: number, mySeat: number | null, o: Orientation): number {
  return o === 'landscape' || mySeat === null ? seat : (seat - mySeat + 6) % 6;
}

/** Segundos até o prazo, com a diferença para a hora do servidor (servidor = local + offsetMs). */
export function secondsLeft(deadline: string | null, offsetMs: number, now = Date.now()): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((Date.parse(deadline) - (now + offsetMs)) / 1000));
}

export function lastLabel(p: PokerPlayer): string | null {
  switch (p.last) {
    case 'fold':
      return 'Correu';
    case 'check':
      return 'Mesa';
    case 'call':
      return `Pagou ${fmt(p.bet)}`;
    case 'raise':
      return `Aumentou p/ ${fmt(p.bet)}`;
    case 'allin':
      return 'All-in';
    case 'sb':
      return 'Cega pequena';
    case 'bb':
      return 'Cega grande';
    default:
      return null;
  }
}

/** Faixa da folha de sentar: entrada da mesa, anti-rathole e o que tenho na carteira. */
export function buyinRange(s: PokerState, wallet: number): { min: number; max: number; ok: boolean } {
  const min = Math.max(s.buyin[0], s.me?.rathole_min ?? 0);
  const cap = Math.min(Math.max(s.buyin[1], min), wallet);
  // de 10 em 10 (o banco recusa 255); só o mínimo exato do anti-rathole pode ser quebrado
  const max = cap === min ? cap : Math.floor(cap / 10) * 10;
  return { min, max, ok: max >= min };
}

/** Quem receberia cartas se a mesa estivesse parada. */
export function readyCount(s: PokerState): number {
  return s.seats.filter((x) => x.status === 'playing' && x.stack > 0 && !x.leaving).length;
}

export type Names = (userId: string) => string;

/** A linha acima dos botões: o que está acontecendo quando não é a minha vez. */
export function statusLine(s: PokerState, me: string | null, name: Names, offsetMs: number, now = Date.now()): string | null {
  const h = s.hand;
  const betting = h?.status === 'betting';
  const mine = seatOf(s, me);
  if (!betting && s.closed) return 'A mesa fecha pro reset. Volta 00:00.';
  if (mine?.status === 'away') return null; // a faixa do ausente cuida
  if (mine?.busted) return 'Acabaram suas fichas. Completa em até 1 minuto ou você levanta.';
  if (mine?.leaving) return 'Você sai no fim dessa mão';
  if (!betting) {
    const missing = 2 - readyCount(s);
    return missing > 0 ? `Esperando mais ${missing} ${missing === 1 ? 'fella' : 'fellas'} pra começar` : null;
  }
  if (mine && !playerOf(h!, me)) return 'Você entra quando a cega grande chegar em você';
  if (isMyTurn(s, me) || h!.to_act === null) return null;
  const who = h!.players[String(h!.to_act)];
  const secs = secondsLeft(h!.deadline, offsetMs, now);
  return `Vez de ${name(who.user_id)}${secs === null ? '' : ` · ${secs} s`}`;
}

/** Quem levou a mão que acabou. */
export function resultLine(h: PokerHand, me: string | null, name: Names): string | null {
  if (h.status !== 'done' || !h.results) return null;
  const who = (uid: string) => (uid === me ? 'Você' : name(uid));
  const pays = Object.entries(h.results.payouts)
    .filter(([, v]) => v > 0)
    .map(([seat, v]) => ({ uid: h.players[seat].user_id, v }))
    .sort((a, b) => b.v - a.v);
  if (!pays.length) return null;
  if (pays.length === 1) return `${who(pays[0].uid)} levou ${fmt(pays[0].v)}`;
  if (h.results.pots.every((p) => p.winners.length > 1)) {
    const list = pays.map((x) => who(x.uid));
    const total = pays.reduce((sum, x) => sum + x.v, 0);
    return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]} dividiram ${fmt(total)}`;
  }
  return pays.map((x) => `${who(x.uid)} levou ${fmt(x.v)}`).join(' · ');
}

/** Faixa da folha de completar: de 10 em 10, até o teto da mesa e até a carteira. */
export function rebuyRange(stack: number, max: number, wallet: number): { min: number; max: number; ok: boolean } {
  const top = Math.min(Math.floor((max - stack) / 10) * 10, Math.floor(wallet / 10) * 10);
  return { min: 10, max: top, ok: top >= 10 };
}

/** Valor da régua da folha: o mínimo exato vale (anti-rathole pode ser quebrado); o resto, de 10 em 10. */
export function snapAmount(v: number, r: { min: number; max: number }): number {
  if (v <= r.min) return r.min;
  return Math.min(Math.max(Math.round(v / 10) * 10, r.min), r.max);
}
