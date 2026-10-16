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
    expect(r.textContent).toBe('Preço novo em 0:10');
    tela.relogio(-200);
    expect(r.textContent).toBe('Preço novo em 0:00');
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
  it('a 1ª empresa já vem escolhida; comprar 1/10/Máx e vender 1/10/Tudo mandam o tick visto', () => {
    tela.renderizar(B(), 1e9, false);
    expect(document.querySelector('.bolsa-detalhe')!.getAttribute('data-empresa')).toBe('1');
    linha(1).click();
    const d = document.querySelector('.bolsa-detalhe')!;
    expect(d.textContent).toContain('Preço novo em 0:42');
    expect(d.querySelector('.bolsa-info')!.textContent).toContain('Você tem10 de 120');
    expect(d.querySelector('.conta-limite')!.textContent).toBe('Limite: 100 + 20 Food truck'); // Pastel ↔ Food truck
    const bts = [...d.querySelectorAll<HTMLButtonElement>('button')].map((b) => b.textContent);
    expect(bts).toEqual(['1', '10', 'Máx', '1', '10', 'Tudo']);
    [...d.querySelectorAll<HTMLButtonElement>('.comprar button')][2].click();
    [...d.querySelectorAll<HTMLButtonElement>('.vender button')][0].click();
    expect(negociar.mock.calls).toEqual([[1, 'comprar', 0, 1000], [1, 'vender', 1, 1000]]);
    linha(1).click(); // tocar de novo não fecha (sempre tem uma escolhida)
    expect(document.querySelector('.bolsa-detalhe')!.getAttribute('data-empresa')).toBe('1');
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
    expect(tela.precos().map((p) => p.preco)).toEqual([33 * 2 * 1.05, 10 * 33 * 2 * 1.05, 33 * 2 * 1.05, 1800 * 2, 3600 * 2]);
  });
  it('apagado só por falta de F$ entra na lista (acende quando o dinheiro chega)', () => {
    tela.renderizar(B(), 0, false);
    linha(1).click();
    expect(tela.precos().map((p) => p.preco)).toEqual([33 * 2 * 1.05, 10 * 33 * 2 * 1.05, 33 * 2 * 1.05, 1800 * 2, 3600 * 2]);
  });
  it('no limite ou ocupado, os botões de compra ficam fora da lista do F$ (senão acenderiam sozinhos)', () => {
    tela.renderizar(B({ carteira: [{ empresa: 1, qtd: 120, custo: 3600 }] }), 1e9, false);
    linha(1).click();
    expect(tela.precos().map((p) => p.preco)).toEqual([1800 * 2, 3600 * 2]); // só as melhorias
    tela.renderizar(B(), 1e9, true);
    expect(tela.precos()).toEqual([]);
  });
  it('no celular, tocar numa empresa leva até o detalhe (que fica embaixo da lista); no PC não', () => {
    const rolar = vi.fn();
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = rolar;
    const largura = window.innerWidth;
    tela.renderizar(B(), 1e9, false);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    linha(6).click();
    expect(rolar).not.toHaveBeenCalled();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    linha(1).click();
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(rolar.mock.contexts[0]).toBe(document.querySelector('.bolsa-detalhe'));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: largura });
  });
  it('escolher outra empresa põe os botões novos do detalhe na lista do F$', () => {
    tela.renderizar(B(), 1e9, false);
    expect(tela.precos()).toHaveLength(5);
    linha(6).click(); // quebrada: sem botões de compra, só as melhorias
    expect(tela.precos()).toHaveLength(2);
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
  it('com a árvore: os cartões e a conta do limite mostram a corretagem e o Escritório com os nós', () => {
    const empresas = B().empresas.map((e) => (e.id === 1 ? { ...e, limite: 142, limite_gen: 5 } : e));
    tela.renderizar(B({ corretor: 1, escritorio: 1, corretagem: 0.02, empresas }), 1e9, false, 1, false, { corretagem: 0.5, escritorio: 1.5 });
    const corr = document.querySelector('.melhoria-bolsa[data-tipo="corretor"]')!;
    expect(corr.textContent).toContain('Corretagem 2%'); // 4% × 0,5
    expect(corr.querySelector('button')!.getAttribute('aria-label')).toContain('Corretagem 1,5%'); // o próximo: 3% × 0,5
    const esc = document.querySelector('.melhoria-bolsa[data-tipo="escritorio"]')!;
    expect(esc.textContent).toContain('+37,5 ações em cada empresa'); // 25 × 1,5
    expect(esc.querySelector('button')!.getAttribute('aria-label')).toContain('+75 ações em cada empresa');
    expect(document.querySelector('.conta-limite')!.textContent).toBe('Limite: 100 + 5 Food truck + 25 ×1,5 do Escritório');
  });
  it('sem trader: só o aviso pra abrir', () => {
    tela.renderizar(B({ aberta: false }), 1e9, false);
    expect(document.querySelector('.bolsa')!.textContent).toContain('Compra 1 Grupo de trader pra abrir a Bolsa');
    expect(document.querySelectorAll('.acao')).toHaveLength(0);
  });
  it('escolher uma empresa lá embaixo não sobe a lista e o foco fica nela', () => {
    tela.renderizar(B(), 1e9, false);
    document.querySelector<HTMLElement>('.bolsa-lista')!.scrollTop = 180;
    linha(4).focus();
    linha(4).click();
    expect(document.querySelector<HTMLElement>('.bolsa-lista')!.scrollTop).toBe(180);
    expect(document.activeElement).toBe(linha(4));
    tela.renderizar(B(), 1e9, false); // o minuto virou: redesenha sem mexer na rolagem
    expect(document.querySelector<HTMLElement>('.bolsa-lista')!.scrollTop).toBe(180);
  });
  it('a rolagem do detalhe fica na mesma empresa e volta ao topo em outra', () => {
    tela.renderizar(B(), 1e9, false);
    linha(1).click();
    document.querySelector<HTMLElement>('.bolsa-detalhe')!.scrollTop = 90;
    tela.renderizar(B(), 1e9, false);
    expect(document.querySelector<HTMLElement>('.bolsa-detalhe')!.scrollTop).toBe(90);
    linha(4).click();
    expect(document.querySelector<HTMLElement>('.bolsa-detalhe')!.scrollTop).toBe(0);
  });
  it('carregando: avisa', () => {
    tela.renderizar(null, 1e9, false);
    expect(document.querySelector('.bolsa')!.textContent).toContain('Carregando a Bolsa…');
  });
});

