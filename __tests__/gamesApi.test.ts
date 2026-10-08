const mockRpc = jest.fn();
const mockCalls: { table: string; op: string; args: unknown[] }[] = [];
let mockResult: { data: unknown; error: unknown } = { data: [], error: null };

// consulta encadeada: registra cada passo e, no fim (await ou maybeSingle), devolve mockResult
function mockQuery(table: string) {
  const chain: Record<string, unknown> = {};
  for (const op of ['select', 'not', 'order', 'limit']) {
    chain[op] = (...args: unknown[]) => {
      mockCalls.push({ table, op, args });
      return chain;
    };
  }
  chain.maybeSingle = () => Promise.resolve(mockResult);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(mockResult);
  return chain;
}

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => mockQuery(table),
  },
}));

import { gamesErrorMessage, getLastChampion, getLeaderboard, getWallet, takeFiado } from '../lib/api/games';
import { setMemberDirectory } from '../lib/memberDirectory';

const ROW = { balance: 1000, fiado_count: 0, can_fiado: false, open_round_id: null, week_start: '2026-10-05' };

beforeEach(() => {
  jest.clearAllMocks();
  mockCalls.length = 0;
  mockResult = { data: [], error: null };
  setMemberDirectory([
    { id: 'u1', username: 'bia', name: 'Bia', avatarUrl: 'https://signed/a.jpg' },
    { id: 'u2', username: 'teteu', name: 'Teteu', avatarUrl: null },
  ]);
});

describe('getWallet / takeFiado', () => {
  it('lê a carteira pelo banco, em camelCase', async () => {
    mockRpc.mockResolvedValue({ data: ROW, error: null });
    await expect(getWallet()).resolves.toEqual({
      balance: 1000,
      fiadoCount: 0,
      canFiado: false,
      openRoundId: null,
      weekStart: '2026-10-05',
    });
    expect(mockRpc).toHaveBeenCalledWith('games_wallet');
  });

  it('fiado chama a função própria; recusa vira frase', async () => {
    mockRpc.mockResolvedValue({ data: { ...ROW, balance: 100, fiado_count: 1 }, error: null });
    expect((await takeFiado()).fiadoCount).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith('games_fiado');
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fiado_today' } });
    const err = await takeFiado().catch((e: unknown) => e);
    expect(gamesErrorMessage(err)).toBe('Fiado de hoje já foi. Volta amanhã.');
    expect(gamesErrorMessage({ message: 'fiado_not_broke' })).toBe('Não deu pra pegar o fiado. Tenta de novo.');
    expect(gamesErrorMessage(new Error('Failed to fetch'))).toBe('Não deu pra carregar o placar. Tenta de novo.');
  });
});

describe('getLeaderboard', () => {
  it('só quem jogou, na ordem do placar, com nome e foto do diretório', async () => {
    mockResult = {
      data: [
        { user_id: 'u2', balance: 2000, fiado_count: 0 },
        { user_id: 'u1', balance: 2000, fiado_count: 1 },
        { user_id: 'saiu', balance: 50, fiado_count: 3 },
      ],
      error: null,
    };
    const rows = await getLeaderboard();
    expect(rows.map((r) => [r.name, r.balance, r.fiadoCount])).toEqual([
      ['Teteu', 2000, 0],
      ['Bia', 2000, 1],
      ['Alguém', 50, 3],
    ]);
    expect(rows[1].avatarUrl).toBe('https://signed/a.jpg');
    expect(mockCalls.filter((c) => c.op !== 'select').map((c) => [c.op, ...c.args])).toEqual([
      ['not', 'last_played_at', 'is', null],
      ['order', 'balance', { ascending: false }],
      ['order', 'fiado_count', { ascending: true }],
      ['order', 'last_played_at', { ascending: true }],
    ]);
  });

  it('erro do banco sobe', async () => {
    mockResult = { data: null, error: { message: 'boom' } };
    await expect(getLeaderboard()).rejects.toEqual({ message: 'boom' });
  });
});

describe('getLastChampion', () => {
  it('sem semana fechada, ou semana sem campeão: null', async () => {
    mockResult = { data: null, error: null };
    await expect(getLastChampion()).resolves.toBeNull();
    mockResult = { data: { week_start: '2026-09-28', champion_id: null, podium: [] }, error: null };
    await expect(getLastChampion()).resolves.toBeNull();
  });

  it('campeão com nome do diretório e o saldo com que fechou', async () => {
    mockResult = {
      data: { week_start: '2026-09-28', champion_id: 'u1', podium: [{ user_id: 'u1', balance: 4870, fiado_count: 0 }] },
      error: null,
    };
    await expect(getLastChampion()).resolves.toEqual({
      userId: 'u1',
      name: 'Bia',
      username: 'bia',
      avatarUrl: 'https://signed/a.jpg',
      balance: 4870,
      weekStart: '2026-09-28',
    });
    expect(mockCalls.find((c) => c.op === 'order')?.args).toEqual(['week_start', { ascending: false }]);
  });
});
