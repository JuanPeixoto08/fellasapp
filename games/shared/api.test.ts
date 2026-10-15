import { describe, expect, it, vi } from 'vitest';
const rpcMock = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => ({ data: null, error: null })));
vi.mock('./supabase', () => ({ supabase: { rpc: rpcMock } }));
import { idleDouradoPegar, idleLugarAcao } from './api';

describe('idleLugarAcao', () => {
  it('só aceita funções de mecânica de lugar (idle_tee_*, idle_cup_*, idle_din_*)', () => {
    expect(() => idleLugarAcao('idle_bolsa', {})).toThrow();
    expect(() => idleLugarAcao('idle_prestige', {})).toThrow();
    expect(() => idleLugarAcao('idle_tee_x; drop', {})).toThrow();
  });
  it('deixa passar as funções dos lugares', () => {
    for (const fn of ['idle_tee_jogar', 'idle_cup_servir', 'idle_din_pedido']) expect(() => idleLugarAcao(fn, {})).not.toThrow();
  });
});

describe('idleDouradoPegar', () => {
  it('só manda p_moedas quando passa de zero (banco velho ainda atende os outros dourados)', async () => {
    rpcMock.mockClear();
    await idleDouradoPegar(5, 0);
    await idleDouradoPegar(5, 0, 12);
    expect(rpcMock.mock.calls[0][1]).toEqual({ p_seg: 5, p_lado: 0 });
    expect(rpcMock.mock.calls[1][1]).toEqual({ p_seg: 5, p_lado: 0, p_moedas: 12 });
  });
});
