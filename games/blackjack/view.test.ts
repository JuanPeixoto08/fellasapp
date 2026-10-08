// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { RoundState, Wallet } from '../shared/types';
import { initial, type MachineState } from './machine';
import { createView, type ViewHandlers } from './view';

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
  hands: [{ cards: [8, 46], bet: 100, doubled: false, from_split_aces: false, done: false, result: null }],
  active: 0,
  dealer: [12],
  dealer_total: 10,
  payout: 0,
  balance: 900,
  can_fiado: false,
  ...extra,
});
const state = (extra: Partial<MachineState>): MachineState => ({ ...initial, wallet: wallet(), weekStart: '2026-10-05', ...extra });
const table = { anchor: () => ({ x: 10, y: 20 }), orientation: () => 'portrait' as const };

let h: { [K in keyof ViewHandlers]: Mock<ViewHandlers[K]> };
let root: HTMLElement;
const button = (name: string) =>
  [...root.querySelectorAll('button, a')].find(
    (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
  ) as HTMLButtonElement | undefined;
const visible = (el: Element | undefined | null) => !!el && !(el as HTMLElement).closest('[hidden]');

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  h = {
    chip: vi.fn<ViewHandlers['chip']>(),
    clear: vi.fn<ViewHandlers['clear']>(),
    deal: vi.fn<ViewHandlers['deal']>(),
    act: vi.fn<ViewHandlers['act']>(),
    again: vi.fn<ViewHandlers['again']>(),
    fiado: vi.fn<ViewHandlers['fiado']>(),
    retry: vi.fn<ViewHandlers['retry']>(),
  };
});

describe('apostando', () => {
  it('quatro fichas, Limpar e Dar as cartas (só com aposta)', () => {
    const v = createView(root, h);
    v.render(state({ phase: 'betting', bet: 0 }), table);
    expect(root.querySelectorAll('.chips button')).toHaveLength(4);
    expect(visible(button('Limpar'))).toBe(true);
    expect(button('Dar as cartas')!.disabled).toBe(true);
    v.render(state({ phase: 'betting', bet: 150 }), table);
    expect(button('Dar as cartas')!.disabled).toBe(false);
    expect(root.querySelector('.betrow b')!.textContent).toBe('150');
  });

  it('ficha que passa do saldo ou do máximo fica apagada; tocar soma', () => {
    const v = createView(root, h);
    v.render(state({ phase: 'betting', bet: 450, wallet: wallet({ balance: 1000 }) }), table);
    expect(button('Ficha de 500')!.getAttribute('aria-disabled')).toBe('true');
    expect(button('Ficha de 50')!.getAttribute('aria-disabled')).toBe('false');
    button('Ficha de 50')!.click();
    expect(h.chip).toHaveBeenCalledWith(50);
  });

  it('sem dar pra apostar: fiado (ou o aviso de que já pegou hoje)', () => {
    const v = createView(root, h);
    v.render(state({ phase: 'betting', wallet: wallet({ balance: 5, can_fiado: true }) }), table);
    expect(visible(root.querySelector('.chips'))).toBe(false);
    button('Pegar fiado (+100)')!.click();
    expect(h.fiado).toHaveBeenCalled();
    v.render(state({ phase: 'betting', wallet: wallet({ balance: 0, can_fiado: false }) }), table);
    expect(root.textContent).toContain('Fiado de hoje já foi. Volta amanhã.');
  });
});

describe('jogando', () => {
  it('Pedir e Parar sempre; Dobrar e Dividir só quando valem', () => {
    const v = createView(root, h);
    v.render(state({ phase: 'playing', round: round() }), table);
    expect(button('Pedir carta')!.disabled).toBe(false);
    expect(button('Parar')!.disabled).toBe(false);
    expect(button('Dobrar a aposta')!.disabled).toBe(false);
    expect(button('Dividir o par')!.disabled).toBe(true);
    const pair = round({ hands: [{ cards: [9, 51], bet: 100, doubled: false, from_split_aces: false, done: false, result: null }] });
    v.render(state({ phase: 'playing', round: pair }), table);
    expect(button('Dividir o par')!.disabled).toBe(false);
    button('Pedir carta')!.click();
    expect(h.act).toHaveBeenCalledWith('hit');
  });

  it('pedido em voo: tudo travado', () => {
    const v = createView(root, h);
    v.render(state({ phase: 'busy', back: 'playing', round: round() }), table);
    for (const name of ['Pedir carta', 'Parar', 'Dobrar a aposta', 'Dividir o par']) expect(button(name)!.disabled).toBe(true);
  });

  it('plaquinhas: banca com a carta escondida e o meu total', () => {
    const v = createView(root, h);
    v.render(state({ phase: 'playing', round: round() }), table);
    const tags = [...root.querySelectorAll('.tag')].map((t) => t.textContent?.replace(/\s+/g, ' ').trim());
    expect(tags).toContain('Banca 10 + ?');
    expect(tags).toContain('Você 17');
  });
});

describe('fim da mão', () => {
  it('resultado dourado quando ganha, anunciado, e "Bora de novo"', () => {
    const v = createView(root, h);
    const won = round({
      status: 'done',
      payout: 200,
      balance: 1100,
      dealer: [12, 32],
      dealer_total: 17,
      hands: [{ cards: [8, 46], bet: 100, doubled: false, from_split_aces: false, done: true, result: 'win' }],
    });
    v.render(state({ phase: 'done', round: won, lastBet: 100 }), table);
    const mine = [...root.querySelectorAll('.tag')].find((t) => t.textContent?.includes('Ganhou +100'))!;
    expect(mine.classList.contains('gold')).toBe(true);
    expect(root.querySelector('.tags')!.getAttribute('aria-live')).toBe('polite');
    button('Bora de novo')!.click();
    expect(h.again).toHaveBeenCalled();
  });
});

describe('avisos', () => {
  it('sem sessão: entrar pelo app', () => {
    const v = createView(root, h);
    v.render(state({ phase: 'no_session' }), table);
    const link = button('Entrar') as unknown as HTMLAnchorElement;
    expect(visible(link)).toBe(true);
    expect(link.getAttribute('href')).toBe('/');
    expect(root.textContent).toContain('Entra no fellas pra jogar');
  });

  it('sem rede: aviso com Tentar de novo', () => {
    const v = createView(root, h);
    v.render(state({ phase: 'playing', round: round(), notice: 'Sem conexão. Sua mão tá salva.' }), table);
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Sem conexão');
    button('Tentar de novo')!.click();
    expect(h.retry).toHaveBeenCalled();
  });

  it('saldo no topo', () => {
    const v = createView(root, h);
    v.render(state({ phase: 'betting', wallet: wallet({ balance: 1240 }) }), table);
    expect(root.querySelector('.pill')!.textContent).toContain('1.240');
  });
});
