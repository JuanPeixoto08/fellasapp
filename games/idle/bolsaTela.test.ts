// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BolsaEstado } from '../shared/types';
import { criarBolsaTela } from './bolsaTela';

const B = (x: Partial<BolsaEstado> = {}): BolsaEstado => ({
  tick: 1000, vira_em_ms: 42_000, r: 2, aberta: true, corretor: 0, escritorio: 0, corretagem: 0.05,
  empresas: [
    { id: 1, valor: 33, limite: 120, risco: false, rj_ate: null, historico: [30, 32, 33] },
    { id: 4, valor: 2, limite: 102, risco: true, rj_ate: null, historico: [20, 2] },
    { id: 6, valor: 5, limite: 100, risco: false, rj_ate: 1007, historico: [5] },
  ],
  carteira: [{ empresa: 1, qtd: 10, custo: 300 }],
  viraram_po: [],
  ...x,
});
const negociar = vi.fn();
const melhorar = vi.fn();
let tela: ReturnType<typeof criarBolsaTela>;
beforeEach(() => {
  document.body.innerHTML = '';
  negociar.mockClear();
  melhorar.mockClear();
  tela = criarBolsaTela({ negociar, melhorar });
  document.body.append(tela.elemento);
});
const linha = (id: number) => document.querySelector<HTMLButtonElement>(`.acao[data-empresa="${id}"]`)!;

