// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { criarDouradoTela } from './douradoTela';

let raiz: HTMLElement;
const pegar = vi.fn();
let d: ReturnType<typeof criarDouradoTela>;
beforeEach(() => {
  document.body.innerHTML = '';
  raiz = document.createElement('div');
  document.body.append(raiz);
  pegar.mockClear();
  d = criarDouradoTela(raiz, pegar);
});
afterEach(() => vi.useRealTimers());

const T = 1_760_000_000_000;
const ev = (x: Partial<Parameters<typeof d.mostrar>[0]> = {}) => ({ seg: T / 1000, lado: 0, tipo: 0 as const, x: 0.3, y: 0.4, agoraMs: T, ...x });

describe('eventos na tela', () => {
  it('aparece no ponto sorteado, com o nome pra leitor de tela e o anel dos 12 s', () => {
    d.mostrar(ev());
    const b = raiz.querySelector<HTMLButtonElement>('.dourado')!;
    expect(b.getAttribute('aria-label')).toBe('Pegar: Investidor apressado');
    expect(b.style.left).toBe('30%');
    expect(b.style.top).toBe('40%');
    expect(b.querySelector('svg.icone-dourado')).not.toBeNull();
    expect(b.querySelector('.anel')).not.toBeNull();
  });
  it('visto atrasado (a página voltou pra aba): o anel já começa gasto', () => {
    d.mostrar(ev({ agoraMs: T + 3000 }));
    expect(raiz.querySelector<HTMLElement>('.dourado')!.style.getPropertyValue('--ja')).toBe('-3s');
  });
  it('o mesmo evento não aparece duas vezes; a dupla são dois botões', () => {
    d.mostrar(ev());
    d.mostrar(ev());
    expect(raiz.querySelectorAll('.dourado')).toHaveLength(1);
    d.mostrar(ev({ seg: T / 1000 + 5, tipo: 2 }));
    d.mostrar(ev({ seg: T / 1000 + 5, tipo: 2, lado: 1, x: 0.44 }));
    expect(raiz.querySelectorAll('.dourado')).toHaveLength(3);
    expect([...raiz.querySelectorAll('.dourado')].at(-1)!.getAttribute('aria-label')).toBe('Pegar: Viralizou');
  });
  it('clicar chama o pegar uma vez e o ícone sai', () => {
    d.mostrar(ev());
    const b = raiz.querySelector<HTMLButtonElement>('.dourado')!;
    b.click();
    b.click();
    expect(pegar.mock.calls).toEqual([[T / 1000, 0]]);
    expect(raiz.querySelector('.dourado')).toBeNull();
  });
  it('passou dos 12 s: some sozinho (e não volta)', () => {
    d.mostrar(ev());
    d.tick(T + 11_900);
    expect(raiz.querySelector('.dourado')).not.toBeNull();
    d.tick(T + 12_100);
    expect(raiz.querySelector('.dourado')).toBeNull();
    d.mostrar(ev({ agoraMs: T + 12_100 }));
    expect(raiz.querySelector('.dourado')).toBeNull();
  });
  it('o texto que sobe some depois de um tempo', () => {
    vi.useFakeTimers();
    d.subirTexto('+F$ 10', 0.5, 0.5);
    expect(raiz.querySelector('.dourado-texto')!.textContent).toBe('+F$ 10');
    vi.advanceTimersByTime(2000);
    expect(raiz.querySelector('.dourado-texto')).toBeNull();
  });
});
