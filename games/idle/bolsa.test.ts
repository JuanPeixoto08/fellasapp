import { describe, expect, it } from 'vitest';

import { GameError, toGameError } from '../shared/errors';
import { EMPRESAS_BOLSA } from './bolsaMotor';
import { GERADORES } from './nomes';
import { acoes, avisosPo, contaLimite, empresa, empresaDoGerador, lucro, maxCompra, melhoriaAtual, pct, proximaMelhoria, textoQuebra, variacao } from './bolsa';

describe('contas e textos da Bolsa', () => {
  it('porcentagem com sinal, uma casa, menos de verdade', () => {
    expect(pct(0.042)).toBe('+4,2%');
    expect(pct(-0.031)).toBe('−3,1%');
    expect(pct(0)).toBe('0%');
    expect(pct(0.31)).toBe('+31%');
  });
  it('variação no minuto e na hora pelo histórico', () => {
    expect(variacao([10, 12, 11])).toEqual({ minuto: 11 / 12 - 1, hora: 11 / 10 - 1 });
    expect(variacao([10])).toEqual({ minuto: 0, hora: 0 });
    expect(variacao([])).toEqual({ minuto: 0, hora: 0 });
  });
  it('lucro sobre o preço médio (em segundos, não muda com a produção)', () => {
    expect(lucro(33, { empresa: 1, qtd: 10, custo: 300 })).toBeCloseTo(0.1, 12);
  });
  it('Máx: o que o F$ (com a corretagem) e o limite deixam, nunca negativo', () => {
    expect(maxCompra(1000, 10, 2, 120, 0, 0.05)).toBe(Math.floor(1000 / (10 * 2 * 1.05)));
    expect(maxCompra(1000, 10, 2, 120, 0, 0.01)).toBe(Math.floor(1000 / (10 * 2 * 1.01)));
    expect(maxCompra(1e12, 10, 2, 120, 100, 0.05)).toBe(20);
    expect(maxCompra(1e12, 10, 2, 120, 130, 0.05)).toBe(0);
    expect(maxCompra(0, 10, 2, 120, 0, 0.05)).toBe(0);
  });
  it('melhorias: o nível atual e o próximo (nome, efeito, custo em segundos); no 5 não tem próximo', () => {
    expect(melhoriaAtual('corretor', 0)).toEqual({ nome: 'Sem corretor', efeito: 'Corretagem 5%' });
    expect(melhoriaAtual('corretor', 2)).toEqual({ nome: 'Assessor do banco', efeito: 'Corretagem 3%' });
    expect(melhoriaAtual('escritorio', 0)).toEqual({ nome: 'Sem escritório', efeito: '+0 ações em cada empresa' });
    expect(proximaMelhoria('corretor', 0)).toEqual({ nivel: 1, nome: 'Primo que entende de ação', efeito: 'Corretagem 4%', segundos: 1800 });
    expect(proximaMelhoria('escritorio', 4)).toEqual({ nivel: 5, nome: 'Torre na Berrini', efeito: '+400 ações em cada empresa', segundos: 57600 });
    expect(proximaMelhoria('corretor', 4)!.efeito).toBe('Corretagem 0,5%');
    expect(proximaMelhoria('escritorio', 5)).toBeNull();
  });
  it('a conta do limite mostra o gerador ligado (e o Escritório, se tiver)', () => {
    expect(contaLimite(3, 105, 0)).toBe('Limite: 100 + 5 Curso online');
    expect(contaLimite(1, 145, 1)).toBe('Limite: 100 + 20 Food truck + 25 do Escritório');
    expect(contaLimite(6, 100, 0)).toBe('Limite: 100 + 0 Live na Twitch');
  });
  it('gerador → empresa ligada (só os 8 da Bolsa)', () => {
    expect(empresaDoGerador(16)?.codigo).toBe('COCH');
    expect(empresaDoGerador(11)?.codigo).toBe('PSTL');
    expect(empresaDoGerador(1)).toBeUndefined();
  });
  it('textos', () => {
    expect(acoes(1)).toBe('1 ação');
    expect(acoes(12)).toBe('12 ações');
    expect(textoQuebra(1007, 1000)).toBe('Quebrou · volta em 7 min');
    expect(textoQuebra(1001, 1000)).toBe('Quebrou · volta em 1 min');
    expect(empresa(4).nome).toBe('Cripto do Primo');
    expect(avisosPo([{ empresa: 4, qtd: 120 }, { empresa: 6, qtd: 1 }])).toEqual([
      'Suas 120 ações da Cripto do Primo viraram pó.', 'Sua 1 ação do NFT de Meme virou pó.',
    ]);
  });
  it('erros novos do banco viram frase', () => {
    const casos: [string, string][] = [
      ['idle_bolsa_nivel', 'Essa melhoria já mudou. Confere de novo'],
      ['idle_bolsa_preco_mudou', 'O preço mudou, confere de novo'],
      ['idle_bolsa_rj', 'Essa empresa quebrou. Volta em alguns minutos'],
      ['idle_bolsa_limite', 'Chegou no limite de ações dessa empresa'],
      ['idle_bolsa_fechada', 'Compra 1 Grupo de trader pra abrir a Bolsa'],
      ['idle_bolsa_sem_acoes', 'Você não tem ações dessa empresa'],
    ];
    for (const [code, texto] of casos) {
      const e = toGameError({ message: code });
      expect(e).toBeInstanceOf(GameError);
      expect(e.code).toBe(code);
      expect(e.message).toBe(texto);
    }
  });
});

