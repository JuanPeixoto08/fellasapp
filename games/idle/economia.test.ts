import { describe, expect, it } from 'vitest';

import { catalogo as cat } from './catalogo';
import { acumular, acumularTrechos, custoMult, era, liberada, maxCompra, multContratos, podeComprarGerador, preco, taxa, taxaPorUnidade, type Estado } from './economia';

const vazio = (): Estado => ({ generators: Array(30).fill(0), upgrades: [], strategies: [-1, -1, -1, -1] });
const com = (pares: [number, number][], extra: Partial<Estado> = {}): Estado => {
  const s = { ...vazio(), ...extra };
  s.generators = [...s.generators];
  for (const [g, n] of pares) s.generators[g - 1] = n;
  return s;
};

describe('era', () => {
  it('é a era do gerador mais alto que você tem', () => {
    expect(era(cat, vazio().generators)).toBe(1);
    expect(era(cat, com([[1, 3], [7, 1]]).generators)).toBe(2);
    expect(era(cat, com([[25, 1]]).generators)).toBe(5);
  });
});

const PISO = 1.02; // ninguém te contratou: piso de freela (+2%)

describe('taxa', () => {
  it('soma renda × quantidade (com o piso de freela)', () => {
    expect(taxa(cat, com([[1, 2]]))).toBeCloseTo(1 * PISO, 10);
  });
  it('melhoria de gerador dobra só aquele gerador', () => {
    const s = com([[1, 2], [2, 1]], { upgrades: [11] });
    expect(taxa(cat, s)).toBeCloseTo((2 + cat.geradores[1].renda) * PISO, 10);
  });
  it('geral multiplica tudo; sinergia soma por unidade da fonte', () => {
    expect(taxa(cat, com([[1, 1]], { upgrades: [1001] }))).toBeCloseTo(0.5 * 1.05 * PISO, 10);
    const s = com([[1, 10], [2, 1]], { upgrades: [2001] });
    expect(taxa(cat, s)).toBeCloseTo((5 + cat.geradores[1].renda * 1.1) * PISO, 10);
  });
  it('estratégias: Bootstrapping +50% nos 1–12, Queimar caixa +60% em tudo, Holding +3% por gerador diferente', () => {
    expect(taxa(cat, com([[1, 1], [7, 1]], { strategies: [0, -1, -1, -1] }))).toBeCloseTo((0.5 + cat.geradores[6].renda) * 1.5 * PISO, 10);
    expect(taxa(cat, com([[1, 1]], { strategies: [1, -1, -1, -1] }))).toBeCloseTo(0.5 * 1.6 * PISO, 10);
    expect(taxa(cat, com([[1, 1], [2, 1]], { strategies: [-1, -1, -1, 1] }))).toBeCloseTo((0.5 + cat.geradores[1].renda) * 1.06 * PISO, 10);
  });
  it('taxaPorUnidade × quantidade fecha com a taxa (sem estratégia de gerador distinto)', () => {
    const s = com([[1, 4], [3, 2]], { upgrades: [11, 1001] });
    expect(4 * taxaPorUnidade(cat, s, 1) + 2 * taxaPorUnidade(cat, s, 3)).toBeCloseTo(taxa(cat, s), 10);
  });
});

describe('contratos (multContratos)', () => {
  const s = (social: Estado['social'], strategies = [-1, -1, -1, -1]): Estado => ({ ...com([[1, 1]]), strategies, social });
  it('ninguém te contratou: piso de freela, +2%', () => {
    expect(multContratos(cat, vazio())).toBeCloseTo(1.02, 12);
  });
  it('+10% por contratado; +2% por empresa em que você trabalha (aí sem o piso)', () => {
    expect(multContratos(cat, s({ contratei: 3, empregos: [] }))).toBeCloseTo(1 + 0.3 + 0.02, 12);
    expect(multContratos(cat, s({ contratei: 0, empregos: [1, 1] }))).toBeCloseTo(1.04, 12);
    expect(multContratos(cat, s({ contratei: 2, empregos: [1] }))).toBeCloseTo(1.22, 12);
  });
  it('Networking dobra tudo, o piso também', () => {
    expect(multContratos(cat, s({ contratei: 0, empregos: [] }, [2, -1, -1, -1]))).toBeCloseTo(1.04, 12);
    expect(multContratos(cat, s({ contratei: 1, empregos: [1] }, [2, -1, -1, -1]))).toBeCloseTo(1.24, 12);
  });
  it('Cultura de startup: +15% por contratado; empresa com Cultura paga o triplo a quem ela contratou', () => {
    expect(multContratos(cat, s({ contratei: 2, empregos: [] }, [0, 0, 2, -1]))).toBeCloseTo(1 + 0.3 + 0.02, 12);
    expect(multContratos(cat, s({ contratei: 0, empregos: [3, 1] }))).toBeCloseTo(1.08, 12);
  });
  it('entra na taxa como multiplicador global', () => {
    expect(taxa(cat, com([[1, 2]], { social: { contratei: 1, empregos: [] } }))).toBeCloseTo(1 * 1.12, 10);
  });
});

