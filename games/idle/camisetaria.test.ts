import { describe, expect, it } from 'vitest';

import {
  caderno, comentario, CORES, duracao, gostou, CRESCE, custoLote, focoDaNota, liberaTextos, repeticao, distanciaFoco, FAS_TETO, fasExcesso, fasNota, podeFiar, PRECO_MULT, PUBLICO_BASE, ESTILOS, INFLUENCERS, LIBERA, liberado, nomeSugerido, notas, pctProcura, PECAS, pecasLote,
  pecaTema, pesoVenda, precoPeca, precoRelatorio, procura, producaoMs, publico, rotulo, TEMAS, tendencia, VENDA_MS, vendidoAte,
  type Lancamento,
} from './camisetaria';
import { semanaIdx } from './mapa';

const H = 3600_000;
const MIN = 60_000;

describe('o catálogo da camisetaria', () => {
  it('contagens: 30 temas, 15 estilos, 6 peças, 12 cores, 4 influencers', () => {
    expect([TEMAS.length, ESTILOS.length, PECAS.length, CORES.length, INFLUENCERS.length]).toEqual([30, 15, 6, 12, 4]);
    expect(INFLUENCERS.map((i) => i.nome)).toEqual(['@hojetemjp', '@SuperMauro64', '@mcresenha', '@luisviton']);
  });

  it('LIBERA cobre 48 itens sem repetir; cada id fora do começo aparece uma vez', () => {
    const todos = Object.values(LIBERA).flat();
    expect(todos.length).toBe(48);
    expect(new Set(todos).size).toBe(48);
    expect(Object.keys(LIBERA).map(Number)).toEqual(Array.from({ length: 24 }, (_, k) => k + 2));
    const fora = [
      ...TEMAS.filter((t) => t.id > 6).map((t) => `tema:${t.id}`), ...ESTILOS.filter((e) => e.id > 3).map((e) => `estilo:${e.id}`),
      ...PECAS.filter((p) => p.id > 2).map((p) => `peca:${p.id}`), ...CORES.filter((c) => c.id > 4).map((c) => `cor:${c.id}`),
    ];
    expect([...todos].sort()).toEqual([...fora].sort());
  });

  it('liberado e nivel de cada item saem do LIBERA', () => {
    expect(liberado('tema', 6, 1)).toBe(true);
    expect(liberado('tema', 7, 1)).toBe(false);
    expect(liberado('tema', 7, 2)).toBe(true);
    expect(liberado('estilo', 15, 24)).toBe(false);
    expect(liberado('estilo', 15, 25)).toBe(true);
    expect(liberado('peca', 6, 19)).toBe(true);
    expect(liberado('cor', 12, 22)).toBe(false);
    expect(liberado('cor', 12, 23)).toBe(true);
    expect(TEMAS[29].nivel).toBe(25);
    expect(TEMAS[0].nivel).toBe(1);
  });
});

describe('rótulo, peça e foco', () => {
  it('rotulo da spec', () => {
    expect(rotulo(15, 14)).toBe(4);
    expect(rotulo(5, 14)).toBe(0);
    expect(rotulo(10, 8)).toBe(4);
  });
  it('pecaTema', () => {
    expect(pecaTema(6, 15)).toBe(1);
    expect(pecaTema(6, 2)).toBe(-1);
    expect(pecaTema(1, 2)).toBe(0);
  });
  it('distanciaFoco', () => {
    expect(distanciaFoco(1, [3, 5, 2])).toBe(0);
    expect(distanciaFoco(1, [10, 0, 0])).toBe(7);
  });
});

const base = (o: Partial<Lancamento> = {}): Lancamento => ({
  id: 2, tema: 2, estilo: 7, peca: 3, cor: 3, foco: [3, 5, 2], lote: 1, nivel: 5, fas: 0, tendencia: 9, ultimas: [{ tema: 2, estilo: 5 }], ...o,
});