describe('limite com a árvore grande', () => {
  it('o banco manda o gerador (limite_gen): sem árvore, a frase de sempre; com árvore, o total e de onde vem', () => {
    const id = EMPRESAS_BOLSA[0].id;
    expect(contaLimite(id, 130, 1, 5)).toBe(`Limite: 100 + 5 ${GERADORES[EMPRESAS_BOLSA[0].gerador - 1]} + 25 do Escritório`);
    expect(contaLimite(id, 760, 1, 5)).toBe(`Limite: 760 (100 + 5 ${GERADORES[EMPRESAS_BOLSA[0].gerador - 1]} + 25 do Escritório, com a árvore)`);
    expect(contaLimite(id, 130, 1)).toBe(`Limite: 100 + 5 ${GERADORES[EMPRESAS_BOLSA[0].gerador - 1]} + 25 do Escritório`); // resposta velha
  });
  it('Escritório na Faria Lima (×1,5): a conta mostra o ×1,5 e as partes fecham o total', () => {
    const id = EMPRESAS_BOLSA[0].id;
    const g = GERADORES[EMPRESAS_BOLSA[0].gerador - 1];
    expect(contaLimite(id, 142, 1, 5, 1.5)).toBe(`Limite: 100 + 5 ${g} + 25 ×1,5 do Escritório`); // floor(100 + 5 + 37,5)
    expect(contaLimite(id, 205, 2, 30, 1.5)).toBe(`Limite: 100 + 30 ${g} + 50 ×1,5 do Escritório`);
    expect(contaLimite(id, 900, 2, 30, 1.5)).toBe(`Limite: 900 (100 + 30 ${g} + 50 ×1,5 do Escritório, com a árvore)`);
    expect(contaLimite(id, 105, 0, 5, 1.5)).toBe(`Limite: 100 + 5 ${g}`); // sem Escritório o ×1,5 não aparece
  });
  it('cartões do Corretor e do Escritório com a árvore: corretagem × o nó, bônus × o Faria Lima', () => {
    const arv = { corretagem: 0.5, escritorio: 1.5 };
    expect(melhoriaAtual('corretor', 0, arv).efeito).toBe('Corretagem 2,5%');
    expect(melhoriaAtual('corretor', 2, { corretagem: 0.8, escritorio: 1 }).efeito).toBe('Corretagem 2,4%');
    expect(melhoriaAtual('escritorio', 2, arv).efeito).toBe('+75 ações em cada empresa');
    expect(proximaMelhoria('corretor', 4, { corretagem: 0.25, escritorio: 1 })!.efeito).toBe('Corretagem 0,125%');
    expect(proximaMelhoria('escritorio', 0, arv)!.efeito).toBe('+37,5 ações em cada empresa');
    expect(proximaMelhoria('escritorio', 4, arv)).toMatchObject({ nivel: 5, efeito: '+600 ações em cada empresa', segundos: 57600 });
    // sem os nós (fatores 1), a frase de sempre
    expect(melhoriaAtual('corretor', 2, { corretagem: 1, escritorio: 1 }).efeito).toBe('Corretagem 3%');
    expect(proximaMelhoria('escritorio', 4, { corretagem: 1, escritorio: 1 })!.efeito).toBe('+400 ações em cada empresa');
  });
});
