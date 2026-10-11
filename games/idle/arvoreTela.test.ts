// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import { criarArvoreTela, miniArvore } from './arvoreTela';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
  ...x,
});

let comprar: ReturnType<typeof vi.fn<(id: number) => void>>;
let volta: HTMLButtonElement;
beforeEach(() => {
  document.body.innerHTML = '<button id="volta">Abrir</button>';
  volta = document.getElementById('volta') as HTMLButtonElement;
  comprar = vi.fn<(id: number) => void>();
});
const abrir = (s: IdleState, ocupado = false) => {
  const t = criarArvoreTela(comprar);
  document.body.append(t.elemento);
  t.abrir(s, ocupado, () => volta);
  return t;
};
const no = (id: number) => document.querySelector<HTMLButtonElement>(`.no-arvore[data-no="${id}"]`)!;
const cartao = () => document.querySelector('.arvore-cartao')!;

describe('árvore em tela cheia', () => {
  it('fechada até abrir; abre com os 26 nós, as situações nas classes e os pontos no topo', () => {
    const t = criarArvoreTela(comprar);
    document.body.append(t.elemento);
    expect(t.aberta()).toBe(false);
    expect(t.elemento.hasAttribute('hidden')).toBe(true);
    t.abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }), false, () => volta);
    expect(t.aberta()).toBe(true);
    expect(document.querySelectorAll('.no-arvore')).toHaveLength(26);
    expect(no(11).classList.contains('comprado')).toBe(true);
    expect(no(21).classList.contains('pode')).toBe(true);
    expect(no(12).classList.contains('falta')).toBe(true);
    expect(no(13).classList.contains('trancado')).toBe(true);
    expect(no(12).getAttribute('aria-label')).toBe('Ô loco, bicho!, falta 1 ★');
    expect(no(12).querySelector('.no-custo')!.textContent).toBe('4 ★');
    expect(no(11).querySelector('.no-custo')).toBeNull();
    expect(document.querySelectorAll('.ligacao')).toHaveLength(25);
    expect(document.querySelectorAll('.ligacao.comprado')).toHaveLength(1); // 1 → 11
    expect(document.querySelector('.arvore-pontos')!.textContent).toBe('★ 3');
    expect([...document.querySelectorAll('.arvore-ramo')].map((r) => r.textContent)).toEqual(['Produção', 'Recomeço', 'Oportunidades', 'Tempo', 'Gente']);
  });
  it('abre com o nó mais barato que dá pra comprar escolhido; Comprar chama comprar(id)', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    expect(no(21).getAttribute('aria-pressed')).toBe('true');
    expect(cartao().textContent).toContain('Porquinho quebrado');
    expect(cartao().textContent).toContain('Recomeço · 1 de 5');
    expect(cartao().textContent).toContain('O Abrir CNPJ começa com F$ 1 mil.');
    const b = cartao().querySelector('button')!;
    expect(b.textContent).toBe('Comprar · 2 ★');
    b.click();
    expect(comprar).toHaveBeenCalledWith(21);
  });
  it('tocar noutro nó troca o cartão: falta ponto, trancado, comprado', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    no(12).click();
    expect(no(12).getAttribute('aria-pressed')).toBe('true');
    expect(no(21).getAttribute('aria-pressed')).toBe('false');
    const b = cartao().querySelector('button')!;
    expect(b.textContent).toBe('Falta 1 ★');
    expect(b.disabled).toBe(true);
    no(13).click();
    expect(cartao().querySelector('button')).toBeNull();
    expect(cartao().textContent).toContain('Libera com Ô loco, bicho!');
    no(11).click();
    expect(cartao().querySelector('button')).toBeNull();
    expect(cartao().textContent).toContain('Comprado');
  });
  it('ocupado: Comprar apagado', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }), true);
    expect(cartao().querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
  });
  it('renderizar de novo (comprou) mantém o escolhido e acende o nó', () => {
    const t = abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    expect(no(11).getAttribute('aria-pressed')).toBe('true');
    t.renderizar(estado({ pontos: 1, bonus: { arvore: [1, 11], conquistas: 0 } }), false);
    expect(no(11).getAttribute('aria-pressed')).toBe('true');
    expect(no(11).classList.contains('comprado')).toBe(true);
    expect(cartao().textContent).toContain('Comprado');
    expect(document.querySelector('.arvore-pontos')!.textContent).toBe('★ 1');
  });
  it('foco no ✕ ao abrir; Esc e ✕ fecham e devolvem o foco', () => {
    const t = abrir(estado());
    expect(document.activeElement).toBe(document.querySelector('.arvore-topo .fechar'));
    t.elemento.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(t.aberta()).toBe(false);
    expect(document.activeElement).toBe(volta);
    t.abrir(estado(), false, () => volta);
    document.querySelector<HTMLButtonElement>('.arvore-topo .fechar')!.click();
    expect(t.aberta()).toBe(false);
    expect(document.activeElement).toBe(volta);
  });
  it('Esc fecha mesmo com o foco fora da árvore (o botão comprado sumiu, clicou no céu)', () => {
    const t = abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(t.aberta()).toBe(false);
    expect(document.activeElement).toBe(volta);
    // fechada, o Esc da página não é da árvore
    const ouvido = vi.fn();
    t.elemento.addEventListener('keydown', ouvido);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(t.aberta()).toBe(false);
  });
  it('arrastar e soltar em cima de um nó não escolhe o nó', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    const alvo = no(41);
    palco.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 120, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { clientX: 140, clientY: 120, bubbles: true }));
    alvo.click();
    expect(no(41).getAttribute('aria-pressed')).toBe('false');
    // um toque de verdade depois do arraste escolhe
    palco.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { clientX: 11, clientY: 10, bubbles: true }));
    no(41).click();
    expect(no(41).getAttribute('aria-pressed')).toBe('true');
  });
  it('com a página ampliada (zoom do PC), o mundo anda junto com o mouse, não mais rápido', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    for (const k of ['clientWidth', 'clientHeight', 'offsetWidth']) Object.defineProperty(palco, k, { configurable: true, value: 200 });
    palco.getBoundingClientRect = () => ({ width: 400, height: 400 }) as DOMRect; // zoom 2: 200 de layout viram 400 na tela
    palco.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 120, bubbles: true }));
    expect(document.querySelector<HTMLElement>('.arvore-mundo')!.style.transform).toBe('translate(20px, 10px)');
  });
  it('ícone sem a arte: só a moldura', () => {
    const sem = vi.spyOn(ativos, 'no').mockReturnValue(null);
    try {
      abrir(estado());
      expect(no(1).querySelector('.icone-legado')!.classList.contains('sem-arte')).toBe(true);
    } finally {
      sem.mockRestore();
    }
  });
  it('legenda com as 4 situações', () => {
    abrir(estado());
    expect([...document.querySelectorAll('.arvore-legenda li')].map((x) => x.textContent))
      .toEqual(['Comprado', 'Dá pra comprar', 'Falta ponto', 'Trancado']);
  });
  it('miniatura: 26 quadradinhos e 25 linhas, decorativa', () => {
    const svg = miniArvore(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('rect.mini-no')).toHaveLength(26);
    expect(svg.querySelectorAll('line.ligacao')).toHaveLength(25);
    expect(svg.querySelectorAll('rect.mini-no.comprado')).toHaveLength(2);
  });
});
