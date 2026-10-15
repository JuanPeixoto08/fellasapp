import { describe, expect, it } from 'vitest';
import { descontoAtivo, eventoEraEm, JANELA_EVENTO_S, marmitaAtiva, MAX_GOLS, premioShopee } from './eventosEra';

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
