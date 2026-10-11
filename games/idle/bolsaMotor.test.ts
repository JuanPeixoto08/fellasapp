import { describe, expect, it } from 'vitest';

import { BOLSA, EMPRESAS_BOLSA, escolherHumor, inicial, MELHORIAS_BOLSA, normal, simular, tick } from './bolsaMotor';

const e = (codigo: string) => EMPRESAS_BOLSA.find((x) => x.codigo === codigo)!;
const U = [0.3, 0.6, 0.4, 0.2, 0.5, 0.5, 0.99];

describe('catálogo', () => {
  it('8 empresas na ordem da spec, pesos de 6 humores', () => {
    expect(EMPRESAS_BOLSA.map((x) => x.codigo)).toEqual(['PSTL', 'ACAI', 'COCH', 'PRMO', 'JEGU', 'MEME', 'IRMA', 'SIMA']);
    expect(EMPRESAS_BOLSA.map((x) => x.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const x of EMPRESAS_BOLSA) expect(x.pesos).toHaveLength(6);
    expect(e('IRMA').nome).toBe('Funerária 1 Irmão');
    expect(e('SIMA').nome).toBe('Mecânica Simas');
    expect(EMPRESAS_BOLSA.map((x) => x.gerador)).toEqual([11, 14, 16, 19, 15, 6, 20, 8]);
  });
  it('melhorias: 5 níveis de Corretor e de Escritório', () => {
    expect(MELHORIAS_BOLSA.corretor.nomes).toEqual(['Primo que entende de ação', 'Assessor do banco', 'Mesa de operações', 'Robô de trade', 'Insider (shh)']);
    expect(MELHORIAS_BOLSA.escritorio.nomes).toEqual(['Mesa na sala', 'Salinha comercial', 'Andar na Faria Lima', 'Prédio espelhado', 'Torre na Berrini']);
    expect(MELHORIAS_BOLSA.corretor.corretagem).toEqual([0.05, 0.04, 0.03, 0.02, 0.01, 0.005]);
    expect(MELHORIAS_BOLSA.escritorio.bonus).toEqual([0, 25, 50, 100, 200, 400]);
  });
});

describe('peças do sorteio', () => {
  it('normal: Box-Muller com 1 − a (nunca ln(0))', () => {
    expect(normal(0, 0)).toBeCloseTo(0, 12); // sqrt(-2 ln 1) = 0
    expect(Number.isFinite(normal(0.999999, 0.25))).toBe(true);
    expect(normal(1 - Math.exp(-0.5), 0)).toBeCloseTo(1, 12);
  });
  it('humor: escolhe pelo peso', () => {
    const p = [10, 0, 0, 0, 0, 30];
    expect(escolherHumor(p, 0)).toBe(0);
    expect(escolherHumor(p, 0.24)).toBe(0);
    expect(escolherHumor(p, 0.26)).toBe(5);
    expect(escolherHumor(p, 0.999)).toBe(5);
  });
});

describe('tick', () => {
  it('começa no repouso, sorteia o humor no primeiro tick e dura de 10 a 120', () => {
    const m = tick(inicial(e('PSTL'), 100), e('PSTL'), 101, [...U.slice(0, 4), 0.0, 0.0, 0.99]);
    expect(m.humor).toBe(0);
    expect(m.humorAte).toBe(101 + 10);
    const m2 = tick(inicial(e('PSTL'), 100), e('PSTL'), 101, [...U.slice(0, 4), 0.0, 0.999999, 0.99]);
    expect(m2.humorAte).toBe(101 + 120);
  });
  it('nunca cai abaixo de 5% do repouso', () => {
    let m = { ...inicial(e('MEME'), 0), valor: 0.3, delta: -0.08, humor: 4, humorAte: 10_000 };
    for (let t = 1; t < 200; t++) m = tick(m, { ...e('MEME'), quebra: 0 }, t, [0.99, 0.5, 0.5, 0.5, 0.5, 0.5, 0.99]);
    expect(m.valor).toBeGreaterThanOrEqual(BOLSA.piso * e('MEME').repouso - 1e-12);
  });
  it('na zona de risco quebra com a chance da empresa: geração +1, 10 ticks de recuperação no repouso, depois volta', () => {
    const base = { ...inicial(e('PRMO'), 0), valor: 1.5, delta: -0.05, humor: 4, humorAte: 10_000 };
    const salva = tick(base, e('PRMO'), 1, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.16]); // 0.16 >= 15%: não quebra
    expect(salva.geracao).toBe(0);
    const quebrou = tick(base, e('PRMO'), 1, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.01]);
    expect(quebrou).toMatchObject({ geracao: 1, rjAte: 11, valor: e('PRMO').repouso, delta: 0, humor: 0 });
    const parada = tick(quebrou, e('PRMO'), 5, U);
    expect(parada).toMatchObject({ rjAte: 11, valor: e('PRMO').repouso });
    const volta = tick(parada, e('PRMO'), 11, U);
    expect(volta).toMatchObject({ rjAte: null, valor: e('PRMO').repouso, humorAte: 11 });
  });
  it('fora da zona de risco não quebra nem com sorteio 0', () => {
    const m = tick({ ...inicial(e('PRMO'), 0), humorAte: 10_000 }, e('PRMO'), 1, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0]);
    expect(m.geracao).toBe(0);
  });
});

