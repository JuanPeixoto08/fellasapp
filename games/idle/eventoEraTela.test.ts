// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { criarEventoEraTela } from './eventoEraTela';

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
    expect(o.aoPegar).toHaveBeenCalledWith(100, 0);
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
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('3 de 7');
    t.tick(130_000);
    expect(o.aoPegar).toHaveBeenCalledWith(100, 3);
    t.mostrar({ seg: 200, tipo: 5, agoraMs: 200_000 });
    for (let i = 0; i < 7; i++) bola().click();
    expect(o.aoPegar).toHaveBeenLastCalledWith(200, 7);
  });
  it('Jogo do Brasil sem gol não chama o banco', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    t.tick(130_000);
    expect(o.aoPegar).not.toHaveBeenCalled();
  });
});
