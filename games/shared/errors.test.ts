import { describe, expect, it } from 'vitest';

import { ERROR_TEXT, GameError, toGameError } from './errors';

describe('toGameError', () => {
  it('códigos do banco viram o código certo', () => {
    expect(toGameError({ message: 'insufficient_credits' }).code).toBe('insufficient_credits');
    expect(toGameError({ message: 'round_done' }).code).toBe('round_done');
    expect(toGameError({ message: 'fiado_today' }).code).toBe('fiado_today');
    expect(toGameError({ message: 'invalid_action' }).code).toBe('invalid_action'); // outra aba mudou a mão
  });

  it('sessão expirada ou fora do grupo: entrar de novo', () => {
    expect(toGameError({ status: 401, message: 'x' }).code).toBe('no_session');
    expect(toGameError({ message: 'JWT expired' }).code).toBe('no_session');
    expect(toGameError({ code: '42501', message: 'not_member' }).code).toBe('no_session');
  });

  it('sem rede', () => {
    expect(toGameError(new TypeError('Failed to fetch')).code).toBe('offline');
    expect(toGameError(new TypeError('NetworkError when attempting to fetch resource.')).code).toBe('offline');
    // o supabase-js embrulha a falha de rede num objeto de erro comum
    expect(toGameError({ message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }).code).toBe('offline');
  });

  it('o resto é desconhecido, e GameError passa direto', () => {
    expect(toGameError(new Error('boom')).code).toBe('unknown');
    const e = new GameError('round_open');
    expect(toGameError(e)).toBe(e);
    expect(ERROR_TEXT.offline).toBe('Sem conexão. Sua mão tá salva.');
  });
});