describe('notas', () => {
  it('caso feito à mão', () => {
    // Praia(2) + Tie-dye(7): vibes em comum = {praia} -> 1; conflitos 0; v = ((2*31+7*17) mod 3) - 1 = (181 mod 3) - 1 = 0
    //   s = 2*1 - 0 + 0 = 2 -> boa (3) -> 75.
    // Regata(3) gosta de praia -> +10. Foco [3,5,2] vs Tie-dye [2,6,2]: (1+1+0)/2 = 1 -> -3.
    // Repetição: o tema (2) é igual ao da última (2,5) -> -10. Tendência é 9, não 2 -> 0.
    // base10 = 75 + 10 - 3 - 10 = 72.
    // sorte10_i = ((2*7919 + i*104729) mod 11) - 5; 15838 mod 11 = 9; 104729 mod 11 = 9 -> i=1..4: 18,27,36,45 mod 11 = 7,5,3,1 -> 2,0,-2,-4.
    // gosto: hojetemjp 0 | Mauro +1 (cor Amarelo é forte) | mcresenha -1 (não é Futebol) | luisviton -1 (boa, sem bônus).
    // total10 = 72+0+2=74 ; 72+10+0=82 ; 72-10-2=60 ; 72-10-4=58 -> floor((t+5)/10) = 7, 8, 6, 6.
    expect(notas(base())).toEqual([7, 8, 6, 6]);
  });

  it('repetição: -2 se (tema, estilo) igual a uma das 3 últimas, -1 se só tema ou estilo igual à última', () => {
    const l = base({ ultimas: [], cor: 1 });
    // base10 = 75+10-3 = 82; hojetemjp: total10 = 82+2 = 84 -> 8. Com -20: 64 -> 6. Com -10: 74 -> 7.
    expect(notas(l)[0]).toBe(8);
    expect(notas({ ...l, ultimas: [{ tema: 9, estilo: 9 }, { tema: 2, estilo: 7 }] })[0]).toBe(6);
    expect(notas({ ...l, ultimas: [{ tema: 2, estilo: 1 }] })[0]).toBe(7);
    expect(notas({ ...l, ultimas: [{ tema: 9, estilo: 7 }] })[0]).toBe(7);
    // só a última conta para o -10: tema igual a uma anterior (não a última) não pesa
    expect(notas({ ...l, ultimas: [{ tema: 9, estilo: 9 }, { tema: 2, estilo: 1 }] })[0]).toBe(8);
  });

  it('tendência dá +1 no tema e +1 extra no @hojetemjp', () => {
    const l = base({ ultimas: [], cor: 1 });
    const a = notas(l);
    const b = notas({ ...l, tendencia: 2 });
    // total10 do hojetemjp: 84 -> 94 e +10 do gosto = 104 -> 10 (limite); os outros: +10
    expect(a).toEqual([8, 8, 7, 7]);
    expect(b).toEqual([10, 9, 8, 8]);
  });

  it('@luisviton: +1 só com combinação ótima e foco <= 1, senão -1', () => {
    // Caveira(15)+Gótico(14) = ótima; Moletom(6) gosta de caveira (+10); id 1 -> sorte do luisviton (i=4) = -3.
    // foco [4,4,2] (dist 0): base10 = 90+10 = 100; gosto +1: 100+10-3 = 107 -> 10.
    // foco [5,3,2] (dist 1): base10 = 97; gosto +1: 97+10-3 = 104 -> 10 (com gosto 0 daria 94 -> 9: distingue).
    // foco [6,2,2] (dist 2): base10 = 94; gosto -1: 94-10-3 = 81 -> 8.
    const o = base({ id: 1, tema: 15, estilo: 14, peca: 6, cor: 1, ultimas: [], tendencia: 9 });
    expect(notas({ ...o, foco: [4, 4, 2] })[3]).toBe(10);
    expect(notas({ ...o, foco: [5, 3, 2] })[3]).toBe(10);
    expect(notas({ ...o, foco: [6, 2, 2] })[3]).toBe(8);
  });

  it('@mcresenha: +2 no Futebol de várzea, -1 no resto; notas ficam em 1..10', () => {
    const f = notas(base({ tema: 3, ultimas: [] }));
    const o = notas(base({ tema: 2, ultimas: [] }));
    // Futebol(3)+Tie-dye(7): comum 0, conflito fofo-bruto 1 -> s = -2 + (((93+119) mod 3) - 1) = -1 -> ruim (40); Regata gosta de esporte +10;
    //   dist 1 -> -3; base10 = 47; mcresenha +2 e sorte -2: 47+20-2 = 65 -> 7.
    // Praia(2)+Tie-dye(7) (caso à mão acima, sem repetição): base10 = 82; -1 e sorte -2: 82-10-2 = 70 -> 7. Sem o +2 do Futebol seria 5.
    expect(f[2]).toBe(7);
    expect(o[2]).toBe(7);
    expect(notas(base({ tema: 3, ultimas: [], peca: 1 }))[2]).toBe(notas(base({ tema: 3, ultimas: [], peca: 1, cor: 1 }))[2]);
    for (let id = 1; id < 200; id++) for (const n of notas(base({ id, tema: 1 + (id % 30) }))) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(10);
    }
  });
});

