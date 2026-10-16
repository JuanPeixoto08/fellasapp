import { describe, expect, it } from 'vitest';
import {
  DESVIO_S, descontoAtivo, EVENTO_PADRAO, eventoEraEm, ganhoEventoAgora, JANELA_EVENTO_S, marmitaAtiva, MAX_DESVIOS, MAX_GOLS, NOME_EVENTO_ERA,
  premioShopee, SILVER_MULT, silverAtivo, textoEventoPegou,
} from './eventosEra';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const ini = 1_760_000_000;

describe('eventos de era: a sorte', () => {
  it('uns 1/1800 por segundo', () => {
    let n = 0;
    for (let s = ini; s < ini + 360_000; s++) if (eventoEraEm(A, s, 5) !== null) n++;
    expect(n).toBeGreaterThan(150);
    expect(n).toBeLessThan(260);
  });
  it('só os das eras até a sua; o da sua era sai ~3× mais que cada antigo', () => {
    const conta = [0, 0, 0, 0, 0, 0];
    for (let s = ini; s < ini + 2_000_000; s++) {
      const t = eventoEraEm(A, s, 3);
      if (t !== null) conta[t]++;
    }
    expect(conta[4] + conta[5]).toBe(0);
    expect(conta[3] / conta[1]).toBeGreaterThan(2);
    expect(conta[3] / conta[1]).toBeLessThan(4.5);
  });
  it('eras 6 e 7: o Lixo e o Houston entram na roda; na era 7 o Houston sai ~3× mais que a mãe; na 6 não tem Houston', () => {
    const conta = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let s = ini; s < ini + 2_000_000; s++) {
      const t = eventoEraEm(A, s, 7);
      if (t !== null) conta[t]++;
    }
    expect(conta[6]).toBeGreaterThan(0);
    expect(conta[7] / conta[1]).toBeGreaterThan(2);
    expect(conta[7] / conta[1]).toBeLessThan(4.5);
    for (let s = ini; s < ini + 400_000; s++) expect(eventoEraEm(A, s, 6)).not.toBe(7);
    expect([NOME_EVENTO_ERA[6], NOME_EVENTO_ERA[7]]).toEqual(['Lixo espacial', 'Houston, temos um problema']);
  });
  it('era 1: só a mãe; era acima de 7 conta como 7', () => {
    for (let s = ini; s < ini + 200_000; s++) {
      const t = eventoEraEm(A, s, 1);
      if (t !== null) expect(t).toBe(1);
    }
    for (let s = ini; s < ini + 50_000; s++) expect(eventoEraEm(A, s, 9)).toBe(eventoEraEm(A, s, 7));
  });
  it('o prêmio da Shopee: ~50% F$, ~35% Promoção, ~15% ×5', () => {
    const c = [0, 0, 0];
    for (let s = ini; s < ini + 20_000; s++) c[premioShopee(A, s)]++;
    expect(c[0] / 20_000).toBeCloseTo(0.5, 1);
    expect(c[1] / 20_000).toBeCloseTo(0.35, 1);
    expect(c[2] / 20_000).toBeCloseTo(0.15, 1);
  });
  it('janelas e gols', () => {
    expect(JANELA_EVENTO_S).toEqual({ 1: 8, 2: 12, 3: 12, 4: 5, 5: 30, 6: 10, 7: 8 });
    expect([MAX_DESVIOS, DESVIO_S, SILVER_MULT]).toEqual([3, 600, 4]);
    expect(MAX_GOLS).toBe(7);
  });
});

describe('o que está valendo', () => {
  it('Silver tape pelo fim; ausente ou null = nada', () => {
    const agora = Date.parse('2026-10-15T12:00:00Z');
    expect(silverAtivo({ silver_ate: '2026-10-15T12:01:52Z' }, agora)).toBe(true);
    expect(silverAtivo({ silver_ate: '2026-10-15T11:59:00Z' }, agora)).toBe(false);
    expect(silverAtivo({}, agora)).toBe(false);
    expect(silverAtivo({ silver_ate: null }, agora)).toBe(false);
  });
  it('marmita e desconto pelo fim; campo ausente ou null = nada', () => {
    const agora = Date.parse('2026-10-14T12:00:00Z');
    expect(marmitaAtiva({ marmita_ate: '2026-10-14T12:01:00Z' }, agora)).toBe(true);
    expect(marmitaAtiva({ marmita_ate: '2026-10-14T11:59:00Z' }, agora)).toBe(false);
    expect(marmitaAtiva({}, agora)).toBe(false);
    expect(descontoAtivo({ upg_desc_ate: null }, agora)).toBe(false);
    expect(descontoAtivo({ upg_desc_ate: '2026-10-14T12:00:30Z' }, agora)).toBe(true);
  });
});

