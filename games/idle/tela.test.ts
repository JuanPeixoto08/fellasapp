// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { IdleState } from '../shared/types';
import { criarTela, type Acoes, type Modelo } from './tela';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
  server_now: '2026-10-12T12:00:00.000Z', ...x,
});
const modelo = (x: Partial<Modelo> = {}): Modelo => ({
  fase: 'jogando', estado: estado(), aba: 'geradores', placar: null, aviso: null, ocupado: false, pendentes: [], aoVivo: null, caixaAberta: false, ...x,
});

let acoes: { [K in keyof Acoes]: Mock<Acoes[K]> };
let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  acoes = {
    abrirCnpj: vi.fn<Acoes['abrirCnpj']>(), comprar: vi.fn<Acoes['comprar']>(), escolher: vi.fn<Acoes['escolher']>(), pegar: vi.fn<Acoes['pegar']>(),
    trocarAba: vi.fn<Acoes['trocarAba']>(), caixa: vi.fn<Acoes['caixa']>(), tentarDeNovo: vi.fn<Acoes['tentarDeNovo']>(),
  };
});
const porTexto = (texto: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === texto)!;

describe('tela da Fellas Inc.', () => {
  it('antes: só o Abrir CNPJ', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    porTexto('Abrir CNPJ').click();
    expect(acoes.abrirCnpj).toHaveBeenCalled();
    expect(root.querySelector('.lista-geradores')!.hasAttribute('hidden')).toBe(true);
  });
  it('lista o gerador 1 e o próximo trancado; botão libera quando o valor chega no preço', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const linhas = root.querySelectorAll('.gerador');
    expect(linhas).toHaveLength(3); // 1 (tem), 2 (liberado: tem o 1), 3 (trancado)
    expect(linhas[2].textContent).toContain('Compra 1 "Post motivacional no LinkedIn" pra liberar');
    const comprar1 = linhas[0].querySelector<HTMLButtonElement>('button[data-qtd="1"]')!;
    tela.atualizarValor(17);
    expect(comprar1.disabled).toBe(true);
    tela.atualizarValor(17.25);
    expect(comprar1.disabled).toBe(false);
    comprar1.click();
    expect(acoes.comprar).toHaveBeenCalledWith('gerador', 1, 1);
  });
  it('era nova sem estratégia: cartões, os desligados avisam o porquê', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ estado: estado({ era: 2, generators: [1, 1, 1, 1, 1, 1, 1, ...Array(23).fill(0)] }) }));
    const modal = root.querySelector('.modal-estrategia')!;
    expect(modal.hasAttribute('hidden')).toBe(false);
    expect(modal.textContent).toContain('Chega com Contratar');
    [...modal.querySelectorAll('button')].find((b) => b.textContent === 'Escolher' && !b.disabled)!.click();
    expect(acoes.escolher).toHaveBeenCalledWith(2, 0);
  });
  it('aviso aparece; caixinha mostra quantas tem', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aviso: 'Valuation não cobre essa compra', pendentes: [3, 2] }));
    expect(root.querySelector('.notice')!.textContent).toContain('Valuation não cobre essa compra');
    expect(root.querySelector('.caixinha')!.textContent).toBe('Oportunidades (2)');
  });
});
