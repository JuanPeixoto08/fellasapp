// Mesa do Blackjack: liga a máquina de estados (machine), a tela (view) e a cena 3D (table) ao banco (api).
// Toda regra mora no banco; aqui só se pede a jogada, anima o que voltou e mostra.
import '../shared/hud/hud.css';

import * as realApi from '../shared/api';
import { GameError, toGameError } from '../shared/errors';
import type { Action, RoundState } from '../shared/types';
import { createTable, type Table } from '../shared/table3d/scene';
import { canAct, createEpoch, initial, reduce, type MachineEvent, type MachineState } from './machine';
import { actionDelta, canDouble, canSplit, MIN_BET } from './rules';
import { createView } from './view';

// só no dev: ?shot faz a página se achar visível (o Chrome da automação marca a aba como escondida e freia timers)
const SHOT = import.meta.env.DEV && new URLSearchParams(location.search).has('shot');
if (SHOT) {
  Object.defineProperty(document, 'hidden', { get: () => false });
  // timer de Worker não sofre o freio das abas escondidas; ~60 quadros por segundo
  const tick = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'])));
  const queue: FrameRequestCallback[] = [];
  tick.onmessage = () => queue.splice(0).forEach((cb) => cb(performance.now()));
  window.requestAnimationFrame = (cb) => (queue.push(cb), 0);
}

type Api = Pick<typeof realApi, 'bjAct' | 'bjCurrent' | 'bjDeal' | 'gamesFiado' | 'gamesWallet' | 'hasSession' | 'myId' | 'weekBoard'>;
// só no dev: ?mock joga contra as migrações rodando no navegador (dev/mockApi.ts)
const api: Api =
  import.meta.env.DEV && new URLSearchParams(location.search).has('mock') ? await import('../dev/mockApi') : realApi;

let s: MachineState = initial;
let table: Table | null = null;
let me: string | null = null;
const epoch = createEpoch();
const wait = (ms: number) => new Promise((r) => setTimeout(r, table?.reducedMotion || SHOT ? 0 : ms));

const view = createView(document.getElementById('app')!, {
  chip(value) {
    send({ type: 'chip', value });
    table?.setPot(s.bet);
  },
  clear() {
    send({ type: 'clear' });
    table?.setPot(0);
  },
  deal,
  act,
  again() {
    send({ type: 'again' });
    void table?.clear().then(() => table?.setPot(s.bet));
  },
  fiado() {
    if (!canAct(s)) return;
    send({ type: 'request' });
    void guard(async () => send({ type: 'wallet', wallet: await api.gamesFiado() }));
  },
  retry: reload,
});

function send(e: MachineEvent) {
  s = reduce(s, e);
  view.render(s, table);
}

/** Erro vira aviso; se o banco disse que o estado mudou (saldo, mão fechada, semana nova), recarrega. */
async function guard(work: () => Promise<void>) {
  epoch.bump();
  try {
    await work();
  } catch (e) {
    const err = toGameError(e);
    send({ type: 'failed', error: err });
    if (['insufficient_credits', 'round_done', 'round_open', 'round_not_found', 'invalid_action'].includes(err.code)) {
      await reload();
    }
  }
}

async function reload() {
  try {
    const had = s.round;
    const at = epoch.now();
    const [wallet, round] = await Promise.all([api.gamesWallet(), api.bjCurrent()]);
    if (epoch.stale(at)) return; // uma jogada começou enquanto recarregava: o estado dela vale mais
    if (round) table?.placeRound(round);
    else if (had) await table?.clear();
    else table?.setPot(0); // aposta recusada: as fichas saem da mesa junto com a aposta
    send({ type: 'loaded', wallet, round });
    refreshBoard();
  } catch (e) {
    send({ type: 'failed', error: toGameError(e) });
  }
}

function refreshBoard() {
  if (table?.orientation() !== 'landscape') return;
  api.weekBoard()
    .then((rows) => view.board(rows, me))
    .catch(() => {});
}

