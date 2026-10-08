// HUD do poker em DOM: lugares em volta da mesa (foto, nome, fichas, o que fez, relógio), pote, minha mão, botões
// moeda, régua do aumento, folhas (sentar, completar, histórico) e avisos. Monta uma vez; cada render reescreve só
// o que muda. Texto de usuário sempre por textContent.
import { button, el, fmt } from '../shared/hud/hud';
import type { Orientation } from '../shared/table3d/layout';
import type { BoardRow, Fella, PokerAction, PokerHistoryRow } from '../shared/types';
import { rank, rankName } from './hands';
import type { PokerUi } from './machine';
import {
  buyinRange,
  lastLabel,
  offer,
  playerOf,
  rebuyRange,
  resultLine,
  seatOf,
  secondsLeft,
  statusLine,
} from './rules';

export type Anchors = {
  seatAnchor(v: number): { x: number; y: number };
  potAnchor(): { x: number; y: number };
  mineAnchor(): { x: number; y: number };
  orientation(): Orientation;
};

export type ViewHandlers = {
  openSit(seat: number): void;
  sheetAmount(amount: number): void;
  confirmSheet(): void;
  closeSheet(): void;
  act(action: Exclude<PokerAction, 'raise'>): void;
  openRaise(): void;
  raiseTo(to: number): void;
  confirmRaise(): void;
  closeRaise(): void;
  leave(): void;
  back(): void;
  openRebuy(): void;
  show(): void;
  openHistory(): void;
  tab(tab: 'hands' | 'board'): void;
  retry(): void;
};

export type Extras = {
  me: string | null;
  fella(id: string): Fella | undefined;
  history: PokerHistoryRow[];
  board: BoardRow[];
  tab: 'hands' | 'board';
  now: number;
};

export type View = { canvas: HTMLCanvasElement; render(ui: PokerUi, t: Anchors | null, x: Extras): void; fatal(text: string): void };

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