describe('lote, procura e preço', () => {
  it('pecasLote e publico crescem com o nível', () => {
    expect(pecasLote(1, 0)).toBe(12);
    expect(pecasLote(1, 1)).toBe(36);
    expect(pecasLote(1, 2)).toBe(84);
    expect(pecasLote(5, 1)).toBe(Math.round(12 * CRESCE ** 4) * 3);
    expect(publico(1)).toBe(PUBLICO_BASE);
    expect(publico(3)).toBeCloseTo(PUBLICO_BASE * CRESCE ** 2, 9);
  });
  it('as constantes (0069: o lote cresce 1,32; o banco copia em idle_tee_const)', () => {
    expect([PUBLICO_BASE, CRESCE, PRECO_MULT, FAS_TETO]).toEqual([75, 1.32, 6.5, 3]);
  });
  it('procura e pctProcura', () => {
    const l = base({ fas: 900, nivel: 1, peca: 1 });
    // 900 fãs: √900/30 = 1 -> bônus 2
    expect(procura(l, [10, 10, 10, 10])).toBeCloseTo(PUBLICO_BASE * 1 * 2 * 1, 9);
    expect(procura(l, [5, 5, 5, 5])).toBeCloseTo(PUBLICO_BASE * 0.25 * 2, 9);
    expect(pctProcura(l, [10, 10, 10, 10])).toBeCloseTo(((PUBLICO_BASE * 2) / 36) * 100, 9);
  });
  it('o bônus de fãs para em 4× (√fãs/30 até 3)', () => {
    // √8100/30 = 3 (no teto); √1e10/30 passaria de 3000 e fica em 3
    expect(procura(base({ fas: 8100, nivel: 1, peca: 1 }), [10, 10, 10, 10])).toBeCloseTo(PUBLICO_BASE * 4, 9);
    expect(procura(base({ fas: 1e10, nivel: 1, peca: 1 }), [10, 10, 10, 10])).toBeCloseTo(PUBLICO_BASE * 4, 9);
  });
  it('fãs pela nota: nada abaixo de 7; 10% do público do nível por ponto acima de 6, arredondado', () => {
    expect(fasNota(6.75, 1)).toBe(0);
    expect(fasNota(7, 1)).toBe(Math.round(PUBLICO_BASE * 0.1));
    expect(fasNota(9.5, 1)).toBe(Math.round(PUBLICO_BASE * 0.1 * 3.5));
    expect(fasNota(10, 5)).toBe(Math.round(publico(5) * 0.4));
  });
  it('fãs do excesso: metade da sobra, até 20% do público do nível', () => {
    expect(fasExcesso(30, 36, 1)).toBe(0);
    expect(fasExcesso(40, 36, 1)).toBeCloseTo(2, 9);
    expect(fasExcesso(1000, 36, 1)).toBeCloseTo(PUBLICO_BASE * 0.2, 9);
    expect(fasExcesso(1e9, 36, 3)).toBeCloseTo(publico(3) * 0.2, 9);
  });
  it('o fornecedor fia o lote pequeno uma vez a cada 24 h, só sem coleção e sem cupom', () => {
    const t = Date.UTC(2026, 9, 12, 12);
    expect(podeFiar(true, 10, 24, null, t)).toBe(true);
    expect(podeFiar(false, 10, 24, null, t)).toBe(false);
    expect(podeFiar(true, 24, 24, null, t)).toBe(false);
    expect(podeFiar(true, 10, 24, t - 24 * H + 1, t)).toBe(false);
    expect(podeFiar(true, 10, 24, t - 24 * H, t)).toBe(true);
  });
  it('custo, preço, produção, relatório', () => {
    expect(custoLote(1, 1, 1)).toBe(3 * 36);
    expect(precoPeca(1)).toBeCloseTo(3 * PRECO_MULT, 9);
    expect([producaoMs(0), producaoMs(1), producaoMs(2)]).toEqual([2 * MIN, 5 * MIN, 10 * MIN]);
    expect(VENDA_MS).toBe(30 * MIN);
    expect([duracao(2 * MIN), duracao(30 * MIN), duracao(H), duracao(90 * MIN)]).toEqual(['2 min', '30 min', '1 h', '1 h 30 min']);
    expect(precoRelatorio(1)).toBe(50);
    expect(precoRelatorio(3)).toBeCloseTo(50 * CRESCE ** 2, 9);
  });
});

