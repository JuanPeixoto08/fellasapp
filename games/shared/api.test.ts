import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: { rpc: async () => ({ data: null, error: null }) } }));
import { idleLugarAcao } from './api';

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
