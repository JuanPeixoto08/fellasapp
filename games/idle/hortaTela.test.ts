// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HortaEstado } from '../shared/types';
import { criarHortaTela } from './hortaTela';

const H = 3600_000;
const AGORA = Date.parse('2026-10-12T12:00:00.000Z');
const em = (msAtras: number) => new Date(AGORA - msAtras).toISOString();
const HORTA = (x: Partial<HortaEstado> = {}): HortaEstado => ({
  lado: 2, food_trucks: 3,
  plantas: [
    { canteiro: 0, especie: 1, inicio: em(2 * H), origem: 'plantada' }, // Pix madura
    { canteiro: 1, especie: 2, inicio: em(0.1 * H), origem: 'plantada' }, // Couve muda
  ],
  descobertas: [1, 2],
  bonus: { producao: 0.01, geradores: 0, melhorias: 0, oportunidades: 0 },
  server_now: new Date(AGORA).toISOString(),
  ...x,
});
const plantar = vi.fn();
const colher = vi.fn();
const arrancar = vi.fn();
let tela: ReturnType<typeof criarHortaTela>;
beforeEach(() => {
  document.body.innerHTML = '';
  plantar.mockClear();
  colher.mockClear();
  arrancar.mockClear();
  tela = criarHortaTela({ plantar, colher, arrancar });
  document.body.append(tela.elemento);
});
const canteiro = (c: number) => document.querySelector<HTMLButtonElement>(`.canteiro[data-canteiro="${c}"]`)!;

describe('a horta na tela', () => {
  it('a grade do tamanho dos Food trucks, com cada canteiro dizendo o que tem', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA);
    expect(document.querySelectorAll('.canteiro')).toHaveLength(4);
    expect(canteiro(0).getAttribute('aria-label')).toBe('Canteiro 1: Pé de Pix, madura');
    expect(canteiro(1).getAttribute('aria-label')).toBe('Canteiro 2: Couve do Coach, muda');
    expect(canteiro(6).getAttribute('aria-label')).toBe('Canteiro 3: vazio');
    expect(document.querySelector('.horta-prox')!.textContent).toBe('3 × 3 com 25 Food trucks (tem 3)');
  });
  it('resumo dos bônus e a coleção (com a dica quando os pais já foram descobertos)', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA);
    expect(document.querySelector('.horta-bonus')!.textContent).toBe('Produção +1%');
    expect(document.querySelector('.horta-colecao-cab')!.textContent).toContain('Coleção 2/8');
    const itens = [...document.querySelectorAll('.colecao-item')];
    expect(itens[0].textContent).toContain('Pé de Pix');
    expect(itens[3].textContent).toContain('???');
    expect(itens[3].textContent).toContain('Nasce perto de Pé de Pix e Couve do Coach');
    expect(itens[7].textContent).toContain('Tem gente que jura que viu');
  });
  it('canteiro vazio: as sementes descobertas com preço; plantar manda canteiro e espécie', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA);
    canteiro(6).click();
    const bts = [...document.querySelectorAll<HTMLButtonElement>('.horta-cartao .semente')];
    expect(bts.map((b) => b.dataset.especie)).toEqual(['1', '2']);
    expect(bts[0].textContent).toContain('F$ 1,2 mil'); // 600 s × r 2
    bts[1].click();
    expect(plantar).toHaveBeenCalledWith(6, 2);
  });
  it('com planta: fase e quanto falta; Colher só madura; Arrancar sempre', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA);
    canteiro(1).click();
    const c = document.querySelector('.horta-cartao')!;
    expect(c.textContent).toContain('Couve do Coach');
    expect(c.textContent).toContain('amadurece em');
    const [col, arr] = [...c.querySelectorAll<HTMLButtonElement>('button')];
    expect(col.textContent).toBe('Colher');
    expect(col.disabled).toBe(true);
    arr.click();
    expect(arrancar).toHaveBeenCalledWith(1);
    canteiro(0).click();
    const col0 = document.querySelector<HTMLButtonElement>('.horta-cartao button')!;
    expect(col0.disabled).toBe(false);
    col0.click();
    expect(colher).toHaveBeenCalledWith(0);
  });
  it('sem Food truck: só o aviso; ocupado apaga os botões', () => {
    tela.renderizar(HORTA({ lado: 0, food_trucks: 0, plantas: [] }), 0, 1e9, false, AGORA);
    expect(document.querySelector('.horta')!.textContent).toContain('Compra 1 Food truck pra abrir a horta');
    tela.renderizar(HORTA(), 2, 1e9, true, AGORA);
    canteiro(6).click();
    expect([...document.querySelectorAll<HTMLButtonElement>('.horta-cartao .semente')].every((b) => b.disabled)).toBe(true);
  });
  it('a lista do F$: as sementes que só dependem do dinheiro', () => {
    tela.renderizar(HORTA(), 2, 0, false, AGORA);
    canteiro(6).click();
    expect(tela.precos().map((p) => p.preco)).toEqual([1200, 1200]);
  });
});

describe('com os convidados', () => {
  it('a planta que entrou com o Terry usa os tempos dela (amadurece antes)', () => {
    tela.renderizar(HORTA({ plantas: [
      { canteiro: 0, especie: 1, inicio: em(0.8 * H), origem: 'plantada', amadurece_s: 2520, vida_s: 23040 },
      { canteiro: 1, especie: 1, inicio: em(0.8 * H), origem: 'plantada' },
    ] }), 2, 1e9, false, AGORA);
    expect(canteiro(0).getAttribute('aria-label')).toBe('Canteiro 1: Pé de Pix, madura');
    expect(canteiro(1).getAttribute('aria-label')).toBe('Canteiro 2: Pé de Pix, crescendo');
  });
});