describe('venda no tempo', () => {
  // 2026-10-12 é segunda. Sexta 16/10 18h de Brasília = 21h UTC.
  const sexta18 = Date.UTC(2026, 9, 16, 21);
  const segunda10 = Date.UTC(2026, 9, 12, 13);
  it('peso 1 fora das janelas; 2 dentro; janelas sex 18h-sáb 2h e sáb 18h-dom 2h', () => {
    expect(pesoVenda(segunda10, segunda10 + 5 * H)).toBe(5 * H);
    expect(pesoVenda(sexta18, sexta18 + 8 * H)).toBe(16 * H);
    expect(pesoVenda(sexta18 - H, sexta18 + H)).toBe(3 * H);
    expect(pesoVenda(sexta18 + 8 * H, sexta18 + 24 * H)).toBe(16 * H); // sáb 2h até sáb 18h: peso 1
    expect(pesoVenda(sexta18 + 24 * H, sexta18 + 32 * H)).toBe(16 * H); // sáb 18h até dom 2h
    expect(pesoVenda(sexta18 + 32 * H, sexta18 + 33 * H)).toBe(H);
    expect(pesoVenda(sexta18 + 31 * H, sexta18 + 33 * H)).toBe(3 * H); // dom 1h-3h: 1h de show (peso 2) + 1h normal
  });
  it('vendidoAte: 0 no início, total no fim, proporcional no meio, preso nos extremos', () => {
    expect(vendidoAte(100, segunda10, segunda10)).toBe(0);
    expect(vendidoAte(100, segunda10, segunda10 + 15 * MIN)).toBeCloseTo(50, 9);
    expect(vendidoAte(100, segunda10, segunda10 + VENDA_MS)).toBeCloseTo(100, 9);
    expect(vendidoAte(100, segunda10, segunda10 + 99 * H)).toBeCloseTo(100, 9);
    expect(vendidoAte(100, segunda10, segunda10 - H)).toBe(0);
  });
  it('vendidoAte com o fim da coleção: a que já rodava antes da 0069 vende as 12 h dela', () => {
    expect(vendidoAte(100, segunda10, segunda10 + 6 * H, segunda10 + 12 * H)).toBeCloseTo(50, 9);
    expect(vendidoAte(100, segunda10, segunda10 + 30 * MIN, segunda10 + 12 * H)).toBeCloseTo(100 / 24, 9);
    expect(vendidoAte(100, segunda10, segunda10 + 13 * H, segunda10 + 12 * H)).toBeCloseTo(100, 9);
    expect(vendidoAte(100, segunda10, segunda10 + 10 * MIN, segunda10 + VENDA_MS)).toBe(vendidoAte(100, segunda10, segunda10 + 10 * MIN));
  });
  it('venda que atravessa sexta 18h vende mais na janela', () => {
    const pronta = sexta18 - 15 * MIN; // 15 min sem show, depois show
    const antes = vendidoAte(120, pronta, pronta + 15 * MIN);
    const depois = vendidoAte(120, pronta, pronta + 30 * MIN) - antes;
    expect(antes).toBeCloseTo(40, 9); // a janela pesa 2: 15 min valem 1/3
    expect(depois).toBeCloseTo(80, 9);
    expect(depois).toBeGreaterThan(antes);
  });
});

describe('tendência e nome', () => {
  it('tendencia = 1 + semanaIdx(3, 1, 30, semana), entre 1 e 30', () => {
    for (const s of ['2026-10-12', '2026-10-19', '2027-01-04']) {
      expect(tendencia(s)).toBe(1 + semanaIdx(3, 1, 30, s));
      expect(tendencia(s)).toBeGreaterThanOrEqual(1);
      expect(tendencia(s)).toBeLessThanOrEqual(30);
    }
  });
  it('nomeSugerido nunca passa de 30 caracteres', () => {
    for (const t of TEMAS) for (const e of ESTILOS) for (let n = 0; n <= 5; n++) {
      const nome = nomeSugerido(t.id, e.id, n);
      expect([...nome].length).toBeLessThanOrEqual(30);
      expect(nome).toContain(t.nome);
    }
    expect(nomeSugerido(1, 1, 0)).toBe('Coleção Meme Vol. 2');
  });
});

