// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { criarEventoEraTela, prenderNaTela } from './eventoEraTela';

const opcoes = (aoPegar = vi.fn()) => ({ aoPegar, dica: vi.fn(), posicao: () => ({ x: 0.5, y: 0.5 }) });

describe('eventos de era na tela', () => {
  it('mãe: o botão "Já vou!" pega uma vez; some depois da janela', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 1, agoraMs: 100_000 });
    const b = raiz.querySelector<HTMLButtonElement>('.evento-era button')!;
    expect(b.textContent).toBe('Já vou!');
    b.click(); b.click();
    expect(o.aoPegar).toHaveBeenCalledTimes(1);
    expect(o.aoPegar).toHaveBeenCalledWith(100, 0, { x: 0.5, y: 0.5 }, 1);
    t.mostrar({ seg: 200, tipo: 1, agoraMs: 200_000 });
    t.tick(208_001);
    expect(raiz.querySelector('.evento-era')).toBeNull();
  });
  it('não mostra o que já passou da janela (aba que voltou) nem dois de uma vez', () => {
    const raiz = document.createElement('div');
    const t = criarEventoEraTela(raiz, opcoes());
    t.mostrar({ seg: 100, tipo: 4, agoraMs: 105_000 }); // tela azul: 5 s
    expect(raiz.querySelector('.evento-era')).toBeNull();
    t.mostrar({ seg: 100, tipo: 3, agoraMs: 100_000 });
    t.mostrar({ seg: 101, tipo: 2, agoraMs: 101_000 });
    expect(raiz.querySelectorAll('.evento-era')).toHaveLength(1);
    expect(t.ativo()).toBe(true);
  });
  it('Jogo do Brasil: cada clique na bola é gol; no 7º manda na hora; no fim da janela manda o que tiver', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    const bola = () => raiz.querySelector<HTMLButtonElement>('.evento-bola')!;
    for (let i = 0; i < 3; i++) bola().click();
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('Jogo do Brasil · 3 de 7');
    expect(bola().querySelector('svg.icone-evento')).not.toBeNull(); // a bola de pixel
    t.tick(130_000);
    expect(o.aoPegar).toHaveBeenCalledWith(100, 3, { x: 0.5, y: 0.5 }, 5);
    t.mostrar({ seg: 200, tipo: 5, agoraMs: 200_000 });
    for (let i = 0; i < 7; i++) bola().click();
    expect(o.aoPegar).toHaveBeenLastCalledWith(200, 7, { x: 0.5, y: 0.5 }, 5);
  });
  it('Jogo do Brasil: do 1º gol até acabar, a tela trava atrás (clique fora da bola não é gol nem cai no jogo)', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    const caixa = () => raiz.querySelector<HTMLElement>('.evento-era-5')!;
    expect(caixa().classList.contains('travado')).toBe(false); // antes de começar, o jogo atrás segue clicável
    raiz.querySelector<HTMLButtonElement>('.evento-bola')!.click();
    expect(caixa().classList.contains('travado')).toBe(true);
    caixa().click();
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('Jogo do Brasil · 1 de 7');
    t.tick(130_000);
    expect(raiz.querySelector('.evento-era-5')).toBeNull(); // acabou: a trava sai junto
  });
  it('a bola fica no pulo (tempo / 1,5 s) + gols: anda a cada clique e a cada 1,5 s, sem travar depois de clicar rápido', () => {
    const raiz = document.createElement('div');
    const posicao = vi.fn((_seg: number, i: number) => ({ x: i / 10, y: 0.5 }));
    const t = criarEventoEraTela(raiz, { ...opcoes(), posicao });
    const bola = () => raiz.querySelector<HTMLButtonElement>('.evento-bola')!;
    const pulos = () => posicao.mock.calls.map((c) => c[1]);
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    expect(pulos()).toEqual([0]);
    bola().click(); bola().click(); bola().click(); // 3 gols rápidos
    expect(pulos()).toEqual([0, 1, 2, 3]);
    t.tick(101_000); // ainda no mesmo passo de 1,5 s: não pula
    expect(pulos()).toEqual([0, 1, 2, 3]);
    t.tick(101_500); // passou 1,5 s: pula na hora (passo 1 + 3 gols)
    expect(pulos()).toEqual([0, 1, 2, 3, 4]);
    expect(bola().style.left).toBe('40%');
    bola().click();
    expect(pulos()).toEqual([0, 1, 2, 3, 4, 5]);
    t.tick(103_000);
    expect(pulos()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it('a bola que aparece com a janela andando já começa no pulo do tempo', () => {
    const raiz = document.createElement('div');
    const posicao = vi.fn((_seg: number, i: number) => ({ x: i / 10, y: 0.5 }));
    const t = criarEventoEraTela(raiz, { ...opcoes(), posicao });
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 106_000 });
    expect(posicao.mock.calls.map((c) => c[1])).toEqual([4]);
  });
  it('aoPegar recebe onde a coisa estava: o ponto dela, a faixa da tela azul no meio, o último pulo da bola', () => {
    const raiz = document.createElement('div');
    const o = { ...opcoes(), posicao: (_seg: number, i: number) => ({ x: 0.2 + i / 10, y: 0.3 }) };
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 3, agoraMs: 100_000 });
    raiz.querySelector<HTMLButtonElement>('.evento-era button')!.click();
    expect(o.aoPegar).toHaveBeenLastCalledWith(100, 0, { x: 0.2, y: 0.3 }, 3);
    t.mostrar({ seg: 200, tipo: 4, agoraMs: 200_000 });
    raiz.querySelector<HTMLButtonElement>('.evento-era button')!.click();
    expect(o.aoPegar).toHaveBeenLastCalledWith(200, 0, { x: 0.5, y: 0.3 }, 4);
    t.mostrar({ seg: 300, tipo: 5, agoraMs: 300_000 });
    raiz.querySelector<HTMLButtonElement>('.evento-bola')!.click();
    raiz.querySelector<HTMLButtonElement>('.evento-bola')!.click();
    t.tick(301_500); // pulo 1 + 2 gols = 3
    t.tick(330_000);
    expect(o.aoPegar).toHaveBeenLastCalledWith(300, 2, { x: 0.2 + 3 / 10, y: 0.3 }, 5);
  });
  it('o placar anda com a bola: em cima dela; embaixo quando ela está perto do topo', () => {
    const raiz = document.createElement('div');
    const ys = [0.6, 0.2, 0.7];
    const t = criarEventoEraTela(raiz, { ...opcoes(), posicao: (_seg: number, i: number) => ({ x: 0.1 + i / 10, y: ys[i] ?? 0.5 }) });
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    const bola = raiz.querySelector<HTMLButtonElement>('.evento-bola')!;
    const placar = raiz.querySelector<HTMLElement>('.evento-placar')!;
    const junto = () => {
      expect(placar.style.getPropertyValue('--x')).toBe(bola.style.left);
      expect(placar.style.getPropertyValue('--y')).toBe(bola.style.top);
    };
    junto();
    expect(bola.style.left).toBe('10%');
    expect(placar.classList.contains('embaixo')).toBe(false);
    bola.click(); // pulo 1: perto do topo
    junto();
    expect(bola.style.left).toBe('20%');
    expect(placar.classList.contains('embaixo')).toBe(true);
    expect(placar.textContent).toBe('Jogo do Brasil · 1 de 7');
    t.tick(101_500); // pulo 2 (passo 1 + 1 gol)
    junto();
    expect(bola.style.top).toBe('70%');
    expect(placar.classList.contains('embaixo')).toBe(false);
  });
  it('no 7º gol o texto sobe onde a bola levou o chute (antes de pular)', () => {
    const raiz = document.createElement('div');
    const o = { ...opcoes(), posicao: (_seg: number, i: number) => ({ x: i / 10, y: 0.5 }) };
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    for (let i = 0; i < 7; i++) raiz.querySelector<HTMLButtonElement>('.evento-bola')!.click();
    expect(o.aoPegar).toHaveBeenCalledWith(100, 7, { x: 0.6, y: 0.5 }, 5); // o 7º chute foi na bola do pulo 6
  });
  it('Jogo do Brasil sem gol não chama o banco', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    t.tick(130_000);
    expect(o.aoPegar).not.toHaveBeenCalled();
  });
  it('aoGol a cada gol (o som do gol); aoBotao no clique da caixa (Shopee e call tocam aí, não ao aparecer)', () => {
    const raiz = document.createElement('div');
    const aoGol = vi.fn();
    const aoBotao = vi.fn();
    const t = criarEventoEraTela(raiz, { ...opcoes(), aoGol, aoBotao });
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    expect(aoGol).not.toHaveBeenCalled();
    for (let i = 0; i < 7; i++) raiz.querySelector<HTMLButtonElement>('.evento-bola')!.click();
    expect(aoGol).toHaveBeenCalledTimes(7);
    expect(aoGol.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    t.mostrar({ seg: 200, tipo: 2, agoraMs: 200_000 });
    expect(aoBotao).not.toHaveBeenCalled();
    raiz.querySelector<HTMLButtonElement>('.evento-era button')!.click();
    expect(aoBotao).toHaveBeenCalledWith(2);
    t.mostrar({ seg: 300, tipo: 3, agoraMs: 300_000 });
    raiz.querySelector<HTMLButtonElement>('.evento-era button')!.click();
    raiz.querySelector<HTMLButtonElement>('.evento-era button')?.click(); // já saiu: não toca de novo
    expect(aoBotao).toHaveBeenLastCalledWith(3);
    expect(aoBotao).toHaveBeenCalledTimes(2);
  });
  it('a caixa fica inteira dentro da tela (8 px de margem): o centro é empurrado pra dentro', () => {
    const tela = { w: 387, h: 800 };
    // a call (249 px) sorteada em left 161 px: a borda direita ia a 410 px; vai pra 387 - 8 - 124,5
    expect(prenderNaTela({ x: 161 + 124.5, y: 400 }, { w: 249, h: 120 }, tela)).toEqual({ x: 387 - 8 - 124.5, y: 400 });
    expect(prenderNaTela({ x: 50, y: 400 }, { w: 249, h: 120 }, tela)).toEqual({ x: 8 + 124.5, y: 400 });
    expect(prenderNaTela({ x: 200, y: 20 }, { w: 100, h: 120 }, tela)).toEqual({ x: 200, y: 8 + 60 });
    expect(prenderNaTela({ x: 200, y: 790 }, { w: 100, h: 120 }, tela)).toEqual({ x: 200, y: 800 - 8 - 60 });
    expect(prenderNaTela({ x: 200, y: 400 }, { w: 100, h: 120 }, tela)).toEqual({ x: 200, y: 400 }); // já cabe
    expect(prenderNaTela({ x: 10, y: 400 }, { w: 500, h: 120 }, tela)).toEqual({ x: 193.5, y: 400 }); // maior que a tela: no meio
  });
  it('mostrar prende a caixa na tela e o texto sobe de onde ela ficou; a tela azul (faixa inteira) fica de fora', () => {
    const raiz = document.createElement('div');
    document.body.append(raiz);
    // a camada (a tela) com 387 × 800 e cada caixa com 249 × 120 (happy-dom não faz layout)
    const medida = (nome: 'clientWidth' | 'clientHeight' | 'offsetWidth' | 'offsetHeight', valor: (el: HTMLElement) => number) =>
      vi.spyOn(HTMLElement.prototype, nome, 'get').mockImplementation(function (this: HTMLElement) { return valor(this); });
    const ehCamada = (el: HTMLElement) => el.classList.contains('eventos-era');
    const espioes = [
      medida('clientWidth', (el) => (ehCamada(el) ? 387 : 0)),
      medida('clientHeight', (el) => (ehCamada(el) ? 800 : 0)),
      medida('offsetWidth', (el) => (el.classList.contains('evento-era') ? 249 : 0)),
      medida('offsetHeight', (el) => (el.classList.contains('evento-era') ? 120 : 0)),
    ];
    try {
      const o = { ...opcoes(), posicao: () => ({ x: 0.74, y: 0.5 }) };
      const t = criarEventoEraTela(raiz, o);
      t.mostrar({ seg: 100, tipo: 3, agoraMs: 100_000 });
      const caixa = raiz.querySelector<HTMLElement>('.evento-era')!;
      expect(caixa.style.left).toBe(`${Math.round(387 - 8 - 124.5)}px`);
      caixa.querySelector<HTMLButtonElement>('button')!.click();
      expect(o.aoPegar.mock.calls[0][2].x).toBeCloseTo(Math.round(387 - 8 - 124.5) / 387, 5);
      t.mostrar({ seg: 200, tipo: 4, agoraMs: 200_000 });
      expect(raiz.querySelector<HTMLElement>('.evento-era-4')!.style.left).toBe('50%');
    } finally {
      for (const e of espioes) e.mockRestore();
      raiz.remove();
    }
  });
});