describe('acumularTrechos (contrato vencendo no meio)', () => {
  it('com um trecho só é o mesmo que acumular', () => {
    expect(acumularTrechos(10, [{ desdeMs: 0, r: 0.5 }], 0, 100_000, 60_000)).toBeCloseTo(acumular(10, 0.5, 0, 100_000, 60_000), 12);
    expect(acumularTrechos(0, [{ desdeMs: 0, r: 1 }], 0, 10 * 3600_000, null)).toBeCloseTo(8 * 3600, 6);
  });
  it('cada trecho rende com a sua taxa; o ×5 vale só até o fim do bônus', () => {
    // r = 1 até 100 s, r = 2 depois; bônus até 150 s; fecha em 300 s
    const v = acumularTrechos(0, [{ desdeMs: 0, r: 1 }, { desdeMs: 100_000, r: 2 }], 0, 300_000, 150_000);
    expect(v).toBeCloseTo(1 * 100 + 4 * 1 * 100 + 2 * 200 + 4 * 2 * 50, 10);
  });
  it('vencimento depois do teto de 8h não conta', () => {
    const v = acumularTrechos(0, [{ desdeMs: 0, r: 1 }, { desdeMs: 9 * 3600_000, r: 100 }], 0, 10 * 3600_000, null);
    expect(v).toBeCloseTo(8 * 3600, 6);
  });
});

describe('preço e compra', () => {
  it('cada unidade custa 15% a mais; comprar k soma a série', () => {
    expect(preco(15, 0, 1, 1)).toBeCloseTo(15, 10);
    expect(preco(15, 1, 1, 1)).toBeCloseTo(17.25, 10);
    expect(preco(15, 0, 2, 1)).toBeCloseTo(32.25, 10);
    expect(preco(15, 0, 1, 1.25)).toBeCloseTo(18.75, 10);
  });
  it('máx: com o valuation exatamente no preço de k compra k (nem mais, nem zero)', () => {
    for (const k of [1, 2, 7, 10, 33]) {
      const v = preco(15, 3, k, 1);
      expect(maxCompra(15, 3, v, 1)).toBe(k);
      expect(maxCompra(15, 3, v * 0.999999, 1)).toBe(k - 1);
    }
    expect(maxCompra(15, 0, 0, 1)).toBe(0);
  });
  it('custoMult multiplica as estratégias escolhidas', () => {
    expect(custoMult(cat, vazio())).toBe(1);
    expect(custoMult(cat, { ...vazio(), strategies: [1, -1, -1, -1] })).toBe(1.25);
  });
  it('gerador só libera depois de ter o anterior', () => {
    expect(podeComprarGerador(vazio(), 1)).toBe(true);
    expect(podeComprarGerador(vazio(), 2)).toBe(false);
    expect(podeComprarGerador(com([[1, 1]]), 2)).toBe(true);
  });
  it('melhorias liberam por quantidade, era ou dupla de sinergia', () => {
    const m = (id: number) => cat.melhorias.find((x) => x.id === id)!;
    expect(liberada(cat, m(11), com([[1, 1]]))).toBe(true);
    expect(liberada(cat, m(12), com([[1, 9]]))).toBe(false);
    expect(liberada(cat, m(1005), com([[1, 1]]))).toBe(false);
    expect(liberada(cat, m(1005), com([[7, 1]]))).toBe(true);
    expect(liberada(cat, m(2001), com([[1, 15], [2, 14]]))).toBe(false);
    expect(liberada(cat, m(2001), com([[1, 15], [2, 15]]))).toBe(true);
  });
});

describe('acumular', () => {
  it('soma taxa × tempo, com teto de 8 horas', () => {
    expect(acumular(10, 0.5, 0, 100_000, null)).toBeCloseTo(60, 10);
    expect(acumular(0, 1, 0, 10 * 3600_000, null)).toBeCloseTo(8 * 3600, 6);
  });
  it('produção ×5 só dentro da janela do bônus', () => {
    expect(acumular(0, 1, 0, 100_000, 60_000)).toBeCloseTo(100 + 4 * 60, 10);
    expect(acumular(0, 1, 70_000, 100_000, 60_000)).toBeCloseTo(30, 10);
  });
  it('tempo negativo não tira nada', () => {
    expect(acumular(5, 1, 1000, 0, null)).toBe(5);
  });
});