function miniCard(c: number): HTMLElement {
  const suit = Math.floor(c / 13);
  return el('span', suit === 1 || suit === 2 ? 'mc r' : 'mc', RANKS[c % 13] + SUITS[suit]);
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

type Coin = { b: HTMLButtonElement; face: HTMLElement; label: HTMLElement };

/** Botão moeda (mesmo desenho do Blackjack): face com valor ou símbolo e plaquinha com o nome. */
function coin(kind: string, face: string, label: string, aria: string, key: string, onPress: () => void): Coin {
  const b = el('button', `coin ${kind}`);
  b.type = 'button';
  b.setAttribute('aria-label', aria);
  if (key) b.setAttribute('aria-keyshortcuts', key);
  const f = el('span', 'b');
  const v = el('span', 'v', face);
  f.append(v);
  const l = el('span', 'l', label);
  if (key) b.append(el('kbd', undefined, key));
  b.append(f, l);
  b.addEventListener('click', onPress);
  return { b, face: v, label: l };
}

type SeatEl = {
  root: HTMLElement;
  av: HTMLElement;
  img: HTMLImageElement;
  ini: HTMLElement;
  ring: HTMLElement;
  name: HTMLElement;
  stack: HTMLElement;
  status: HTMLElement;
};

function seatTag(): SeatEl {
  const root = el('div', 'seat');
  const av = el('div', 'av');
  const img = el('img');
  img.alt = '';
  const ini = el('span');
  const ring = el('div', 'ring');
  av.append(img, ini, ring);
  const nm = el('div', 'nm');
  const name = el('span');
  const stack = el('small');
  nm.append(name, stack);
  const status = el('div', 'st');
  root.append(av, nm, status);
  return { root, av, img, ini, ring, name, stack, status };
}

export function createView(root: HTMLElement, h: ViewHandlers): View {
  const app = el('div', 'app poker');

  // topo
  const top = el('header', 'top');
  const back = el('a', undefined, '← Voltar');
  back.href = '/games';
  const title = el('span', 'title', 'Poker');
  const tools = el('div', 'tools');
  const histBtn = button('Mãos', 'ghost hist', h.openHistory);
  histBtn.setAttribute('aria-label', 'Últimas mãos');
  const rebuyBtn = button('Completar', 'ghost', h.openRebuy);
  const leaveBtn = button('Levantar', 'ghost', h.leave);
  const pill = el('span', 'pill', '● —');
  tools.append(histBtn, rebuyBtn, leaveBtn, pill);
  top.append(back, title, tools);

  // cena e o que fica preso nela
  const stage = el('div', 'stage');
  const canvas = el('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const tags = el('div', 'tags');
  const seatAt = [0, 1, 2, 3, 4, 5];
  const seats = seatAt.map(() => seatTag());
  const empties = seatAt.map((_, v) => {
    const b = el('button', 'seat empty');
    b.type = 'button';
    b.setAttribute('aria-label', 'Sentar neste lugar');
    const av = el('span', 'av', '+');
    const nm = el('span', 'nm', 'Sentar');
    b.append(av, nm);
    b.addEventListener('click', () => h.openSit(seatAt[v]));
    return b;
  });
  const potTag = el('div', 'tag');
  potTag.setAttribute('aria-live', 'polite');
  const mineTag = el('div', 'tag');
  tags.append(...seats.map((s) => s.root), ...empties, potTag, mineTag);
  const side = el('aside', 'side');
  side.setAttribute('aria-label', 'Mãos e placar');
  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  const tabHands = button('Mãos', '', () => h.tab('hands'));
  const tabBoard = button('Placar', '', () => h.tab('board'));
  for (const b of [tabHands, tabBoard]) b.setAttribute('role', 'tab');
  tabs.append(tabHands, tabBoard);
  const sideList = el('div', 'list');
  side.append(tabs, sideList);
  const betbox = el('div', 'betbox');
  const banner = el('div', 'banner');
  banner.append(el('span', undefined, 'Você ficou ausente: as mãos seguem sem você.'), button('Voltar', '', h.back));
  stage.append(canvas, tags, side, betbox, banner);

  // painel
  const panel = el('section', 'panel');
  panel.setAttribute('aria-label', 'Controles da mesa');
  const hint = el('p', 'hint');
  hint.setAttribute('aria-live', 'polite');
  const presetValues = [0, 0, 0];
  const presets = [0, 1, 2].map((i) => button('', '', () => h.raiseTo(presetValues[i])));
  let raiseNow = 0;
  const minus = button('−', 'step', () => h.raiseTo(raiseNow - 10));
  minus.setAttribute('aria-label', 'Menos 10');
  const plus = button('+', 'step', () => h.raiseTo(raiseNow + 10));
  plus.setAttribute('aria-label', 'Mais 10');
  const val = el('b', 'val');
  const ruler = el('div', 'ruler');
  const presetRow = el('div', 'row');
  presetRow.append(...presets);
  const stepRow = el('div', 'row');
  stepRow.append(minus, val, plus);
  ruler.append(presetRow, stepRow);
  const fold = coin('fold', '✕', 'CORRER', 'Correr', '1', () => h.act('fold'));
  const call = coin('call', '✓', 'MESA', 'Mesa', '2', () => h.act(callAction));
  const raise = coin('raise', '↑', 'AUMENTAR', 'Aumentar', '3', h.openRaise);
  const allin = coin('allin', 'ALL', 'ALL-IN', 'All-in', '4', () => h.act('allin'));
  let callAction: 'check' | 'call' = 'check';
  const acts = el('div', 'acts');
  acts.append(fold.b, call.b, raise.b, allin.b);
  const raiseBack = coin('back', '←', 'VOLTAR', 'Voltar aos botões', '', h.closeRaise);
  const raiseGo = coin('raise', '↑', 'AUMENTAR', 'Aumentar', '', h.confirmRaise);
  const raiseActs = el('div', 'acts');
  raiseActs.append(raiseBack.b, raiseGo.b);
  const cta = el('div', 'cta');
  const backBtn = button('Voltar pra mesa', 'btn main', h.back);
  const standBtn = button('Levantar', 'btn', h.leave);
  const showBtn = button('Mostrar cartas', 'btn', h.show);
  const rebuyCta = button('Completar', 'btn main', h.openRebuy);
  cta.append(backBtn, standBtn, showBtn, rebuyCta);
  panel.append(hint, ruler, acts, raiseActs, cta);

  // folha (sentar, completar, histórico)
  const sheetWrap = el('div', 'sheetwrap');
  const dim = el('button', 'dim');
  dim.type = 'button';
  dim.setAttribute('aria-label', 'Fechar');
  dim.addEventListener('click', h.closeSheet);
  const sheet = el('section', 'sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  const sheetTitle = el('h2');
  const sheetText = el('p');
  const amt = el('div', 'amt');
  const range = el('input');
  range.type = 'range';
  range.step = '5';
  range.setAttribute('aria-label', 'Quanto levar para a mesa');
  range.addEventListener('input', () => h.sheetAmount(Number(range.value)));
  const ends = el('div', 'ends');
  const endMin = el('span');
  const endMid = el('span');
  const endMax = el('span');
  ends.append(endMin, endMid, endMax);
  const form = el('div');
  const confirm = button('', 'btn main', h.confirmSheet);
  form.append(amt, range, ends, confirm);
  const sheetList = el('div', 'list');
  const cancel = button('Agora não', 'btn', h.closeSheet);
  sheet.append(sheetTitle, sheetText, form, sheetList, cancel);
  sheetWrap.append(dim, sheet);

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

  app.append(top, stage, panel, sheetWrap, notice, overlay);
  root.append(app);

  let sideKey = '';
  let sheetKey = '';

  function place(n: HTMLElement, p: { x: number; y: number } | undefined) {
    if (!p) return;
    n.style.left = `${p.x}px`;
    n.style.top = `${p.y}px`;
  }

  function historyRow(r: PokerHistoryRow, name: (id: string) => string): HTMLElement {
    const row = el('div', 'row');
    const head = el('div');
    const pays = Object.entries(r.results.payouts).filter(([, v]) => v > 0);
    pays.forEach(([seat, v], i) => {
      if (i) head.append(document.createTextNode(' · '));
      head.append(el('b', undefined, name(r.players[seat])), document.createTextNode(` levou ${fmt(v)}`));
    });
    const m = el('div', 'm');
    const named = r.results.pots.find((p) => p.name)?.name ?? '';
    m.append(document.createTextNode(r.results.showdown ? named : 'Todos correram'));
    if (r.board.length) {
      m.append(document.createTextNode(' · '));
      r.board.forEach((c) => m.append(miniCard(c)));
    }
    row.append(head, m);
    return row;
  }

  function fillList(list: HTMLElement, rows: HTMLElement[], empty: string) {
    list.replaceChildren(...(rows.length ? rows : [el('p', 'empty', empty)]));
  }

  function render(ui: PokerUi, t: Anchors | null, x: Extras) {
    overlay.hidden = ui.phase !== 'no_session';
    overlayText.textContent = 'Entra no fellas pra jogar';
    const noticeMsg = ui.notice ?? (ui.online ? null : 'Reconectando…');
    notice.hidden = !noticeMsg;
    noticeText.textContent = noticeMsg ?? '';
    retryBtn.hidden = ui.online;
    pill.textContent = ui.wallet ? `● ${fmt(ui.wallet.balance)}` : '● —';
    pill.setAttribute('aria-label', ui.wallet ? `Sua carteira: ${fmt(ui.wallet.balance)}` : 'Carteira');
    const s = ui.table;
    if (!s) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    const o = t?.orientation() ?? 'portrait';
    app.dataset.orient = o;
    const me = x.me;
    const name = (id: string) => (id === me ? 'Você' : (x.fella(id)?.name ?? 'Alguém'));
    const mine = seatOf(s, me);
    const mySeat = mine?.seat ?? null;
    const h0 = s.hand && s.hand.status !== 'void' ? s.hand : null;
    const betting = h0?.status === 'betting';
    const live = playerOf(h0, me);
    const inOpenHand = !!(betting && live && !live.p.folded);
    const full = s.seats.length >= 6;
    const away = mine?.status === 'away';

    title.textContent = `Poker · cegas ${s.blinds[0]}/${s.blinds[1]}`;
    leaveBtn.hidden = !mine;
    rebuyBtn.hidden = !mine || inOpenHand || mine.stack >= s.buyin[1];

    // lugares
    for (let v = 0; v < 6; v++) {
      const seatNo = o === 'landscape' || mySeat === null ? v : (v + mySeat) % 6;
      seatAt[v] = seatNo;
      const occ = s.seats.find((z) => z.seat === seatNo);
      const tag = seats[v];
      const pos = t?.seatAnchor(v);
      place(tag.root, pos);
      place(empties[v], pos);
      tag.root.hidden = !occ;
      empties[v].hidden = !!occ || !!mine || full || s.closed;
      if (!occ) continue;
      const nm = name(occ.user_id);
      tag.name.textContent = nm;
      tag.stack.textContent = fmt(occ.stack);
      const url = x.fella(occ.user_id)?.avatarUrl ?? null;
      tag.img.hidden = !url;
      if (url && tag.img.getAttribute('src') !== url) tag.img.src = url;
      tag.ini.hidden = !!url;
      tag.ini.textContent = initials(nm);
      tag.av.className = `av c${seatNo}`;
      const p = h0?.players[String(seatNo)];
      const inHand = !!p && p.user_id === occ.user_id;
      const turn = betting && inHand && h0!.to_act === seatNo;
      tag.root.classList.toggle('turn', turn);
      tag.root.classList.toggle('out', occ.status === 'away' || (inHand && p!.folded));
      tag.root.classList.toggle('win', h0?.status === 'done' && inHand && (h0.results?.payouts[String(seatNo)] ?? 0) > 0);
      tag.ring.hidden = !turn;
      if (turn) tag.ring.style.setProperty('--k', String(Math.min(1, (secondsLeft(h0!.deadline, ui.offsetMs, x.now) ?? 0) / 30)));
      const handName = h0?.status === 'done' && inHand ? h0.results?.hands[String(seatNo)] : undefined;
      tag.status.textContent =
        occ.status === 'away'
          ? 'Ausente'
          : occ.leaving
            ? 'Saindo'
            : occ.busted
              ? 'Sem fichas'
              : (handName ?? (inHand ? (lastLabel(p!) ?? '') : occ.wait_bb ? 'Esperando a cega' : ''));
      tag.root.setAttribute(
        'aria-label',
        `${nm}, ${fmt(occ.stack)} fichas${tag.status.textContent ? `, ${tag.status.textContent}` : ''}${turn ? ', na vez' : ''}`,
      );
    }

    // pote ou resultado, e o nome da minha mão
    const result = h0 ? resultLine(h0, me, name) : null;
    potTag.hidden = !h0 || (!result && h0.pot <= 0);
    potTag.textContent = result ?? (h0 ? `Pote ${fmt(h0.pot)}` : '');
    potTag.className = result ? 'tag gold' : 'tag';
    place(potTag, t?.potAnchor());
    const myCards = live && h0 && ui.cards?.hand_id === h0.id ? ui.cards.cards : null;
    const myHand = myCards
      ? ((h0!.status === 'done' ? h0!.results?.hands[String(live!.seat)] : undefined) ?? rankName(rank([...myCards, ...h0!.board])))
      : null;
    mineTag.hidden = !myHand;
    mineTag.textContent = myHand ?? '';
    place(mineTag, t?.mineAnchor());

    // deitado: eu na mesa e o painel da direita
    betbox.hidden = !mine;
    betbox.replaceChildren(document.createTextNode('Você na mesa'), el('b', undefined, fmt(mine?.stack ?? 0)));
    banner.hidden = !away;
    tabHands.setAttribute('aria-selected', String(x.tab === 'hands'));
    tabBoard.setAttribute('aria-selected', String(x.tab === 'board'));
    const key = JSON.stringify([x.tab, x.history.map((r) => r.id), x.board, me]);
    if (key !== sideKey) {
      sideKey = key;
      if (x.tab === 'hands') fillList(sideList, x.history.slice(0, 8).map((r) => historyRow(r, name)), 'Nenhuma mão ainda.');
      else
        fillList(
          sideList,
          x.board.map((r) => {
            const row = el('div', r.userId === me ? 'row me' : 'row');
            row.append(el('span', 'n', r.userId === me ? 'Você' : r.name), el('b', undefined, fmt(r.balance)));
            return row;
          }),
          'Ninguém jogou essa semana ainda.',
        );
    }

    // linha de estado
    const of = offer(s, me);
    const myTurn = !!of && ui.online && !ui.busy;
    const raising = ui.raise !== null && !!of;
    let hintText: string | null;
    if (!mine) {
      hintText =
        s.closed && !betting
          ? 'A mesa fecha pro reset. Volta 00:00.'
          : full
            ? 'Mesa cheia (6/6). Fica de olho que já libera.'
            : 'Toca num lugar vazio pra sentar';
    } else if (away) {
      hintText = 'Ao voltar, você entra quando a cega grande chegar em você.';
    } else {
      hintText = statusLine(s, me, name, ui.offsetMs, x.now);
    }
    hint.textContent = hintText ?? '';
    hint.hidden = !hintText;

    // moedas
    acts.hidden = !mine || away || raising;
    for (const c of [fold, call, raise, allin]) c.b.disabled = !myTurn;
    if (of) {
      callAction = of.canCheck ? 'check' : 'call';
      call.face.textContent = of.canCheck ? '✓' : fmt(of.toCall);
      call.label.textContent = of.canCheck ? 'MESA' : of.callAllIn ? 'ALL-IN' : 'PAGAR';
      call.b.setAttribute('aria-label', of.canCheck ? 'Mesa' : `Pagar ${of.toCall}`);
      raise.b.disabled = !myTurn || !of.canRaise;
    } else {
      call.face.textContent = '✓';
      call.label.textContent = 'MESA';
      call.b.setAttribute('aria-label', 'Mesa');
    }

    // régua
    ruler.hidden = !raising;
    raiseActs.hidden = !raising;
    if (raising && of) {
      raiseNow = ui.raise!;
      const labels = [`Mín ${fmt(of.minTo)}`, `½ pote ${fmt(of.halfPotTo)}`, `Pote ${fmt(of.potTo)}`];
      [of.minTo, of.halfPotTo, of.potTo].forEach((value, i) => {
        presetValues[i] = value;
        presets[i].textContent = labels[i];
        presets[i].setAttribute('aria-label', labels[i]);
        presets[i].classList.toggle('on', value === raiseNow);
      });
      val.textContent = fmt(raiseNow);
      minus.disabled = raiseNow <= of.minTo;
      plus.disabled = raiseNow >= of.maxTo;
      const all = raiseNow >= of.maxTo;
      raiseGo.label.textContent = all ? 'ALL-IN' : `AUMENTAR P/ ${fmt(raiseNow)}`;
      raiseGo.b.setAttribute('aria-label', all ? 'All-in' : `Aumentar para ${raiseNow}`);
      raiseGo.b.disabled = ui.busy;
    }

    // chamadas
    backBtn.hidden = !away;
    standBtn.hidden = !away;
    standBtn.textContent = `Levantar (${fmt(mine?.stack ?? 0)} voltam pra carteira)`;
    showBtn.hidden = !(h0 && h0.status === 'done' && live && myCards && !(String(live.seat) in h0.shown));
    rebuyCta.hidden = !mine?.busted;
    cta.hidden = [backBtn, standBtn, showBtn, rebuyCta].every((b) => b.hidden);
    for (const b of [backBtn, standBtn, showBtn, rebuyCta]) b.disabled = ui.busy;

    // folha
    sheetWrap.hidden = !ui.sheet;
    if (ui.sheet?.kind === 'history') {
      sheetTitle.textContent = 'Últimas mãos';
      sheetText.hidden = true;
      form.hidden = true;
      sheetList.hidden = false;
      cancel.textContent = 'Fechar';
      const k = JSON.stringify(x.history.map((r) => r.id));
      if (k !== sheetKey) {
        sheetKey = k;
        fillList(sheetList, x.history.map((r) => historyRow(r, name)), 'Nenhuma mão ainda.');
      }
    } else if (ui.sheet) {
      sheetKey = '';
      sheetText.hidden = false;
      form.hidden = false;
      sheetList.hidden = true;
      cancel.textContent = 'Agora não';
      const w = ui.wallet?.balance ?? 0;
      const sit = ui.sheet.kind === 'sit';
      const r = sit ? buyinRange(s, w) : rebuyRange(mine?.stack ?? 0, s.buyin[1], w);
      const amount = r.ok ? Math.min(Math.max(ui.sheet.amount, r.min), r.max) : r.min;
      sheetTitle.textContent = sit ? 'Sentar na mesa' : 'Completar fichas';
      sheetText.textContent = !r.ok
        ? sit
          ? `Você precisa de pelo menos ${fmt(r.min)} na carteira.${ui.wallet?.can_fiado ? ' Dá pra pegar fiado na aba Games.' : ''}`
          : 'Sua carteira não cobre nem 10.'
        : sit && s.me?.rathole_min
          ? `Você levantou há pouco: volta com pelo menos ${fmt(r.min)}.`
          : sit
            ? 'Sai da carteira e vira fichas. Ao levantar, volta tudo.'
            : `Sai da carteira e entra na mesa (até ${fmt(s.buyin[1])}).`;
      range.min = String(r.min);
      range.max = String(Math.max(r.max, r.min));
      range.value = String(amount);
      range.disabled = !r.ok || r.min >= r.max;
      amt.textContent = fmt(amount);
      endMin.textContent = fmt(r.min);
      endMid.textContent = `Carteira ${fmt(w)}`;
      endMax.textContent = fmt(Math.max(r.max, r.min));
      confirm.textContent = `${sit ? 'Sentar' : 'Completar'} com ${fmt(amount)}`;
      confirm.disabled = !r.ok || ui.busy;
    }
  }

  function fatal(text: string) {
    overlayText.textContent = text;
    enter.hidden = true;
    overlay.hidden = false;
    panel.hidden = true;
  }

  overlay.hidden = true;
  notice.hidden = true;
  sheetWrap.hidden = true;
  return { canvas, render, fatal };
}
