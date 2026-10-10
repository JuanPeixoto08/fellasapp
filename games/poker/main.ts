// Mesa do Poker: liga o estado da tela (machine), o HUD (view) e a mesa 3D (table) ao banco (api) e ao tempo real.
// O banco manda retratos; a tela anima a diferença entre o último desenhado e o novo, e só pede jogadas.
import '../shared/hud/hud.css';
import './poker.css';

import * as realApi from '../shared/api';
import { GameError, toGameError } from '../shared/errors';
import { watchTable as realWatch } from '../shared/realtime';
import type { BoardRow, Fella, PokerAction, PokerHistoryRow, PokerState } from '../shared/types';
import { initial, reduce, type PokerUi, type UiEvent } from './machine';
import { buyinRange, clampRaise, isMyTurn, offer, playerOf, rebuyRange, seatOf, snapAmount } from './rules';
import { createPlayer } from './player';
import { createPokerTable, type PokerTable } from './table';
import type { Step } from './tableDiff';
import { buildView, diff, type TableView } from './tableDiff';
import { createView } from './view';
import { vigiarVersao } from '../shared/atualizar';

// aba aberta há tempo recarrega sozinha quando sai versão nova (no dev o Vite já recarrega)
if (!import.meta.env.DEV) vigiarVersao();

// só no dev: ?shot faz a página se achar visível (o Chrome da automação marca a aba como escondida e freia timers)
const SHOT = import.meta.env.DEV && new URLSearchParams(location.search).has('shot');
if (SHOT) {
  Object.defineProperty(document, 'hidden', { get: () => false });
  const tick = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'])));
  const queue: FrameRequestCallback[] = [];
  tick.onmessage = () => queue.splice(0).forEach((cb) => cb(performance.now()));
  window.requestAnimationFrame = (cb) => (queue.push(cb), 0);
}

type Api = Pick<
  typeof realApi,
  | 'gamesWallet'
  | 'hasSession'
  | 'myId'
  | 'weekBoard'
  | 'fellas'
  | 'pokerState'
  | 'pokerSit'
  | 'pokerAct'
  | 'pokerRebuy'
  | 'pokerLeave'
  | 'pokerBack'
  | 'pokerShow'
  | 'pokerMyCards'
  | 'pokerTick'
  | 'pokerHistory'
> & { watchTable: typeof realWatch };
// só no dev: ?mock joga contra as migrações no navegador, com 3 bots (dev/mockPoker.ts)
const api: Api =
  import.meta.env.DEV && new URLSearchParams(location.search).has('mock')
    ? await import('../dev/mockPoker')
    : { ...realApi, watchTable: realWatch };

let ui: PokerUi = initial;
let table: PokerTable | null = null;
let me: string | null = null;
let drawn: TableView | null = null;
const player = createPlayer<Step[]>((steps) => table?.play(steps) ?? Promise.resolve());
const people = new Map<string, Fella>();
let history: PokerHistoryRow[] = [];
let board: BoardRow[] = [];
let tab: 'hands' | 'board' = 'hands';
let wasMyTurn = false;
let tickedFor = '';