describe('textos e ganhos', () => {
  it('Lixo e Houston: o que sobe e quanto dá agora', () => {
    expect(textoEventoPegou({ tipo: 6, premio: null, ganho: 3_600_000, gols: 3 })).toBe('3 destroços desviados! +F$ 3,6 mi');
    expect(textoEventoPegou({ tipo: 6, premio: null, ganho: 1_200_000, gols: 1 })).toBe('1 destroço desviado! +F$ 1,2 mi');
    expect(textoEventoPegou({ tipo: 7, premio: null, ganho: 0, gols: 0 })).toBe('Consertado com silver tape! ×4 por 2 min');
    expect(ganhoEventoAgora(6, 2000)).toBe(2000 * 600); // por destroço
    expect(ganhoEventoAgora(7, 2000)).toBe(2000 * 120 * 3); // o que o ×4 dá a mais em 2 min
  });
  it('o que sobe quando pega', () => {
    expect(textoEventoPegou({ tipo: 1, premio: null, ganho: 0, gols: 0 })).toBe('Marmita da mãe! ×3 por 3 min');
    expect(textoEventoPegou({ tipo: 2, premio: 0, ganho: 980_000, gols: 0 })).toBe('+F$ 980 mil (Taxa das blusinhas: −20%)');
    expect(textoEventoPegou({ tipo: 2, premio: 1, ganho: 0, gols: 0 })).toBe('Promoção! Tudo pela metade por 1 min');
    expect(textoEventoPegou({ tipo: 2, premio: 2, ganho: 0, gols: 0 })).toBe('×5 por 2 min');
    expect(textoEventoPegou({ tipo: 3, premio: null, ganho: 1_200_000, gols: 0 })).toBe('Fugiu da call! +F$ 1,2 mi');
    expect(textoEventoPegou({ tipo: 4, premio: null, ganho: 0, gols: 0 })).toBe('Atualização instalada! Melhorias −25%');
    expect(textoEventoPegou({ tipo: 5, premio: null, ganho: 3_100_000, gols: 4 })).toBe('4 gols! +F$ 3,1 mi');
    expect(textoEventoPegou({ tipo: 5, premio: null, ganho: 1, gols: 1 })).toBe('1 gol! +F$ 1');
  });
  it('ganho agora: Shopee 1 h × 0,8; call 30 min; gol 5 min', () => {
    expect(ganhoEventoAgora(2, 10)).toBeCloseTo(28_800, 6);
    expect(ganhoEventoAgora(3, 10)).toBeCloseTo(18_000, 6);
    expect(ganhoEventoAgora(5, 10)).toBeCloseTo(3_000, 6);
    expect(ganhoEventoAgora(1, 10)).toBe(0);
  });
});

describe('eventos de era com a árvore grande (Espaço; igual a idle_evento_era/idle_evento_pegar na 0082)', () => {
  it('TARS (1,5×): os segundos de sempre continuam, com ~50% a mais, os mesmos tipos nos de sempre', () => {
    let base = 0;
    let mais = 0;
    for (let s = 1_760_000_000; s < 1_760_000_000 + 400_000; s++) {
      const a = eventoEraEm(A, s, 7);
      const b = eventoEraEm(A, s, 7, 1.5);
      if (a !== null) {
        base++;
        expect(b).toBe(a);
      }
      if (b !== null) mais++;
    }
    expect(mais / base).toBeGreaterThan(1.3);
    expect(mais / base).toBeLessThan(1.7);
  });
  it('Lixo 15 min por destroço; Silver 3 min ×5: o que dá agora e o texto', () => {
    const ev = { lixoMin: 15, silverMin: 3, silverMult: 5 };
    expect(ganhoEventoAgora(6, 10, ev)).toBe(10 * 900);
    expect(ganhoEventoAgora(7, 10, ev)).toBe(10 * 180 * 4);
    expect(ganhoEventoAgora(6, 10)).toBe(10 * 600);
    expect(EVENTO_PADRAO).toEqual({ lixoMin: 10, silverMin: 2, silverMult: 4 });
    expect(textoEventoPegou({ tipo: 7, premio: null, ganho: 0, gols: 0 }, ev)).toBe('Consertado com silver tape! ×5 por 3 min');
    expect(textoEventoPegou({ tipo: 7, premio: null, ganho: 0, gols: 0 })).toBe('Consertado com silver tape! ×4 por 2 min');
  });
});
