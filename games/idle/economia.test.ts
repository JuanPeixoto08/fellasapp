import { describe, expect, it } from 'vitest';

import { catalogo as cat } from './catalogo';
import {
  abertura, acumular, acumularTrechos, copiasOportunidade, custoMult, efeitosArvore, era, liberada, maxCompra, multBonus, multContratos, podeComprarGerador,
  pontosTotais, precoContrato, preco, produzido, rendasGeradores, taxa, taxaPorUnidade, type Estado, VIRAL_MS,
} from './economia';

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

describe('Viralizou na conta (igual a idle_settle na 0045)', () => {
  it('×10 por Viralizou ativo, sem teto (três = ×1000); ×50 com o ×5 da oportunidade', () => {
    expect(acumular(0, 1, 0, 100_000, null, [90_000])).toBeCloseTo(100 + 9 * 60, 9);
    expect(acumular(0, 1, 0, 100_000, null, [90_000, 90_000])).toBeCloseTo(100 + 99 * 60, 9);
    expect(acumular(0, 1, 0, 100_000, null, [90_000, 90_000, 90_000])).toBeCloseTo(100 + 999 * 60, 9);
    expect(acumular(0, 1, 0, 100_000, 60_000, [90_000])).toBeCloseTo(1960, 9);
  });
  it('trechos: o Viralizou atravessa a troca de taxa', () => {
    // taxa 1 até 50 s, 2 depois; Viralizou de 30 a 90 s
    const v = acumularTrechos(0, [{ desdeMs: 0, r: 1 }, { desdeMs: 50_000, r: 2 }], 0, 100_000, null, [90_000]);
    expect(v).toBeCloseTo(30 + 20 * 10 + 40 * 2 * 10 + 10 * 2, 9);
  });
});

describe('o ×5 da oportunidade empilha (igual a idle_settle na 0062)', () => {
  it('somam: um = ×5; dois = ×10; o total multiplica com o Viralizou (×5 e ×10 = ×50)', () => {
    expect(acumular(0, 1, 0, 100_000, [90_000])).toBeCloseTo(90 * 5 + 10, 9);
    expect(acumular(0, 1, 0, 100_000, [90_000, 90_000])).toBeCloseTo(90 * 10 + 10, 9);
    expect(acumular(0, 1, 0, 100_000, [60_000, 90_000])).toBeCloseTo(60 * 10 + 30 * 5 + 10, 9);
    // dois ×5 (×10) com dois Viralizou (×100) de 30 a 90 s: 30 s a ×10, 60 s a ×1.000, 10 s a ×1
    expect(acumular(0, 1, 0, 100_000, [90_000, 90_000], [90_000, 90_000])).toBeCloseTo(30 * 10 + 60 * 1000 + 10, 9);
    // ×5 até 90 s; Viralizou de 30 a 90 s: 30 s a ×5, 60 s a ×50, 10 s a ×1
    expect(acumular(0, 1, 0, 100_000, [90_000], [90_000])).toBeCloseTo(30 * 5 + 60 * 50 + 10, 9);
    expect(acumularTrechos(0, [{ desdeMs: 0, r: 1 }, { desdeMs: 50_000, r: 2 }], 0, 100_000, [90_000, 90_000])).toBeCloseTo(50 * 10 + 40 * 2 * 10 + 10 * 2, 9);
  });
});

describe('rendem o dobro: quantas pegas uma oportunidade vale (igual a idle_claim_opportunity na 0063)', () => {
  it('1 sem nada; 2 com o Viralizar ou a Xepa da feira; 4 com os dois', () => {
    const era3 = (estrategia: number, arvore: number[] = []) => com([[13, 1]], { strategies: [0, estrategia, -1, -1], bonus: { arvore, conquistas: 0 } });
    expect(copiasOportunidade(cat, vazio())).toBe(1);
    expect(copiasOportunidade(cat, era3(1))).toBe(1);
    expect(copiasOportunidade(cat, era3(0))).toBe(2);
    expect(copiasOportunidade(cat, era3(1, [1, 31, 32, 33, 34]))).toBe(2);
    expect(copiasOportunidade(cat, era3(0, [1, 31, 32, 33, 34]))).toBe(4);
  });
});