const view = createView(document.getElementById('app')!, {
  openSit(seat) {
    if (!ui.table || !ui.wallet) return;
    const r = buyinRange(ui.table, ui.wallet.balance);
    send({ type: 'sheet', sheet: { kind: 'sit', seat, amount: snapAmount(Math.max(300, r.min), { min: r.min, max: Math.max(r.max, r.min) }) } });
  },
  sheetAmount(v) {
    const sh = ui.sheet;
    if (!sh || sh.kind === 'history' || !ui.table || !ui.wallet) return;
    const w = ui.wallet.balance;
    const mine = seatOf(ui.table, me);
    const r = sh.kind === 'sit' ? buyinRange(ui.table, w) : rebuyRange(mine?.stack ?? 0, ui.table.buyin[1], w);
    send({ type: 'sheet', sheet: { ...sh, amount: snapAmount(v, r) } });
  },
  confirmSheet() {
    const sh = ui.sheet;
    if (sh?.kind === 'sit') void guard(() => api.pokerSit(sh.seat, sh.amount), true);
    else if (sh?.kind === 'rebuy') void guard(() => api.pokerRebuy(sh.amount), true);
  },
  closeSheet: () => send({ type: 'sheet', sheet: null }),
  act: (a) => act(a),
  openRaise() {
    const o = offer(ui.table, me);
    if (o?.canRaise) send({ type: 'raise', to: o.minTo });
  },
  raiseTo(to) {
    const o = offer(ui.table, me);
    if (o) send({ type: 'raise', to: clampRaise(to, o) });
  },
  confirmRaise() {
    const o = offer(ui.table, me);
    if (o && ui.raise !== null) act(ui.raise >= o.maxTo ? 'allin' : 'raise', ui.raise);
  },
  closeRaise: () => send({ type: 'raise', to: null }),
  leave: () => void guard(() => api.pokerLeave(), true),
  back: () => void guard(() => api.pokerBack()),
  openRebuy() {
    const mine = seatOf(ui.table, me);
    if (!mine || !ui.table || !ui.wallet) return;
    const r = rebuyRange(mine.stack, ui.table.buyin[1], ui.wallet.balance);
    send({ type: 'sheet', sheet: { kind: 'rebuy', amount: Math.max(r.max, r.min) } });
  },
  show: () => void guard(() => api.pokerShow()),
  openHistory() {
    void loadHistory();
    send({ type: 'sheet', sheet: { kind: 'history' } });
  },
  tab(next) {
    tab = next;
    if (next === 'board') void loadBoard();
    paint();
  },
  retry: () => void reload(),
});

function send(e: UiEvent) {
  ui = reduce(ui, e);
  paint();
}

function paint() {
  view.render(ui, table, { me, fella: (id) => people.get(id), history, board, tab, now: Date.now() });
  if (!table) return;
  if (document.hidden) {
    // escondida a mesa não anima: nada entra na fila e, ao voltar, ela é redesenhada inteira
    drawn = null;
    return;
  }
  const next = buildView(ui.table, me, ui.cards, table.orientation());
  const steps = diff(drawn, next);
  if (!steps.length) return;
  drawn = next;
  player.push(steps);
}

/** Retrato novo (tempo real ou resposta): cartas da mão nova, histórico, nomes, carteira, vibrar na minha vez. */
function onTable(s: PokerState) {
  const before = ui.table;
  send({ type: 'table', table: s, now: Date.now() });
  if (ui.table !== before && ui.table?.seq === s.seq) {
    const handChanged = before?.hand?.id !== s.hand?.id;
    if (handChanged && playerOf(s.hand, me)) void loadCards();
    if (before?.hand?.status === 'betting' && s.hand?.status === 'done') void loadHistory();
    void loadPeople(s.seats.map((x) => x.user_id));
    const seated = !!seatOf(s, me);
    if (seated !== !!seatOf(before, me)) void refreshWallet();
  }
  const mine = isMyTurn(ui.table, me);
  if (mine && !wasMyTurn && typeof navigator.vibrate === 'function') navigator.vibrate(120);
  wasMyTurn = mine;
}

async function guard(work: () => Promise<PokerState | null>, wallet = false) {
  if (ui.busy) return;
  send({ type: 'request' });
  try {
    const s = await work();
    if (s) onTable(s);
    send({ type: 'done' });
    if (wallet) await refreshWallet();
  } catch (e) {
    const err = toGameError(e);
    send({ type: 'failed', error: err });
    if (['stale_seq', 'not_your_turn', 'seat_taken', 'not_seated', 'rebuy_in_hand', 'already_seated'].includes(err.code)) {
      await reload();
    }
  }
}

function act(a: PokerAction, amount?: number) {
  const h = ui.table?.hand;
  if (!h || !isMyTurn(ui.table, me)) return;
  void guard(() => api.pokerAct(h.id, h.action_no, a, amount));
}

async function loadCards() {
  try {
    send({ type: 'cards', cards: await api.pokerMyCards() });
  } catch {
    /* a próxima recarga traz */
  }
}

