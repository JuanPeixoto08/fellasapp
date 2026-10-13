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
  it('a grade 6 × 6: abertos os do tamanho dos Food trucks, cada um dizendo o que tem; o resto com cadeado', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA);
    expect(document.querySelectorAll('.canteiro[data-canteiro]')).toHaveLength(4);
    expect(document.querySelectorAll('.canteiro.tranc')).toHaveLength(32);
    expect(canteiro(0).getAttribute('aria-label')).toBe('Canteiro 1: Pé de Pix, madura');
    expect(canteiro(1).getAttribute('aria-label')).toBe('Canteiro 2: Couve do Coach, muda');
    expect(canteiro(6).getAttribute('aria-label')).toBe('Canteiro 3: vazio');
    expect(document.querySelector('.horta-prox')!.textContent).toBe('Tem 3 Food trucks · faltam 22');
    expect(document.querySelector('.horta-legenda')!.textContent).toContain('Abre com 25 Food trucks');
  });
  it('resumo dos bônus e a coleção (com a dica quando os pais já foram descobertos)', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA);
    const linhas = [...document.querySelectorAll('.horta-bonus-agora .linha-bonus')].map((l) => l.textContent);
    expect(linhas).toEqual(['Produção+1%', 'Geradores—', 'Melhorias—', 'Oportunidades—']);
    expect(document.querySelector('.horta-colecao-cab')!.textContent).toContain('Coleção 2/8');
    const itens = [...document.querySelectorAll('.colecao-item')];
    expect(itens[0].textContent).toContain('Pé de Pix');
    expect(itens[3].textContent).toBe('???');
    expect(itens[3].getAttribute('title')).toBe('Nasce perto de Pé de Pix e Couve do Coach');
    const dicas = document.querySelector('.horta-dicas')!.textContent;
    expect(dicas).toContain('Nasce perto de Pé de Pix e Couve do Coach');
    expect(dicas).toContain('Tem gente que jura que viu');
    expect(dicas).not.toContain('Inhame'); // a dica não entrega o nome
  });
  it('com o Agrotóxico liberado (×1,5), o cartão e as sementes dizem o bônus da pessoa', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA, [], 1.5);
    expect(document.querySelector('.horta-cartao .bom')!.textContent).toBe('Produção +1,5%');
    const sementes = [...document.querySelectorAll('.semente .bom')].map((x) => x.textContent);
    expect(sementes).toEqual(['Produção +1,5%', 'Geradores 1,5% mais baratos']);
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA);
    expect(document.querySelector('.horta-cartao .bom')!.textContent).toBe('Produção +1%');
  });
  it('canteiro vazio: as sementes descobertas com preço; plantar manda canteiro e espécie', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA);
    canteiro(6).click();
    expect(document.querySelector('.horta-cartao')!.textContent).toContain('Canteiro 3 vazio');
    expect(document.querySelector('.horta-sementes .rot2')!.textContent).toBe('Plantar no canteiro 3');
    const bts = [...document.querySelectorAll<HTMLButtonElement>('.horta-sementes .semente')];
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
    expect([...document.querySelectorAll<HTMLButtonElement>('.horta-sementes .semente')].every((b) => b.disabled)).toBe(true);
  });
  it('a lista do F$: as sementes que só dependem do dinheiro', () => {
    tela.renderizar(HORTA(), 2, 0, false, AGORA);
    canteiro(6).click();
    expect(tela.precos().map((p) => p.preco)).toEqual([1200, 1200]);
  });
  it('com planta no escolhido, a semente vai no primeiro canteiro vazio', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA);
    canteiro(0).click();
    expect(document.querySelector('.horta-sementes .rot2')!.textContent).toBe('Plantar no canteiro 3 (o primeiro vazio)');
    document.querySelector<HTMLButtonElement>('.horta-sementes .semente[data-especie="1"]')!.click();
    expect(plantar).toHaveBeenCalledWith(6, 1);
  });
  it('horta cheia: sem canteiro vazio, as sementes ficam apagadas e fora da lista do F$', () => {
    const cheia = [0, 1, 6, 7].map((c) => ({ canteiro: c, especie: 1, inicio: em(2 * H), origem: 'plantada' as const }));
    tela.renderizar(HORTA({ plantas: cheia }), 2, 1e9, false, AGORA);
    expect(document.querySelector('.horta-sementes .rot2')!.textContent).toBe('Sem canteiro vazio pra plantar');
    expect([...document.querySelectorAll<HTMLButtonElement>('.horta-sementes .semente')].every((b) => b.disabled)).toBe(true);
    expect(tela.precos()).toEqual([]);
  });
  it('no 6 × 6 não tem cadeado nem a legenda do próximo tamanho', () => {
    tela.renderizar(HORTA({ lado: 6, food_trucks: 250 }), 2, 1e9, false, AGORA);
    expect(document.querySelectorAll('.canteiro.tranc')).toHaveLength(0);
    expect(document.querySelector('.horta-prox')!.textContent).toBe('Horta no tamanho máximo');
    expect(document.querySelector('.horta-legenda')!.textContent).not.toContain('Abre com');
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
  it('o Terry e o Vini sentados aparecem do lado, com o efeito deles', () => {
    tela.renderizar(HORTA(), 2, 1e9, false, AGORA, [{ retrato: null, titulo: 'Terry na frente', bonus: 'Plantas novas amadurecem 30% mais rápido', defeito: 'E vivem 20% menos' }]);
    const chip = document.querySelector('.horta-chip')!;
    expect(chip.textContent).toContain('Terry na frente');
    expect(chip.textContent).toContain('E vivem 20% menos');
  });
});