describe('Convidados na Bolsa', () => {
  it('Vorcaro: o lote alavancado aparece separado, com o preço pago e os próprios botões de vender', () => {
    tela.renderizar(B({ carteira: [{ empresa: 1, qtd: 10, custo: 300, alavanca: 1 }, { empresa: 1, qtd: 4, custo: 120, alavanca: 2 }] }), 1e9, false, 2);
    linha(1).click();
    expect(linha(1).textContent).toContain('14 ações');
    const d = document.querySelector('.bolsa-detalhe')!;
    expect(d.textContent).toContain('entram alavancadas ×2 (Vorcaro)');
    const lote = d.querySelector<HTMLElement>('.lote[data-alavanca="2"]')!;
    expect(lote.textContent).toContain('Alavancadas ×2 · 4 ações · pagou F$ 60');
    expect(lote.textContent).toContain('vale F$ 288'); // 4 × (30 + 2 × (33 − 30)) × 2
    [...lote.querySelectorAll('button')].find((b) => b.textContent === 'Tudo')!.click();
    expect(negociar).toHaveBeenCalledWith(1, 'vender', 0, 1000, 2);
  });
  it('VSauce: o humor de cada empresa vira etiqueta (só quando vem do banco)', () => {
    tela.renderizar(B(), 1e9, false);
    expect(document.querySelector('.etq.humor')).toBeNull();
    tela.renderizar(B({ empresas: [{ id: 1, valor: 33, limite: 120, risco: false, rj_ate: null, historico: [33], humor: 3 }] }), 1e9, false);
    expect(linha(1).textContent).toContain('Subindo forte');
  });
});

