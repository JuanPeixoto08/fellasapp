import { describe, expect, it } from 'vitest';

import {
  COMBO_MULT, COMBO_PRECISA, CHUVA_S, douradoEm, douradosEntre, escolhaLinkedin, ganhoInvestidor, JANELA_S, janelaS, LINKEDIN_MULT, MOEDINHA_S,
  PIX_FICAR_S, posicao, promoAtiva, segundoPix, selosBonus, TIGRE_CHANCE, TIGRE_COME_S, TIGRE_GRATIS, TIGRE_PAGA_S, tigrePaga, TIPOS_DOURADO,
  tipoDourado, tipoGarantido, TREND_MAX, textoPegou,
} from './dourados';

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
  it('as chances da roda nova: 25 · 18 · 13 · 2 · 12 · 12 · 10 · 8 (%)', () => {
    const conta = Array(8).fill(0);
    let n = 0;
    for (const u of [U, '098d04dc-bba1-433a-9ef8-0e9dd863e4ed', 'bf30208e-c18c-4efc-ae6d-d1331de03916']) {
      for (let s = 1_760_000_000; s < 1_760_000_000 + 200_000; s++) {
        conta[tipoDourado(u, s)]++;
        n++;
      }
    }
    [0.25, 0.18, 0.13, 0.02, 0.12, 0.12, 0.1, 0.08].forEach((p, t) => expect(Math.abs(conta[t] / n - p), `tipo ${t}`).toBeLessThan(0.01));
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
    expect(TIPOS_DOURADO).toEqual(['investidor', 'promocao', 'viralizou', 'dupla', 'trend', 'linkedin', 'pix', 'tigrinho']);
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
    // os ×5 da oportunidade empilhados somam (0064): ×5, ×10…, até o primeiro acabar
    expect(selosBonus({ promo_ate: null, viral: [], boosts: [em(42)] }, T)).toEqual([{ texto: '×5 · 0:42', ouro: false }]);
    expect(selosBonus({ promo_ate: null, viral: [em(15)], boosts: [em(55), em(30), em(-1)] }, T)).toEqual([
      { texto: '×10 · 0:15', ouro: false }, { texto: '×10 · 0:30', ouro: true }]);
  });
  it('o texto que sobe ao pegar', () => {
    expect(textoPegou(0, { ganho: 1_234_567, viral: 0 })).toBe('+F$ 1,23 mi');
    expect(textoPegou(1, { ganho: 0, viral: 0 })).toBe('Promoção! Tudo pela metade por 30 s');
    expect(textoPegou(2, { ganho: 0, viral: 1 })).toBe('Viralizou! ×10 por 1 min');
    expect(textoPegou(3, { ganho: 0, viral: 2 })).toBe('×100!');
    expect(textoPegou(2, { ganho: 0, viral: 3 })).toBe('×1.000!');
  });
  it('o que o Investidor paga (igual a idle_dourado_pegar): 20 min da produção × Investidor anjo × (1 + oportunidades da horta)', () => {
    expect(ganhoInvestidor(2, 1, 0)).toBe(2400);
    expect(ganhoInvestidor(2, 2, 0)).toBe(4800);
    expect(ganhoInvestidor(2, 2, 0.075)).toBeCloseTo(4800 * 1.075, 9); // Inhame (+5%) com o Agrotóxico (×1,5)
  });
  it('com o Hype (duração 2): Promoção por 1 min e Viralizou por 2 min; Olho de lince: 24 s na tela', () => {
    expect(textoPegou(1, { ganho: 0, viral: 1, duracao: 2 })).toBe('Promoção! Tudo pela metade por 1 min');
    expect(textoPegou(2, { ganho: 0, viral: 1, duracao: 2 })).toBe('Viralizou! ×10 por 2 min');
    expect(janelaS(0, 24)).toBe(24);
    expect(janelaS(1, 24)).toBe(12);
    expect(janelaS(1)).toBe(6);
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

describe('selos dos eventos de era', () => {
  it('selos da Marmita e da Atualização, com caixinha', () => {
    const agora = Date.parse('2026-10-14T12:00:00Z');
    const l = selosBonus({ promo_ate: null, marmita_ate: '2026-10-14T12:02:41Z', upg_desc_ate: '2026-10-14T12:01:40Z' }, agora);
    expect(l.map((x) => x.texto)).toEqual(['Marmita ×3 · 2:41', 'Melhorias −25% · 1:40']);
    expect(l[0].dica?.titulo).toBe('Marmita da mãe');
    expect(l[1].dica?.titulo).toBe('Atualização instalada');
  });
});

describe('os sorteios dos dourados novos (iguais ao banco: idle_dourado_sorteio)', () => {
  it('garantido: a roda sem Pix nem Tigrinho (os dois viram Investidor)', () => {
    for (let s = 1_760_000_000; s < 1_760_000_000 + 20_000; s++) {
      const t = tipoDourado(U, s);
      expect(tipoGarantido(U, s)).toBe(t >= 6 ? 0 : t);
    }
  });
  it('Pix devolvido: o garantido cai de 20 a 120 s depois', () => {
    const vistos = new Set<number>();
    for (let s = 1_760_000_000; s < 1_760_000_000 + 5_000; s++) {
      const d = segundoPix(U, s) - s;
      expect(d).toBeGreaterThanOrEqual(20);
      expect(d).toBeLessThanOrEqual(120);
      vistos.add(d);
    }
    expect(vistos.size).toBeGreaterThan(90);
  });
  it('Tigrinho: a casa paga 3 em cada 10', () => {
    let n = 0;
    for (let s = 1_760_000_000; s < 1_760_000_000 + 20_000; s++) if (tigrePaga(U, s)) n++;
    expect(n / 20_000).toBeCloseTo(0.3, 1);
  });
  it('LinkedIn: um dos 5 que mais rendem; f = a parte dele na soma; sem renda nenhuma, null', () => {
    const rendas = [0, 10, 40, 5, 0, 20, 1, 2, 30, ...Array(21).fill(0)]; // rendem os geradores 2, 3, 4, 6, 7, 8 e 9
    const top = new Set([3, 9, 6, 2, 4]); // 40, 30, 20, 10, 5
    const vistos = new Set<number>();
    for (let s = 1_760_000_000; s < 1_760_000_000 + 500; s++) {
      const e = escolhaLinkedin(U, s, rendas)!;
      expect(top.has(e.gen)).toBe(true);
      expect(e.f).toBeCloseTo(rendas[e.gen - 1] / 108, 12);
      vistos.add(e.gen);
    }
    expect(vistos.size).toBe(5);
    expect(escolhaLinkedin(U, 1, Array(30).fill(0))).toBeNull();
    expect(escolhaLinkedin(U, 1, [7, ...Array(29).fill(0)])).toEqual({ gen: 1, f: 1 });
  });
  it('as constantes da spec (e as do plano: o Tigrinho paga 30 min e come 15)', () => {
    expect({ TREND_MAX, CHUVA_S, MOEDINHA_S, PIX_FICAR_S, TIGRE_GRATIS, TIGRE_CHANCE, TIGRE_PAGA_S, TIGRE_COME_S, LINKEDIN_MULT, COMBO_MULT, COMBO_PRECISA }).toEqual({
      TREND_MAX: 20, CHUVA_S: 8, MOEDINHA_S: 60, PIX_FICAR_S: 1800, TIGRE_GRATIS: 3, TIGRE_CHANCE: 30, TIGRE_PAGA_S: 1800, TIGRE_COME_S: 900,
      LINKEDIN_MULT: 30, COMBO_MULT: 7, COMBO_PRECISA: 3,
    });
  });
});
