import { describe, expect, it } from 'vitest';

import { garantido, mediaDourado, mediaOportunidade, RODA_DOURADO_HOJE, RODA_DOURADO_NOVA, RODA_OPP_HOJE, RODA_OPP_NOVA } from './valorMedio';

// Spec (Testes): o ganho médio por dourado e por oportunidade não sobe mais de 15% sobre o de hoje. Em minutos da sua produção.
describe('ganho médio: a entrega 5 não sobe mais de 15%', () => {
  it('dourado: hoje 16,1 min; com os novos 18,06 (+12%, com o Tigrinho de 30 min; com o de 1 h seria +27%)', () => {
    expect(mediaDourado(RODA_DOURADO_HOJE)).toBeCloseTo(16.1, 6);
    expect(mediaDourado(RODA_DOURADO_NOVA)).toBeCloseTo(18.0552, 3);
    expect(mediaDourado(RODA_DOURADO_NOVA) / mediaDourado(RODA_DOURADO_HOJE)).toBeLessThanOrEqual(1.15);
  });
  it('o garantido: 16,05 min; em dobro 32,09 (devolver o Pix vale um pouco mais que ficar com 30)', () => {
    expect(garantido(1)).toBeCloseTo(16.046, 3);
    expect(garantido(2)).toBeCloseTo(32.092, 3);
  });
  it('oportunidade com Horta e Bolsa: hoje 7,17 min; com os novos 7,95 (+11%)', () => {
    const tem = { horta: true, bolsa: true };
    expect(mediaOportunidade(RODA_OPP_HOJE, tem)).toBeCloseTo(7.1667, 3);
    expect(mediaOportunidade(RODA_OPP_NOVA, tem)).toBeCloseTo(7.9546, 3);
    expect(mediaOportunidade(RODA_OPP_NOVA, tem) / mediaOportunidade(RODA_OPP_HOJE, tem)).toBeLessThanOrEqual(1.15);
  });
  it('sem Horta nem Bolsa (o Adubo e a Informação viram 15 min): +36%; a simulação da semana roda com isso (Task 8)', () => {
    const sem = { horta: false, bolsa: false };
    expect(mediaOportunidade(RODA_OPP_NOVA, sem) / mediaOportunidade(RODA_OPP_HOJE, sem)).toBeCloseTo(1.3611, 3);
  });
});
