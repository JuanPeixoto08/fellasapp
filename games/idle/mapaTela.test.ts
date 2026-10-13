// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { MapaEstado, PinoMapa } from '../shared/types';
import { criarMapaTela } from './mapaTela';

const pino = (id: number, extra: Partial<PinoMapa> = {}): PinoMapa => ({
  id, faixa: 'barato', lote: id === 3 ? 1 : 2, lancado: id === 3, horas: 2, era: 2, moeda: null, numero: null, preco: 1000,
  nome: null, frase: null, icone: null, x: null, y: null, aberto: false, nivel: null, moeda_qtd: null, fas: null, dono: null, ...extra,
});
const estado = (ps: PinoMapa[]): MapaEstado => ({ mapa: null, lugares: ps, mult: 1 });
const dicas = { ligar: vi.fn() };

describe('mapa', () => {
  it('9 pinos: lançado fechado com preço, aberto com nível, os outros "Em breve"', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    t.renderizar(estado([1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => pino(id, id === 7 ? { lancado: true, aberto: true, nivel: 4 } : {}))), 1e6, 4, false);
    const pinos = [...t.elemento.querySelectorAll<HTMLButtonElement>('.pino')];
    expect(pinos).toHaveLength(9);
    expect(t.elemento.querySelectorAll('.lugar-linha')).toHaveLength(9); // a lista do celular
    expect(pinos[2].classList.contains('fechado')).toBe(true);
    expect(pinos[2].textContent).toContain('F$');
    expect(pinos[6].textContent).toContain('4');
    expect(pinos[0].disabled).toBe(true);
    expect(pinos[0].textContent).toContain('Em breve');
  });
  it('sem nome no banco mostra "Lugar N"; com nome mostra o nome', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    t.renderizar(estado([pino(3), pino(4, { lancado: true, nome: 'Outro' })]), 0, 1, false);
    expect(t.elemento.textContent).toContain('Lugar 3');
    expect(t.elemento.textContent).toContain('Outro');
  });
  it('clicar no fechado com dinheiro e era compra; no aberto entra', () => {
    const a = { entrar: vi.fn(), abrir: vi.fn() };
    const t = criarMapaTela(a, dicas);
    t.renderizar(estado([pino(3), pino(7, { lancado: true, aberto: true, nivel: 1 })]), 1e6, 4, false);
    const [p3, p7] = t.elemento.querySelectorAll<HTMLButtonElement>('.pino');
    p3.click(); p7.click();
    expect(a.abrir).toHaveBeenCalledWith(3);
    expect(a.entrar).toHaveBeenCalledWith(7);
  });
  it('sem dinheiro ou sem era o fechado fica desabilitado', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    t.renderizar(estado([pino(3)]), 10, 4, false);
    expect(t.elemento.querySelector<HTMLButtonElement>('.pino')!.disabled).toBe(true);
    t.renderizar(estado([pino(3)]), 1e9, 1, false);
    expect(t.elemento.querySelector<HTMLButtonElement>('.pino')!.disabled).toBe(true);
  });
  it('sem a imagem do mapa: o fundo genérico; com ela, a <img> em pixel', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    t.renderizar(estado([pino(3)]), 0, 1, false);
    expect(t.elemento.querySelector('.mapa-generico')).not.toBeNull();
    t.renderizar({ ...estado([pino(3)]), mapa: 'data:image/png;base64,AAAA' }, 0, 1, false);
    expect(t.elemento.querySelector('.mapa-generico')).toBeNull();
    expect(t.elemento.querySelector<HTMLImageElement>('img.mapa-img')!.src).toContain('data:image/png');
  });
  it('pino na posição do banco (em % de 160 × 96) ou na genérica; o fechado ganha caixinha', () => {
    const d = { ligar: vi.fn() };
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, d);
    t.renderizar(estado([pino(3, { x: 80, y: 48 }), pino(4)]), 0, 1, false);
    const [p3, p4] = t.elemento.querySelectorAll<HTMLButtonElement>('.pino');
    expect(p3.style.left).toBe('50%');
    expect(p3.style.top).toBe('50%');
    expect(p4.style.left).toBe(`${(30 / 160) * 100}%`); // posicaoGenerica(4) = 30, 48
    // só o 3 (fechado e lançado): o pino e a linha da lista do PC, cada um com a sua chave
    expect(d.ligar.mock.calls.map((c) => c[1])).toEqual(['pino3', 'linha3'])
  });
  it('o pino do lugar com tema leva o destaque dele; sem tema, o de sempre', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    t.renderizar(estado([pino(3), pino(5)]), 0, 1, false);
    const [p3, p5] = t.elemento.querySelectorAll<HTMLButtonElement>('.pino');
    expect(p3.dataset.tema).toBe('3');
    expect(p5.dataset.tema).toBeUndefined();
  });
  it('"Em breve" não conta o que é: sem nome, frase, ícone, tema nem caixinha; só "Em breve" (pino, linha e leitor de tela)', () => {
    const d = { ligar: vi.fn() };
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, d);
    const segredo = { nome: 'Lugar Secreto', frase: 'a frase secreta', icone: 'data:image/png;base64,SEGREDO' };
    t.renderizar(estado([pino(7, segredo), pino(1, segredo)]), 1e9, 4, false);
    for (const bt of t.elemento.querySelectorAll<HTMLButtonElement>('.pino, .lugar-linha')) {
      expect(bt.classList.contains('breve')).toBe(true);
      expect(bt.disabled).toBe(true);
      expect(bt.textContent).toBe('Em breve');
      expect(bt.getAttribute('aria-label')).toBe('Em breve');
      expect(bt.outerHTML).not.toContain('Secret');
      expect(bt.outerHTML).not.toContain('SEGREDO');
      expect(bt.outerHTML).not.toMatch(/Lugar [17]/);
      expect(bt.dataset.tema).toBeUndefined();
      expect(bt.querySelector('.pino-icone.breve-icone')).not.toBeNull(); // o cadeado genérico apagado
    }
    expect(d.ligar).not.toHaveBeenCalled();
  });
  it('carregando: sem estado ainda, avisa', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    t.renderizar(null, 0, 1, false);
    expect(t.elemento.textContent).toContain('Carregando');
  });
  it('a lista do F$: o fechado que só depende do dinheiro', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    document.body.append(t.elemento);
    t.renderizar(estado([pino(3), pino(4)]), 10, 4, false);
    expect(t.precos().map((p) => p.preco)).toEqual([1000, 1000]); // o pino e a linha da lista do celular
    t.elemento.remove();
  });
  it('foco do teclado: o pino e a linha com foco voltam pro do mesmo lugar depois de redesenhar', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    document.body.replaceChildren(t.elemento);
    const m = estado([pino(3), pino(4, { lancado: true, aberto: true, nivel: 2 })]);
    t.renderizar(m, 1e9, 4, false);
    t.elemento.querySelector<HTMLElement>('.pino[data-lugar="4"]')!.focus();
    t.renderizar(m, 1e9, 4, false);
    expect(document.activeElement).toBe(t.elemento.querySelector('.pino[data-lugar="4"]'));
    t.elemento.querySelector<HTMLElement>('.lugar-linha[data-lugar="3"]')!.focus();
    t.renderizar(m, 1e9, 4, true); // ocupado: o fechado apaga
    t.renderizar(estado([pino(3, { aberto: true, nivel: 1 }), pino(4, { lancado: true, aberto: true, nivel: 2 })]), 1e9, 4, false);
    expect(document.activeElement).toBe(t.elemento.querySelector('.lugar-linha[data-lugar="3"]'));
    t.elemento.remove();
  });
});