describe('acumularTrechos (contrato vencendo no meio)', () => {
  it('com um trecho só é o mesmo que acumular', () => {
    expect(acumularTrechos(10, [{ desdeMs: 0, r: 0.5 }], 0, 100_000, 60_000)).toBeCloseTo(acumular(10, 0.5, 0, 100_000, 60_000), 12);
    expect(acumularTrechos(0, [{ desdeMs: 0, r: 1 }], 0, 10 * 3600_000, null)).toBeCloseTo(10 * 3600, 6);
  });
  it('cada trecho rende com a sua taxa; o ×5 vale só até o fim do bônus', () => {
    // r = 1 até 100 s, r = 2 depois; bônus até 150 s; fecha em 300 s
    const v = acumularTrechos(0, [{ desdeMs: 0, r: 1 }, { desdeMs: 100_000, r: 2 }], 0, 300_000, 150_000);
    expect(v).toBeCloseTo(1 * 100 + 4 * 1 * 100 + 2 * 200 + 4 * 2 * 50, 10);
  });
  it('sem teto: vencimento depois de 8h conta inteiro', () => {
    const v = acumularTrechos(0, [{ desdeMs: 0, r: 1 }, { desdeMs: 9 * 3600_000, r: 2 }], 0, 10 * 3600_000, null);
    expect(v).toBeCloseTo(9 * 3600 + 2 * 3600, 6);
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
  it('soma taxa × tempo sem limite: 3 dias fechado rendem os 3 dias', () => {
    expect(acumular(10, 0.5, 0, 100_000, null)).toBeCloseTo(60, 10);
    expect(acumular(0, 1, 0, 3 * 86400_000, null)).toBeCloseTo(3 * 86400, 6);
  });
  it('Viralizou com duração dobrada (Hype): ×10 por 120 s', () => {
    expect(acumular(0, 1, 0, 200_000, null, [150_000], 120_000)).toBeCloseTo(200 + 9 * 120, 9);
  });
  it('produção ×5 só dentro da janela do bônus', () => {
    expect(acumular(0, 1, 0, 100_000, 60_000)).toBeCloseTo(100 + 4 * 60, 10);
    expect(acumular(0, 1, 70_000, 100_000, 60_000)).toBeCloseTo(30, 10);
  });
  it('tempo negativo não tira nada', () => {
    expect(acumular(5, 1, 1000, 0, null)).toBe(5);
  });
});

describe('árvore de habilidades e conquistas', () => {
  const comArvore = (s: Estado, arvore: number[], conquistas = 0): Estado => ({ ...s, bonus: { arvore, conquistas } });
  it('sem nó: o jogo de sempre', () => {
    expect(efeitosArvore(cat, [])).toEqual({
      producao: 1, caixinha: 3, oppSegundos: 10, oppExtra: 0, oppBonus: 1, contratoPreco: 1,
      porContratado: 0.1, contratoDias: 7, empregoMult: 1, inicioValuation: 10, inicioNotebooks: 1, inicioEra1: false,
      manterGerais: false, douradoFreq: 1, douradoTela: 12, douradoInvestidor: 1, douradoDuracao: 1, hortaAmadurece: 1,
      hortaVida: 1, hortaCruza: 1, hortaMult: 1, morangoChance: 1,
    });
  });
  it('nós do mesmo tipo: produção multiplica, caixinha e eventos ficam o maior, +por dia soma, preço do contrato fica o menor', () => {
    const e = efeitosArvore(cat, [1, 11, 12, 13, 14, 15, 31, 33, 35, 41, 43, 51, 55]);
    expect(e.producao).toBeCloseTo(1.05 * 1.1 * 1.25 * 1.5 * 2 * 2, 12);
    expect(e).toMatchObject({ douradoFreq: 1.5, caixinha: 5, oppExtra: 3, contratoPreco: 0.5 });
    expect(efeitosArvore(cat, [1, 31]).oppSegundos).toBe(10);
    expect(efeitosArvore(cat, [1, 31, 32]).oppSegundos).toBe(30);
    expect(efeitosArvore(cat, [1, 41, 42, 43, 44, 45])).toMatchObject({ douradoFreq: 2, douradoTela: 24, douradoInvestidor: 2, douradoDuracao: 2 });
    expect(efeitosArvore(cat, [1, 61, 62, 63, 64, 65])).toMatchObject({ hortaAmadurece: 0.75, hortaVida: 1.5, hortaCruza: 2, hortaMult: 1.5, morangoChance: 5 });
    expect(efeitosArvore(cat, [999]).producao).toBe(1); // nó que a página não conhece não faz nada
  });
  it('produção: nós de produção × (1 + 1% por conquista); ponto guardado não conta', () => {
    const s = com([[1, 2]]);
    expect(multBonus(cat, s)).toBe(1);
    expect(taxa(cat, comArvore(s, [1, 11]))).toBeCloseTo(1 * PISO * 1.05 * 1.1, 10);
    expect(taxa(cat, comArvore(s, [1, 11], 5))).toBeCloseTo(1 * PISO * 1.05 * 1.1 * 1.05, 10);
    expect(taxaPorUnidade(cat, comArvore(s, [], 3), 1)).toBeCloseTo(0.5 * PISO * 1.03, 10);
  });
  it('Gente: Aniversariante do mês paga 15% por contratado (sem somar com a Cultura); Passe de craque dobra cada emprego, não o piso', () => {
    const s = com([[1, 1]]);
    expect(multContratos(cat, { ...comArvore(s, [1, 51, 52]), social: { contratei: 2, empregos: [] } })).toBeCloseTo(1 + 0.15 * 2 + 0.02, 12);
    expect(multContratos(cat, { ...comArvore(s, [1, 51, 52, 53, 54]), social: { contratei: 0, empregos: [1, 3] } })).toBeCloseTo(1 + 0.02 * 2 * 4, 12);
    expect(multContratos(cat, { ...comArvore(s, [1, 51, 52, 53, 54]), social: { contratei: 0, empregos: [] } })).toBeCloseTo(1.02, 12);
  });
  it('Aniversariante do mês não soma com a Cultura de startup: fica o maior dos dois', () => {
    const s = { ...comArvore(com([[1, 1]]), [1, 51, 52]), strategies: [-1, -1, 2, -1], social: { contratei: 2, empregos: [] } };
    expect(multContratos(cat, s)).toBeCloseTo(1 + 0.15 * 2 + 0.02, 12);
    expect(multContratos(cat, s)).not.toBeCloseTo(1 + 0.3 * 2 + 0.02, 6); // somar daria outro valor
  });
  it('nó repetido conta uma vez só', () => {
    expect(efeitosArvore(cat, [11, 11])).toEqual(efeitosArvore(cat, [11]));
  });
  it('preço do contrato: 30 min de produção × 1,5 por contrato ativo × o desconto da árvore', () => {
    const s = { ...comArvore(com([[1, 2]]), [1, 51]), social: { contratei: 1, empregos: [] } };
    expect(precoContrato(cat, s, 1)).toBeCloseTo(taxa(cat, s) * 1800 * 1.5 * 0.75, 6);
  });
  it('Abrir CNPJ com o Recomeço: dinheiro, notebooks, a era 1 inteira e as gerais mantidas', () => {
    expect(abertura(cat, efeitosArvore(cat, []))).toEqual({ valuation: 10, generators: [1, ...Array(29).fill(0)], upgrades: [] });
    const a = abertura(cat, efeitosArvore(cat, [1, 21, 22, 23, 24, 25]), [1001, 1003]);
    expect(a.valuation).toBe(1e6);
    expect(a.generators.slice(0, 7)).toEqual([10, 1, 1, 1, 1, 1, 0]);
    expect(a.upgrades).toEqual([1001, 1003]);
    expect(abertura(cat, efeitosArvore(cat, [1, 21]), [1001]).upgrades).toEqual([]);
  });
  it('sem teto do offline: 30h fora rendem as 30h', () => {
    expect(acumular(0, 1, 0, 30 * 3600_000, null)).toBeCloseTo(30 * 3600, 6);
    expect(acumularTrechos(0, [{ desdeMs: 0, r: 1 }], 0, 30 * 3600_000, null)).toBeCloseTo(30 * 3600, 6);
  });
  it('pontos totais: floor(cbrt(F$/s ÷ 1 milhão)), sem errar nos cubos', () => {
    for (const [r, n] of [[0, 0], [-1, 0], [NaN, 0], [Infinity, 0], [-Infinity, 0], [1e33, 1e9], [1e40, 1e9], [999_999, 0], [1e6, 1], [7_999_999, 1], [8e6, 2], [1e9, 10], [1e12, 100]]) {
      expect(pontosTotais(r), String(r)).toBe(n);
    }
    for (let n = 1; n <= 1000; n++) {
      expect(pontosTotais(n ** 3 * 1e6)).toBe(n);
      expect(pontosTotais(n ** 3 * 1e6 * (1 - 1e-12))).toBe(n - 1);
    }
  });
});

describe('Marmita da mãe (×3) no produzido', () => {
  it('×3 até o fim da marmita, multiplicando com ×5 e Viralizou', () => {
    // r = 1/s, de 0 a 100 s, marmita até 40 s: 40·3 + 60 = 180
    expect(produzido(1, 0, 100_000, null, [], VIRAL_MS, 40_000)).toBeCloseTo(180, 6);
    // com um ×5 até 20 s: 20·15 + 20·3 + 60 = 420
    expect(produzido(1, 0, 100_000, [20_000], [], VIRAL_MS, 40_000)).toBeCloseTo(420, 6);
    // com um Viralizou de 0 a 60 s (fim 60 s): 40·30 + 20·10 + 40 = 1440
    expect(produzido(1, 0, 100_000, null, [60_000], VIRAL_MS, 40_000)).toBeCloseTo(1440, 6);
  });
  it('sem marmita (null ou já passou) é a conta de antes', () => {
    expect(produzido(2, 0, 10_000, null, [], VIRAL_MS, null)).toBeCloseTo(20, 6);
    expect(produzido(2, 50_000, 60_000, null, [], VIRAL_MS, 40_000)).toBeCloseTo(20, 6);
  });
});

describe('rendasGeradores (o sorteio do LinkedIn)', () => {
  it('cada gerador: unidades × quanto cada uma rende; a soma é a taxa', () => {
    const s = { generators: [10, 5, ...Array(28).fill(0)], upgrades: [11], strategies: [-1, -1, -1, -1] };
    const r = rendasGeradores(cat, s);
    expect(r).toHaveLength(30);
    expect(r[0]).toBeCloseTo(10 * taxaPorUnidade(cat, s, 1), 9);
    expect(r[1]).toBeCloseTo(5 * taxaPorUnidade(cat, s, 2), 9);
    expect(r.slice(2).every((x) => x === 0)).toBe(true);
    expect(r[0] + r[1]).toBeCloseTo(taxa(cat, s), 9);
  });
});

describe('LinkedIn e Combo no produzido (0076)', () => {
  it('cada fator multiplica tudo até o fim dele, por cima do resto', () => {
    // r = 1/s, de 0 a 100 s; Combo ×7 até 30 s: 30·7 + 70 = 280
    expect(produzido(1, 0, 100_000, null, [], VIRAL_MS, null, [{ ateMs: 30_000, mult: 7 }])).toBeCloseTo(280, 6);
    // LinkedIn ×4,5 até 40 s e Combo ×7 até 30 s: 30·31,5 + 10·4,5 + 60 = 1050
    expect(produzido(1, 0, 100_000, null, [], VIRAL_MS, null, [{ ateMs: 40_000, mult: 4.5 }, { ateMs: 30_000, mult: 7 }])).toBeCloseTo(1050, 6);
    // ×5 até 20 s, Viralizou até 60 s, Marmita até 50 s e Combo até 30 s:
    // 20·(5·10·3·7) + 10·(10·3·7) + 20·(10·3) + 10·10 + 40·1 = 21000 + 2100 + 600 + 100 + 40 = 23840
    expect(produzido(1, 0, 100_000, [20_000], [60_000], VIRAL_MS, 50_000, [{ ateMs: 30_000, mult: 7 }])).toBeCloseTo(23_840, 6);
  });
  it('fator que já acabou (ou lista vazia) é a conta de antes', () => {
    expect(produzido(2, 50_000, 60_000, null, [], VIRAL_MS, null, [{ ateMs: 40_000, mult: 7 }])).toBeCloseTo(20, 6);
    expect(acumular(5, 2, 0, 10_000, null, [], VIRAL_MS, null, [])).toBeCloseTo(25, 6);
  });
});
