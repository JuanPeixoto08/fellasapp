// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import { copaBarras, criarArvoreTela, type LigarDica } from './arvoreTela';
import { MUNDO_ARVORE, POSICOES_ARVORE, ZOOM_ABRIR, ZOOM_MIN } from './legado';

const L = MUNDO_ARVORE.largura;
const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(41).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10, promo_ate: null, viral: [],
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
  ...x,
});

let comprar: ReturnType<typeof vi.fn<(id: number) => void>>;
let ligar: ReturnType<typeof vi.fn<LigarDica>>;
let volta: HTMLButtonElement;
beforeEach(() => {
  document.body.innerHTML = '<button id="volta">Abrir</button>';
  volta = document.getElementById('volta') as HTMLButtonElement;
  comprar = vi.fn<(id: number) => void>();
  ligar = vi.fn<LigarDica>();
});
const abrir = (s: IdleState, ocupado = false, no?: number) => {
  const t = criarArvoreTela(comprar, ligar);
  document.body.append(t.elemento);
  t.abrir(s, ocupado, () => volta, no);
  return t;
};
const no = (id: number) => document.querySelector<HTMLButtonElement>(`.no-arvore[data-no="${id}"]`)!;
const cartao = () => document.querySelector('.arvore-cartao')!;
const mundo = () => document.querySelector<HTMLElement>('.arvore-mundo')!;
const largura = () => parseFloat(mundo().style.width);
const translate = () => {
  const m = /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\)/.exec(mundo().style.transform)!;
  return { x: Number(m[1]), y: Number(m[2]) };
};
/** O deslocamento que põe o nó no meio do palco, no zoom k. */
const noMeio = (id: number, k: number) => ({ x: (L / 2 - POSICOES_ARVORE[id][0]) * k, y: (L / 2 - POSICOES_ARVORE[id][1]) * k });
/** Espera o próximo quadro (a pinça e a rodinha redesenham uma vez por quadro). */
const quadro = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const palcoEl = () => document.querySelector<HTMLElement>('.arvore-palco')!;
const rodinha = (deltaY: number, deltaX = 0) =>
  palcoEl().dispatchEvent(new WheelEvent('wheel', { deltaY, deltaX, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));

describe('árvore grande em tela cheia (a constelação)', () => {
  it('fechada até abrir; abre com os 120 nós, situação e forma nas classes, o anel da era 7 e os pontos no topo', () => {
    const t = criarArvoreTela(comprar, ligar);
    document.body.append(t.elemento);
    expect(t.aberta()).toBe(false);
    t.abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }), false, () => volta);
    expect(t.aberta()).toBe(true);
    expect(document.querySelectorAll('.no-arvore')).toHaveLength(120);
    expect(no(11).classList.contains('comprado')).toBe(true);
    expect(no(21).classList.contains('pode')).toBe(true);
    expect(no(12).classList.contains('falta')).toBe(true);
    expect(no(13).classList.contains('trancado')).toBe(true);
    expect(no(701).classList.contains('portao')).toBe(true);
    expect(no(701).querySelector('.no-cadeado')).not.toBeNull();
    expect(no(110).classList.contains('grande')).toBe(true);
    expect(no(3001).classList.contains('infinito')).toBe(true);
    expect(no(2005).classList.contains('ponte')).toBe(true);
    expect(no(12).querySelector('.no-custo')!.textContent).toBe('4 ★');
    expect(no(11).querySelector('.no-custo')).toBeNull();
    expect(document.querySelectorAll('.ligacao')).toHaveLength(128); // 119 do nó pro anterior + a 2ª linha das 9 pontes
    expect(document.querySelectorAll('.ligacao.acesa')).toHaveLength(1); // 1 → 11: o caminho comprado
    expect(document.querySelectorAll('.arvore-anel')).toHaveLength(1);
    expect(document.querySelector('.arvore-anel-rotulo')!.textContent).toBe('Era 7');
    expect([...document.querySelectorAll('.arvore-ramo')].map((r) => r.textContent))
      .toEqual(['Horta', 'Mapa do rolê', 'Gente', 'PPP Podcast', 'Recomeço', 'Produção', 'Espaço', 'Oportunidades', 'Bolsa', 'Dourados']);
    expect(document.querySelector('.arvore-pontos')!.textContent).toBe('★ 3');
    expect(ligar).toHaveBeenCalledWith(no(106), 'no-106', expect.any(Function)); // a caixinha (mouse/teclado)
  });
  it('abre no nó mais barato que dá pra comprar (ou no pedido), no meio do palco e num zoom que dá pra ler', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    expect(no(21).getAttribute('aria-pressed')).toBe('true');
    expect(largura()).toBeCloseTo(L * ZOOM_ABRIR, 6);
    const t = translate();
    expect(t.x).toBeCloseTo(noMeio(21, ZOOM_ABRIR).x, 6);
    expect(t.y).toBeCloseTo(noMeio(21, ZOOM_ABRIR).y, 6);
    expect(cartao().textContent).toContain('Porquinho quebrado');
    expect(cartao().textContent).toContain('Recomeço · 1 de 10');
    const b = cartao().querySelector('button')!;
    expect(b.textContent).toBe('Comprar · 2 ★');
    b.click();
    expect(comprar).toHaveBeenCalledWith(21);
    document.body.innerHTML = '';
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }), false, 12);
    expect(no(12).getAttribute('aria-pressed')).toBe('true');
  });
  it('a fileira de ramos: a Raiz no meio e os 10 na ordem da copa; tocar num ramo leva pro raio dele (o próximo nó, no meio)', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    const fileira = [...document.querySelectorAll<HTMLButtonElement>('.arvore-fileira .ramo-botao')];
    expect(fileira.map((b) => b.textContent)).toEqual(['Horta', 'Mapa do rolê', 'Gente', 'PPP Podcast', 'Recomeço', 'Raiz', 'Produção', 'Espaço', 'Oportunidades', 'Bolsa', 'Dourados']);
    // afasta tudo e pula pra Produção: o 11 é seu, o próximo é o 12; o zoom volta pro de ler
    for (let i = 0; i < 20; i++) document.querySelector<HTMLButtonElement>('.arvore-zoom .zoom-menos')!.click();
    fileira[6].click();
    expect(no(12).getAttribute('aria-pressed')).toBe('true');
    expect(largura()).toBeCloseTo(L * ZOOM_ABRIR, 6);
    expect(translate().x).toBeCloseTo(noMeio(12, ZOOM_ABRIR).x, 6);
    expect(translate().y).toBeCloseTo(noMeio(12, ZOOM_ABRIR).y, 6);
    // a fileira é refeita a cada desenho: procura de novo
    expect(document.querySelectorAll<HTMLButtonElement>('.arvore-fileira .ramo-botao')[6].getAttribute('aria-pressed')).toBe('true');
    expect(cartao().textContent).toContain('Ô loco, bicho!');
  });
  it('cartão: falta ponto, trancado, portão (com cadeado e o motivo), comprado; infinito com o nível e o próximo preço', () => {
    abrir(estado({ pontos: 3, vendas: 1, bonus: { arvore: [1, 11, 12, 13, 14, 15], conquistas: 0 } }));
    no(21).click();
    expect(cartao().querySelector('button')!.textContent).toBe('Comprar · 2 ★');
    no(106).click();
    expect(cartao().querySelector('button')).toBeNull();
    expect(cartao().querySelector('.portao-motivo .cadeado')).not.toBeNull();
    expect(cartao().textContent).toContain('Falta: 3 vendas (você tem 1)');
    no(107).click();
    expect(cartao().textContent).toContain('Libera com Coach quântico');
    no(11).click();
    expect(cartao().textContent).toContain('Comprado');
    document.body.innerHTML = '';
    abrir(estado({ pontos: 5000, vendas: 10, bonus: { arvore: [3001], conquistas: 0, niveis: { 3001: 7 } } }), false, 3001);
    expect(cartao().textContent).toContain('Nível 7 → 8');
    expect(cartao().textContent).toContain(`${Math.round(2000 * 1.6 ** 7)} ★`);
    expect(no(3001).querySelector('.no-nivel')!.textContent).toBe('nv 7');
    expect(no(3001).querySelector('.no-custo')!.textContent).toBe(`${Math.round(2000 * 1.6 ** 7)} ★`);
    expect(no(3001).classList.contains('nivelado')).toBe(true);
    // o nível e o preço do infinito ficam juntos, pro lado de fora do raio
    expect(no(3001).querySelector('.no-info .no-nivel')).not.toBeNull();
    expect(no(3001).style.getPropertyValue('--ux')).not.toBe('');
  });
  it('falta ponto: o botão diz quanto falta, apagado', () => {
    abrir(estado({ pontos: 1, bonus: { arvore: [1, 11], conquistas: 0 } }), false, 21);
    expect(no(21).classList.contains('falta')).toBe(true);
    expect(cartao().querySelector('button')!.textContent).toBe('Falta 1 ★');
    expect(cartao().querySelector('button')!.disabled).toBe(true);
  });
  it('infinito: depois de comprar, o Comprar fica apagado ~400 ms (o 2º toque não compra outro nível) e o foco volta pra ele', () => {
    vi.useFakeTimers();
    try {
      const s = (nv: number) => estado({ pontos: 99999, vendas: 10, bonus: { arvore: [3001], conquistas: 0, niveis: { 3001: nv } } });
      const t = abrir(s(2), false, 3001);
      const b = cartao().querySelector<HTMLButtonElement>('.arvore-acao .btn')!;
      b.focus();
      b.click();
      expect(comprar).toHaveBeenCalledWith(3001);
      t.renderizar(s(2), true); // o banco pensando
      t.renderizar(s(3), false); // respondeu: nível 3
      const b2 = cartao().querySelector<HTMLButtonElement>('.arvore-acao .btn')!;
      expect(b2.disabled).toBe(true);
      b2.click();
      expect(comprar).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(399);
      expect(cartao().querySelector<HTMLButtonElement>('.arvore-acao .btn')!.disabled).toBe(true);
      vi.advanceTimersByTime(1);
      const b3 = cartao().querySelector<HTMLButtonElement>('.arvore-acao .btn')!;
      expect(b3.disabled).toBe(false);
      expect(document.activeElement).toBe(b3); // o teclado segue no Comprar
    } finally {
      vi.useRealTimers();
    }
  });
  it('comprar com o teclado: o foco volta pro Comprar depois de redesenhar; escolher outro nó com o mouse não puxa o foco', () => {
    const s = () => estado({ pontos: 9, bonus: { arvore: [1], conquistas: 0 } });
    const t = abrir(s(), false, 21);
    cartao().querySelector<HTMLButtonElement>('.arvore-acao .btn')!.focus();
    t.renderizar(s(), true);
    t.renderizar(s(), false);
    expect(document.activeElement).toBe(cartao().querySelector('.arvore-acao .btn'));
    no(31).focus();
    no(31).click();
    t.renderizar(s(), false);
    expect(document.activeElement).toBe(no(31));
  });
  it('a fileira rola até o ramo ativo só quando ele muda', () => {
    const rolar = vi.fn();
    const antes = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = rolar;
    try {
      abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } })); // o 11, Produção
      expect(rolar).toHaveBeenCalledTimes(1);
      no(12).click(); // Produção de novo
      document.querySelector<HTMLButtonElement>('.arvore-zoom .zoom-mais')!.click();
      expect(rolar).toHaveBeenCalledTimes(1);
      no(21).click(); // Recomeço
      expect(rolar).toHaveBeenCalledTimes(2);
    } finally {
      HTMLElement.prototype.scrollIntoView = antes;
    }
  });
  it('ocupado: Comprar apagado', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }), true);
    expect(cartao().querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
  });
  it('renderizar de novo (comprou) mantém o escolhido, o zoom e o lugar, e acende o nó', () => {
    const t = abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    expect(no(11).getAttribute('aria-pressed')).toBe('true');
    const antes = mundo().style.transform;
    t.renderizar(estado({ pontos: 1, bonus: { arvore: [1, 11], conquistas: 0 } }), false);
    expect(no(11).getAttribute('aria-pressed')).toBe('true');
    expect(no(11).classList.contains('comprado')).toBe(true);
    expect(mundo().style.transform).toBe(antes);
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
  it('Esc fecha mesmo com o foco fora da árvore', () => {
    const t = abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    (document.activeElement as HTMLElement).blur();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(t.aberta()).toBe(false);
    expect(document.activeElement).toBe(volta);
  });
  it('arrastar e soltar em cima de um nó não escolhe o nó; um toque de verdade escolhe', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140, clientY: 120, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 140, clientY: 120, bubbles: true }));
    no(41).click();
    expect(no(41).getAttribute('aria-pressed')).toBe('false');
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 11, clientY: 10, bubbles: true }));
    no(41).click();
    expect(no(41).getAttribute('aria-pressed')).toBe('true');
  });
  it('pinça (dois dedos): aproxima em volta do meio dos dedos, redesenha uma vez por quadro e não escolhe nem compra no fim', async () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    const antes = mundo().style.width;
    const t0 = translate();
    const desenhos = vi.spyOn(mundo(), 'replaceChildren');
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 210, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 220, clientY: 100, bubbles: true })); // 100 → 120
    expect(desenhos).not.toHaveBeenCalled(); // espera o quadro
    await quadro();
    expect(desenhos).toHaveBeenCalledTimes(1);
    expect(largura()).toBeCloseTo(L * ((ZOOM_ABRIR * 120) / 100), 6);
    expect(mundo().style.width).not.toBe(antes);
    // o ponto do mundo que estava no meio dos dedos (150, 100) segue no meio deles (160, 100)
    expect(translate().x).toBeCloseTo(160 + (t0.x - 150) * 1.2, 6);
    expect(translate().y).toBeCloseTo(100 + (t0.y - 100) * 1.2, 6);
    palco.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, clientX: 220, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    no(41).click();
    expect(no(41).getAttribute('aria-pressed')).toBe('false');
    cartao().querySelector<HTMLButtonElement>('button')?.click();
    expect(comprar).toHaveBeenCalledTimes(1); // só o clique de verdade no botão (o 11, escolhido ao abrir)
  });
  it('rodinha/trackpad: passo pequeno aproxima pouco, em volta do mouse, um desenho por quadro; de lado arrasta; deltaY 0 não faz nada', async () => {
    abrir(estado());
    const w0 = largura();
    const desenhos = vi.spyOn(mundo(), 'replaceChildren');
    rodinha(4);
    rodinha(4);
    rodinha(-2);
    await quadro();
    expect(desenhos).toHaveBeenCalledTimes(1);
    expect(largura()).toBeCloseTo(w0 * Math.exp(-6 * 0.0015), 6); // nada de pular pro mínimo ou pro máximo
    const t0 = translate();
    rodinha(3, 60); // deslizar de lado no trackpad: arrasta
    await quadro();
    expect(largura()).toBeCloseTo(w0 * Math.exp(-6 * 0.0015), 6);
    expect(translate().x).toBeCloseTo(t0.x - 60, 6);
    expect(translate().y).toBeCloseTo(t0.y - 3, 6);
    rodinha(0);
    await quadro();
    expect(largura()).toBeCloseTo(w0 * Math.exp(-6 * 0.0015), 6);
  });
  it('botões de zoom: + aproxima até 1,4 (apaga), − afasta até a constelação inteira (apaga; longe, sem rótulos)', () => {
    abrir(estado());
    const mais = document.querySelector<HTMLButtonElement>('.arvore-zoom .zoom-mais')!;
    const menos = document.querySelector<HTMLButtonElement>('.arvore-zoom .zoom-menos')!;
    expect(mais.getAttribute('aria-label')).toBe('Aproximar');
    expect(menos.getAttribute('aria-label')).toBe('Afastar');
    for (let i = 0; i < 6; i++) mais.click();
    expect(mais.disabled).toBe(true);
    expect(largura()).toBeCloseTo(L * 1.4, 6);
    expect(mundo().classList.contains('sem-rotulos')).toBe(false);
    for (let i = 0; i < 30; i++) menos.click();
    expect(menos.disabled).toBe(true);
    expect(largura()).toBeCloseTo(L * ZOOM_MIN, 6); // o palco sem tamanho (teste): o mínimo é o ZOOM_MIN
    expect(mundo().classList.contains('sem-rotulos')).toBe(true);
    expect(mundo().classList.contains('longe')).toBe(true); // os ícones viram estrelinhas (abaixo de 16 px borrariam)
  });
  it('com a página ampliada (zoom do PC), o mundo anda junto com o mouse, não mais rápido', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    for (const k of ['clientWidth', 'clientHeight', 'offsetWidth']) Object.defineProperty(palco, k, { configurable: true, value: 200 });
    palco.getBoundingClientRect = () => ({ width: 400, height: 400 }) as DOMRect; // zoom 2: 200 de layout viram 400 na tela
    const t0 = translate();
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140, clientY: 120, bubbles: true }));
    const t1 = translate();
    expect(t1.x - t0.x).toBeCloseTo(20, 6);
    expect(t1.y - t0.y).toBeCloseTo(10, 6);
  });
  it('a caixinha: segue o nó quando a vista fica parada (comprou, escolheu); fecha quando a vista anda (zoom, ramo, arraste)', () => {
    const dicas = { conferir: vi.fn(), esconder: vi.fn() };
    const t = criarArvoreTela(comprar, ligar, dicas);
    document.body.append(t.elemento);
    t.abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }), false, () => volta);
    dicas.conferir.mockClear();
    dicas.esconder.mockClear();
    t.renderizar(estado({ pontos: 1, bonus: { arvore: [1, 11], conquistas: 0 } }), false);
    no(21).click();
    expect(dicas.conferir).toHaveBeenCalledTimes(2);
    expect(dicas.esconder).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('.arvore-zoom .zoom-mais')!.click();
    document.querySelectorAll<HTMLButtonElement>('.arvore-fileira .ramo-botao')[0].click();
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140, clientY: 120, bubbles: true }));
    expect(dicas.esconder).toHaveBeenCalledTimes(3);
    expect(dicas.conferir).toHaveBeenCalledTimes(2);
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
  it('legenda com as 5 situações', () => {
    abrir(estado());
    expect([...document.querySelectorAll('.arvore-legenda li')].map((x) => x.textContent))
      .toEqual(['Comprado', 'Dá pra comprar', 'Falta ponto', 'Tem portão', 'Trancado']);
  });
  it('as barrinhas do quadro: 10, na ordem da copa, cheias na proporção, decorativas', () => {
    const b = copaBarras(estado({ bonus: { arvore: [1, 11, 12, 13, 14, 15, 106, 107, 108, 109, 110, 61], conquistas: 0 } }));
    expect(b.getAttribute('aria-hidden')).toBe('true');
    const barras = [...b.querySelectorAll<HTMLElement>('.barra')];
    expect(barras).toHaveLength(10);
    expect(barras[5].style.getPropertyValue('--cheio')).toBe('100%'); // a Produção é a 6ª da copa
    expect(barras[5].classList.contains('cheia')).toBe(true);
    expect(barras[0].style.getPropertyValue('--cheio')).toBe('10%'); // a Horta: 1 de 10
    expect(barras[1].style.getPropertyValue('--cheio')).toBe('0%');
  });
});
