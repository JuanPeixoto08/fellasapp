import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo } from './catalogo';
import {
  alturaBarra, avisos, contextoArvore, criarFilaAvisos, descricaoNo, detectarNovas, dicaConquista, escalaMinima, falta, faltam, ganhouEm, grade, liberadoNo,
  MUNDO_ARVORE, GEOMETRIA_ARVORE, ANEIS_ARVORE, limitarZoom, nivelNo, posicaoRotulo, progressoRamo, raioAnelTela, ZOOM_ABRIR, ZOOM_MAX, ZOOM_MIN, noInicial, ondeNo, pontos, portao, POSICOES_ARVORE, precoNo, RAMOS_ARVORE, ROTULOS_ARVORE, situacao, situacaoTela,
  textoVenda, TOTAL_CONQUISTAS, type ContextoArvore,
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
    expect(g.find((c) => c.conquista.id === 7)).toMatchObject({
      ganhou: true, texto: 'Cem estagiários pagos em "experiência". A princesa Isabel ficaria decepcionada.', feito: 'Ter 100 "Estagiário"', em: EM,
    });
    expect(g.find((c) => c.conquista.id === 101)).toMatchObject({ ganhou: true, nome: '6-7', texto: 'Seis sete. Ninguém sabe por quê.' });
  });
  it('bloqueada não tem "feito"; a caixinha (PC) diz o que é: frase, o que precisou e a data; ou o que falta', () => {
    const g = grade(estado({ conquistas: [{ id: 7, em: '2026-10-13T02:30:00.000Z' }], descobertas: [102] }));
    expect(g.find((c) => c.conquista.id === 1)!.feito).toBeNull();
    expect(dicaConquista(g.find((c) => c.conquista.id === 7)!)).toEqual({
      titulo: 'Estágio não remunerado em escala',
      linhas: [
        { texto: 'Cem estagiários pagos em "experiência". A princesa Isabel ficaria decepcionada.' },
        { texto: '✓ Feito: Ter 100 "Estagiário"', tom: 'bom' },
        { texto: 'Ganhou em 12/10/2026 · +1% de produção', tom: 'fraco' },
      ],
    });
    expect(dicaConquista(g.find((c) => c.conquista.id === 1)!)).toEqual({
      titulo: 'Cem abas abertas',
      linhas: [{ texto: 'Ter 100 "Você, no notebook da faculdade"' }, { texto: 'Vale +1% de produção', tom: 'fraco' }],
    });
    expect(dicaConquista(g.find((c) => c.conquista.id === 102)!)).toEqual({ titulo: '???', linhas: [{ texto: 'Alguém do grupo conseguiu', tom: 'fraco' }] });
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
    expect(avisos([101, 999, 1])).toEqual([
      { id: 101, nome: '6-7', frase: 'Seis sete. Ninguém sabe por quê.' },
      { id: 1, nome: 'Cem abas abertas', frase: 'Cem abas, zero vagas aplicadas. Seu pai já desistiu de você em silêncio.' },
    ]);
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
  it('um de cada vez, 5 s cada, e depois some', () => {
    vi.useFakeTimers();
    const vistos: (string | null)[] = [];
    const fila = criarFilaAvisos<string>((t) => vistos.push(t));
    fila.adicionar(['Conquista: 6-7', 'Conquista: Exit']);
    expect(vistos).toEqual(['Conquista: 6-7']);
    fila.adicionar(['Conquista: Black Friday']);
    vi.advanceTimersByTime(4999);
    expect(vistos).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(vistos.at(-1)).toBe('Conquista: Exit');
    vi.advanceTimersByTime(5000);
    expect(vistos.at(-1)).toBe('Conquista: Black Friday');
    vi.advanceTimersByTime(5000);
    expect(vistos.at(-1)).toBeNull();
    fila.adicionar([]);
    expect(vistos.at(-1)).toBeNull();
  });
  it('parar limpa o que está na tela, a fila e os timers', () => {
    vi.useFakeTimers();
    const vistos: (string | null)[] = [];
    const fila = criarFilaAvisos<string>((t) => vistos.push(t));
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
    expect(avisos([1, 2, 3, 4, 5])).toEqual([{ id: null, nome: '5 conquistas novas!', frase: 'Olha no Legado.' }]);
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
  it('a raiz e os 10 ramos, na ordem do catálogo, com 10 nós e o infinito cada', () => {
    expect(RAMOS_ARVORE.map((r) => [r.nome, r.nos.length])).toEqual([
      ['Raiz', 1], ['Produção', 11], ['Recomeço', 11], ['Oportunidades', 11], ['Dourados', 11], ['Gente', 11], ['Horta', 11],
      ['Bolsa', 11], ['PPP Podcast', 11], ['Mapa do rolê', 11], ['Espaço', 11],
    ]);
    for (const r of RAMOS_ARVORE.slice(1)) expect(r.nos.map((n) => n.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it('comprado, disponível (tem o que o nó pede; a ponte pede os dois nós 5) ou trancado', () => {
    const no = (id: number) => catalogo.arvore.find((n) => n.id === id)!;
    expect(situacao(no(1), [])).toBe('disponivel');
    expect(situacao(no(11), [])).toBe('trancado');
    expect(situacao(no(11), [1])).toBe('disponivel');
    expect(situacao(no(12), [1])).toBe('trancado');
    expect(situacao(no(11), [1, 11])).toBe('comprado');
    expect(liberadoNo(no(2005), [25])).toBe(false);
    expect(liberadoNo(no(2005), [25, 15])).toBe(true);
    expect(falta(no(12))).toBe('Libera com Cafezinho de garrafa térmica');
    expect(falta(no(11))).toBe('Libera com Virou MEI');
    expect(falta(no(2005))).toBe('Libera com Material escolar completo e O hexa vem');
    expect(falta(no(1))).toBe('');
  });
});

const noDe = (id: number) => catalogo.arvore.find((n) => n.id === id)!;
const ctx = (x: Partial<ContextoArvore> = {}): ContextoArvore => ({ arvore: [], niveis: {}, pontos: 0, vendas: 0, eraMax: 1, ...x });

describe('nível, preço e portão', () => {
  it('nível: 0 sem o nó; 1 no fixo; o do banco no infinito (resposta velha, sem niveis: 1)', () => {
    expect(nivelNo(noDe(11), ctx())).toBe(0);
    expect(nivelNo(noDe(11), ctx({ arvore: [1, 11] }))).toBe(1);
    expect(nivelNo(noDe(3001), ctx({ arvore: [3001], niveis: { 3001: 7 } }))).toBe(7);
    expect(nivelNo(noDe(3001), ctx({ arvore: [3001] }))).toBe(1);
  });
  it('preço: o custo; no infinito, round(1000 · 1,6^nível de agora)', () => {
    expect(precoNo(noDe(106), ctx())).toBe(14);
    expect(precoNo(noDe(3001), ctx())).toBe(1000);
    expect(precoNo(noDe(3001), ctx({ arvore: [3001] }))).toBe(1600);
    expect(precoNo(noDe(3001), ctx({ arvore: [3001], niveis: { 3001: 9 } }))).toBe(68719);
    expect(precoNo(noDe(3001), ctx({ arvore: [3001], niveis: { 3001: 19 } }))).toBe(7555786);
  });
  it('portão: vendas, era alcançada ou o recurso; null quando passou', () => {
    expect(portao(noDe(106), ctx({ vendas: 1 }))).toBe('Falta: 3 vendas (você tem 1)');
    expect(portao(noDe(106), ctx({ vendas: 3 }))).toBeNull();
    expect(portao(noDe(108), ctx({ eraMax: 6 }))).toBe('Falta: chegar na era 7 (você chegou na 6)');
    expect(portao(noDe(1001), ctx({ eraMax: 5 }))).toBe('Falta: chegar na era 6 (você chegou na 5)');
    expect(portao(noDe(701), ctx({ eraMax: 3 }))).toBe('Abre com a Bolsa');
    expect(portao(noDe(801), ctx({ eraMax: 2 }))).toBe('Abre com os Convidados');
    expect(portao(noDe(901), ctx({ eraMax: 1 }))).toBe('Abre com o Mapa do rolê');
    expect(portao(noDe(901), ctx({ eraMax: 2 }))).toBeNull();
    expect(portao(noDe(2001), ctx({ vendas: 4 }))).toBe('Falta: 5 vendas (você tem 4)');
    expect(portao(noDe(3003), ctx({ vendas: 9 }))).toBe('Falta: 10 vendas (você tem 9)');
  });
  it('o contexto do estado: era_max que falta (resposta velha) é a era de agora; niveis que falta é vazio', () => {
    const c = contextoArvore(estado({ era: 4, vendas: 2, pontos: 9, bonus: { arvore: [1], conquistas: 0 } }));
    expect(c).toEqual({ arvore: [1], niveis: {}, pontos: 9, vendas: 2, eraMax: 4 });
    expect(contextoArvore(estado({ era: 1, era_max: 7 })).eraMax).toBe(7);
  });
});

describe('árvore em tela cheia: a constelação', () => {
  const L = MUNDO_ARVORE.largura;
  const C = L / 2;
  const ordem = [6, 9, 5, 8, 2, 1, 10, 3, 7, 4];
  const polar = (id: number) => { const [x, y] = POSICOES_ARVORE[id]; return { r: Math.hypot(x - C, y - C), a: Math.atan2(y - C, x - C) }; };
  const difAng = (a: number, b: number) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
  const anguloRamo = (ramo: number) => polar(catalogo.arvore.find((n) => n.ramo === ramo && n.posicao === 1)!.id).a;
  const maior = (id: number) => { const n = noDe(id); return n.posicao >= 10 || n.ramo === 11; };

  it('as 120 posições existem (nem uma a mais) e o mundo é quadrado, com folga de 26', () => {
    const ids = Object.keys(POSICOES_ARVORE).map(Number).sort((a, b) => a - b);
    expect(ids).toEqual(catalogo.arvore.map((n) => n.id).sort((a, b) => a - b));
    expect(ids).toHaveLength(120);
    expect(MUNDO_ARVORE.altura).toBe(L);
    for (const [x, y] of Object.values(POSICOES_ARVORE)) {
      expect(x).toBeGreaterThanOrEqual(26);
      expect(x).toBeLessThanOrEqual(L - 26);
      expect(y).toBeGreaterThanOrEqual(26);
      expect(y).toBeLessThanOrEqual(L - 26);
    }
  });
  it('a raiz está no centro exato', () => {
    expect(POSICOES_ARVORE[1]).toEqual([C, C]);
  });
  it('nenhum nó encosta no outro: centros a 64 ou mais; o nó 10, o infinito e a ponte (maiores) a 84 ou mais', () => {
    const ids = Object.keys(POSICOES_ARVORE).map(Number);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [POSICOES_ARVORE[ids[i]], POSICOES_ARVORE[ids[j]]];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        expect(d, `${ids[i]} × ${ids[j]}`).toBeGreaterThanOrEqual(maior(ids[i]) || maior(ids[j]) ? 84 : 64);
      }
    }
  });
  it('o raio cresce ao longo do ramo e todos os nós do ramo ficam no mesmo ângulo', () => {
    for (const n of catalogo.arvore) {
      if (n.ramo === 0 || n.ramo === 11) continue;
      if (n.requer !== null && n.requer !== 1) expect(polar(n.id).r, `${n.id} × ${n.requer}`).toBeGreaterThan(polar(n.requer).r);
      expect(Math.abs(difAng(polar(n.id).a, anguloRamo(n.ramo))), `ângulo ${n.id}`).toBeLessThan(0.02);
    }
  });
  it('os ramos seguem a ordem da copa no sentido horário, em passos iguais, Recomeço e Produção simétricos em volta do topo', () => {
    for (let k = 1; k < ordem.length; k++) {
      expect(difAng(anguloRamo(ordem[k]), anguloRamo(ordem[k - 1]))).toBeCloseTo((2 * Math.PI) / 10, 1);
      expect(Math.abs(difAng(anguloRamo(ordem[k]), anguloRamo(ordem[k - 1])) - (2 * Math.PI) / 10)).toBeLessThan(0.02);
    }
    const topo = -Math.PI / 2;
    const a = difAng(anguloRamo(2), topo);
    const b = difAng(anguloRamo(1), topo);
    expect(a).toBeLessThan(0);
    expect(b).toBeGreaterThan(0);
    expect(Math.abs(a + b)).toBeLessThan(0.02);
  });
  it('cada ponte fica no ângulo médio (arco menor) dos dois ramos e meio passo além do nó 5', () => {
    const pontes = catalogo.arvore.filter((n) => n.ramo === 11);
    expect(pontes).toHaveLength(9);
    for (const p of pontes) {
      const ra = noDe(p.requer!).ramo;
      const rb = noDe(p.requer2!).ramo;
      const medio = anguloRamo(ra) + difAng(anguloRamo(rb), anguloRamo(ra)) / 2;
      expect(Math.abs(difAng(polar(p.id).a, medio)), `ponte ${p.id}`).toBeLessThan(0.02);
      expect(Math.abs(polar(p.id).r - (polar(p.requer!).r + GEOMETRIA_ARVORE.passoR / 2))).toBeLessThan(1.5);
    }
  });
  it('o nome de cada ramo fica depois do infinito, no ângulo do ramo, na ordem da copa, sem se sobrepor', () => {
    expect(ROTULOS_ARVORE.map((r) => r.nome)).toEqual(['Horta', 'Mapa do rolê', 'Gente', 'PPP Podcast', 'Recomeço', 'Produção', 'Espaço', 'Oportunidades', 'Bolsa', 'Dourados']);
    expect(ROTULOS_ARVORE.map((r) => r.ramo)).toEqual(ordem);
    for (const r of ROTULOS_ARVORE) {
      const rr = Math.hypot(r.x - C, r.y - C);
      expect(rr).toBeGreaterThan(polar(3000 + r.ramo).r);
      expect(Math.abs(difAng(Math.atan2(r.y - C, r.x - C), anguloRamo(r.ramo)))).toBeLessThan(0.02);
      for (const o of ROTULOS_ARVORE) if (o !== r) expect(Math.hypot(o.x - r.x, o.y - r.y), `${r.nome} × ${o.nome}`).toBeGreaterThanOrEqual(64);
    }
  });
  it('o anel da era 7 passa por fora de todos os nós e por dentro dos rótulos', () => {
    const a7 = ANEIS_ARVORE.find((a) => a.era === 7)!;
    expect(a7.rotulo).toBe('Era 7');
    for (const id of Object.keys(POSICOES_ARVORE).map(Number)) expect(a7.raio).toBeGreaterThan(polar(id).r);
    for (const r of ROTULOS_ARVORE) expect(a7.raio).toBeLessThan(Math.hypot(r.x - C, r.y - C));
  });
  it('zoom: o mínimo faz a copa inteira caber no palco (nunca abaixo de ZOOM_MIN nem acima de 1); o zoom fica entre o mínimo e 1,4', () => {
    expect(escalaMinima(L, L + 300)).toBe(1);
    expect(escalaMinima(4000, 4000)).toBe(1);
    expect(escalaMinima(390, 560)).toBeCloseTo(390 / L, 12); // o celular: a constelação inteira na largura
    expect(L * escalaMinima(390, 560)).toBeLessThanOrEqual(390);
    expect(L * escalaMinima(1138, 600)).toBeLessThanOrEqual(600); // o PC (2000×961): a altura manda
    expect(escalaMinima(100, 100)).toBe(ZOOM_MIN);
    expect(limitarZoom(3, 0.3)).toBe(ZOOM_MAX);
    expect(limitarZoom(0.05, 0.3)).toBe(0.3);
    expect(limitarZoom(0.8, 0.3)).toBe(0.8);
    expect(ZOOM_MAX).toBe(1.4);
    expect(52 * ZOOM_ABRIR).toBeGreaterThanOrEqual(32); // ao abrir, o nó tem 32 px ou mais no celular
  });
  it('o anel na tela passa por fora do texto embaixo dos nós de fora (preço, nível), em qualquer zoom com rótulo', () => {
    const a7 = ANEIS_ARVORE.find((a) => a.era === 7)!;
    const maisFora = Math.max(...Object.keys(POSICOES_ARVORE).map((id) => polar(Number(id)).r));
    for (const k of [0.8, 1, 1.4]) {
      expect(raioAnelTela(a7, k)).toBeGreaterThanOrEqual(a7.raio * k);
      expect(raioAnelTela(a7, k)).toBeGreaterThanOrEqual(maisFora * k + 106); // o losango (38) + 2 + o nível e o preço pra fora (até 66)
    }
    // longe (sem etiquetas): o anel do mundo, dentro do quadrado (a constelação inteira cabe no zoom mínimo)
    for (const k of [0.1, 0.2, 0.3]) {
      expect(raioAnelTela(a7, k)).toBe(a7.raio * k);
      expect(raioAnelTela(a7, k)).toBeLessThan((L / 2) * k);
    }
    expect(raioAnelTela(a7, 0.5)).toBeGreaterThanOrEqual(maisFora * 0.5 + 36); // o cadeado ainda aparece
    expect(raioAnelTela(a7, 0.4)).toBeLessThan((L / 2) * 0.4); // e o anel ainda cabe no quadrado
  });
  it('o nome de cada ramo na tela fica todo por fora do anel (a linha nunca cruza o texto) e um não encosta no outro', () => {
    const a7 = ANEIS_ARVORE.find((a) => a.era === 7)!;
    for (const k of [0.8, 1, 1.4]) {
      for (const [w, h] of [[40, 20], [140, 20]]) {
        const caixas = ROTULOS_ARVORE.map((r) => posicaoRotulo(r.ramo, k, w, h));
        caixas.forEach((p, i) => {
          // o ponto da caixa mais perto do centro do mundo (na tela)
          const c = (L / 2) * k;
          const nx = Math.max(p.x - w / 2, Math.min(c, p.x + w / 2));
          const ny = Math.max(p.y - h / 2, Math.min(c, p.y + h / 2));
          expect(Math.hypot(nx - c, ny - c), `${ROTULOS_ARVORE[i].nome} k=${k} w=${w}`).toBeGreaterThanOrEqual(raioAnelTela(a7, k) + 8);
          // no ângulo do ramo
          expect(Math.abs(difAng(Math.atan2(p.y - c, p.x - c), anguloRamo(ROTULOS_ARVORE[i].ramo)))).toBeLessThan(0.02);
          for (const o of caixas) {
            if (o === p) continue;
            const separa = Math.abs(o.x - p.x) >= w || Math.abs(o.y - p.y) >= h;
            expect(separa, `${ROTULOS_ARVORE[i].nome} encosta`).toBe(true);
          }
        });
      }
    }
  });
  it('barrinhas do quadro: os 10 nós fixos de cada ramo; as do meio mais altas', () => {
    expect(progressoRamo(1, ctx({ arvore: [1, 11, 12, 106, 3001] }))).toEqual({ comprados: 3, total: 10 });
    expect(progressoRamo(7, ctx({ arvore: [701, 702] }))).toEqual({ comprados: 2, total: 10 });
    expect(alturaBarra(0)).toBeCloseTo(0.55, 12);
    expect(alturaBarra(9)).toBeCloseTo(0.55, 12);
    expect(alturaBarra(4)).toBeGreaterThan(alturaBarra(1));
    expect(alturaBarra(4)).toBeCloseTo(alturaBarra(5), 12);
  });
  it('situação na tela: comprado, dá pra comprar, falta ponto, portão, trancado; o infinito comprado segue comprável', () => {
    expect(situacaoTela(noDe(1), ctx({ arvore: [1] }))).toBe('comprado');
    expect(situacaoTela(noDe(11), ctx({ arvore: [1], pontos: 2 }))).toBe('pode');
    expect(situacaoTela(noDe(11), ctx({ arvore: [1], pontos: 1 }))).toBe('falta');
    expect(situacaoTela(noDe(12), ctx({ arvore: [1], pontos: 99 }))).toBe('trancado');
    expect(situacaoTela(noDe(1), ctx())).toBe('falta');
    expect(situacaoTela(noDe(106), ctx({ arvore: [1, 11, 12, 13, 14, 15], pontos: 99, vendas: 2 }))).toBe('portao');
    expect(situacaoTela(noDe(106), ctx({ arvore: [1, 11, 12, 13, 14, 15], pontos: 99, vendas: 3 }))).toBe('pode');
    const cheio = ctx({ arvore: [3001], niveis: { 3001: 2 }, vendas: 10 });
    expect(situacaoTela(noDe(3001), { ...cheio, pontos: 2560 })).toBe('pode');
    expect(situacaoTela(noDe(3001), { ...cheio, pontos: 2559 })).toBe('falta');
  });
  it('nó inicial: o mais barato que dá pra comprar; senão o mais barato liberado; senão a raiz', () => {
    expect(noInicial(ctx({ pontos: 5 }))).toBe(1);
    expect(noInicial(ctx())).toBe(1);
    expect(noInicial(ctx({ arvore: [1], pontos: 3 }))).toBe(11);
    expect(noInicial(ctx({ arvore: [1, 11], pontos: 3 }))).toBe(21);
    expect(noInicial(ctx({ arvore: [1, 11], pontos: 1 }))).toBe(21);
    expect(noInicial(ctx({ arvore: [1], pontos: 9, eraMax: 4 }))).toBe(11); // a Bolsa 1 custa 8: o 11 (2) vem antes
    // tudo comprado: sobram os infinitos (1.600 o próximo nível), o de menor id
    expect(noInicial(ctx({ arvore: catalogo.arvore.map((n) => n.id), pontos: 99, vendas: 99, eraMax: 7 }))).toBe(3001);
  });
  it('textos: onde fica, quanto falta e a descrição pro leitor de tela', () => {
    expect(ondeNo(noDe(1))).toBe('Raiz');
    expect(ondeNo(noDe(12))).toBe('Produção · 2 de 10');
    expect(ondeNo(noDe(707))).toBe('Bolsa · 7 de 10');
    expect(ondeNo(noDe(3008))).toBe('PPP Podcast · infinito');
    expect(ondeNo(noDe(2003))).toBe('Ponte · Gente e PPP Podcast');
    expect(faltam(1)).toBe('Falta 1 ★');
    expect(faltam(5)).toBe('Faltam 5 ★');
    const c = ctx({ pontos: 3, vendas: 1 });
    expect(descricaoNo(noDe(11), 'comprado', c)).toBe('Cafezinho de garrafa térmica, comprado');
    expect(descricaoNo(noDe(21), 'pode', c)).toBe('Porquinho quebrado, dá pra comprar por 2 ★');
    expect(descricaoNo(noDe(13), 'falta', c)).toBe('Turno dobrado, faltam 5 ★');
    expect(descricaoNo(noDe(14), 'trancado', c)).toBe('Tema da Vitória, trancado');
    expect(descricaoNo(noDe(106), 'portao', c)).toBe('Coach quântico, falta: 3 vendas (você tem 1)');
    expect(descricaoNo(noDe(3001), 'falta', ctx({ arvore: [3001], niveis: { 3001: 4 }, pontos: 6000 }))).toBe('Hora extra infinita, nível 4, faltam 554 ★');
  });
});
