// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { criarDouradoTela } from './douradoTela';
import type { TipoDourado } from './dourados';

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
const ev = (x: Partial<Parameters<typeof d.mostrar>[0]> = {}) => ({ seg: T / 1000, lado: 0, tipo: 0 as TipoDourado, x: 0.3, y: 0.4, agoraMs: T, ...x });

describe('eventos na tela', () => {
  it('aparece no ponto sorteado, com o nome pra leitor de tela e o anel dos 12 s', () => {
    d.mostrar(ev());
    const b = raiz.querySelector<HTMLButtonElement>('.dourado')!;
    expect(b.getAttribute('aria-label')).toBe('Pegar: Investidor apressado');
    expect(b.style.getPropertyValue('--x')).toBe('30%');
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
    expect([...raiz.querySelectorAll<HTMLElement>('.dourado')].at(-1)!.style.getPropertyValue('--x')).toBe('calc(44% + 84px)');
  });
  it('a dupla nunca cai pra fora da tela: o segundo ícone vai pro lado que tem espaço', () => {
    d.mostrar(ev({ seg: 1, tipo: 3, lado: 1, x: 0.3, agoraMs: 1000 }));
    d.mostrar(ev({ seg: 2, tipo: 3, lado: 1, x: 0.7, agoraMs: 2000 }));
    const [esq, dir] = [...raiz.querySelectorAll<HTMLElement>('.dourado')];
    expect(esq.style.getPropertyValue('--x')).toBe('calc(30% + 84px)');
    expect(dir.style.getPropertyValue('--x')).toBe('calc(70% - 84px)');
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

describe('os dourados novos na tela (0076)', () => {
  it('cada um com o seu ícone e o nome pro leitor de tela; o garantido em dobro mostra "2×"', () => {
    for (const [tipo, nome] of [[4, 'Trend do TikTok'], [5, 'Bombou no LinkedIn'], [6, 'Pix errado'], [7, 'Tigrinho']] as const) {
      d.mostrar(ev({ seg: T / 1000 + tipo, tipo }));
      const b = raiz.querySelector<HTMLElement>(`.dourado-${tipo}`)!;
      expect(b.getAttribute('aria-label')).toBe(`Pegar: ${nome}`);
      expect(b.querySelector('svg.icone-dourado')).not.toBeNull();
    }
    d.mostrar(ev({ seg: T / 1000 + 20, dobro: true }));
    const dobro = raiz.querySelector<HTMLElement>('.dourado.dobro')!;
    expect(dobro.querySelector('.dobro-selo')!.textContent).toBe('2×');
    expect(dobro.getAttribute('aria-label')).toBe('Pegar: Investidor apressado (em dobro)');
  });
  it('a caixinha só nos novos (o 3º parâmetro liga)', () => {
    const dica = vi.fn();
    d = criarDouradoTela(raiz, pegar, { dica });
    d.mostrar(ev());
    d.mostrar(ev({ seg: T / 1000 + 1, tipo: 5 }));
    expect(dica).toHaveBeenCalledTimes(1);
    expect(dica).toHaveBeenCalledWith(expect.any(HTMLElement), `dourado-${T / 1000 + 1}`, 5, T / 1000 + 1, false);
  });
  it('Trend: o clique abre a chuva de 25 moedinhas; cada clique conta; em 8 s manda quantas pegou', () => {
    let relogio = 0;
    const som = vi.fn();
    d = criarDouradoTela(raiz, pegar, { agora: () => relogio, som });
    d.mostrar(ev({ tipo: 4 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-4')!.click();
    expect(pegar).not.toHaveBeenCalled();
    const moedas = [...raiz.querySelectorAll<HTMLButtonElement>('.chuva .moedinha')];
    expect(moedas).toHaveLength(25);
    moedas.slice(0, 3).forEach((m) => m.click());
    expect(raiz.querySelector('.chuva-placar')!.textContent).toBe('3 moedinhas');
    expect(som).toHaveBeenCalledTimes(3);
    relogio = 7_900;
    d.tick(T + 7_900);
    expect(pegar).not.toHaveBeenCalled();
    relogio = 8_000;
    d.tick(T + 8_000);
    expect(pegar.mock.calls).toEqual([[T / 1000, 0, 3]]);
    expect(raiz.querySelector('.chuva')).toBeNull();
  });
  it('Pix: o clique abre Ficar / Devolver (sem relógio); a escolha vai no lado; some sozinha na janela + 8 s', () => {
    d.mostrar(ev({ tipo: 6 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-6')!.click();
    expect(pegar).not.toHaveBeenCalled();
    const bts = [...raiz.querySelectorAll<HTMLButtonElement>('.pix-escolha button')];
    expect(bts.map((b) => b.textContent)).toEqual(['Ficar', 'Devolver']);
    bts[1].click();
    bts[0].click();
    expect(pegar.mock.calls).toEqual([[T / 1000, 1]]);
    const seg2 = T / 1000 + 30;
    d.mostrar(ev({ seg: seg2, tipo: 6, agoraMs: T + 30_000 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-6')!.click();
    d.tick(seg2 * 1000 + 19_900);
    expect(raiz.querySelector('.pix-escolha')).not.toBeNull();
    d.tick(seg2 * 1000 + 20_000); // 12 s + 8 s
    expect(raiz.querySelector('.pix-escolha')).toBeNull();
    expect(pegar).toHaveBeenCalledTimes(1);
  });
  it('Tigrinho: o clique pega na hora e gira o rolo; para no resultado do banco no mínimo 1,5 s depois do clique', () => {
    vi.useFakeTimers();
    let relogio = 0;
    const som = vi.fn();
    d = criarDouradoTela(raiz, pegar, { agora: () => relogio, som });
    d.mostrar(ev({ tipo: 7 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-7')!.click();
    expect(pegar.mock.calls).toEqual([[T / 1000, 0]]);
    expect(raiz.querySelector('.tigre-rolo.girando')).not.toBeNull();
    expect(som).toHaveBeenCalledWith('tigreGira');
    const parou = vi.fn();
    relogio = 400;
    d.pararTigre(T / 1000, false, parou);
    expect(parou).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1100);
    expect(parou).toHaveBeenCalledTimes(1);
    expect(raiz.querySelector('.tigre-rolo')!.textContent).toBe('COMEU');
    vi.advanceTimersByTime(1300);
    expect(raiz.querySelector('.tigre-rolo')).toBeNull();
  });
  it('Tigrinho: erro no banco (pagou = null) só tira o rolo', () => {
    d.mostrar(ev({ tipo: 7 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-7')!.click();
    d.pararTigre(T / 1000, null);
    expect(raiz.querySelector('.tigre-rolo')).toBeNull();
  });
});
