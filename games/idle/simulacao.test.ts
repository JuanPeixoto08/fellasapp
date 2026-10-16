import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { catalogo, PARAMETROS_ESPACO, PRECO_NIVEL } from './catalogo';
import { K_PRESTIGIO, pontosTotais, SEM_BONUS } from './economia';
import { FIM_ERA_12, gastar, primeiraVenda, RITMO_ERAS, simular, veterano, volta, type FixtureVeterano } from './simulacao';
import { mediaOportunidade, RODA_OPP_HOJE, RODA_OPP_NOVA } from './valorMedio';

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
  it('quem nunca vendeu não passa dos portões: com 1.000 pontos só compra entre os 31 de hoje', () => {
    const { arvore } = gastar(catalogo, 1000);
    expect(arvore.every((id) => id <= 65)).toBe(true);
  });
  it('com 3 vendas e a era 7, o 106 entra; nunca um infinito; `todos` compra também os que não aceleram', () => {
    const p = { vendas: 3, eraMax: 7 };
    expect(gastar(catalogo, 1000, [], p).arvore).toContain(106);
    expect(gastar(catalogo, 1e6, [], { vendas: 99, eraMax: 7 }).arvore.some((id) => id > 3000)).toBe(false);
    expect(gastar(catalogo, 1000, [], p).arvore).not.toContain(41); // Dourados não acelera a simulação
    expect(gastar(catalogo, 1000, [], p, true).arvore).toContain(41);
  });
  it('depois de vender e gastar ~10 pontos, voltar à era em que estava é mais rápido que da primeira vez', () => {
    const r = volta(catalogo, 10)!;
    expect(r).toMatchObject({ era: 5, gastos: 7 }); // 9 com o nó do Tempo (2 pontos), que saiu em 13/10
    expect(r.segunda).toBeLessThan(r.primeira);
    expect(r.segunda / r.primeira).toBeLessThan(0.91); // 234000 / 259200 = 0,90
  });
});

// Entrega 5 (0076): no modelo de valorMedio.ts a oportunidade média do jogador da simulação (sem Horta nem Bolsa na
// 1ª semana) sobe 36% (o Adubo e a Informação viram 15 min). Os ritmos têm que continuar valendo com isso. Se algum
// sair do alvo: cupons de 10 pra 5 (CUPONS_POR_OPP e a 0076), rode de novo e avise o Juan; NÃO mexa em PARAMETROS.
describe('ritmo com as oportunidades novas (entrega 5)', () => {
  const sem = { horta: false, bolsa: false };
  const minutos = 15 * (mediaOportunidade(RODA_OPP_NOVA, sem) / mediaOportunidade(RODA_OPP_HOJE, sem));
  const m = simular(catalogo, 14, SEM_BONUS, [], minutos);
  it('uns 20 min por oportunidade (eram 15)', () => expect(minutos).toBeCloseTo(20.42, 1));
  it('era 5 no dia 4 ou 5', () => {
    expect(m.era[5]!).toBeGreaterThanOrEqual(3 * DIA);
    expect(m.era[5]!).toBeLessThan(5 * DIA);
  });
  it('gerador 30 não sai na 1ª semana', () => expect(m.gerador30 === null || m.gerador30 >= 7 * DIA).toBe(true));
  it('a 1ª semana rende uns 17 pontos (16 a 18)', () => {
    const p = pontosTotais(m.amostras.find((a) => a.t >= 7 * DIA)!.taxa);
    expect(p).toBeGreaterThanOrEqual(16);
    expect(p).toBeLessThanOrEqual(18);
  });
});