describe('simulação de 30 dias (calibra o catálogo)', () => {
  const DIAS = 30 * 24 * 60;
  const SEMENTES = Array.from({ length: 20 }, (_, i) => i + 1);
  const runs = SEMENTES.map((s) => simular(s, DIAS));
  const idx = (c: string) => EMPRESAS_BOLSA.findIndex((x) => x.codigo === c);

  it('firmes quebram no máximo 1 vez por mês (em média); malucas de 3 a 30', () => {
    const media = (c: string) => runs.reduce((a, r) => a + r.quebras[idx(c)], 0) / runs.length;
    for (const c of ['PSTL', 'ACAI', 'IRMA']) expect(media(c), c).toBeLessThanOrEqual(1);
    for (const c of ['PRMO', 'MEME']) {
      expect(media(c), c).toBeGreaterThanOrEqual(3);
      expect(media(c), c).toBeLessThanOrEqual(30);
    }
  });
  it('preço sempre finito e no piso ou acima', () => {
    for (const r of runs) {
      r.series.forEach((serie, i) => {
        const piso = BOLSA.piso * EMPRESAS_BOLSA[i].repouso;
        // uma conferência por série (milhões de expect deixariam o teste lento)
        expect(serie.every(Number.isFinite), EMPRESAS_BOLSA[i].codigo).toBe(true);
        expect(serie.reduce((a, v) => Math.min(a, v), Infinity)).toBeGreaterThanOrEqual(piso - 1e-9);
      });
    }
  });

  /** Lucro médio por ação (em segundos) de uma estratégia "compra quando entra(v), vende quando sai(v)". */
  function estrategia(c: string, entra: (v: number, rep: number) => boolean, sai: (v: number, rep: number) => boolean) {
    const i = idx(c);
    const rep = EMPRESAS_BOLSA[i].repouso;
    let total = 0;
    for (const r of runs) {
      let custo: number | null = null;
      r.series[i].forEach((v, t) => {
        if (r.rj[i][t]) {
          if (custo !== null) total -= custo; // quebrou com a ação na mão
          custo = null;
          return;
        }
        if (custo === null && entra(v, rep)) custo = v * (1 + BOLSA.corretagem);
        else if (custo !== null && sai(v, rep)) {
          total += v - custo;
          custo = null;
        }
      });
    }
    return total / runs.length;
  }

  it('comprar no fundo das malucas não é lucro garantido (média <= 0)', () => {
    for (const c of ['PRMO', 'MEME']) {
      expect(estrategia(c, (v, rep) => v < BOLSA.zonaRisco * rep, (v, rep) => v >= 0.5 * rep), c).toBeLessThanOrEqual(0);
    }
  });
  it('paciência nas firmes dá lucro (compra abaixo de 70%, vende acima de 105%)', () => {
    for (const c of ['PSTL', 'ACAI', 'IRMA']) {
      expect(estrategia(c, (v, rep) => v < 0.7 * rep, (v, rep) => v > 1.05 * rep), c).toBeGreaterThan(0);
    }
  });
});
