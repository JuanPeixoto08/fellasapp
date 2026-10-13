import { describe, expect, it } from 'vitest';

import {
  abreNoite, aBase, aguenta, ALFA, custoVenda, MARKUP, ptConta, sementePT, TAXA, distanciaCurta, vagasFuturas, avaliar, BASES, cadernoCup, daBase, chancePT, chavePar, diaBR, distanciasAguenta, distanciaTexto, pontoDescoberto, pontosPossiveis, proximaNoite, CONFLITOS, CRESCE, custoBeneficio, deuPT, DJS, ehSexta, ELASTICIDADE, EXTRAS, fimNoite, galeraNoite,
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
    expect(TAMANHOS.map((t) => [t.nome, t.doses])).toEqual([['Copo', 1], ['Copão', 3], ['Balde', 10]]);
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
  it('MARKUP com uma casa e TAXA com duas (100 × a referência inteiro)', () => {
    expect(Math.abs(MARKUP * 10 - Math.round(MARKUP * 10))).toBeLessThan(1e-9);
    expect(Math.abs(TAXA * 100 - Math.round(TAXA * 100))).toBeLessThan(1e-9);
  });

  it('precoRef = doses · custo da base · (0,5 + força/10) · MARKUP + doses · TAXA; faixa de ceil(0,5·ref) a floor(2·ref)', () => {
    // Copo (1 dose) de Vodka (custo 2) força 5: custo da venda 2 · 1 = 2
    expect(custoVenda(1, 1, 5)).toBe(2);
    expect(precoRef(1, 1, 5)).toBeCloseTo(2 * MARKUP + TAXA, 12);
    // Copão (3) de Cachaça (custo 1) força 6: 3 · 1 · 1,1 = 3,3
    expect(precoRef(2, 2, 6)).toBeCloseTo(3.3 * MARKUP + 3 * TAXA, 12);
    // Balde (10) de Absinto (custo 4) força 10: 10 · 4 · 1,5 = 60
    expect(precoRef(11, 3, 10)).toBeCloseTo(60 * MARKUP + 10 * TAXA, 12);
    // a base pesa: a mesma receita com base mais cara tem referência maior; o tamanho multiplica
    expect(precoRef(10, 1, 5)).toBeGreaterThan(precoRef(2, 1, 5));
    expect(precoRef(1, 3, 5)).toBeCloseTo(10 * precoRef(1, 1, 5), 9);
    for (const [b, t, f] of [[1, 1, 5], [2, 2, 6], [11, 3, 10], [8, 2, 1]]) {
      const ref = precoRef(b, t, f);
      const [lo, hi] = precoFaixa(b, t, f);
      expect([lo, hi]).toEqual([Math.ceil(0.5 * ref), Math.floor(2 * ref)]);
      expect(precoValido(b, t, f, lo)).toBe(true);
      expect(precoValido(b, t, f, lo - 1)).toBe(false);
      expect(precoValido(b, t, f, hi)).toBe(true);
      expect(precoValido(b, t, f, hi + 1)).toBe(false);
      expect(precoValido(b, t, f, lo + 0.5)).toBe(false);
    }
  });

  // Com MARKUP 1,5 e TAXA 7,5 a metade da referência já cobre o custo da venda (0,5·(1,5c + 7,5) ≥ c até c = 15 por dose; o
  // mais caro é 4 · 1,5 = 6): nenhum preço válido dá prejuízo.
  it('nenhum preço válido dá prejuízo', () => {
    for (const b of BASES) for (const t of TAMANHOS) for (let f = 1; f <= 10; f++) {
      const [lo] = precoFaixa(b.id, t.id, f);
      expect(lucroVenda({ base: b.id, tamanho: t.id, forca: f, preco: lo }), `${b.nome}/${t.nome}/${f}`).toBeGreaterThan(0);
    }
  });

  it('custoBeneficio: 250 a 0,5× a referência, 167 a 1×, 0 a 2×', () => {
    // um copão com a referência inteira e par (o meio, o 1× e o 2× são preços válidos)
    let achou = 0;
    for (const b of BASES) for (const t of TAMANHOS) for (let f = 1; f <= 10; f++) {
      const ref = precoRef(b.id, t.id, f);
      const r = Math.round(ref);
      if (Math.abs(ref - r) > 1e-9 || r % 2) continue;
      achou++;
      expect(custoBeneficio(b.id, t.id, f, r / 2)).toBe(250);
      expect(custoBeneficio(b.id, t.id, f, r)).toBe(167);
      expect(custoBeneficio(b.id, t.id, f, 2 * r)).toBe(0);
    }
    expect(achou).toBeGreaterThan(0);
  });

  // Em double, um x,5 exato pode sair x,4999…: a conta em inteiros arredonda o valor exato pra cima (por isso é em inteiros).
  it('custoBeneficio em inteiros bate com a conta em double em todo preço válido (round = floor(x + 0,5))', () => {
    let meios = 0;
    for (const b of BASES) for (const t of TAMANHOS) for (let f = 1; f <= 10; f++) {
      const ref = precoRef(b.id, t.id, f);
      const [lo, hi] = precoFaixa(b.id, t.id, f);
      for (let p = lo; p <= hi; p++) {
        const x = 250 * Math.min(1, Math.max(0, (2 - p / ref) / 1.5));
        const cb = custoBeneficio(b.id, t.id, f, p);
        if (Math.abs(x - Math.floor(x) - 0.5) < 1e-9) {
          meios++;
          expect(cb).toBe(Math.floor(x) + 1);
        } else expect(cb).toBe(Math.floor(x + 0.5));
      }
    }
    expect(meios).toBeLessThan(100);
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
    // Vodka(1, ponto 5, custo 2) + Energético tradicional(1) + Limão(1), Copão (3 doses), força 6, preço 30, semana 2026-10-12.
    // Rótulos: base×mistura s = 0 - 0 + ((31+17+0) mod 3) - 1 = -1 -> ruim (40);
    //          base×extra  s = ((31+17+7) mod 3) - 1 = (55 mod 3) - 1 = 0 -> ok (75);
    //          mistura×extra s = ((31+17+14) mod 3) - 1 = (62 mod 3) - 1 = 1 -> ok (75).  sabor = 40 + 75 + 75 = 190.
    // precoRef = 3·2·1,1·1,5 + 3·7,5 = 9,9 + 22,5 = 32,4; custo-benefício = floor(250·(2 - 30/32,4)/1,5 + 0,5) = floor(179,01 + 0,5) = 179.
    // Moda da semana: Tequila (7) e Suco de maracujá (6); nenhuma bate -> 0.
    // aguenta: f = 6 - 5 = 1 -> 199.
    // nota = 190 + 179 + 0 + 199 = 568. Chance de PT: (6 - 5)·10 = 10%.
    const c = { base: 1, mistura: 1, extra: 1, tamanho: 2, forca: 6, preco: 30 };
    expect(precoRef(1, 2, 6)).toBeCloseTo(32.4, 12);
    expect(avaliar(c, '2026-10-12')).toEqual({ rotulos: [1, 2, 2], sabor: 190, custoBeneficio: 179, moda: 0, aguenta: 199, nota: 568, chancePT: 10 });
    expect(nota(c, '2026-10-12')).toBe(568);
    // Com a Tequila da moda: Tequila(7, ponto 4, custo 3) + Suco de maracujá(6) + Maracujá(4), Copo (1 dose), força 4, preço 8.
    //   base×mistura: Tequila [citrico, forte] × [citrico, tropical]: comum 1 -> 2; v = ((217+102) mod 3) - 1 = (319 mod 3 = 1) - 1 = 0 -> s 2 -> boa (105)
    //   base×extra: × Maracujá [tropical, citrico]: comum 1 -> 2; v = ((217+68+7) mod 3) - 1 = (292 mod 3 = 1) - 1 = 0 -> boa (105)
    //   mistura×extra: [citrico, tropical] × [tropical, citrico]: comum 2 -> 4; v = ((186+68+14) mod 3) - 1 = (268 mod 3 = 1) - 1 = 0 -> ótima (133)
    //   sabor 343; precoRef = 1·3·0,9·1,5 + 7,5 = 11,55; cb = floor(250·(2 - 8/11,55)/1,5 + 0,5) = floor(217,89 + 0,5) = 218;
    //   moda 150; aguenta f = 0 -> 170. nota = 343 + 218 + 150 + 170 = 881.
    expect(avaliar({ base: 7, mistura: 6, extra: 4, tamanho: 1, forca: 4, preco: 8 }, '2026-10-12'))
      .toEqual({ rotulos: [3, 3, 4], sabor: 343, custoBeneficio: 218, moda: 150, aguenta: 170, nota: 881, chancePT: 0 });
  });

  it('nota sempre inteira entre 0 e 999', () => {
    for (let k = 0; k < 600; k++) {
      const c = { base: 1 + (k % 12), mistura: 1 + ((k * 7) % 15), extra: 1 + ((k * 5) % 12), tamanho: 1 + (k % 3), forca: 1 + ((k * 3) % 10), preco: 0 };
      const [lo, hi] = precoFaixa(c.base, c.tamanho, c.forca);
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

  it('deuPT: sorte (semente·7919 + noite·104729 + 4) mod 100 < chance; estável', () => {
    // semente 1, noite 0: 7923 mod 100 = 23. semente 1, noite 1: 112652 mod 100 = 52.
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

  it('a semente do PT é da receita (base, mistura, extra e tamanho): pôr de novo a mesma dá a mesma sorte', () => {
    expect(sementePT(1, 1, 1, 2)).toBe(4096 + 256 + 16 + 2);
    expect(sementePT(12, 15, 12, 3)).toBe(12 * 4096 + 15 * 256 + 12 * 16 + 3);
    // receitas diferentes, sementes diferentes; e a sorte de uma noite (o resto por 100) se espalha entre as receitas
    const sementes = new Set<number>();
    const restos = new Set<number>();
    for (const b of BASES) for (const m of MISTURAS) for (const e of EXTRAS) for (const t of TAMANHOS) {
      const x = sementePT(b.id, m.id, e.id, t.id);
      sementes.add(x);
      restos.add((x * 7919) % 100);
    }
    expect(sementes.size).toBe(12 * 15 * 12 * 3);
    expect(restos.size).toBeGreaterThanOrEqual(50);
  });

  it('o PT de um copão só conta se ele ficou no cardápio pelo menos 1 h da noite', () => {
    const ini = inicioNoite('2026-10-16');
    expect(ptConta(ini, null)).toBe(true);
    expect(ptConta(ini, ini + H)).toBe(true);
    expect(ptConta(ini, ini + H - 1)).toBe(false);
    expect(ptConta(ini, ini + 5 * 60_000)).toBe(false);
    expect(ptConta(ini, ini + 8 * H)).toBe(true);
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
  /** Um copo força 5 cobrado exatamente na referência da base dele: o preço não mexe na venda (e o copo tem 1 dose). */
  const naRef = (base: number, mistura: number, nota: number, noites: number) =>
    ({ base, mistura, tamanho: 1, forca: 5, preco: precoRef(base, 1, 5), nota, noites });

  it('constantes (ajustadas na simulação, copaoSim.test.ts)', () => {
    expect([PUBLICO_BASE, CRESCE, GALERA_TETO, ELASTICIDADE, MARKUP, TAXA, ALFA]).toEqual([35, 1.35, 3, 1.25, 1.5, 7.5, 0.9]);
  });

  it('vendasNoite: o preço espanta: o dobro da referência vende (1/2)^1,25 do mesmo copão na referência', () => {
    const noite = { nivel: 3, galera: 400, sexta: false, dj: null };
    const copao = { base: 1, mistura: 1, tamanho: 2, forca: 4, nota: 700, noites: 1 };
    const ref = precoRef(1, 2, 4);
    const caro = vendasNoite([{ ...copao, preco: Math.floor(2 * ref) }], noite)[0];
    const certo = vendasNoite([{ ...copao, preco: ref }], noite)[0];
    expect(caro / certo).toBeCloseTo((ref / Math.floor(2 * ref)) ** 1.25, 12);
    const balde = { base: 2, mistura: 3, tamanho: 3, forca: 6, preco: precoRef(2, 3, 6), nota: 650, noites: 0 };
    const b1 = vendasNoite([balde], noite)[0];
    const b2 = vendasNoite([{ ...balde, preco: 2 * balde.preco }], noite)[0];
    expect(b2 / b1).toBeCloseTo(0.5 ** 1.25, 12);
    // e só no copão dele: o outro do cardápio vende o mesmo
    const outro = naRef(4, 5, 800, 2);
    expect(vendasNoite([{ ...balde, preco: 2 * balde.preco }, outro], noite)[1]).toBeCloseTo(vendasNoite([balde, outro], noite)[1], 9);
  });

  it('vendasNoite: o recipiente maior sai menos: as vendas são divididas por doses^ALFA', () => {
    const noite = { nivel: 1, galera: 0, sexta: false, dj: null };
    const v = (tamanho: number) => vendasNoite([{ base: 1, mistura: 1, tamanho, forca: 5, preco: precoRef(1, tamanho, 5), nota: 999, noites: 0 }], noite)[0];
    expect(v(1)).toBeCloseTo(PUBLICO_BASE, 9);
    expect(v(2)).toBeCloseTo(PUBLICO_BASE / 3 ** ALFA, 9);
    expect(v(3)).toBeCloseTo(PUBLICO_BASE / 10 ** ALFA, 9);
    // e cada venda do balde rende 10× a do copo na referência: o balde rende 10^(1 − ALFA)× mais por noite
    const lucro = (t: number) => v(t) * lucroVenda({ base: 1, tamanho: t, forca: 5, preco: precoRef(1, t, 5) });
    expect(lucro(3) / lucro(1)).toBeCloseTo(10 ** (1 - ALFA), 9);
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
    const v = vendasNoite([naRef(1, 1, 999, 0)], { nivel: 1, galera: 0, sexta: false, dj: null });
    expect(v[0]).toBeCloseTo(PUBLICO_BASE, 9);
    const meio = vendasNoite([naRef(1, 1, 999, 5)], { nivel: 1, galera: 0, sexta: false, dj: null });
    expect(meio[0]).toBeCloseTo(PUBLICO_BASE / 2, 9); // novidade 0,5
  });

  it('vendasNoite: reparte pela atração; com a soma acima de 1 vende o movimento inteiro', () => {
    const c = [naRef(1, 1, 999, 0), naRef(2, 2, 999, 0)];
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
    const gemeos = [naRef(1, 1, 999, 0), naRef(1, 1, 999, 0)];
    expect(vendasNoite(gemeos, { nivel: 1, galera: 0, sexta: false, dj: null })[0]).toBeCloseTo(PUBLICO_BASE / 2, 9);
    // sozinho com nota 500: atração (500/999)² = 0,2505 -> e o canibal só com outro no cardápio
    const um = [naRef(1, 1, 500, 0)];
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
    // nível 5 (público 35·1,35⁴ = 116,25), média 800: + round(116,25·0,02·800/999) = round(1,862) = 2; média 600 conta:
    // round(1,396) = 1; no nível 1 (público 35) a média 800 dá round(0,561) = 1 e a média 600, round(0,42) = 0
    expect(galeraNoite(100, 5, [800, 800], false)).toBe(102);
    expect(galeraNoite(100, 5, [599, 601], false)).toBe(101);
    expect(galeraNoite(100, 1, [800, 800], false)).toBe(101);
    expect(galeraNoite(100, 1, [600], false)).toBe(100);
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
  it('nomeSugerido nunca passa de 30 caracteres, leva o nome da base e combina com o tamanho', () => {
    for (const b of BASES) for (const m of MISTURAS) for (const e of EXTRAS) for (const t of TAMANHOS) for (let n = 0; n <= 5; n++) {
      const nome = nomeSugerido(b.id, m.id, e.id, t.id, n);
      expect([...nome].length).toBeLessThanOrEqual(30);
      expect(nome).toContain(b.nome);
      if (t.id !== 3) expect(nome).not.toMatch(/^Bald/);
      if (t.id === 1) expect(nome).not.toMatch(/^Copão/);
    }
    expect(nomeSugerido(1, 1, 1, 2, 0)).toBe('Copão de Vodka do Grau');
    expect(nomeSugerido(1, 1, 1, 3, 0)).toBe('Balde de Vodka do Grau');
    expect(nomeSugerido(1, 1, 1, 1, 0)).toBe('Dose de Vodka do Grau');
    expect(nomeSugerido(11, 1, 1, 2, 0)).toBe('Bomba de Absinto do Grau');
  });
});

describe('o que a tela usa: caderninho, distância do ponto, estreia', () => {
  it('cadernoCup lê os pares (chave do banco) e o aguenta por base e força', () => {
    const c = cadernoCup([{ tipo: 'par', a: chavePar(0, 2, 1), b: 0, rotulo: 4 }, { tipo: 'aguenta', a: 2, b: 5, rotulo: 199 }, { tipo: 'outra', a: 1, b: 1, rotulo: 1 }]);
    expect(chavePar(0, 2, 1)).toBe(201);
    expect(chavePar(1, 2, 1)).toBe(10201);
    expect(chavePar(2, 15, 12)).toBe(21512);
    expect(c.pares.get(201)).toBe(4);
    expect(c.aguenta.get(2)?.get(5)).toBe(199);
  });
  it('distância do ponto pelo aguenta: única, menos 35 (3 acima ou 4 abaixo) e 0 (longe)', () => {
    expect(distanciasAguenta(199)).toEqual([1]);
    expect(distanciasAguenta(170)).toEqual([0]);
    expect(distanciasAguenta(140)).toEqual([-1]);
    expect(distanciasAguenta(80)).toEqual([2]);
    expect(distanciasAguenta(105)).toEqual([-2]);
    expect(distanciasAguenta(35)).toEqual([-4, 3]);
    expect(distanciaTexto(6, 199)).toBe('1 acima do ponto');
    expect(distanciaTexto(3, 105)).toBe('2 abaixo do ponto');
    expect(distanciaTexto(8, 35)).toBe('3 acima ou 4 abaixo do ponto');
    expect(distanciaTexto(10, 0)).toBe('longe do ponto');
    expect(distanciaTexto(10, 0, 5)).toBe('5 acima do ponto');
  });
  it('o ponto fecha quando os testes só batem com um; batem com o ponto escondido de verdade', () => {
    for (const b of BASES) {
      const testes = new Map([[b.ponto + 1, aguenta(b.ponto + 1, b.ponto)]]);
      expect(pontoDescoberto(testes)).toBe(b.ponto);
      expect(pontosPossiveis(new Map([[5, aguenta(5, b.ponto)]]))).toContain(b.ponto);
    }
    expect(pontoDescoberto(new Map([[5, 35]]))).toBeNull(); // 2 ou 9
    expect(pontoDescoberto(new Map([[5, 35], [3, 140]]))).toBeNull(); // a 3 diz ponto 4, a 5 diz 2 ou 9: nenhum bate
    expect(pontoDescoberto(new Map([[5, 35], [8, 140]]))).toBe(9);
    expect(pontoDescoberto(undefined)).toBeNull();
  });
  it('a estreia é a primeira noite que começa em t ou depois; o dia em Brasília', () => {
    const ini = inicioNoite('2026-10-13');
    expect(proximaNoite(ini)).toBe(ini);
    expect(proximaNoite(ini - 1)).toBe(ini);
    expect(proximaNoite(ini + 1)).toBe(ini + 24 * 3600_000);
    expect(diaBR(Date.parse('2026-10-14T02:59:00Z'))).toBe(diaBR(Date.parse('2026-10-13T12:00:00Z')));
    expect(diaBR(Date.parse('2026-10-14T03:00:00Z'))).toBe(diaBR(Date.parse('2026-10-13T12:00:00Z')) + 1);
  });
});

describe('artigo da base', () => {
  it('a Vodka, o Gin; da Cachaça, do Corote de pêssego', () => {
    expect(aBase(1)).toBe('a Vodka');
    expect(aBase(4)).toBe('o Gin');
    expect(daBase(2)).toBe('da Cachaça');
    expect(daBase(8)).toBe('do Corote de pêssego');
  });
});

describe('vagas que vão chegar e a distância curta', () => {
  it('vagasFuturas sai do LIBERA', () => {
    expect(vagasFuturas(1)).toEqual([[4, 12], [5, 20]]);
    expect(vagasFuturas(12)).toEqual([[5, 20]]);
    expect(vagasFuturas(25)).toEqual([]);
  });
  it('distanciaCurta: 0, +1, −2, +3/−4, longe; exata com o ponto', () => {
    expect(distanciaCurta(5, 170)).toBe('0');
    expect(distanciaCurta(6, 199)).toBe('+1');
    expect(distanciaCurta(3, 105)).toBe('−2');
    expect(distanciaCurta(8, 35)).toBe('+3/−4');
    expect(distanciaCurta(10, 0)).toBe('longe');
    expect(distanciaCurta(8, 35, 5)).toBe('+3');
  });
});