describe('tela da Bolsa', () => {
  it('lista: código, nome, preço em F$ (valor × r), variação na hora, ações e lucro', () => {
    tela.renderizar(B(), 1e9, false);
    const l = linha(1);
    expect(l.textContent).toContain('PSTL');
    expect(l.textContent).toContain('Pastel do Zé');
    expect(l.textContent).toContain('F$ 66');
    expect(l.textContent).toContain('+10% na hora');
    expect(l.textContent).toContain('10 ações');
    expect(l.textContent).toContain('+10% de lucro');
    expect(l.querySelector('svg.mini')).not.toBeNull();
    expect(linha(4).querySelector('.etq.risco')!.textContent).toBe('Pode quebrar');
    expect(linha(6).classList.contains('quebrada')).toBe(true);
    expect(linha(6).querySelector('.etq.rj')!.textContent).toBe('Quebrou · volta em 7 min');
  });
  it('o relógio do "preço novo em" desce sem buscar de novo (e não fala a cada segundo pro leitor de tela)', () => {
    tela.renderizar(B(), 1e9, false);
    linha(1).click();
    tela.relogio(9_500);
    const r = document.querySelector('.bolsa-detalhe [role="timer"]')!;
    expect(r.textContent).toBe('preço novo em 0:10');
    tela.relogio(-200);
    expect(r.textContent).toBe('preço novo em 0:00');
  });
  it('ações que viraram pó: o aviso aparece dentro da Bolsa (a cena fica escondida com ela aberta)', () => {
    tela.renderizar(B({ viraram_po: [{ empresa: 4, qtd: 120 }] }), 1e9, false);
    const aviso = document.querySelector('.bolsa-po')!;
    expect(aviso.getAttribute('role')).toBe('status');
    expect(aviso.textContent).toContain('Suas 120 ações da Cripto do Primo viraram pó.');
    tela.renderizar(B(), 1e9, false);
    expect(document.querySelector('.bolsa-po')).toBeNull();
  });
  it('topo: carteira e lucro em F$', () => {
    tela.renderizar(B(), 1e9, false);
    expect(document.querySelector('.carteira')!.textContent).toContain('F$ 660'); // 10 × 33 × 2
    expect(document.querySelector('.carteira')!.textContent).toContain('+F$ 60'); // (330 − 300) × 2
  });
  it('tocar abre o detalhe; comprar 1/10/Máx e vender 1/10/Tudo mandam o tick visto', () => {
    tela.renderizar(B(), 1e9, false);
    expect(document.querySelector('.bolsa-detalhe')).toBeNull();
    linha(1).click();
    const d = document.querySelector('.bolsa-detalhe')!;
    expect(d.textContent).toContain('preço novo em 0:42');
    expect(d.textContent).toContain('Você tem 10 de 120');
    expect(d.querySelector('.conta-limite')!.textContent).toBe('Limite: 100 + 20 Food truck'); // Pastel ↔ Food truck
    const bts = [...d.querySelectorAll<HTMLButtonElement>('button')].map((b) => b.textContent);
    expect(bts).toEqual(['1', '10', 'Máx', '1', '10', 'Tudo']);
    [...d.querySelectorAll<HTMLButtonElement>('.comprar button')][2].click();
    [...d.querySelectorAll<HTMLButtonElement>('.vender button')][0].click();
    expect(negociar.mock.calls).toEqual([[1, 'comprar', 0, 1000], [1, 'vender', 1, 1000]]);
    linha(1).click();
    expect(document.querySelector('.bolsa-detalhe')).toBeNull();
  });
  it('apagados: ocupado, sem F$, no limite, sem ações, empresa quebrada', () => {
    tela.renderizar(B({ carteira: [{ empresa: 1, qtd: 120, custo: 3600 }] }), 1e9, false); // limite do Pastel: 120
    linha(1).click();
    const comprar = () => [...document.querySelectorAll<HTMLButtonElement>('.comprar button')];
    expect(comprar().every((b) => b.disabled)).toBe(true); // no limite
    tela.renderizar(B(), 1e9, true);
    expect(comprar().every((b) => b.disabled)).toBe(true); // ocupado
    tela.renderizar(B({ carteira: [] }), 1e9, false);
    expect([...document.querySelectorAll<HTMLButtonElement>('.vender button')].every((b) => b.disabled)).toBe(true);
    linha(6).click();
    expect(document.querySelector('.bolsa-detalhe')!.textContent).toContain('Quebrou · volta em 7 min');
    expect(document.querySelectorAll('.bolsa-detalhe button')).toHaveLength(0);
  });
  it('a lista do F$ (o atualizarValor acende e apaga) tem os botões de compra que só dependem do F$', () => {
    tela.renderizar(B(), 1e9, false);
    linha(1).click();
    tela.renderizar(B(), 1e9, false);
    expect(tela.precos().map((p) => p.preco)).toEqual([1800 * 2, 3600 * 2, 33 * 2 * 1.05, 10 * 33 * 2 * 1.05, 33 * 2 * 1.05]);
  });
  it('apagado só por falta de F$ entra na lista (acende quando o dinheiro chega)', () => {
    tela.renderizar(B(), 0, false);
    linha(1).click();
    expect(tela.precos().map((p) => p.preco)).toEqual([1800 * 2, 3600 * 2, 33 * 2 * 1.05, 10 * 33 * 2 * 1.05, 33 * 2 * 1.05]);
  });
  it('no limite ou ocupado, os botões de compra ficam fora da lista do F$ (senão acenderiam sozinhos)', () => {
    tela.renderizar(B({ carteira: [{ empresa: 1, qtd: 120, custo: 3600 }] }), 1e9, false);
    linha(1).click();
    expect(tela.precos().map((p) => p.preco)).toEqual([1800 * 2, 3600 * 2]); // só as melhorias
    tela.renderizar(B(), 1e9, true);
    expect(tela.precos()).toEqual([]);
  });
  it('escolher outra empresa põe os botões novos do detalhe na lista do F$', () => {
    tela.renderizar(B(), 1e9, false);
    expect(tela.precos()).toHaveLength(2);
    linha(1).click();
    expect(tela.precos()).toHaveLength(5);
  });
  it('melhorias: nível atual, efeito e o próximo com o preço em F$ (segundos × r); no 5, No máximo', () => {
    tela.renderizar(B({ corretor: 1, escritorio: 5 }), 1e9, false);
    const corr = document.querySelector('.melhoria-bolsa[data-tipo="corretor"]')!;
    expect(corr.textContent).toContain('Primo que entende de ação');
    expect(corr.textContent).toContain('Corretagem 4%');
    const b = corr.querySelector('button')!;
    expect(b.textContent).toBe('Assessor do banco · F$ 7,2 mil'); // 3600 s × r 2
    b.click();
    expect(melhorar).toHaveBeenCalledWith('corretor', 2);
    const esc = document.querySelector('.melhoria-bolsa[data-tipo="escritorio"]')!;
    expect(esc.textContent).toContain('Torre na Berrini');
    expect(esc.textContent).toContain('No máximo');
    expect(esc.querySelector('button')).toBeNull();
    tela.renderizar(B({ corretor: 1 }), 100, false);
    expect(document.querySelector<HTMLButtonElement>('.melhoria-bolsa[data-tipo="corretor"] button')!.disabled).toBe(true);
  });
  it('sem trader: só o aviso pra abrir', () => {
    tela.renderizar(B({ aberta: false }), 1e9, false);
    expect(document.querySelector('.bolsa')!.textContent).toContain('Compra 1 Grupo de trader pra abrir a Bolsa');
    expect(document.querySelectorAll('.acao')).toHaveLength(0);
  });
  it('carregando: avisa', () => {
    tela.renderizar(null, 1e9, false);
    expect(document.querySelector('.bolsa')!.textContent).toContain('Carregando a Bolsa…');
  });
});
