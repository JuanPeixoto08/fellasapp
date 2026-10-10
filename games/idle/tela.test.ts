// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { IdleState } from '../shared/types';
import { instante, VALIDADE_S } from './oportunidades';
import { criarTela, prazo, type Acoes, type Modelo } from './tela';

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
    const g = [...Array(13).fill(1), ...Array(17).fill(0)];
    tela.renderizar(modelo({ estado: estado({ era: 3, generators: g, strategies: [0, -1, -1, -1] }) }));
    const modal = root.querySelector('.modal-estrategia')!;
    expect(modal.hasAttribute('hidden')).toBe(false);
    expect(modal.textContent).toContain('Chega com o Mapa do rolê');
    [...modal.querySelectorAll('button')].find((b) => b.textContent === 'Escolher' && !b.disabled)!.click();
    expect(acoes.escolher).toHaveBeenCalledWith(3, 0);
  });
  it('aviso aparece; caixinha mostra quantas tem', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aviso: 'Valuation não cobre essa compra', pendentes: [3, 2] }));
    expect(root.querySelector('.notice')!.textContent).toContain('Valuation não cobre essa compra');
    expect(root.querySelector('.caixinha')!.textContent).toBe('Oportunidades (2)');
  });
  it('caixinha: uma linha por oportunidade com o boneco, o prazo e Pegar; X fecha; sem pega no dia, botões apagados', () => {
    vi.useFakeTimers();
    const uid = '00000000-0000-0000-0000-00000000000a';
    vi.setSystemTime(instante(uid, 50) + 60 * 60 * 1000); // 1h depois de a janela 50 aparecer
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ caixaAberta: true, pendentes: [50], estado: estado({ user_id: uid }) }));
    const linha = root.querySelector('.modal-caixa .escolha')!;
    expect((linha.querySelector('.boneco') as HTMLElement).style.backgroundImage).toContain('url(');
    expect(linha.querySelector('.prazo')!.textContent).toBe('some em 3h00');
    linha.querySelector('button')!.click();
    expect(acoes.pegar).toHaveBeenCalledWith(50);
    root.querySelector<HTMLButtonElement>('.modal-caixa .fechar')!.click();
    expect(acoes.caixa).toHaveBeenCalledWith(false);
    tela.renderizar(modelo({ caixaAberta: true, pendentes: [50], estado: estado({ user_id: uid, opp_left: 0 }) }));
    expect(root.querySelector('.modal-caixa')!.textContent).toContain('Já pegou todas de hoje. Amanhã tem mais.');
    expect(root.querySelector<HTMLButtonElement>('.modal-caixa .escolha button')!.disabled).toBe(true);
    vi.useRealTimers();
  });
  it('prazo: horas com minutos, minutos, menos de 1 min', () => {
    expect(prazo(VALIDADE_S * 1000)).toBe('some em 4h00');
    expect(prazo((3 * 60 + 12) * 60000)).toBe('some em 3h12');
    expect(prazo(40 * 60000)).toBe('some em 40 min');
    expect(prazo(30000)).toBe('some em menos de 1 min');
  });
  it('melhorias: Compradas mostra as que você já tem, da mais recente pra mais antiga, sem botão de compra', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'melhorias', estado: estado({ upgrades: [1001, 1002] }) }));
    porTexto('Compradas (2)').click();
    const itens = [...root.querySelectorAll('.lista-melhorias .melhoria')];
    expect(itens.map((x) => x.querySelector('strong')!.textContent)).toEqual(['Wi-Fi do vizinho', 'Café coado na hora']);
    expect(itens.every((x) => !x.querySelector('.btn'))).toBe(true);
    expect(porTexto('Compradas (2)').getAttribute('aria-pressed')).toBe('true');
    porTexto(root.querySelector('.seg button')!.textContent!).click();
    expect(root.querySelector('.lista-melhorias')!.textContent).not.toContain('Wi-Fi do vizinho');
  });
  it('placar mostra o R$/s de cada um, não o valuation', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: [{ userId: 'b', name: 'Bia', valuation: 9e9, rate: 1234.5, era: 3, strategies: [0, -1, -1, -1] }] }));
    const v = root.querySelector('.lista-placar .v')!.textContent!;
    expect(v).toContain('/s');
    expect(v).not.toContain('bi');
    expect(root.querySelector('.lista-placar .sub')!.textContent).toBe('Era 3 · Escritório');
  });
  it('placar ainda não carregado: Carregando…', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: null }));
    const lista = root.querySelector('.lista-placar')!;
    expect(lista.hasAttribute('hidden')).toBe(false);
    expect(lista.textContent).toBe('Carregando…');
  });
  it('fatal: botão de tentar de novo, sem o Entrar', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'carregando', estado: null }));
    tela.fatal('Deu ruim');
    const overlay = root.querySelector<HTMLElement>('.overlay')!;
    expect(overlay.hasAttribute('hidden')).toBe(false);
    expect(overlay.textContent).toContain('Deu ruim');
    expect([...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Tentar de novo')!.hasAttribute('hidden')).toBe(false);
    expect(overlay.querySelector('a')!.hasAttribute('hidden')).toBe(true);
  });
  it('sem sessão: Entrar, sem o tentar de novo do fatal', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'sem_sessao', estado: null }));
    const overlay = root.querySelector<HTMLElement>('.overlay')!;
    expect(overlay.querySelector('a')!.hasAttribute('hidden')).toBe(false);
    expect(overlay.querySelector('button')!.hasAttribute('hidden')).toBe(true);
  });
  it('modais com aria-modal e título', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ estado: estado({ era: 2, generators: [1, 1, 1, 1, 1, 1, 1, ...Array(23).fill(0)] }), caixaAberta: true }));
    for (const sel of ['.modal-estrategia', '.modal-caixa']) {
      const modal = root.querySelector(sel)!;
      expect(modal.getAttribute('aria-modal')).toBe('true');
      expect(root.querySelector(`#${modal.getAttribute('aria-labelledby')}`)!.tagName).toBe('H2');
    }
  });
});
