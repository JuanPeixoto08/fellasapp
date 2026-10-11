import { describe, expect, it } from 'vitest';

import { douradoEm, JANELA_S, posicao, TIPOS_DOURADO } from './dourados';

const U = '4a681416-b4ee-4976-8cdd-540cc816f28c';

describe('a sorte dos eventos na tela', () => {
  it('sempre o mesmo resultado pro mesmo jogador e segundo', () => {
    for (const s of [0, 1, 1_760_000_000, 1_760_123_456]) expect(douradoEm(U, s)).toBe(douradoEm(U, s));
  });
  it('em média um a cada ~10 min (1/600 por segundo), sem padrão de intervalo fixo', () => {
    const inicio = 1_760_000_000;
    const N = 600_000;
    const vistos: number[] = [];
    for (let s = inicio; s < inicio + N; s++) if (douradoEm(U, s) !== null) vistos.push(s);
    expect(vistos.length).toBeGreaterThan(850);
    expect(vistos.length).toBeLessThan(1150);
    const intervalos = new Set(vistos.slice(1).map((s, i) => s - vistos[i]));
    expect(intervalos.size).toBeGreaterThan(200); // sorte de verdade: não volta sempre no mesmo passo
  });
  it('as chances: Investidor ~45%, Promoção ~35%, Viralizou ~18%, dupla ~2%', () => {
    const conta = [0, 0, 0, 0];
    let n = 0;
    for (const u of [U, '098d04dc-bba1-433a-9ef8-0e9dd863e4ed', 'bf30208e-c18c-4efc-ae6d-d1331de03916']) {
      for (let s = 1_760_000_000; s < 1_760_000_000 + 2_000_000; s++) {
        const d = douradoEm(u, s);
        if (d !== null) {
          conta[d]++;
          n++;
        }
      }
    }
    const pct = conta.map((c) => c / n);
    expect(pct[0]).toBeGreaterThan(0.4);
    expect(pct[0]).toBeLessThan(0.5);
    expect(pct[1]).toBeGreaterThan(0.3);
    expect(pct[1]).toBeLessThan(0.4);
    expect(pct[2]).toBeGreaterThan(0.14);
    expect(pct[2]).toBeLessThan(0.22);
    expect(pct[3]).toBeGreaterThan(0.005);
    expect(pct[3]).toBeLessThan(0.04);
  });
  it('posição na tela dentro da margem; a dupla fica lado a lado', () => {
    for (let s = 0; s < 500; s++) {
      for (const lado of [0, 1]) {
        const p = posicao(U, s, lado);
        expect(p.x).toBeGreaterThanOrEqual(0.08);
        expect(p.x).toBeLessThanOrEqual(0.92);
        expect(p.y).toBeGreaterThanOrEqual(0.15);
        expect(p.y).toBeLessThanOrEqual(0.85);
      }
    }
    expect(JANELA_S).toBe(12);
    expect(TIPOS_DOURADO).toEqual(['investidor', 'promocao', 'viralizou', 'dupla']);
  });
});
