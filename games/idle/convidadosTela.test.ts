// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { criarConvidadosTela, dicaConvidado } from './convidadosTela';

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
  it('o estúdio: os retratos nos lugares, a placa com o nome e a luz AO VIVO quando tem alguém sentado', () => {
    tela.renderizar(estado(), false, AGORA);
    expect(document.querySelector('.estudio')!.classList.contains('no-ar')).toBe(false);
    tela.renderizar(estado({ convidados: { cadeira: [1, null, null], desde: ['2026-10-14T17:00:00Z', null, null], trocas: 2, trocas_t: '2026-10-14T17:01:00Z', ppp: 30, derrubada_ate: null } }), false, AGORA);
    expect(document.querySelector('.estudio')!.classList.contains('no-ar')).toBe(true);
    expect(document.querySelector('.estudio-placa.frente')!.textContent).toBe('Cristiano Ronaldo');
    expect(document.querySelectorAll('.estudio-eq')).toHaveLength(1);
  });
  it('chamar convidado abre a seleção em grade; o destaque mostra o efeito naquela cadeira e o Sentar', () => {
    tela.renderizar(estado(), false, AGORA);
    botao('Chamar convidado', document.querySelectorAll('.conv-cadeira')[0]).click(); // os cartões vão meio, frente, canto
    const tiles = [...document.querySelectorAll<HTMLButtonElement>('.conv-tile')];
    expect(tiles).toHaveLength(11);
    expect(document.querySelector('.conv-detalhe')!.textContent).toContain('Produção +7,5%'); // Cristiano no meio
    tiles[5].click(); // Gabe
    botao('Sentar no meio', document.querySelector('.conv-detalhe')!).click();
    expect(sentar).toHaveBeenCalledWith(1, 6);
  });
  it('convidado sentado: efeitos, Trocar e Tirar; na seleção ele aparece marcado com a cadeira', () => {
    tela.renderizar(estado({ convidados: { cadeira: [1, null, null], desde: ['2026-10-14T17:00:00Z', null, null], trocas: 2, trocas_t: '2026-10-14T17:01:00Z', ppp: 30, derrubada_ate: null } }), false, AGORA);
    const frente = document.querySelectorAll('.conv-cadeira')[1]; // meio, frente, canto
    expect(frente.textContent).toContain('Cristiano Ronaldo');
    expect(frente.textContent).toContain('Melhorias 10% mais caras');
    expect(document.querySelector('.conv-trocas')!.textContent).toBe('Trocas: 2/3 · próxima em 1 min');
    botao('Tirar', frente).click();
    expect(tirar).toHaveBeenCalledWith(0);
    botao('Chamar convidado', document.querySelectorAll('.conv-cadeira')[0]).click();
    const cr = document.querySelector('.conv-tile[data-convidado="1"]')!;
    expect(cr.classList.contains('sentado')).toBe(true);
    expect(cr.textContent).toContain('Frente');
  });
  it('sem trocas: o Sentar apaga e diz quando volta', () => {
    tela.renderizar(estado({ convidados: { cadeira: [null, null, null], desde: [null, null, null], trocas: 0, trocas_t: '2026-10-14T17:30:00Z', ppp: 30, derrubada_ate: null } }), false, AGORA);
    expect(botao('Chamar convidado').disabled).toBe(true);
  });
});

describe('com a árvore grande (0082): a tela mostra os números que o banco mandou', () => {
  const arv = { trocas_max: 5, recarga_s: 1800, pesos: [1, 0.75, 0.5], queda: 0.05, efeito: 0.4 };
  it('trocas 5/5, 5 fichas e a força das cadeiras (meio 75%, canto 50%)', () => {
    tela.renderizar(estado({ generators: gens(50), convidados: { cadeira: [null, null, null], desde: [null, null, null], trocas: 5, trocas_t: null, ppp: 50, derrubada_ate: null, ...arv } }), false, AGORA);
    expect(document.querySelector('.conv-trocas')!.textContent).toBe('Trocas: 5/5');
    expect(document.querySelectorAll('.ficha')).toHaveLength(5);
    const rotulos = [...document.querySelectorAll('.conv-rotulo')].map((r) => r.textContent);
    expect(rotulos).toEqual(['Meio · 75%', 'Frente · 100%', 'Canto · 50%']);
  });
  it('a próxima troca volta na recarga do banco (30 min)', () => {
    tela.renderizar(estado({ generators: gens(50), convidados: { cadeira: [null, null, null], desde: [null, null, null], trocas: 3, trocas_t: '2026-10-14T17:45:00Z', ppp: 50, derrubada_ate: null, ...arv } }), false, AGORA);
    expect(document.querySelector('.conv-trocas')!.textContent).toBe('Trocas: 3/5 · próxima em 15 min');
  });
  it('o cartão e a caixinha de quem está sentado dizem o efeito e a derrubada de agora', () => {
    const desde = '2026-10-13T12:00:00Z';
    tela.renderizar(estado({ generators: gens(50), convidados: { cadeira: [1, 5, 9], desde: [desde, desde, desde], trocas: 5, trocas_t: null, ppp: 50, derrubada_ate: null, ...arv } }), false, AGORA);
    const cartoes = [...document.querySelectorAll('.conv-cadeira')].map((c) => c.textContent!);
    expect(cartoes[1]).toContain('Produção +21%'); // Cristiano na frente: 15% × 1,4
    expect(cartoes[0]).toContain('Produção sobe até +45% em 24 h sentado'); // Kojima no meio (75%): (40% + 50% × 0,4) × 0,75
    expect(cartoes[2]).toContain('5% de derrubada');
    const d = dicaConvidado(5, 0.75, 1, null, arv);
    expect(d.linhas.map((l) => l.texto)).toContain('Produção sobe até +45% em 24 h sentado');
    expect(d.linhas.at(-1)!.texto).toBe('Na cadeira do meio (75%)');
  });
});
