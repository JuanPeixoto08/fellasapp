import { describe, expect, it } from 'vitest';

import { catalogo } from './catalogo';
import { K_PRESTIGIO, pontosTotais } from './economia';
import { gastar, primeiraVenda, simular, volta } from './simulacao';

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

// Prestígio (spec da entrega 3, seção 1.4). Medido ao planejar, com K = 1 milhão: a venda vale 1 ponto já no dia 1
// (0,7 d, era 3), 5 pontos com 2,7 d (era 4), 10 pontos com 5,5 d (11 pontos, era 5) e 15 no fim da semana.
// Vendendo com 11 e gastando 9 na árvore (Virou MEI, Cafezinho de garrafa térmica, Porquinho quebrado, Grupo de promoção no zap, Soneca pós-almoço), a era 5
// chega com 2,7 d (era 3,0 d) e a era 2 com 520 s (era 895 s). Se algum número sair do alvo, NÃO mexa em PARAMETROS
// nem em K: pare e avise. A razão 0,90 é quantizada pelas sessões (3 por dia: a era só chega no fim de uma), e a 2ª
// empresa recomeça com a cota de oportunidades do dia zerada.
describe('ritmo do prestígio', () => {
  const m = simular(catalogo, 14);
  it('K é 1 milhão (o mesmo de idle_prestige_total na 0041)', () => expect(K_PRESTIGIO).toBe(1e6));
  it('a primeira venda que vale a pena (5 pontos) sai no dia 3 ou 4, na era 4 ou 5', () => {
    const v = primeiraVenda(m, 5);
    expect(v).not.toBeNull();
    expect(v!.t).toBeGreaterThanOrEqual(2 * DIA);
    expect(v!.t).toBeLessThan(4 * DIA);
    expect([4, 5]).toContain(v!.era);
  });
  it('5 pontos não saem antes do dia 3 (a primeira venda não compensa cedo demais)', () => {
    expect(pontosTotais(m.amostras.filter((a) => a.t < 2 * DIA).at(-1)!.taxa)).toBeLessThan(5);
  });
  // eram 15 com o teto de 8h fechado; sem teto (13/10) a noite rende inteira
  it('a primeira semana rende uns 17 pontos', () => {
    expect(pontosTotais(m.amostras.find((a) => a.t >= 7 * DIA)!.taxa)).toBe(17);
  });
  it('quem gasta compra o mais barato que acelera: com 11 pontos, a raiz, o 1º de três ramos e o 2º da Produção', () => {
    expect(gastar(catalogo, 11)).toEqual({ arvore: [1, 11, 21, 31, 12], sobra: 0 });
  });
  it('depois de vender e gastar ~10 pontos, voltar à era em que estava é mais rápido que da primeira vez', () => {
    const r = volta(catalogo, 10)!;
    expect(r).toMatchObject({ era: 5, gastos: 7 }); // 9 com o nó do Tempo (2 pontos), que saiu em 13/10
    expect(r.segunda).toBeLessThan(r.primeira);
    expect(r.segunda / r.primeira).toBeLessThan(0.91); // 234000 / 259200 = 0,90
  });
});
