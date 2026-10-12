// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { criarDicas } from './dicaTela';

const DICA = { titulo: 'Food truck', linhas: [{ texto: 'Cada um rende +F$ 10/s' }, { texto: 'Os 3 rendem +F$ 30/s', tom: 'bom' as const }] };
let app: HTMLElement;
let alvo: HTMLButtonElement;
let dicas: ReturnType<typeof criarDicas>;
const ponteiro = (tipo: string, el: Element, pointerType: string, x = 0, y = 0) =>
  el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, pointerType, clientX: x, clientY: y }));
const caixa = () => app.querySelector<HTMLElement>('.dica')!;
const aberta = () => !caixa().hasAttribute('hidden');

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div class="app"></div>';
  app = document.querySelector('.app')!;
  alvo = document.createElement('button');
  app.append(alvo);
  dicas = criarDicas(app);
  dicas.ligar(alvo, 'g11', () => DICA);
});
afterEach(() => vi.useRealTimers());

describe('caixinha de informação', () => {
  it('mouse: aparece ao passar por cima (título e linhas) e some ao sair', () => {
    ponteiro('pointerenter', alvo, 'mouse');
    vi.advanceTimersByTime(200);
    expect(aberta()).toBe(true);
    expect(caixa().getAttribute('role')).toBe('tooltip');
    expect(caixa().querySelector('strong')!.textContent).toBe('Food truck');
    expect([...caixa().querySelectorAll('li')].map((l) => l.textContent)).toEqual(['Cada um rende +F$ 10/s', 'Os 3 rendem +F$ 30/s']);
    expect(caixa().querySelector('li.bom')).not.toBeNull();
    expect(alvo.getAttribute('aria-describedby')).toBe(caixa().id);
    ponteiro('pointerleave', alvo, 'mouse');
    expect(aberta()).toBe(false);
    expect(alvo.hasAttribute('aria-describedby')).toBe(false);
  });
  it('dedo: tocar rápido não abre (e o toque vale); segurar abre e engole o toque', () => {
    const clique = vi.fn();
    alvo.addEventListener('click', clique);
    ponteiro('pointerdown', alvo, 'touch');
    vi.advanceTimersByTime(100);
    ponteiro('pointerup', alvo, 'touch');
    alvo.click();
    expect(aberta()).toBe(false);
    expect(clique).toHaveBeenCalledTimes(1);

    ponteiro('pointerdown', alvo, 'touch');
    vi.advanceTimersByTime(500);
    expect(aberta()).toBe(true);
    ponteiro('pointerup', alvo, 'touch');
    alvo.click();
    expect(clique).toHaveBeenCalledTimes(1); // o toque de segurar não compra
    expect(aberta()).toBe(true); // fica aberta pra ler
    ponteiro('pointerdown', document.body, 'touch'); // tocar em outro lugar fecha
    expect(aberta()).toBe(false);
  });
  it('dedo arrastando (rolando a lista) não abre', () => {
    ponteiro('pointerdown', alvo, 'touch', 10, 10);
    ponteiro('pointermove', alvo, 'touch', 10, 40);
    vi.advanceTimersByTime(600);
    expect(aberta()).toBe(false);
  });
  it('a tela refez a linha: a caixinha aberta passa pra linha nova com o conteúdo novo; sem ela, fecha', () => {
    ponteiro('pointerenter', alvo, 'mouse');
    vi.advanceTimersByTime(200);
    alvo.remove();
    const nova = document.createElement('button');
    app.append(nova);
    dicas.ligar(nova, 'g11', () => ({ titulo: 'Food truck', linhas: [{ texto: 'Os 4 rendem +F$ 40/s' }] }));
    dicas.conferir();
    expect(aberta()).toBe(true);
    expect(caixa().textContent).toContain('Os 4 rendem');
    nova.remove();
    dicas.conferir();
    expect(aberta()).toBe(false);
  });
  it('teclado: foco visível no item mostra; sair do foco esconde; Esc fecha', () => {
    alvo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(aberta()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(aberta()).toBe(false);
    alvo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    alvo.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(aberta()).toBe(false);
  });
});
