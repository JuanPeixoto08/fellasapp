import { describe, expect, it } from 'vitest';

import { simular } from './simulacao';

const H = 3600;
const DIA = 24 * H;

// Jogador que abre 3x por dia (meio-dia, 17h, meia-noite) e sempre compra o que se paga mais rápido.
// A primeira sessão dura 1h. Os alvos são os da spec (seção 1.3).
// Com o piso de freela (+2%, entrega 2), medido ao implementar: 2º notebook 15 s, era 2 em 895 s, era 3 em 0,5 d (43210 s),
// era 4 em 1,0 d (86405 s), era 5 em 3,0 d (259200 s), 489 compras na 1ª hora, gerador 30 fora. Era 4 e era 5 caem no começo de uma sessão
// (meia-noite); a era 2 tem pouca folga para o teto de 900 s.
// Se algum marco sair do alvo, NÃO mexa em PARAMETROS (mudaria os preços em produção): pare e avise.
describe('ritmo da semana', () => {
  const m = simular();
  it('2º notebook em até 15 s', () => {
    expect(m.segundaNotebook).not.toBeNull();
    expect(m.segundaNotebook!).toBeLessThanOrEqual(15);
  });
  it('era 2 entre 10 e 15 min', () => {
    expect(m.era[2]).not.toBeNull();
    expect(m.era[2]!).toBeGreaterThanOrEqual(10 * 60);
    expect(m.era[2]!).toBeLessThanOrEqual(15 * 60);
  });
  it('era 3 no dia 1', () => expect(m.era[3]!).toBeLessThan(DIA));
  it('era 4 no dia 2 ou 3', () => {
    expect(m.era[4]!).toBeGreaterThanOrEqual(DIA);
    expect(m.era[4]!).toBeLessThan(3 * DIA);
  });
  it('era 5 no dia 4 ou 5', () => {
    expect(m.era[5]!).toBeGreaterThanOrEqual(3 * DIA);
    expect(m.era[5]!).toBeLessThan(5 * DIA);
  });
  it('pelo menos 60 compras na primeira hora (sempre tem o que comprar)', () => {
    expect(m.compras1h).toBeGreaterThanOrEqual(60);
  });
  it('gerador 30 não sai numa semana jogando assim (raro de propósito)', () => expect(m.gerador30).toBeNull());
});