async function loadPeople(ids: string[]) {
  const missing = [...new Set(ids)].filter((id) => !people.has(id));
  if (!missing.length) return;
  try {
    for (const f of await api.fellas(missing)) people.set(f.id, f);
    paint();
  } catch {
    /* sem nome: "Alguém" até a próxima */
  }
}

async function loadHistory() {
  try {
    history = await api.pokerHistory();
    await loadPeople(history.flatMap((r) => Object.values(r.players)));
    paint();
  } catch {
    /* fica o que tinha */
  }
}

async function loadBoard() {
  try {
    board = await api.weekBoard();
    paint();
  } catch {
    /* fica o que tinha */
  }
}

async function refreshWallet() {
  try {
    send({ type: 'wallet', wallet: await api.gamesWallet() });
  } catch {
    /* fica o que tinha */
  }
}

async function reload() {
  try {
    const [s, cards, wallet] = await Promise.all([api.pokerState(), api.pokerMyCards(), api.gamesWallet()]);
    await loadPeople(s.seats.map((x) => x.user_id));
    send({ type: 'loaded', table: s, cards, wallet, now: Date.now() });
    wasMyTurn = isMyTurn(ui.table, me);
    void loadHistory();
    if (table?.orientation() === 'landscape') void loadBoard();
  } catch (e) {
    send({ type: 'failed', error: toGameError(e) });
  }
}

// relógio da tela: anel e segundos; prazo vencido (ou pausa entre mãos) → pede o tick (uma vez por prazo)
setInterval(() => {
  const s = ui.table;
  if (!s || document.hidden) return;
  paint();
  const due = s.hand?.status === 'betting' ? s.hand.deadline : s.next_hand_at;
  if (!due || Date.parse(due) + 1000 > Date.now() + ui.offsetMs) return;
  const key = `${due}|${s.seq}`;
  if (tickedFor === key) return;
  tickedFor = key;
  api
    .pokerTick()
    .then((st) => st && onTable(st))
    .catch(() => {});
}, 1000);

// PC: 1 Correr · 2 Mesa/Pagar · 3 Aumentar (abre a régua; com ela aberta, confirma) · 4 All-in · Esc fecha
addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
  const o = offer(ui.table, me);
  if (e.key === 'Escape') {
    if (ui.raise !== null) send({ type: 'raise', to: null });
    else if (ui.sheet) send({ type: 'sheet', sheet: null });
    return;
  }
  if (!o) return;
  if (e.key === '1') act('fold');
  else if (e.key === '2') act(o.canCheck ? 'check' : 'call');
  else if (e.key === '3' || (e.key === 'Enter' && ui.raise !== null)) {
    if (ui.raise === null) {
      if (o.canRaise) send({ type: 'raise', to: o.minTo });
    } else act(ui.raise >= o.maxTo ? 'allin' : 'raise', ui.raise);
  } else if (e.key === '4') act('allin');
});

// voltou para a aba: pode ter perdido eventos
document.addEventListener('visibilitychange', () => {
  player.cancel(); // o que ficou na fila é passado
  drawn = null;
  if (!document.hidden && ui.phase === 'ready') void reload();
});

void (async () => {
  if (import.meta.env.DEV && api.myId === realApi.myId) {
    const { devLogin } = await import('../shared/devLogin');
    await devLogin();
  }
  await document.fonts.ready; // as cartas são desenhadas com a Golos Text
  table = createPokerTable(view.canvas);
  if (!table) {
    view.fatal('Esse navegador não roda a mesa 3D. Tenta pelo Chrome ou Safari atualizado.');
    return;
  }
  if (SHOT) table.reducedMotion = true;
  const t = table;
  new ResizeObserver(() => {
    if (t.resize(view.canvas.clientWidth || 1, view.canvas.clientHeight || 1)) {
      drawn = null; // a vista depende da orientação: redesenha inteira
      if (t.orientation() === 'landscape') void loadBoard();
    }
    paint();
  }).observe(view.canvas);
  if (!(await api.hasSession())) {
    send({ type: 'failed', error: new GameError('no_session') });
    return;
  }
  me = await api.myId();
  await reload();
  api.watchTable(onTable, (live) => {
    const was = ui.online;
    send({ type: 'online', online: live });
    if (live && !was) void reload();
  });
})();
