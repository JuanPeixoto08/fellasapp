import { describe, expect, it } from 'vitest';

import { GameError, toGameError } from '../shared/errors';
import { acoes, avisosPo, empresa, lucro, maxCompra, melhoriaAtual, pct, proximaMelhoria, textoQuebra, variacao } from './bolsa';

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
