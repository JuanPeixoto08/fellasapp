import { describe, expect, it } from 'vitest';

import {
  CORES, custoLote, distanciaFoco, ESTILOS, INFLUENCERS, LIBERA, liberado, nomeSugerido, notas, pctProcura, PECAS, pecasLote,
  pecaTema, pesoVenda, precoPeca, precoRelatorio, procura, producaoMs, publico, rotulo, TEMAS, tendencia, VENDA_MS, vendidoAte,
  type Lancamento,
} from './camisetaria';
import { semanaIdx } from './mapa';

const H = 3600_000;

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
    expect(pecasLote(5, 1)).toBe(Math.round(12 * 1.55 ** 4) * 3);
    expect(publico(1)).toBe(75);
    expect(publico(3)).toBeCloseTo(75 * 1.55 ** 2, 9);
  });
  it('procura e pctProcura', () => {
    const l = base({ fas: 900, nivel: 1, peca: 1 });
    expect(procura(l, [10, 10, 10, 10])).toBeCloseTo(75 * 1 * 2 * 1, 9);
    expect(procura(l, [5, 5, 5, 5])).toBeCloseTo(75 * 0.25 * 2, 9);
    expect(pctProcura(l, [10, 10, 10, 10])).toBeCloseTo((150 / 36) * 100, 9);
  });
  it('custo, preço, produção, relatório', () => {
    expect(custoLote(1, 1, 1)).toBe(3 * 36);
    expect(precoPeca(1)).toBeCloseTo(7.5, 9);
    expect([producaoMs(0), producaoMs(1), producaoMs(2)]).toEqual([H, 2 * H, 4 * H]);
    expect(VENDA_MS).toBe(12 * H);
    expect(precoRelatorio(1)).toBe(50);
    expect(precoRelatorio(3)).toBeCloseTo(50 * 1.55 ** 2, 9);
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
    expect(vendidoAte(100, segunda10, segunda10 + 6 * H)).toBeCloseTo(50, 9);
    expect(vendidoAte(100, segunda10, segunda10 + VENDA_MS)).toBeCloseTo(100, 9);
    expect(vendidoAte(100, segunda10, segunda10 + 99 * H)).toBeCloseTo(100, 9);
    expect(vendidoAte(100, segunda10, segunda10 - H)).toBe(0);
  });
  it('venda que atravessa sexta 18h vende mais na janela', () => {
    const pronta = sexta18 - 6 * H; // 6h sem show, depois show
    const antes = vendidoAte(120, pronta, pronta + 6 * H);
    const depois = vendidoAte(120, pronta, pronta + 12 * H) - antes;
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