describe('o que a tela usa', () => {
  it('caderno: combinações, peça × tema e focos do caderninho em mapas', () => {
    const c = caderno([
      { tipo: 'combo', a: 2, b: 4, rotulo: 4 }, { tipo: 'peca', a: 1, b: 2, rotulo: 2 }, { tipo: 'foco', a: 4, b: 0, rotulo: 523 },
      { tipo: 'outro', a: 1, b: 1, rotulo: 1 },
    ]);
    expect(c.combos.get('2,4')).toBe(4);
    expect(c.pecas.get('1,2')).toBe(1); // rotulo = pecaTema + 1
    expect(c.focos.get(4)).toEqual([5, 2, 3]);
    expect(c.combos.size + c.pecas.size + c.focos.size).toBe(3);
  });
  it('focoDaNota: arte·100 + tecido·10 + div, inclusive o 10', () => {
    expect(focoDaNota(523)).toEqual([5, 2, 3]);
    expect(focoDaNota(1000)).toEqual([10, 0, 0]);
    expect(focoDaNota(10)).toEqual([0, 1, 0]);
    expect(focoDaNota(55)).toEqual([0, 5, 5]);
  });
  it('repeticao: igual a uma das 3 últimas = 2; só tema ou só estilo da última = 1; senão 0 (o mesmo que a nota usa)', () => {
    const ult = [{ tema: 1, estilo: 2 }, { tema: 3, estilo: 3 }, { tema: 4, estilo: 1 }, { tema: 5, estilo: 5 }];
    const ultMeme = [{ tema: 9, estilo: 9 }, { tema: 1, estilo: 1 }];
    expect(repeticao(3, 3, ult)).toBe(2);
    expect(repeticao(5, 5, ult)).toBe(0);
    expect(repeticao(1, 9, ult)).toBe(1);
    expect(repeticao(9, 2, ult)).toBe(1);
    expect(repeticao(9, 9, [])).toBe(0);
    // Meme × Minimalista (nenhuma nota no 10): repetida de 2 coleções atrás, cai 2 em cada nota (o piso é 1)
    const base: Lancamento = { id: 1, tema: 1, estilo: 1, peca: 1, cor: 1, foco: [3, 5, 2], lote: 1, nivel: 1, fas: 0, tendencia: 30, ultimas: [] };
    expect(repeticao(1, 1, ultMeme)).toBe(2);
    const sem = notas(base);
    const com = notas({ ...base, ultimas: ultMeme });
    expect(sem.every((n) => n < 10)).toBe(true);
    expect(com).toEqual(sem.map((n) => Math.max(1, n - 2)));
  });
  it('cada tipo libera em ordem de id (a tela mostra os liberados como os primeiros da lista)', () => {
    for (const lista of [TEMAS, ESTILOS, PECAS, CORES]) {
      const niveis = lista.map((x) => x.nivel);
      expect(niveis).toEqual([...niveis].sort((x, y) => x - y));
    }
  });
  it('liberaTextos: o que o nível libera, com o nome', () => {
    expect(liberaTextos(2)).toEqual(['Tema: Signo', 'Estilo: Grafite']);
    expect(liberaTextos(3)).toEqual(['Tema: Anime', 'Cor: Off-white']);
    expect(liberaTextos(4)).toEqual(['Tema: Crise financeira', 'Peça: Regata']);
    expect(liberaTextos(1)).toEqual([]);
    expect(liberaTextos(26)).toEqual([]);
  });
});

describe('os posts da revelação', () => {
  const c = { tema: 3, estilo: 5, cor: 1, tendencia: 3, arte: 3, tecido: 5, div: 2, rotulo: 4 };
  it('gostou segue os gostos da nota: tendência, vintage/bordado/cor forte, várzea, ótima no foco', () => {
    expect([0, 1, 2, 3].map((k) => gostou(k, c))).toEqual([true, true, true, true]);
    const nada = { ...c, tema: 1, estilo: 1, cor: 1, tendencia: 2, rotulo: 2 };
    expect([0, 1, 2, 3].map((k) => gostou(k, nada))).toEqual([false, false, false, false]);
    expect(gostou(1, { ...nada, cor: 3 })).toBe(true); // amarelo é forte
    expect(gostou(3, { ...c, arte: 7, tecido: 1, div: 2 })).toBe(false); // ótima, mas foco longe
  });
  it('um comentário por faixa de nota e gosto, com o tema no texto', () => {
    const todos = new Set<string>();
    for (let k = 0; k < 4; k++) for (const nota of [10, 6, 2]) for (const g of [false, true]) {
      const t = comentario(k, nota, g, 3);
      expect(t.length).toBeGreaterThan(10);
      expect(t).not.toContain('{tema}');
      todos.add(t);
    }
    expect(todos.size).toBe(24);
    expect(comentario(0, 9, true, 2)).toBe('Praia tá em alta e vocês entregaram. Já tô no carrinho.');
    expect(comentario(2, 4, false, 1)).toBe('Não tem escudo, não tem patrocínio, não tem nada.');
    expect(comentario(3, 5, false, 1)).toBe(comentario(3, 7, false, 1));
  });
});
