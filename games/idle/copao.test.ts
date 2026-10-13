import { describe, expect, it } from 'vitest';

import {
  abreNoite, aguenta, avaliar, BASES, chancePT, CONFLITOS, CRESCE, custoBeneficio, deuPT, DJS, ehSexta, ELASTICIDADE, EXTRAS, fimNoite, galeraNoite,
  GALERA_TETO, inicioNoite, LIBERA, liberado, liberaTextos, lucroVenda, MISTURAS, moda, modaDaSemana, movimento, NOITE_MS, noiteIdx,
  noitesEntre, nomeSugerido, nota, novidade, PONTOS, precoFaixa, precoRef, precoValido, publico, PUBLICO_BASE, rotuloPar, rotulos, sabor,
  SABORES, TAMANHOS, vagas, vendasNoite, vendidoNaNoite,
} from './copao';
import { semanaIdx } from './mapa';

const H = 3600_000;

describe('o catálogo do copão', () => {
  it('contagens: 13 sabores, 5 conflitos, 12 bases, 15 misturas, 12 extras, 3 tamanhos, 10 DJs', () => {
    expect([SABORES.length, CONFLITOS.length, BASES.length, MISTURAS.length, EXTRAS.length, TAMANHOS.length, DJS.length])
      .toEqual([13, 5, 12, 15, 12, 3, 10]);
    expect(BASES.map((b) => b.id)).toEqual(Array.from({ length: 12 }, (_, k) => k + 1));
    expect(MISTURAS[14].id).toBe(15);
  });

  it('o conteúdo copiado da spec', () => {
    expect(BASES[5]).toMatchObject({ nome: 'Whisky de posto', sabores: ['forte', 'amargo'], ponto: 4, custo: 2 });
    expect(BASES[10]).toMatchObject({ nome: 'Absinto', sabores: ['herbal', 'forte', 'amargo'], ponto: 3, custo: 4 });
    expect(BASES[11]).toMatchObject({ nome: 'Vinho de garrafão', sabores: ['frutado', 'doce', 'raiz'], ponto: 6, custo: 1 });
    expect(MISTURAS[7]).toMatchObject({ nome: 'Energético de açaí', sabores: ['frutado', 'energia', 'cremoso'] });
    expect(MISTURAS[12]).toMatchObject({ nome: 'Isotônico', sabores: ['leve', 'neutro'] });
    expect(EXTRAS[9]).toMatchObject({ nome: 'Sal na borda', sabores: ['salgado'] });
    expect(TAMANHOS.map((t) => [t.nome, t.doses, t.ref])).toEqual([['Copo', 1, 8], ['Copão', 3, 22], ['Balde', 10, 60]]);
    expect(DJS.map((d) => d.nome)).toEqual([
      'DJ Vaqueiro', 'DJ Ramemes', 'Neiff', 'DJ Robson Caetano', 'Ana Castela', 'Kannário', 'Wesley Safadão', 'Veigh', 'Ferrugem', 'Jane Remover',
    ]);
    expect(DJS[9]).toMatchObject({ estilo: 'shoegaze', bases: [11, 10, 12] });
    expect(DJS[2]).toMatchObject({ estilo: 'brega-funk', bases: [8, 3, 9] });
    // todo sabor usado existe; todo DJ curte bases que existem
    const todos = [...BASES, ...MISTURAS, ...EXTRAS].flatMap((x) => x.sabores);
    for (const s of todos) expect(SABORES).toContain(s);
    for (const d of DJS) for (const b of d.bases) expect(BASES.map((x) => x.id)).toContain(b);
  });

  it('LIBERA cobre 40 itens sem repetir, nos níveis 2 a 21; cada coisa fora do começo aparece uma vez', () => {
    const todos = Object.values(LIBERA).flat();
    expect(todos.length).toBe(40);
    expect(new Set(todos).size).toBe(40);
    expect(Object.keys(LIBERA).map(Number)).toEqual(Array.from({ length: 20 }, (_, k) => k + 2));
    const fora = [
      ...BASES.filter((x) => x.id > 3).map((x) => `base:${x.id}`), ...MISTURAS.filter((x) => x.id > 4).map((x) => `mistura:${x.id}`),
      ...EXTRAS.filter((x) => x.id > 3).map((x) => `extra:${x.id}`), ...TAMANHOS.filter((x) => x.id > 2).map((x) => `tamanho:${x.id}`),
      ...DJS.filter((x) => x.id > 2).map((x) => `dj:${x.id}`), 'vaga:4', 'vaga:5',
    ];
    expect([...todos].sort()).toEqual([...fora].sort());
    expect(LIBERA[7]).toEqual(['tamanho:3', 'extra:6']);
  });

  it('liberado, nivel e vagas saem do LIBERA', () => {
    expect(liberado('base', 3, 1)).toBe(true);
    expect(liberado('base', 4, 1)).toBe(false);
    expect(liberado('base', 4, 2)).toBe(true);
    expect(liberado('tamanho', 3, 6)).toBe(false);
    expect(liberado('tamanho', 3, 7)).toBe(true);
    expect(liberado('dj', 10, 19)).toBe(false);
    expect(liberado('dj', 10, 20)).toBe(true);
    expect(liberado('mistura', 15, 21)).toBe(true);
    expect(BASES[11].nivel).toBe(19);
    expect(DJS[0].nivel).toBe(1);
    expect(EXTRAS[11].nivel).toBe(21);
    expect([1, 11, 12, 19, 20, 25].map(vagas)).toEqual([3, 3, 4, 4, 5, 5]);
  });

  it('cada tipo libera em ordem de id (a tela mostra os liberados como os primeiros da lista)', () => {
    for (const lista of [BASES, MISTURAS, EXTRAS, TAMANHOS, DJS]) {
      const niveis = lista.map((x) => x.nivel);
      expect(niveis).toEqual([...niveis].sort((x, y) => x - y));
    }
  });

  it('liberaTextos: o que o nível libera, com o nome', () => {
    expect(liberaTextos(2)).toEqual(['Base: Gin', 'Mistura: Energético de melancia']);
    expect(liberaTextos(7)).toEqual(['Tamanho: Balde', 'Extra: Bala de goma']);
    expect(liberaTextos(12)).toEqual(['Vaga no cardápio: 4ª', 'Mistura: Xarope de groselha']);
    expect(liberaTextos(3)).toEqual(['Extra: Maracujá', 'DJ: Neiff']);
    expect(liberaTextos(1)).toEqual([]);
    expect(liberaTextos(22)).toEqual([]);
  });
});

