import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo } from './catalogo';
import { avisos, criarFilaAvisos, falta, ganhouEm, grade, pontos, RAMOS_ARVORE, situacao, textoVenda, TOTAL_CONQUISTAS } from './legado';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
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
