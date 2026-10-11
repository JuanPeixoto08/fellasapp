import { describe, expect, it } from 'vitest';

import { escalaPc } from './escala';

describe('escala do PC (a tela cresce com a janela)', () => {
  it('celular e PC pequeno ficam como estão (cena 3× no PC)', () => {
    expect(escalaPc(390, 760)).toEqual({ zoom: 1, cena: 0, largura: 390 });
    expect(escalaPc(1280, 720)).toEqual({ zoom: 1, cena: 3, largura: 1280 });
    expect(escalaPc(1366, 657)).toEqual({ zoom: 1, cena: 3, largura: 1314 }); // 2 × 657: sobra 26 de cada lado
  });
  it('cresce pelo lado que aperta primeiro (largura / 1280 ou altura / 720)', () => {
    expect(escalaPc(1920, 960).zoom).toBeCloseTo(4 / 3);
    expect(escalaPc(2560, 1440).zoom).toBe(2);
    expect(escalaPc(2560, 1440).largura).toBe(1280);
  });
  it('a cena só cresce por inteiro (160 × 96 vezes N, sem borrar)', () => {
    expect(escalaPc(1920, 960).cena).toBe(4);
    expect(escalaPc(2560, 1440).cena).toBe(6);
    expect(escalaPc(1600, 800).cena).toBe(3); // zoom 1,11: ainda não cabe 4×
  });
  it('tela muito larga não estica sem fim: no máximo 16:8 na base, o resto vira margem', () => {
    const s = escalaPc(3440, 1440);
    expect(s.zoom).toBe(2);
    expect(s.largura).toBe(1440); // 720 × 2 de base; os outros 1000 px viram margem
  });
});