describe('o Espiar (0076)', () => {
  const espiada = { id: 1, valor: 33, limite: 120, risco: false, rj_ate: null, historico: [33], humor: 3, espiada: true, muda_em: 7 };
  it('com crédito, a empresa escolhida ganha "Espiar (n)" com caixinha; espiada, mostra o humor e em quantos min muda', () => {
    const espiar = vi.fn();
    const dica = vi.fn();
    document.body.innerHTML = '';
    tela = criarBolsaTela({ negociar, melhorar, espiar }, dica);
    document.body.append(tela.elemento);
    tela.renderizar(B({ info_creditos: 2 }), 1e9, false);
    const bt = [...document.querySelectorAll<HTMLButtonElement>('.bolsa-detalhe button')].find((b) => b.textContent === 'Espiar (2)')!;
    bt.click();
    expect(espiar).toHaveBeenCalledWith(1);
    expect(dica).toHaveBeenCalledWith(bt, 'espiar-1', expect.any(Function));
    expect(dica.mock.calls[0][2]()).toMatchObject({ titulo: 'Espiar' });
    tela.renderizar(B({ info_creditos: 1, empresas: [espiada] }), 1e9, false);
    expect(document.querySelector('.humor-vsauce')!.textContent).toBe('Espiado: subindo forte agora · muda em 7 min');
    expect([...document.querySelectorAll('.bolsa-detalhe button')].some((b) => b.textContent?.startsWith('Espiar'))).toBe(false);
    tela.renderizar(B({ info_creditos: 0, empresas: [espiada] }), 1e9, false, 1, true);
    expect(document.querySelector('.humor-vsauce')!.textContent).toBe('VSauce: subindo forte agora. Ou não? · muda em 7 min');
  });
  it('sem crédito ou sem a ação ligada, sem botão', () => {
    tela.renderizar(B({ info_creditos: 0 }), 1e9, false);
    expect([...document.querySelectorAll('.bolsa-detalhe button')].some((b) => b.textContent?.startsWith('Espiar'))).toBe(false);
    tela.renderizar(B({ info_creditos: 3 }), 1e9, false); // a tela do beforeEach não tem `espiar`
    expect([...document.querySelectorAll('.bolsa-detalhe button')].some((b) => b.textContent?.startsWith('Espiar'))).toBe(false);
  });
  it('no minuto em que a empresa sai da recuperação o humor vira na hora: o Espiar fica apagado (não gasta crédito à toa), com a caixinha dizendo por quê', () => {
    const espiar = vi.fn();
    const dica = vi.fn();
    document.body.innerHTML = '';
    tela = criarBolsaTela({ negociar, melhorar, espiar }, dica);
    document.body.append(tela.elemento);
    const esp = () => [...document.querySelectorAll<HTMLButtonElement>('.bolsa-detalhe button')].find((b) => b.textContent?.startsWith('Espiar'));
    const textosDica = (bt: HTMLElement) => (dica.mock.calls.filter((c) => c[0] === bt).at(-1)![2]() as { linhas: { texto: string }[] }).linhas.map((l) => l.texto);
    tela.renderizar(B({ info_creditos: 2 }), 1e9, false);
    linha(6).click();
    expect(esp()).toBeUndefined(); // quebrada: sem Espiar
    const saiu = (tick: number) => B({ tick, info_creditos: 2, empresas: [{ id: 6, valor: 5, limite: 100, risco: false, rj_ate: null, historico: [5] }] });
    tela.renderizar(saiu(1007), 1e9, false);
    // apagado sem `disabled`: o foco do teclado e o mouse ainda chegam na caixinha que explica
    const apagado = esp()!;
    expect(apagado.disabled).toBe(false);
    expect(apagado.getAttribute('aria-disabled')).toBe('true');
    apagado.click();
    expect(espiar).not.toHaveBeenCalled();
    expect(textosDica(apagado)).toContain('Acabou de voltar da recuperação: o humor vira neste minuto. Espia no próximo');
    tela.renderizar(saiu(1008), 1e9, false);
    const aceso = esp()!;
    expect(aceso.hasAttribute('aria-disabled')).toBe(false);
    expect(textosDica(aceso)).not.toContain('Acabou de voltar da recuperação: o humor vira neste minuto. Espia no próximo');
    aceso.click();
    expect(espiar).toHaveBeenCalledWith(6);
  });
});
