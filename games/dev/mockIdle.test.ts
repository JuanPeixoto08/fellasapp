// @vitest-environment happy-dom
// O mock da Fellas Inc. chama as ações de lugar por nome, como o PostgREST (a ordem das chaves não importa).
import { describe, expect, it, vi } from 'vitest';

const { call } = vi.hoisted(() => ({ call: vi.fn(async (..._: unknown[]) => ({})) }));
vi.mock('./mockDb', () => ({ call, dono: vi.fn(async () => undefined), FRIENDS: [], ME: 'eu' }));

describe('idleLugarAcao no mock', () => {
  it('monta fn(p_x => $1, ...) com os valores na ordem dos nomes', async () => {
    const { idleLugarAcao } = await import('./mockIdle');
    await idleLugarAcao('idle_tee_lancar', { p_nome: 'Camisa', p_lugar: 3 });
    expect(call).toHaveBeenLastCalledWith('select public.idle_tee_lancar(p_nome => $1, p_lugar => $2) as v', ['Camisa', 3]);
  });
  it('recusa função e argumento fora do formato', async () => {
    const { idleLugarAcao } = await import('./mockIdle');
    expect(() => idleLugarAcao('idle_place_nivel', {})).toThrow(/desconhecida/);
    expect(() => idleLugarAcao('idle_tee_lancar', { 'x); drop': 1 })).toThrow(/desconhecido/);
  });
});