describe('rótulos e sabor', () => {
  it('rotuloPar: 2 por sabor em comum, -2 por conflito, empurrão ((ia·31 + ib·17 + tipo·7) mod 3) - 1', () => {
    // Vodka(1) [neutro, forte] × Energético tradicional(1) [doce, energia], tipo 0: comum 0, conflito 0;
    //   v = (48 mod 3) - 1 = -1 -> s = -1 -> ruim (1)
    expect(rotuloPar(BASES[0].sabores, MISTURAS[0].sabores, 1, 1, 0)).toBe(1);
    // Catuaba(3) [doce, raiz] × Refri de guaraná(2) [doce, raiz], tipo 0: comum 2 -> 4; v = ((93+34) mod 3) - 1 = 1 - 1 = 0 -> s = 4 -> ótima
    expect(rotuloPar(BASES[2].sabores, MISTURAS[1].sabores, 3, 2, 0)).toBe(4);
    // Gin(4) [herbal, citrico] × Leite condensado(14) [cremoso, doce], tipo 0: conflitos cremoso-citrico e herbal-doce = 2 -> -4;
    //   v = ((124+238) mod 3) - 1 = (362 mod 3 = 2) - 1 = 1 -> s = -3 -> péssima
    expect(rotuloPar(BASES[3].sabores, MISTURAS[13].sabores, 4, 14, 0)).toBe(0);
    // Vodka(1) × Limão(1), tipo 1: s = (55 mod 3) - 1 = 0 -> ok; Energético(1) × Limão(1), tipo 2: s = (62 mod 3) - 1 = 1 -> ok
    expect(rotuloPar(BASES[0].sabores, EXTRAS[0].sabores, 1, 1, 1)).toBe(2);
    expect(rotuloPar(MISTURAS[0].sabores, EXTRAS[0].sabores, 1, 1, 2)).toBe(2);
    // Cachaça(2) [forte, raiz] × Refri de guaraná(2) [doce, raiz]: comum 1 -> 2; v = ((62+34) mod 3) - 1 = -1 -> s = 1 -> ok
    expect(rotuloPar(BASES[1].sabores, MISTURAS[1].sabores, 2, 2, 0)).toBe(2);
    // Saquê(10) [neutro, leve] × Pimenta(9) [forte], tipo 1: conflito leve-forte -> -2; v = ((310+153+7) mod 3) - 1 = (470 mod 3 = 2) - 1 = 1
    //   -> s = -1 -> ruim; o conflito vale nos dois sentidos
    expect(rotuloPar(BASES[9].sabores, EXTRAS[8].sabores, 10, 9, 1)).toBe(1);
  });

  it('rotulos: base × mistura, base × extra, mistura × extra', () => {
    expect(rotulos(1, 1, 1)).toEqual([1, 2, 2]);
    expect(rotulos(3, 2, 8)).toEqual([4, rotuloPar(BASES[2].sabores, EXTRAS[7].sabores, 3, 8, 1), rotuloPar(MISTURAS[1].sabores, EXTRAS[7].sabores, 2, 8, 2)]);
  });

  it('sabor = soma dos PONTOS dos três rótulos, de 0 a 399', () => {
    expect(PONTOS).toEqual([0, 40, 75, 105, 133]);
    expect(sabor(1, 1, 1)).toBe(40 + 75 + 75);
    let min = 999;
    let max = 0;
    for (const b of BASES) for (const m of MISTURAS) for (const e of EXTRAS) {
      const s = sabor(b.id, m.id, e.id);
      expect(Number.isInteger(s)).toBe(true);
      min = Math.min(min, s);
      max = Math.max(max, s);
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(399);
  });
});

describe('preço e custo-benefício', () => {
  it('precoRef = ref · (20 + força) / 20; faixa de ceil(0,5·ref) a floor(2·ref); preço inteiro', () => {
    expect(precoRef(1, 10)).toBe(12);
    expect(precoRef(2, 6)).toBeCloseTo(28.6, 12);
    expect(precoRef(3, 1)).toBeCloseTo(63, 12);
    expect(precoFaixa(1, 10)).toEqual([6, 24]);
    expect(precoFaixa(2, 6)).toEqual([15, 57]); // 14,3 -> 15; 57,2 -> 57
    expect(precoFaixa(1, 1)).toEqual([5, 16]); // 8,4: 4,2 -> 5; 16,8 -> 16
    expect(precoValido(2, 6, 15)).toBe(true);
    expect(precoValido(2, 6, 14)).toBe(false);
    expect(precoValido(2, 6, 57)).toBe(true);
    expect(precoValido(2, 6, 58)).toBe(false);
    expect(precoValido(2, 6, 20.5)).toBe(false);
  });

  it('custoBeneficio: 250 a 0,5× a referência, 167 a 1×, 0 a 2×', () => {
    // Copo (ref 8) força 10: precoRef = 8·30/20 = 12.
    // 6 (0,5×): (2 - 0,5)/1,5 = 1 -> 250. 12 (1×): 250·(1/1,5) = 166,67 -> 167. 24 (2×): (2 - 2)/1,5 = 0 -> 0.
    expect(custoBeneficio(1, 10, 6)).toBe(250);
    expect(custoBeneficio(1, 10, 12)).toBe(167);
    expect(custoBeneficio(1, 10, 24)).toBe(0);
    // Copão força 6, preço 30: 250·(2 - 30/28,6)/1,5 = 158,508 -> 159
    expect(custoBeneficio(2, 6, 30)).toBe(159);
  });

  it('custoBeneficio em inteiros bate com a conta em double em todo preço válido (round = floor(x + 0,5))', () => {
    for (const t of TAMANHOS) for (let f = 1; f <= 10; f++) {
      const ref = precoRef(t.id, f);
      const [lo, hi] = precoFaixa(t.id, f);
      for (let p = lo; p <= hi; p++) {
        const dbl = Math.floor(250 * Math.min(1, Math.max(0, (2 - p / ref) / 1.5)) + 0.5);
        expect(custoBeneficio(t.id, f, p)).toBe(dbl);
      }
    }
  });
});

describe('moda e aguenta', () => {
  it('copão da moda da semana: base 1 + semanaIdx(4, 1, 12), mistura 1 + semanaIdx(4, 2, 15)', () => {
    for (const s of ['2026-10-05', '2026-10-12', '2027-01-04']) {
      expect(modaDaSemana(s)).toEqual({ base: 1 + semanaIdx(4, 1, 12, s), mistura: 1 + semanaIdx(4, 2, 15, s) });
    }
    expect(modaDaSemana('2026-10-12')).toEqual({ base: 7, mistura: 6 }); // Tequila e Suco de maracujá
  });

  it('moda: 150 as duas, 75 uma, 0 nenhuma', () => {
    const s = '2026-10-12';
    expect(moda(7, 6, s)).toBe(150);
    expect(moda(7, 1, s)).toBe(75);
    expect(moda(1, 6, s)).toBe(75);
    expect(moda(1, 1, s)).toBe(0);
  });

  it('aguenta: 199 um acima do ponto, 170 no ponto, 140 um abaixo; longe cai', () => {
    // f = força - ponto (ponto 5): -3 -> 140 + 35·(-2) = 70; -2 -> 105; -1 -> 140; 0 -> 170; 1 -> 199; 2 -> 170 - 90 = 80; 3 -> 35
    expect([2, 3, 4, 5, 6, 7, 8].map((f) => aguenta(f, 5))).toEqual([70, 105, 140, 170, 199, 80, 35]);
    expect(aguenta(9, 5)).toBe(0); // f = 4: 170 - 180 -> 0
    expect(aguenta(10, 3)).toBe(0);
    expect(aguenta(1, 7)).toBe(0); // f = -6: 140 - 175 -> 0
    expect(aguenta(2, 7)).toBe(0); // f = -5: 140 - 140 = 0
    expect(aguenta(3, 7)).toBe(35);
  });
});

describe('a nota', () => {
  it('caso feito à mão', () => {
    // Vodka(1, ponto 5) + Energético tradicional(1) + Limão(1), Copão (ref 22), força 6, preço 30, semana 2026-10-12.
    // Rótulos: base×mistura s = 0 - 0 + ((31+17+0) mod 3) - 1 = -1 -> ruim (40);
    //          base×extra  s = ((31+17+7) mod 3) - 1 = (55 mod 3) - 1 = 0 -> ok (75);
    //          mistura×extra s = ((31+17+14) mod 3) - 1 = (62 mod 3) - 1 = 1 -> ok (75).  sabor = 40 + 75 + 75 = 190.
    // precoRef = 22·26/20 = 28,6; custo-benefício = floor(250·(2 - 30/28,6)/1,5 + 0,5) = floor(158,508 + 0,5) = 159.
    // Moda da semana: Tequila (7) e Suco de maracujá (6); nenhuma bate -> 0.
    // aguenta: f = 6 - 5 = 1 -> 199.
    // nota = 190 + 159 + 0 + 199 = 548. Chance de PT: (6 - 5)·10 = 10%.
    const c = { base: 1, mistura: 1, extra: 1, tamanho: 2, forca: 6, preco: 30 };
    expect(avaliar(c, '2026-10-12')).toEqual({ rotulos: [1, 2, 2], sabor: 190, custoBeneficio: 159, moda: 0, aguenta: 199, nota: 548, chancePT: 10 });
    expect(nota(c, '2026-10-12')).toBe(548);
    // Com a Tequila da moda: Tequila(7, ponto 4) + Suco de maracujá(6) + Maracujá(4), Copo (ref 8), força 4, preço 8.
    //   base×mistura: Tequila [citrico, forte] × [citrico, tropical]: comum 1 -> 2; v = ((217+102) mod 3) - 1 = (319 mod 3 = 1) - 1 = 0 -> s 2 -> boa (105)
    //   base×extra: × Maracujá [tropical, citrico]: comum 1 -> 2; v = ((217+68+7) mod 3) - 1 = (292 mod 3 = 1) - 1 = 0 -> boa (105)
    //   mistura×extra: [citrico, tropical] × [tropical, citrico]: comum 2 -> 4; v = ((186+68+14) mod 3) - 1 = (268 mod 3 = 1) - 1 = 0 -> ótima (133)
    //   sabor 343; precoRef = 8·24/20 = 9,6; cb = floor(250·(2 - 8/9,6)/1,5 + 0,5) = floor(194,44 + 0,5) = 194; moda 150; aguenta f = 0 -> 170.
    //   nota = 343 + 194 + 150 + 170 = 857.
    expect(avaliar({ base: 7, mistura: 6, extra: 4, tamanho: 1, forca: 4, preco: 8 }, '2026-10-12'))
      .toEqual({ rotulos: [3, 3, 4], sabor: 343, custoBeneficio: 194, moda: 150, aguenta: 170, nota: 857, chancePT: 0 });
  });

  it('nota sempre inteira entre 0 e 999', () => {
    for (let k = 0; k < 600; k++) {
      const c = { base: 1 + (k % 12), mistura: 1 + ((k * 7) % 15), extra: 1 + ((k * 5) % 12), tamanho: 1 + (k % 3), forca: 1 + ((k * 3) % 10), preco: 0 };
      const [lo, hi] = precoFaixa(c.tamanho, c.forca);
      for (const preco of [lo, hi, Math.round((lo + hi) / 2)]) {
        const n = nota({ ...c, preco }, '2026-10-12');
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(999);
      }
    }
  });
});

describe('PT', () => {
  it('chancePT = (força - ponto)·10 acima do ponto', () => {
    expect(chancePT(5, 5)).toBe(0);
    expect(chancePT(3, 5)).toBe(0);
    expect(chancePT(8, 5)).toBe(30);
    expect(chancePT(10, 3)).toBe(70);
  });

  it('deuPT: sorte (copão·7919 + noite·104729 + 4) mod 100 < chance; estável', () => {
    // copão 1, noite 0: 7923 mod 100 = 23. copão 1, noite 1: 112652 mod 100 = 52.
    expect(deuPT(1, 0, 23)).toBe(false);
    expect(deuPT(1, 0, 24)).toBe(true);
    expect(deuPT(1, 1, 50)).toBe(false);
    expect(deuPT(1, 1, 60)).toBe(true);
    expect(deuPT(5, 3, 0)).toBe(false);
    expect(deuPT(5, 3, 100)).toBe(true);
    for (let id = 1; id < 50; id++) for (let n = 280; n < 290; n++) expect(deuPT(id, n, 40)).toBe(deuPT(id, n, 40));
    // a sorte muda de noite para noite (não fica sempre PT ou sempre sem PT)
    const noites = Array.from({ length: 30 }, (_, n) => deuPT(7, 280 + n, 30));
    expect(noites.some(Boolean)).toBe(true);
    expect(noites.every(Boolean)).toBe(false);
  });
});

describe('as noites', () => {
  // 2026-10-16 é sexta; 18h de Brasília = 21h UTC.
  const sexta = Date.UTC(2026, 9, 16, 21);
  it('inicioNoite = dia 18h de Brasília; fimNoite = +8 h; noiteIdx = dias desde 2026-01-05', () => {
    expect(inicioNoite('2026-10-16')).toBe(sexta);
    expect(fimNoite(sexta)).toBe(sexta + 8 * H);
    expect(NOITE_MS).toBe(8 * H);
    expect(noiteIdx(inicioNoite('2026-01-05'))).toBe(0);
    expect(noiteIdx(inicioNoite('2026-01-06'))).toBe(1);
    expect(noiteIdx(sexta)).toBe(284);
    expect(noiteIdx(inicioNoite('2027-01-01'))).toBe(361);
  });

  it('ehSexta: a noite que começa na sexta 18h (até sábado 2h), não a de sábado nem a de quinta', () => {
    expect(ehSexta(sexta)).toBe(true);
    expect(ehSexta(inicioNoite('2026-10-15'))).toBe(false);
    expect(ehSexta(inicioNoite('2026-10-17'))).toBe(false);
    expect(ehSexta(inicioNoite('2026-10-23'))).toBe(true);
  });

  it('abreNoite: abre se a pessoa passou pelo jogo desde 24 h antes do início', () => {
    expect(abreNoite(sexta, null)).toBe(false);
    expect(abreNoite(sexta, sexta - 24 * H)).toBe(true);
    expect(abreNoite(sexta, sexta - 24 * H - 1)).toBe(false);
    expect(abreNoite(sexta, sexta - H)).toBe(true);
    expect(abreNoite(sexta, sexta + 3 * H)).toBe(true);
  });

  it('noitesEntre: os inícios em [a, b), cruzando a virada de semana (domingo 18h -> segunda 2h)', () => {
    const domingo = inicioNoite('2026-10-18');
    const segunda = inicioNoite('2026-10-19');
    expect(segunda - domingo).toBe(24 * H);
    expect(new Date(domingo - 3 * H).getUTCDay()).toBe(0);
    // domingo 17h -> segunda 19h: a noite de domingo (que vai até segunda 2h) e a de segunda
    expect(noitesEntre(domingo - H, segunda + H)).toEqual([domingo, segunda]);
    // domingo 23h -> segunda 3h: a noite de domingo já tinha começado; nenhuma começa no intervalo
    expect(noitesEntre(domingo + 5 * H, domingo + 9 * H)).toEqual([]);
    // [a, b): começa exatamente em a entra, exatamente em b não
    expect(noitesEntre(domingo, segunda)).toEqual([domingo]);
    expect(noitesEntre(sexta - 72 * H, sexta + 1)).toEqual([sexta - 72 * H, sexta - 48 * H, sexta - 24 * H, sexta]);
    expect(noitesEntre(sexta, sexta)).toEqual([]);
    expect(noiteIdx(segunda) - noiteIdx(domingo)).toBe(1);
  });

  it('vendidoNaNoite: linear nas 8 h, preso nas pontas', () => {
    expect(vendidoNaNoite(80, sexta, sexta - H)).toBe(0);
    expect(vendidoNaNoite(80, sexta, sexta)).toBe(0);
    expect(vendidoNaNoite(80, sexta, sexta + 2 * H)).toBeCloseTo(20, 9);
    expect(vendidoNaNoite(80, sexta, sexta + 8 * H)).toBe(80);
    expect(vendidoNaNoite(80, sexta, sexta + 30 * H)).toBe(80);
  });
});

describe('movimento, vendas, lucro e galera', () => {
  /** Copo força 10 a 12 fichas: exatamente o preço de referência (8 · 30/20), o preço não mexe na venda. */
  const NA_REF = { tamanho: 1, forca: 10, preco: 12 };

  it('constantes (ajustadas na simulação, copaoSim.test.ts)', () => {
    expect([PUBLICO_BASE, CRESCE, GALERA_TETO, ELASTICIDADE]).toEqual([25, 1.25, 3, 1.25]);
    expect(precoRef(NA_REF.tamanho, NA_REF.forca)).toBe(NA_REF.preco);
  });

  it('vendasNoite: o preço espanta: o dobro da referência vende (1/2)^1,25 do mesmo copão na referência', () => {
    const noite = { nivel: 3, galera: 400, sexta: false, dj: null };
    const copao = { base: 1, mistura: 1, tamanho: 2, forca: 4, nota: 700, noites: 1 }; // Copão força 4: ref 22·24/20 = 26,4
    const ref = precoRef(2, 4);
    const caro = vendasNoite([{ ...copao, preco: Math.floor(2 * ref) }], noite)[0];
    const certo = vendasNoite([{ ...copao, preco: ref }], noite)[0];
    expect(caro / certo).toBeCloseTo((ref / Math.floor(2 * ref)) ** 1.25, 12);
    // Balde força 6 (ref 78): preço 156 = 2× a referência, exato
    const balde = { base: 2, mistura: 3, tamanho: 3, forca: 6, preco: 78, nota: 650, noites: 0 };
    const b1 = vendasNoite([balde], noite)[0];
    const b2 = vendasNoite([{ ...balde, preco: 156 }], noite)[0];
    expect(b2 / b1).toBeCloseTo(0.5 ** 1.25, 12);
    // e só no copão dele: o outro do cardápio vende o mesmo
    const outro = { base: 4, mistura: 5, ...NA_REF, nota: 800, noites: 2 };
    expect(vendasNoite([{ ...balde, preco: 156 }, outro], noite)[1]).toBeCloseTo(vendasNoite([balde, outro], noite)[1], 9);
  });

  it('publico(nivel) cresce com o nível; movimento soma a galera (√galera/30, até 3)', () => {
    expect(publico(1)).toBe(PUBLICO_BASE);
    expect(publico(4)).toBeCloseTo(PUBLICO_BASE * CRESCE ** 3, 9);
    expect(movimento(1, 0)).toBe(PUBLICO_BASE);
    expect(movimento(1, 900)).toBeCloseTo(PUBLICO_BASE * 2, 9);
    expect(movimento(1, 8100)).toBeCloseTo(PUBLICO_BASE * 4, 9);
    expect(movimento(3, 1e9)).toBeCloseTo(publico(3) * 4, 9);
  });

  it('novidade cai 10% por noite no cardápio até 30%', () => {
    expect(novidade(0)).toBe(1);
    expect(novidade(3)).toBeCloseTo(0.7, 12);
    expect(novidade(7)).toBe(0.3);
    expect(novidade(50)).toBe(0.3);
  });

  it('vendasNoite: um copão só vende movimento · atração (a participação é a própria atração abaixo de 1)', () => {
    const v = vendasNoite([{ base: 1, mistura: 1, ...NA_REF, nota: 999, noites: 0 }], { nivel: 1, galera: 0, sexta: false, dj: null });
    expect(v[0]).toBeCloseTo(PUBLICO_BASE, 9);
    const meio = vendasNoite([{ base: 1, mistura: 1, ...NA_REF, nota: 999, noites: 5 }], { nivel: 1, galera: 0, sexta: false, dj: null });
    expect(meio[0]).toBeCloseTo(PUBLICO_BASE / 2, 9); // novidade 0,5
  });

  it('vendasNoite: reparte pela atração; com a soma acima de 1 vende o movimento inteiro', () => {
    const c = [{ base: 1, mistura: 1, ...NA_REF, nota: 999, noites: 0 }, { base: 2, mistura: 2, ...NA_REF, nota: 999, noites: 0 }];
    const v = vendasNoite(c, { nivel: 1, galera: 0, sexta: false, dj: null });
    expect(v[0]).toBeCloseTo(PUBLICO_BASE / 2, 9);
    expect(v[1]).toBeCloseTo(PUBLICO_BASE / 2, 9);
    // nota 999 e nota 0: o de nota 0 não vende
    const w = vendasNoite([c[0], { ...c[1], nota: 0 }], { nivel: 1, galera: 0, sexta: false, dj: null });
    expect(w).toEqual([PUBLICO_BASE, 0]);
    expect(vendasNoite([], { nivel: 1, galera: 0, sexta: false, dj: null })).toEqual([]);
    expect(vendasNoite([{ ...c[0], nota: 0 }], { nivel: 1, galera: 0, sexta: false, dj: null })).toEqual([0]);
  });

  it('vendasNoite: mesma base e mistura perdem 30% cada; sexta ×2; DJ da sexta ×1,2 nos copões das bases dele', () => {
    // dois Vodka+Energético nota 999 novos: atração 0,7 cada, soma 1,4 -> cada um vende público·0,7/1,4·1 = metade
    const gemeos = [{ base: 1, mistura: 1, ...NA_REF, nota: 999, noites: 0 }, { base: 1, mistura: 1, ...NA_REF, nota: 999, noites: 0 }];
    expect(vendasNoite(gemeos, { nivel: 1, galera: 0, sexta: false, dj: null })[0]).toBeCloseTo(PUBLICO_BASE / 2, 9);
    // sozinho com nota 500: atração (500/999)² = 0,2505 -> e o canibal só com outro no cardápio
    const um = [{ base: 1, mistura: 1, ...NA_REF, nota: 500, noites: 0 }];
    const a = vendasNoite(um, { nivel: 1, galera: 0, sexta: false, dj: null })[0];
    expect(a).toBeCloseTo(PUBLICO_BASE * (500 / 999) ** 2, 9);
    expect(vendasNoite(um, { nivel: 1, galera: 0, sexta: true, dj: null })[0]).toBeCloseTo(2 * a, 9);
    // DJ Ramemes (2) curte Vodka (1): ×1,2 só na sexta; DJ Vaqueiro (1) não curte Vodka
    expect(vendasNoite(um, { nivel: 1, galera: 0, sexta: true, dj: 2 })[0]).toBeCloseTo(2.4 * a, 9);
    expect(vendasNoite(um, { nivel: 1, galera: 0, sexta: true, dj: 1 })[0]).toBeCloseTo(2 * a, 9);
    expect(vendasNoite(um, { nivel: 1, galera: 0, sexta: false, dj: 2 })[0]).toBeCloseTo(a, 9);
  });

  it('lucroVenda = preço - doses · custo da base · (0,5 + força/10); pode ser negativo', () => {
    // Copão (3 doses) de Vodka (custo 2) força 5, preço 22: 22 - 3·2·1 = 16
    expect(lucroVenda({ base: 1, tamanho: 2, forca: 5, preco: 22 })).toBeCloseTo(16, 12);
    // Balde (10 doses) de Absinto (custo 4) força 10, preço 32: 32 - 10·4·1,5 = -28
    expect(lucroVenda({ base: 11, tamanho: 3, forca: 10, preco: 32 })).toBeCloseTo(-28, 12);
  });

  it('galeraNoite: sobe com média ≥ 600, cai 5% abaixo de 300, cai 15% com PT (uma vez), piso 0', () => {
    // nível 5 (público 25·1,25⁴ = 61,04), média 800: + round(61,04·0,02·800/999) = round(0,978) = 1; média 600 conta:
    // round(0,733) = 1; no nível 1 (público 25) a média 800 dá round(0,4) = 0
    expect(galeraNoite(100, 5, [800, 800], false)).toBe(101);
    expect(galeraNoite(100, 5, [599, 601], false)).toBe(101);
    expect(galeraNoite(100, 1, [800, 800], false)).toBe(100);
    expect(galeraNoite(100, 1, [599], false)).toBe(100);
    expect(galeraNoite(100, 1, [200, 300], false)).toBeCloseTo(95, 9);
    expect(galeraNoite(100, 1, [300], false)).toBe(100);
    expect(galeraNoite(100, 1, [450], true)).toBeCloseTo(85, 9);
    expect(galeraNoite(100, 1, [200], true)).toBeCloseTo(100 * 0.95 * 0.85, 9);
    // nível 20, média 999: + round(publico(20)·0,02) e depois o PT
    const g = 1000 + Math.floor(publico(20) * 0.02 + 0.5);
    expect(galeraNoite(1000, 20, [999], true)).toBeCloseTo(g * 0.85, 9);
    expect(galeraNoite(0, 1, [100], true)).toBe(0);
    expect(galeraNoite(50, 1, [], false)).toBe(50);
  });
});

describe('nome', () => {
  it('nomeSugerido nunca passa de 30 caracteres e leva o nome da base', () => {
    for (const b of BASES) for (const m of MISTURAS) for (const e of EXTRAS) for (let n = 0; n <= 5; n++) {
      const nome = nomeSugerido(b.id, m.id, e.id, n);
      expect([...nome].length).toBeLessThanOrEqual(30);
      expect(nome).toContain(b.nome);
    }
    expect(nomeSugerido(1, 1, 1, 0)).toBe('Balde de Vodka do Grau');
    expect(nomeSugerido(11, 1, 1, 0)).toBe('Bomba de Absinto do Grau');
  });
});