describe('eventos das eras 6 e 7 na tela', () => {
  const destroco = (raiz: HTMLElement) => raiz.querySelector<HTMLButtonElement>('.evento-destroco');
  it('Lixo espacial: 3 destroços, um de cada vez (um terço da janela cada); cada clique é um desvio; no 3º manda na hora', () => {
    const raiz = document.createElement('div');
    const o = { ...opcoes(), aoDesvio: vi.fn() };
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 100_000 });
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('Lixo espacial · 0 de 3');
    expect(destroco(raiz)!.querySelector('svg.icone-evento')).not.toBeNull();
    destroco(raiz)!.click();
    expect(destroco(raiz)).toBeNull(); // saiu da tela: o mesmo destroço não conta duas vezes
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('Lixo espacial · 1 de 3');
    t.tick(103_400); // o 2º entra
    destroco(raiz)!.click();
    t.tick(106_700); // o 3º
    destroco(raiz)!.click();
    expect(o.aoPegar).toHaveBeenCalledWith(100, 3, { x: 0.5, y: 0.5 }, 6);
    expect(o.aoDesvio).toHaveBeenCalledTimes(3);
    expect(raiz.querySelector('.evento-era-6')).toBeNull();
  });
  it('Lixo espacial: aoSair roda depois de cada saída do destroço (clique e troca pelo próximo), já desligado da página', () => {
    const raiz = document.createElement('div');
    document.body.append(raiz);
    const conectado: boolean[] = [];
    let el: HTMLElement | null = null;
    const o = { ...opcoes(), aoSair: vi.fn(() => conectado.push(el!.isConnected)) };
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 100_000 });
    el = destroco(raiz);
    el!.click(); // saída por clique
    expect(o.aoSair).toHaveBeenCalledTimes(1);
    t.tick(103_400); // o 2º entra
    el = destroco(raiz);
    t.tick(106_700); // o 3º entra no lugar do 2º, que ninguém clicou
    expect(o.aoSair).toHaveBeenCalledTimes(2);
    expect(conectado).toEqual([false, false]);
    raiz.remove();
  });
  it('Lixo espacial: sem desviar nenhum, não manda nada; com 1, manda 1 no fim da janela', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 100_000 });
    t.tick(103_400);
    t.tick(106_700);
    t.tick(110_000);
    expect(o.aoPegar).not.toHaveBeenCalled();
    t.mostrar({ seg: 200, tipo: 6, agoraMs: 200_000 });
    destroco(raiz)!.click();
    t.tick(210_000);
    expect(o.aoPegar).toHaveBeenCalledWith(200, 1, { x: 0.5, y: 0.5 }, 6);
  });
  it('Lixo espacial: do 1º desvio até acabar, a tela atrás trava (clique errado não compra gerador)', () => {
    const raiz = document.createElement('div');
    const t = criarEventoEraTela(raiz, opcoes());
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 100_000 });
    const caixa = () => raiz.querySelector<HTMLElement>('.evento-era-6')!;
    expect(caixa().classList.contains('travado')).toBe(false);
    destroco(raiz)!.click();
    expect(caixa().classList.contains('travado')).toBe(true);
    caixa().click();
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('Lixo espacial · 1 de 3');
  });
  it('Lixo espacial: quem volta pra aba no meio pega o destroço da vez, já andando', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 104_000 }); // o 2º entrou há 0,67 s
    expect(destroco(raiz)!.style.getPropertyValue('--ja')).toBe('-667ms');
    destroco(raiz)!.click();
    t.tick(110_000);
    expect(o.aoPegar).toHaveBeenCalledWith(100, 1, { x: 0.5, y: 0.5 }, 6);
  });
  it('Houston: a cena pisca (alarme) enquanto o aviso está na tela; consertar manda o tipo e apaga o alarme; passou a janela, apaga sem mandar', () => {
    const raiz = document.createElement('div');
    const palco = document.createElement('div');
    const o = { ...opcoes(), alarmeEm: palco, aoBotao: vi.fn() };
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 7, agoraMs: 100_000 });
    expect(palco.classList.contains('alarme')).toBe(true);
    expect(raiz.querySelector('.evento-balao')!.textContent).toBe('Houston, temos um problema');
    const b = raiz.querySelector<HTMLButtonElement>('.evento-era button')!;
    expect(b.textContent).toBe('Consertar com silver tape');
    b.click();
    expect(o.aoBotao).toHaveBeenCalledWith(7);
    expect(o.aoPegar).toHaveBeenCalledWith(100, 0, { x: 0.5, y: 0.5 }, 7);
    expect(palco.classList.contains('alarme')).toBe(false);
    t.mostrar({ seg: 200, tipo: 7, agoraMs: 200_000 });
    t.tick(208_001);
    expect(palco.classList.contains('alarme')).toBe(false);
    expect(o.aoPegar).toHaveBeenCalledTimes(1);
  });
});
