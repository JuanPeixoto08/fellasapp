import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo } from './catalogo';
import {
  avisos, criarFilaAvisos, descricaoNo, detectarNovas, escalaArvore, falta, faltam, ganhouEm, grade, MUNDO_ARVORE, noInicial, ondeNo,
  pontos, POSICOES_ARVORE, RAMOS_ARVORE, ROTULOS_ARVORE, situacao, situacaoTela, textoVenda, TOTAL_CONQUISTAS,
} from './legado';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10, promo_ate: null, viral: [],
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
  ...x,
});
const EM = '2026-10-12T15:00:00.000Z';

describe('grade de conquistas', () => {
  it('sem nenhuma: só as visíveis, bloqueadas, com a condição', () => {
    const g = grade(estado());
    expect(g).toHaveLength(catalogo.conquistas.filter((c) => !c.escondida).length);
    expect(g.every((c) => !c.ganhou && !c.conquista.escondida)).toBe(true);
    expect(g[6]).toMatchObject({ nome: 'Estágio não remunerado em escala', texto: 'Ter 100 "Estagiário"', em: null });
  });
  it('ganha: a frase e a data; escondida que você tem aparece com o nome', () => {
    const g = grade(estado({ conquistas: [{ id: 7, em: EM }, { id: 101, em: EM }], descobertas: [101] }));
    expect(g.find((c) => c.conquista.id === 7)).toMatchObject({ ganhou: true, texto: 'Cem estagiários, uma cafeteira.', em: EM });
    expect(g.find((c) => c.conquista.id === 101)).toMatchObject({ ganhou: true, nome: '6-7', texto: 'Seis sete. Ninguém sabe por quê.' });
  });
  it('escondida que alguém do grupo tem e você não: ???; que ninguém tem: não aparece', () => {
    const g = grade(estado({ descobertas: [102] }));
    expect(g.find((c) => c.conquista.id === 102)).toMatchObject({ ganhou: false, nome: '???', texto: 'Alguém do grupo conseguiu' });
    expect(g.find((c) => c.conquista.id === 103)).toBeUndefined();
  });
  it('conquista que a página não conhece (o banco é mais novo) fica de fora', () => {
    expect(grade(estado({ conquistas: [{ id: 999, em: EM }] })).some((c) => c.conquista.id === 999)).toBe(false);
  });
  it('total = todas as do catálogo, escondidas inclusive', () => {
    expect(TOTAL_CONQUISTAS).toBe(catalogo.conquistas.length);
  });
});

describe('textos', () => {
  it('aviso por conquista nova; id desconhecido some', () => {
    expect(avisos([101, 999, 1])).toEqual(['Conquista: 6-7', 'Conquista: Cem abas abertas']);
  });
  it('venda e pontos no singular e no plural', () => {
    expect(pontos(1)).toBe('1 ponto');
    expect(pontos(5)).toBe('5 pontos');
    expect(textoVenda(1)).toBe('Você ganha 1 ponto pra gastar na árvore e recomeça do zero.');
    expect(textoVenda(12)).toBe('Você ganha 12 pontos pra gastar na árvore e recomeça do zero.');
  });
  it('data no dia de Brasília', () => {
    expect(ganhouEm('2026-10-13T02:30:00.000Z')).toBe('Ganhou em 12/10/2026');
  });
});

describe('fila de avisos', () => {
  afterEach(() => vi.useRealTimers());
  it('um de cada vez, 3 s cada, e depois some', () => {
    vi.useFakeTimers();
    const vistos: (string | null)[] = [];
    const fila = criarFilaAvisos((t) => vistos.push(t));
    fila.adicionar(['Conquista: 6-7', 'Conquista: Exit']);
    expect(vistos).toEqual(['Conquista: 6-7']);
    fila.adicionar(['Conquista: Black Friday']);
    vi.advanceTimersByTime(2999);
    expect(vistos).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(vistos.at(-1)).toBe('Conquista: Exit');
    vi.advanceTimersByTime(3000);
    expect(vistos.at(-1)).toBe('Conquista: Black Friday');
    vi.advanceTimersByTime(3000);
    expect(vistos.at(-1)).toBeNull();
    fila.adicionar([]);
    expect(vistos.at(-1)).toBeNull();
  });
  it('parar limpa o que está na tela, a fila e os timers', () => {
    vi.useFakeTimers();
    const vistos: (string | null)[] = [];
    const fila = criarFilaAvisos((t) => vistos.push(t));
    fila.adicionar(['A', 'B']);
    fila.parar();
    expect(vistos).toEqual(['A', null]);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(vistos).toEqual(['A', null]);
    fila.adicionar(['C']); // continua utilizável
    expect(vistos.at(-1)).toBe('C');
  });
});

describe('avisos em lote', () => {
  it('até 3: um por conquista; mais de 3: um aviso só', () => {
    expect(avisos([7, 101, 1])).toHaveLength(3);
    expect(avisos([1, 2, 3, 4, 5])).toEqual(['5 conquistas novas! Olha no Legado.']);
    expect(avisos([])).toEqual([]);
  });
});

describe('detectarNovas (o que avisar ao recarregar)', () => {
  it('primeira carga: só as novas da chamada, não o histórico', () => {
    const e = estado({ conquistas: [{ id: 1, em: EM }, { id: 2, em: EM }], novas: [2] });
    expect(detectarNovas(null, e)).toEqual({ ids: [2], conhecidas: [1, 2] });
  });
  it('depois: avisa a que apareceu sem estar nas novas (ser contratado, Pai tá on) e não repete', () => {
    const e = estado({ conquistas: [{ id: 1, em: EM }, { id: 9, em: EM }, { id: 4, em: EM }], novas: [4] });
    const r = detectarNovas([1], e);
    expect(r.ids).toEqual([4, 9]);
    expect(detectarNovas(r.conhecidas, e).ids).toEqual([]);
  });
});