// Entrega 1 das eras 6–12 (15/10): os geradores 31–42 seguem o 2º trecho da curva (catalogo.ts PARAMETROS_ESPACO), as
// gerais e o legado (nomes.ts GERAL_6/GERAL_7/LEGADO_P) e as estratégias ×2. Medido ao planejar, 20 dias: era 6 em 10,5 d
// e era 7 em 16,0 d (oportunidades de ~20,4 min) ou 16,7 d (15 min); gerador 30 no dia 8. Se sair do alvo: ajuste SÓ
// esses números (nunca PARAMETROS, que é preço em produção), regere a 0077 com ATUALIZAR_CATALOGO e avise o Juan.
describe('ritmo das eras 6 e 7', () => {
  const sem = { horta: false, bolsa: false };
  const minutos = 15 * (mediaOportunidade(RODA_OPP_NOVA, sem) / mediaOportunidade(RODA_OPP_HOJE, sem));
  const m = simular(catalogo, 20, SEM_BONUS, [], minutos);
  const antigo = simular(catalogo, 20);
  it('era 6 por volta do dia 10 (entre 9 e 12 dias de jogo)', () => {
    expect(m.era[6]).not.toBeNull();
    expect(m.era[6]!).toBeGreaterThanOrEqual(9 * DIA);
    expect(m.era[6]!).toBeLessThan(12 * DIA);
  });
  it('era 7 por volta do dia 16 (entre 15 e 18 dias de jogo)', () => {
    expect(m.era[7]).not.toBeNull();
    expect(m.era[7]!).toBeGreaterThanOrEqual(15 * DIA);
    expect(m.era[7]!).toBeLessThan(18 * DIA);
  });
  it('com as oportunidades de antes (15 min), as mesmas faixas', () => {
    expect(antigo.era[6]!).toBeGreaterThanOrEqual(9 * DIA);
    expect(antigo.era[6]!).toBeLessThan(12 * DIA);
    expect(antigo.era[7]!).toBeGreaterThanOrEqual(15 * DIA);
    expect(antigo.era[7]!).toBeLessThan(18 * DIA);
  });
  it('a era 6 não sai antes do gerador 30 (o Foguete segue sendo a porta do espaço)', () => {
    expect(m.gerador30).not.toBeNull();
    expect(m.era[6]!).toBeGreaterThan(m.gerador30!);
  });
  it('a régua das 12 eras fica registrada (as 8+ são alvo das próximas entregas)', () => {
    expect(RITMO_ERAS).toEqual({ 6: 10, 7: 16, 8: 24, 9: 31, 10: 38, 11: 45, 12: 52 });
    expect(FIM_ERA_12).toBe(60);
  });
});

describe('os números cabem no double até a era 12', () => {
  it('a curva do 2º trecho até o gerador 72, com 300 unidades e a melhoria mais cara, fica longe de 1e308', () => {
    const q = PARAMETROS_ESPACO;
    const custo72 = q.custoInicial * q.crescimentoCusto ** (72 - q.aPartirDe);
    expect(custo72 * 1.15 ** 300 * PRECO_NIVEL[7]).toBeLessThan(1e100);
  });
});

// Árvore grande (16/10): o veterano do retrato (games/test/fixtures, o maior F$/s de 15/10) vende, gasta na parte fixa
// e recomeça até fechar. Medido ao planejar: fecha no dia 12,2 (passo 30 s; 12,8 com 5 s), em ~11 vendas; a árvore
// cheia deixa a produção dele ~×20 (×26,9 com o legado ×1,5/×2 da spec; o Juan escolheu ×1,25/×1,5); o modelo × 17,2 dá o F$/s real (contratos, convidados, Mapa, Horta). A parte fixa
// não pode passar de ~67 mil pontos: acima disso a era 7 trava e ele não fecha até as eras 8–9 (Decisão 2 do plano).
// Preços ×2 (Task 10b, decisão do Juan de 16/10; a parte fixa nova passa de 58.917 pra ~118 mil). O teto de pontos da era 7
// (~63,6 mil no total) não deixa fechar: medido em 20 dias de jogo, o veterano NÃO fecha, trava no dia 16,7 com 13 vendas
// (a 14ª, no dia 23,7, já cai fora dos 20 dias) e compra 35,1% do custo da parte fixa nova (~41,6 mil de ~118 mil;
// o teto da era 7 daria no máximo ~54%); a árvore fixa cheia segue ×21,2 (o efeito dos nós não mudou). Antes (×1): fechava no dia 12,17.
// Se sair da faixa: ajuste SÓ os custos novos de catalogo.ts, regere a 0081 (ainda não publicada) e avise o Juan.
describe('o veterano (árvore grande)', () => {
  const fix = JSON.parse(readFileSync(resolve(__dirname, '../test/fixtures/veterano-2026-10-15.json'), 'utf8')) as FixtureVeterano;
  const tem = { horta: true, bolsa: true };
  const minutos = 15 * (mediaOportunidade(RODA_OPP_NOVA, tem) / mediaOportunidade(RODA_OPP_HOJE, tem));
  const v = veterano(fix, catalogo, { minutosOpp: minutos, dias: 20 });
  it('o retrato: era 7, a venda de agora daria 18.753 pontos no total; o fator de fora do modelo fica perto de 17', () => {
    expect(fix).toMatchObject({ era: 7, prestige_earned: 232, prestige_count: 3 });
    expect(pontosTotais(fix.rate)).toBe(18753);
    expect(v.extra).toBeGreaterThan(14);
    expect(v.extra).toBeLessThan(21);
  });
  it('em 20 dias na era 7 NÃO fecha a parte fixa e compra entre 35% e 70% dela (alvo do Juan: ~metade)', () => {
    expect(v.dia).toBeNull();
    expect(v.diaTrava).toBeGreaterThan(10);
    expect(v.comprado).toBeGreaterThan(0.35);
    expect(v.comprado).toBeLessThan(0.7);
  });
  it('a árvore fixa cheia deixa a produção dele entre ×15 e ×23 (alvo ~×20, Decisão 3)', () => {
    expect(v.multCheio).toBeGreaterThan(15);
    expect(v.multCheio).toBeLessThan(23);
  });
});
