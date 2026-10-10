import { describe, expect, it } from 'vitest';

import { ERROR_TEXT, toGameError } from './errors';

describe('erros do poker', () => {
  it('código do banco vira frase da mesa', () => {
    const cases: [string, string][] = [
      ['seat_taken', 'Alguém sentou aí primeiro'],
      ['already_seated', 'Você já está na mesa'],
      ['buyin_out_of_range', 'Entrada vai de 200 a 500'],
      ['rathole_min', 'Você levantou há pouco: volta com pelo menos o que levou'],
      ['not_seated', 'Você não está na mesa'],
      ['not_your_turn', 'Ainda não é sua vez'],
      ['stale_seq', 'A mesa mudou'],
      ['raise_too_small', 'Aumento menor que o mínimo'],
      ['raise_too_big', 'Você não tem tudo isso'],
      ['rebuy_in_hand', 'Completa quando a mão acabar'],
      ['rebuy_out_of_range', 'Completa de 10 em 10, até 500 na mesa'],
      ['nothing_to_show', 'Não tem carta pra mostrar agora'],
      ['fiado_seated', 'Levanta da mesa de poker pra pegar fiado'],
    ];
    for (const [code, text] of cases) {
      const e = toGameError({ message: code, code: 'P0001' });
      expect(e.code).toBe(code);
      expect(e.message).toBe(text);
      expect(ERROR_TEXT[e.code]).toBe(text);
    }
  });

  it('not_seated não é confundido com already_seated nem fiado_seated', () => {
    expect(toGameError({ message: 'already_seated' }).code).toBe('already_seated');
    expect(toGameError({ message: 'fiado_seated' }).code).toBe('fiado_seated');
  });
});

describe('erros da Fellas Inc.', () => {
  it.each([
    ['idle_not_started', 'Abre o CNPJ primeiro'],
    ['idle_started', 'Sua empresa já tá aberta'],
    ['idle_strategy_pending', 'Escolhe a estratégia da era antes'],
    ['idle_cant_afford', 'Valuation não cobre essa compra'],
    ['idle_locked', 'Isso ainda não liberou'],
    ['idle_owned', 'Você já tem essa melhoria'],
    ['idle_strategy_set', 'Essa estratégia já foi escolhida'],
    ['idle_bad_choice', 'Essa opção não existe'],
    ['idle_opp_gone', 'Essa oportunidade já passou'],
    ['idle_opp_cap', 'Chega de oportunidade por hoje'],
  ])('%s', (code, text) => {
    const e = toGameError({ message: code, code: 'P0001' });
    expect(e.code).toBe(code);
    expect(e.message).toBe(text);
  });
});