describe('árvore', () => {
  it('a raiz e os 5 ramos, na ordem, com 5 nós cada', () => {
    expect(RAMOS_ARVORE.map((r) => [r.nome, r.nos.length])).toEqual([
      ['Raiz', 1], ['Produção', 5], ['Recomeço', 5], ['Oportunidades', 5], ['Tempo', 5], ['Gente', 5],
    ]);
  });
  it('comprado, disponível (o anterior é seu) ou trancado (falta o anterior)', () => {
    const no = (id: number) => catalogo.arvore.find((n) => n.id === id)!;
    expect(situacao(no(1), [])).toBe('disponivel');
    expect(situacao(no(11), [])).toBe('trancado');
    expect(situacao(no(11), [1])).toBe('disponivel');
    expect(situacao(no(12), [1])).toBe('trancado');
    expect(situacao(no(11), [1, 11])).toBe('comprado');
    expect(falta(no(12))).toBe('Libera com Cafezinho de garrafa térmica');
    expect(falta(no(11))).toBe('Libera com Virou MEI');
    expect(falta(no(1))).toBe('');
  });
});

const noDe = (id: number) => catalogo.arvore.find((n) => n.id === id)!;

describe('árvore em tela cheia: a copa', () => {
  it('as 26 posições existem e cabem no mundo com folga de 26', () => {
    const ids = Object.keys(POSICOES_ARVORE).map(Number).sort((a, b) => a - b);
    expect(ids).toEqual(catalogo.arvore.map((n) => n.id).sort((a, b) => a - b));
    for (const [x, y] of Object.values(POSICOES_ARVORE)) {
      expect(x).toBeGreaterThanOrEqual(26);
      expect(x).toBeLessThanOrEqual(MUNDO_ARVORE.largura - 26);
      expect(y).toBeGreaterThanOrEqual(26);
      expect(y).toBeLessThanOrEqual(MUNDO_ARVORE.altura - 26);
    }
  });
  it('nenhum nó encosta no outro: centros a 64 ou mais', () => {
    const pos = Object.values(POSICOES_ARVORE);
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        expect(Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1])).toBeGreaterThanOrEqual(64);
      }
    }
  });
  it('a raiz embaixo de tudo e cada ramo subindo', () => {
    const yRaiz = POSICOES_ARVORE[1][1];
    for (const n of catalogo.arvore) if (n.id !== 1) expect(POSICOES_ARVORE[n.id][1]).toBeLessThan(yRaiz);
    for (const n of catalogo.arvore) {
      if (n.requer !== null && n.requer !== 1) expect(POSICOES_ARVORE[n.id][1]).toBeLessThan(POSICOES_ARVORE[n.requer][1]);
    }
  });
  it('o nome de cada ramo fica 44 acima do 5º nó, dentro do mundo', () => {
    expect(ROTULOS_ARVORE.map((r) => r.nome)).toEqual(['Produção', 'Recomeço', 'Oportunidades', 'Tempo', 'Gente']);
    for (const r of ROTULOS_ARVORE) {
      const quinto = catalogo.arvore.find((n) => n.posicao === 5 && POSICOES_ARVORE[n.id][0] === r.x)!;
      expect(r.y).toBe(POSICOES_ARVORE[quinto.id][1] - 44);
      expect(r.y).toBeGreaterThanOrEqual(8);
    }
  });
  it('escala: cabe no lado mais apertado, presa entre 0,85 e 1,4', () => {
    expect(escalaArvore(400, 540)).toBe(1);
    expect(escalaArvore(2000, 2000)).toBe(1.4);
    expect(escalaArvore(300, 800)).toBe(0.85);
    expect(escalaArvore(380, 900)).toBeCloseTo(0.95, 10);
  });
  it('situação na tela: comprado, dá pra comprar, falta ponto, trancado', () => {
    expect(situacaoTela(noDe(1), [1], 0)).toBe('comprado');
    expect(situacaoTela(noDe(11), [1], 2)).toBe('pode');
    expect(situacaoTela(noDe(11), [1], 1)).toBe('falta');
    expect(situacaoTela(noDe(12), [1], 99)).toBe('trancado');
    expect(situacaoTela(noDe(1), [], 0)).toBe('falta');
  });
  it('nó inicial: o mais barato que dá pra comprar; senão o mais barato liberado; senão a raiz', () => {
    expect(noInicial([], 5)).toBe(1);
    expect(noInicial([], 0)).toBe(1);
    expect(noInicial([1], 3)).toBe(11);
    expect(noInicial([1, 11], 3)).toBe(21);
    expect(noInicial([1, 11], 1)).toBe(21);
    expect(noInicial(catalogo.arvore.map((n) => n.id), 99)).toBe(1);
  });
  it('textos: onde fica, quanto falta e a descrição pro leitor de tela', () => {
    expect(ondeNo(noDe(1))).toBe('Raiz');
    expect(ondeNo(noDe(12))).toBe('Produção · 2 de 5');
    expect(faltam(1)).toBe('Falta 1 ★');
    expect(faltam(5)).toBe('Faltam 5 ★');
    expect(descricaoNo(noDe(11), 'comprado', 0)).toBe('Cafezinho de garrafa térmica, comprado');
    expect(descricaoNo(noDe(21), 'pode', 3)).toBe('Porquinho quebrado, dá pra comprar por 2 ★');
    expect(descricaoNo(noDe(13), 'falta', 3)).toBe('Turno dobrado, faltam 5 ★');
    expect(descricaoNo(noDe(14), 'trancado', 3)).toBe('Tema da Vitória, trancado');
  });
});
