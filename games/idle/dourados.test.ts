import { describe, expect, it } from 'vitest';

import { douradoEm, douradosEntre, JANELA_S, posicao, promoAtiva, selosBonus, TIPOS_DOURADO, textoPegou } from './dourados';

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

describe('selos e textos', () => {
  const T = Date.parse('2026-10-11T20:00:00.000Z');
  const em = (s: number) => new Date(T + s * 1000).toISOString();
  it('Promoção vale até promo_ate', () => {
    expect(promoAtiva({ promo_ate: em(10) }, T)).toBe(true);
    expect(promoAtiva({ promo_ate: em(-1) }, T)).toBe(false);
    expect(promoAtiva({ promo_ate: null }, T)).toBe(false);
  });
  it('selo ao lado do F$: ×10, ×100 (dourado, até o primeiro acabar) e Metade, com o tempo que falta', () => {
    expect(selosBonus({ promo_ate: null, viral: [] }, T)).toEqual([]);
    expect(selosBonus({ promo_ate: null, viral: [em(42)] }, T)).toEqual([{ texto: '×10 · 0:42', ouro: false }]);
    expect(selosBonus({ promo_ate: null, viral: [em(15), em(55)] }, T)).toEqual([{ texto: '×100 · 0:15', ouro: true }]);
    expect(selosBonus({ promo_ate: null, viral: [em(5), em(15), em(55)] }, T)).toEqual([{ texto: '×1.000 · 0:05', ouro: true }]);
    expect(selosBonus({ promo_ate: em(21), viral: [em(-3)] }, T)).toEqual([{ texto: 'Metade · 0:21', ouro: false }]);
  });
  it('o texto que sobe ao pegar', () => {
    expect(textoPegou(0, { ganho: 1_234_567, viral: 0 })).toBe('+F$ 1,23 mi');
    expect(textoPegou(1, { ganho: 0, viral: 0 })).toBe('Promoção! Tudo pela metade por 30 s');
    expect(textoPegou(2, { ganho: 0, viral: 1 })).toBe('Viralizou! ×10 por 1 min');
    expect(textoPegou(3, { ganho: 0, viral: 2 })).toBe('×100!');
    expect(textoPegou(2, { ganho: 0, viral: 3 })).toBe('×1.000!');
  });
});

describe('agenda do fundo', () => {
  it('lista os eventos de um intervalo de segundos (pra agendar o som com a aba escondida)', () => {
    const ini = 1_760_000_000;
    const lista = douradosEntre(U, ini, ini + 60_000);
    const esperado: { seg: number; tipo: number }[] = [];
    for (let s = ini; s < ini + 60_000; s++) {
      const d = douradoEm(U, s);
      if (d !== null) esperado.push({ seg: s, tipo: d });
    }
    expect(lista).toEqual(esperado);
    expect(lista.length).toBeGreaterThan(50);
  });
});