/** Banca revela a virada e compra o que comprou, uma carta por vez. */
async function dealerPlays(r: RoundState) {
  if (!table || r.status !== 'done') return;
  await table.reveal(1, r.dealer[1]);
  for (let i = 2; i < r.dealer.length; i++) {
    await wait(220);
    await table.dealCard('dealer', 0, 1, i, r.dealer[i]);
  }
}

function deal() {
  if (!canAct(s) || s.phase !== 'betting' || s.bet < MIN_BET) return;
  const bet = s.bet;
  send({ type: 'request' });
  void guard(async () => {
    const r = await api.bjDeal(bet);
    if (table) {
      const p = r.hands[0].cards;
      await table.dealCard('player', 0, 1, 0, p[0]);
      await table.dealCard('dealer', 0, 1, 0, r.dealer[0]);
      await table.dealCard('player', 0, 1, 1, p[1]);
      await table.dealCard('dealer', 0, 1, 1, null);
      await dealerPlays(r);
    }
    send({ type: 'round', round: r });
    if (r.status === 'done') refreshBoard();
  });
}

function act(action: Action) {
  const prev = s.round;
  if (!canAct(s) || s.phase !== 'playing' || !prev) return;
  const balance = s.wallet?.balance ?? 0;
  if ((action === 'double' && !canDouble(prev, balance)) || (action === 'split' && !canSplit(prev, balance))) return;
  send({ type: 'request' });
  void guard(async () => {
    const r = await api.bjAct(prev.id, action);
    const delta = actionDelta(prev, r, action);
    if (table && !delta) {
      table.placeRound(r); // outra aba jogou antes: a resposta não bate com a mesa, redesenha a mão inteira
    } else if (table && delta) {
      if (delta.kind === 'split') {
        await table.splitHand();
        table.setPot(r.hands.reduce((sum, h) => sum + h.bet, 0));
        await table.dealCard('player', 0, 2, 1, r.hands[0].cards[1]);
        await table.dealCard('player', 1, 2, 1, r.hands[1].cards[1]);
      } else if (delta.kind === 'card') {
        if (action === 'double') table.setPot(r.hands.reduce((sum, h) => sum + h.bet, 0));
        await table.dealCard('player', delta.hand, r.hands.length, delta.i, delta.card);
      }
      await dealerPlays(r);
    }
    send({ type: 'round', round: r });
    if (r.status === 'done') refreshBoard();
  });
}

// PC: 1 Pedir · 2 Parar · 3 Dobrar · 4 Dividir · Enter dá as cartas ou joga de novo
addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const coin = { '1': 'hit', '2': 'stand', '3': 'double', '4': 'split' }[e.key];
  if (coin) {
    const b = document.querySelector<HTMLButtonElement>(`.coin.${coin}`);
    if (b && !b.disabled && !b.closest('[hidden]')) b.click();
  } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
    if (s.phase === 'betting') deal();
    else if (s.phase === 'done') document.querySelector<HTMLButtonElement>('.cta .btn.main:not([hidden])')?.click();
  }
});

// voltou para a aba: a mão pode ter mudado em outra aba, ou a semana virado
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && (s.phase === 'betting' || s.phase === 'playing' || s.phase === 'done')) void reload();
});

void (async () => {
  if (import.meta.env.DEV && api === realApi) {
    const { devLogin } = await import('../shared/devLogin');
    await devLogin();
  }
  await document.fonts.ready; // as cartas são desenhadas com a Golos Text
  table = createTable(view.canvas);
  if (!table) {
    view.fatal('Esse navegador não roda a mesa 3D. Tenta pelo Chrome ou Safari atualizado.');
    return;
  }
  const t = table;
  const fit = () => {
    t.resize(view.canvas.clientWidth || 1, view.canvas.clientHeight || 1);
    view.render(s, t);
  };
  new ResizeObserver(fit).observe(view.canvas);
  fit();
  if (!(await api.hasSession())) {
    send({ type: 'failed', error: new GameError('no_session') });
    return;
  }
  me = await api.myId();
  await reload();
})();
