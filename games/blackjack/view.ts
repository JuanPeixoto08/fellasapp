// A tela da mesa em DOM: monta uma vez e, a cada estado, só liga/desliga e reescreve o que mudou.
import { ERROR_TEXT } from '../shared/errors';
import { button, chipButton, coinButton, countUp, el, fmt, type CoinKind } from '../shared/hud/hud';
import type { Orientation, Who } from '../shared/table3d/layout';
import type { Action, BoardRow } from '../shared/types';
import type { MachineState, Phase } from './machine';
import { canDouble, canSplit, CHIPS, chipEnabled, handTotal, MIN_BET, resultLabel } from './rules';

export type ViewHandlers = {
  chip(value: number): void;
  clear(): void;
  deal(): void;
  act(action: Action): void;
  again(): void;
  fiado(): void;
  retry(): void;
};
export type Anchors = { anchor(who: Who, hand: number): { x: number; y: number }; orientation(): Orientation };
export type View = {
  canvas: HTMLCanvasElement;
  render(s: MachineState, table: Anchors | null): void;
  board(rows: BoardRow[], me: string | null): void;
  fatal(text: string): void;
};

const ACTIONS: Record<CoinKind, Action> = { hit: 'hit', stand: 'stand', double: 'double', split: 'split' };

export function createView(root: HTMLElement, h: ViewHandlers): View {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const app = el('div', 'app');

  // topo
  const top = el('header', 'top');
  const back = el('a', undefined, '← Voltar');
  back.href = '/games';
  const credits = el('span', 'pill', '● —');
  top.append(back, el('span', undefined, 'Blackjack'), credits);

  // cena + o que fica preso nela
  const stage = el('div', 'stage');
  const canvas = el('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const tags = el('div', 'tags');
  tags.setAttribute('aria-live', 'polite');
  const side = el('aside', 'side');
  side.setAttribute('aria-label', 'Placar da semana');
  const betbox = el('div', 'betbox');
  stage.append(canvas, tags, side, betbox);

  // painel
  const panel = el('section', 'panel');
  panel.setAttribute('aria-label', 'Controles da mesa');
  const betrow = el('div', 'betrow');
  const betLabel = el('span');
  const betValue = el('b');
  betrow.append(betLabel, betValue);
  const hint = el('p', 'hint');
  const chips = el('div', 'chips');
  const chipBtns = CHIPS.map((v) => chipButton(v, () => h.chip(v)));
  chips.append(...chipBtns);
  const acts = el('div', 'acts');
  const coins = (Object.keys(ACTIONS) as CoinKind[]).map((k) => coinButton(k, () => h.act(ACTIONS[k])));
  acts.append(...coins);
  const cta = el('div', 'cta');
  const clearBtn = button('Limpar', 'btn', h.clear);
  const dealBtn = button('Dar as cartas', 'btn main', h.deal);
  const againBtn = button('Bora de novo', 'btn main', h.again);
  const fiadoBtn = button('Pegar fiado (+100)', 'btn main', h.fiado);
  cta.append(clearBtn, dealBtn, againBtn, fiadoBtn);
  panel.append(betrow, hint, chips, acts, cta);

  // avisos
  const notice = el('div', 'notice');
  notice.setAttribute('role', 'status');
  const noticeText = el('span');
  const retryBtn = button('Tentar de novo', '', h.retry);
  notice.append(noticeText, retryBtn);
  const overlay = el('div', 'overlay');
  const overlayText = el('p');
  const enter = el('a', 'btn main', 'Entrar');
  enter.href = '/';
  overlay.append(overlayText, enter);

  app.append(top, stage, panel, notice, overlay);
  root.append(app);

  let shownBalance: number | null = null;

  function show(node: HTMLElement, on: boolean) {
    node.hidden = !on;
  }

  function placeTags(s: MachineState, table: Anchors | null) {
    tags.replaceChildren();
    const r = s.round;
    const add = (who: Who, hand: number, label: string, small: string, cls = '') => {
      const t = el('div', `tag ${cls}`.trim());
      t.append(document.createTextNode(label + ' '), el('small', undefined, small));
      const p = table?.anchor(who, hand) ?? { x: 0, y: 0 };
      t.style.left = `${p.x}px`;
      t.style.top = `${p.y}px`;
      tags.append(t);
    };
    if (!r) {
      if (s.phase === 'betting' || (s.phase === 'busy' && s.back === 'betting')) add('player', 0, 'Faz sua aposta', '');
      return;
    }
    add('dealer', 0, 'Banca', r.status === 'playing' ? `${r.dealer_total} + ?` : String(r.dealer_total));
    const two = r.hands.length > 1;
    r.hands.forEach((hand, i) => {
      const who = two ? `Mão ${i + 1}` : 'Você';
      if (hand.result) {
        const won = hand.result === 'win' || hand.result === 'blackjack';
        add('player', i, who, resultLabel(hand), won ? 'gold' : '');
      } else {
        const dim = two && r.status === 'playing' && i !== r.active ? 'dim' : '';
        add('player', i, who, String(handTotal(hand.cards).total), dim);
      }
    });
  }

  function render(s: MachineState, table: Anchors | null) {
    const busy = s.phase === 'busy';
    const shown: Phase = busy ? (s.back ?? 'betting') : s.phase;
    const balance = s.wallet?.balance ?? 0;
    app.dataset.orient = table?.orientation() ?? 'portrait';

    // saldo
    if (s.wallet) {
      countUp(credits, shownBalance ?? balance, balance, 600, reduced);
      credits.setAttribute('aria-label', `Seus créditos: ${fmt(balance)}`);
      shownBalance = balance;
    }

    // aposta
    const inPlay = s.round ? s.round.hands.reduce((sum, x) => sum + x.bet, 0) : 0;
    const betText = shown === 'done' ? s.lastBet : shown === 'playing' ? inPlay : s.bet;
    betLabel.textContent = shown === 'done' ? 'Última aposta' : 'Aposta';
    betValue.textContent = fmt(betText);
    betbox.replaceChildren(document.createTextNode(betLabel.textContent), el('b', undefined, fmt(betText)));

    // painel por fase
    const broke = shown === 'betting' && !!s.wallet && balance < MIN_BET;
    show(betrow, shown === 'betting' || shown === 'playing' || shown === 'done');
    show(chips, shown === 'betting' && !broke);
    show(acts, shown === 'playing');
    show(clearBtn, shown === 'betting' && !broke);
    show(dealBtn, shown === 'betting' && !broke);
    show(againBtn, shown === 'done');
    show(fiadoBtn, broke && !!s.wallet?.can_fiado);
    show(cta, [clearBtn, dealBtn, againBtn, fiadoBtn].some((b) => !b.hidden));
    hint.textContent =
      shown === 'loading' ? 'Abrindo a mesa…' : broke && !s.wallet?.can_fiado ? ERROR_TEXT.fiado_today : '';
    show(hint, !!hint.textContent);

    chipBtns.forEach((b, i) => {
      const ok = chipEnabled(CHIPS[i], s.bet, balance) && !busy;
      b.setAttribute('aria-disabled', String(!ok));
    });
    clearBtn.disabled = busy || s.bet === 0;
    dealBtn.disabled = busy || s.bet < MIN_BET;
    againBtn.disabled = busy;
    fiadoBtn.disabled = busy;
    const r = s.round;
    const can: Record<CoinKind, boolean> = {
      hit: true,
      stand: true,
      double: !!r && canDouble(r, balance),
      split: !!r && canSplit(r, balance),
    };
    coins.forEach((b, i) => {
      b.disabled = busy || !can[(Object.keys(ACTIONS) as CoinKind[])[i]];
    });

    placeTags(s, table);

    // avisos
    noticeText.textContent = s.notice ?? '';
    show(notice, !!s.notice);
    show(retryBtn, s.notice === ERROR_TEXT.offline);
    overlayText.textContent = ERROR_TEXT.no_session;
    show(enter, true);
    show(overlay, s.phase === 'no_session');
  }

  function board(rows: BoardRow[], me: string | null) {
    side.replaceChildren(el('h4', undefined, 'PLACAR DA SEMANA'));
    if (!rows.length) side.append(el('p', 'empty', 'Ninguém jogou ainda. Abre os trabalhos.'));
    for (const r of rows) {
      const row = el('div', r.userId === me ? 'row me' : 'row');
      row.append(el('span', 'n', r.userId === me ? 'Você' : r.name), el('b', undefined, fmt(r.balance)));
      side.append(row);
    }
  }

  function fatal(text: string) {
    overlayText.textContent = text;
    show(enter, false);
    show(overlay, true);
    show(panel, false);
  }

  show(overlay, false);
  show(notice, false);
  return { canvas, render, board, fatal };
}
