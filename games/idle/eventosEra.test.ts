import { describe, expect, it } from 'vitest';
import {
  descontoAtivo, eventoEraEm, ganhoEventoAgora, JANELA_EVENTO_S, marmitaAtiva, MAX_GOLS, premioShopee, textoEventoPegou,
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
  it('era 1: só a mãe; era acima de 5 conta como 5', () => {
    for (let s = ini; s < ini + 200_000; s++) {
      const t = eventoEraEm(A, s, 1);
      if (t !== null) expect(t).toBe(1);
    }
    for (let s = ini; s < ini + 50_000; s++) expect(eventoEraEm(A, s, 7)).toBe(eventoEraEm(A, s, 5));
  });
  it('o prêmio da Shopee: ~50% F$, ~35% Promoção, ~15% ×5', () => {
    const c = [0, 0, 0];
    for (let s = ini; s < ini + 20_000; s++) c[premioShopee(A, s)]++;
    expect(c[0] / 20_000).toBeCloseTo(0.5, 1);
    expect(c[1] / 20_000).toBeCloseTo(0.35, 1);
    expect(c[2] / 20_000).toBeCloseTo(0.15, 1);
  });
  it('janelas e gols', () => {
    expect(JANELA_EVENTO_S).toEqual({ 1: 8, 2: 12, 3: 12, 4: 5, 5: 30 });
    expect(MAX_GOLS).toBe(7);
  });
});

describe('o que está valendo', () => {
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
