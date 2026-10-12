// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { criarConvidadosTela } from './convidadosTela';

const AGORA = Date.parse('2026-10-14T18:00:00.000Z');
const gens = (ppp: number) => { const g = Array(30).fill(0); g[12] = ppp; return g; };
const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: '00000000-0000-0000-0000-00000000000a', generators: gens(30),
  convidados: { cadeira: [null, null, null], desde: [null, null, null], trocas: 3, trocas_t: null, ppp: 30, derrubada_ate: null },
  ...x,
}) as IdleState;
const sentar = vi.fn();
const tirar = vi.fn();
let tela: ReturnType<typeof criarConvidadosTela>;
beforeEach(() => {
  document.body.innerHTML = '';
  sentar.mockClear();
  tirar.mockClear();
  tela = criarConvidadosTela({ sentar, tirar });
  document.body.append(tela.elemento);
});
const botao = (texto: string, dentro: ParentNode = document) => [...dentro.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === texto)!;

describe('o estúdio', () => {
  it('sem PPP Podcast: só o aviso', () => {
    tela.renderizar(estado({ generators: gens(0) }), false, AGORA);
    expect(document.body.textContent).toContain('Compra 1 PPP Podcast pra abrir o estúdio');
  });
  it('3 cadeiras: a frente e o meio abertos com 30, o canto trancado (abre com 50); trocas 3/3', () => {
    tela.renderizar(estado(), false, AGORA);
    const cads = [...document.querySelectorAll('.conv-cadeira')];
    expect(cads).toHaveLength(3);
    expect(cads[2].classList.contains('trancada')).toBe(true);
    expect(cads[2].textContent).toContain('Abre com 50 PPP Podcasts');
    expect(document.querySelector('.conv-trocas')!.textContent).toBe('Trocas: 3/3');
  });
  it('chamar convidado abre a lista; sentar manda a cadeira e o convidado com o efeito daquela cadeira', () => {
    tela.renderizar(estado(), false, AGORA);
    botao('Chamar convidado', document.querySelectorAll('.conv-cadeira')[1]).click();
    const itens = [...document.querySelectorAll('.conv-item')];
    expect(itens).toHaveLength(11);
    expect(itens[0].textContent).toContain('produção +7,5%'); // Cristiano no meio
    botao('Sentar', itens[5]).click(); // Gabe
    expect(sentar).toHaveBeenCalledWith(1, 6);
  });
  it('convidado sentado: retrato, efeitos, Trocar e Tirar; quem já está numa cadeira aparece marcado na lista', () => {
    tela.renderizar(estado({ convidados: { cadeira: [1, null, null], desde: ['2026-10-14T17:00:00Z', null, null], trocas: 2, trocas_t: '2026-10-14T17:01:00Z', ppp: 30, derrubada_ate: null } }), false, AGORA);
    const frente = document.querySelector('.conv-cadeira')!;
    expect(frente.textContent).toContain('Cristiano Ronaldo');
    expect(frente.textContent).toContain('melhorias 10% mais caras');
    expect(document.querySelector('.conv-trocas')!.textContent).toBe('Trocas: 2/3 · próxima em 1 min');
    botao('Tirar', frente).click();
    expect(tirar).toHaveBeenCalledWith(0);
    botao('Chamar convidado', document.querySelectorAll('.conv-cadeira')[1]).click();
    expect(document.querySelector('.conv-item')!.textContent).toContain('Na cadeira da frente');
  });
  it('sem trocas: o Sentar apaga e diz quando volta', () => {
    tela.renderizar(estado({ convidados: { cadeira: [null, null, null], desde: [null, null, null], trocas: 0, trocas_t: '2026-10-14T17:30:00Z', ppp: 30, derrubada_ate: null } }), false, AGORA);
    expect(botao('Chamar convidado').disabled).toBe(true);
  });
});
