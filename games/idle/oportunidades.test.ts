import { describe, expect, it } from 'vitest';

import { aoVivo, instante, OPP_CORTE, pendentes, sai, semente, TEXTO_TIPO, tipo, VALIDADE_S } from './oportunidades';

const U = '00000000-0000-0000-0000-00000000000a';
const V = '1234abcd-0000-0000-0000-000000000000';

describe('oportunidades', () => {
  it('Caixa maior: 5 janelas com 6h; uma de 5h atrás entra com 6h e fica fora com 4h', () => {
    const agora = 2_980_100 * 600_000 + 300_000;
    expect(pendentes(V, agora, [], 0, { tamanho: 5, validadeS: 6 * 3600 })).toHaveLength(5);
    const w = Array.from({ length: 40 }, (_, i) => 2_980_100 - 30 + i).find((x) => {
      const t = instante(V, x);
      return t <= agora - 4.2 * 3600_000 && t >= agora - 5.8 * 3600_000;
    })!;
    expect(pendentes(V, agora, [], 0, { tamanho: 100, validadeS: 6 * 3600 })).toContain(w);
    expect(pendentes(V, agora, [], 0, { tamanho: 100, validadeS: 4 * 3600 })).not.toContain(w);
  });
  it('sai da caixinha quando aparece a 3ª mais nova (ou na validade, o que vier antes)', () => {
    const uid = '00000000-0000-0000-0000-00000000000a';
    expect(sai(uid, 50)).toBe(instante(uid, 53));
    expect(sai(uid, 50, 5)).toBe(instante(uid, 55));
    expect(sai(uid, 50, 100)).toBe(instante(uid, 50) + VALIDADE_S * 1000);
    // e bate com pendentes: um instante antes da 53 a 50 ainda está; na 53 já saiu
    expect(pendentes(uid, instante(uid, 53) - 1, [])).toContain(50);
    expect(pendentes(uid, instante(uid, 53), [])).not.toContain(50);
  });
  it('semente = 7 primeiros hex do uuid', () => {
    expect(semente(U)).toBe(0);
    expect(semente(V)).toBe(0x1234abc);
  });
  it('cada janela de 10 min tem uma, num segundo entre 0 e 589', () => {
    for (let w = 2_980_000; w < 2_980_050; w++) {
      const t = instante(V, w);
      expect(t).toBeGreaterThanOrEqual(w * 600_000);
      expect(t).toBeLessThan(w * 600_000 + 590_000);
      expect([0, 1, 2]).toContain(tipo(V, w));
    }
  });
  it('pendentes: até 3, já passaram, menos de 4h, sem as pegas', () => {
    const agora = 2_980_100 * 600_000 + 300_000;
    const p = pendentes(V, agora, []);
    expect(p).toHaveLength(3);
    for (const w of p) {
      expect(instante(V, w)).toBeLessThanOrEqual(agora);
      expect(instante(V, w)).toBeGreaterThanOrEqual(agora - 4 * 3600_000);
    }
    expect(pendentes(V, agora, [p[0]])).not.toContain(p[0]);
  });
  it('pegar uma das 3 não puxa uma 4ª mais velha', () => {
    const agora = 2_980_100 * 600_000 + 300_000;
    const p = pendentes(V, agora, []);
    expect(pendentes(V, agora, [p[1]])).toEqual([p[0], p[2]]);
    expect(pendentes(V, agora, p)).toEqual([]);
  });
  it('nada de antes do início da semana', () => {
    const agora = 2_980_100 * 600_000 + 300_000;
    const p = pendentes(V, agora, []);
    expect(pendentes(V, agora, [], instante(V, p[1]))).toEqual([p[0], p[1]]);
    expect(pendentes(V, agora, [], agora + 1)).toEqual([]);
  });
  it('ao vivo só durante os segundos em que ela está na tela', () => {
    const w = 2_980_100;
    const t = instante(V, w);
    expect(aoVivo(V, t + 5000, 10)).toBe(w);
    expect(aoVivo(V, t + 11_000, 10)).toBeNull();
    expect(aoVivo(V, t + 25_000, 30)).toBe(w);
  });
  it('ao vivo atravessa a virada da janela (30 s na tela)', () => {
    // uma janela cuja oportunidade sai perto do fim, e a da janela seguinte só sai depois dos 30 s
    let w = 2_980_000;
    while (!(instante(V, w) - w * 600_000 > 580_000 && instante(V, w + 1) > instante(V, w) + 30_000)) w++;
    const t = instante(V, w);
    expect(Math.floor((t + 25_000) / 600_000)).toBe(w + 1);
    expect(aoVivo(V, t + 25_000, 30)).toBe(w);
    expect(aoVivo(V, t + 25_000, 10)).toBeNull();
  });
});

describe('a roda da Caixinha com o corte (0076)', () => {
  it('antes de OPP_CORTE, só 0, 1 e 2 (o que já está guardado não troca de tipo)', () => {
    for (let w = OPP_CORTE - 3000; w < OPP_CORTE; w++) expect(tipo(V, w)).toBeLessThanOrEqual(2);
  });
  it('a partir do corte: 18 · 16 · 16 · 10 · 12 · 9 · 10 · 9 (%)', () => {
    const conta = Array(8).fill(0);
    const N = 60_000;
    for (let w = OPP_CORTE; w < OPP_CORTE + N; w++) conta[tipo(V, w)]++;
    [0.18, 0.16, 0.16, 0.1, 0.12, 0.09, 0.1, 0.09].forEach((p, k) => expect(Math.abs(conta[k] / N - p), `tipo ${k}`).toBeLessThan(0.01));
  });
  it('os textos dos 8 tipos', () => {
    expect(TEXTO_TIPO).toEqual({
      0: '15 minutos de produção na hora', 1: 'Produção ×5 por 1 minuto', 2: 'Próxima compra pela metade', 3: 'Chamar um dourado',
      4: 'Cupom de primeira compra', 5: 'Adubo de farmácia', 6: 'Cashback', 7: 'Informação privilegiada',
    });
  });
});
