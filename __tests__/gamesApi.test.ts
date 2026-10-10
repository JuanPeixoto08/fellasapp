const mockRpc = jest.fn();
const mockCalls: { table: string; op: string; args: unknown[] }[] = [];
let mockResult: { data: unknown; error: unknown } = { data: [], error: null };

// consulta encadeada: registra cada passo e, no fim (await ou maybeSingle), devolve mockResult
function mockQuery(table: string) {
  const chain: Record<string, unknown> = {};
  for (const op of ['select', 'not', 'order', 'limit', 'eq']) {
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

import { gamesErrorMessage, getLastChampion, getLastUnicorn, getLeaderboard, getPokerTable, getWallet, takeFiado } from '../lib/api/games';
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
      seatedStack: null,
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
  it('placar do banco (carteira + fichas na mesa), com nome e foto do diretório', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { user_id: 'u2', balance: 2000, fiado_count: 0 },
        { user_id: 'u1', balance: 2000, fiado_count: 1 },
        { user_id: 'saiu', balance: 50, fiado_count: 3 },
      ],
      error: null,
    });
    const rows = await getLeaderboard();
    expect(mockRpc).toHaveBeenCalledWith('games_board');
    expect(rows.map((r) => [r.name, r.balance, r.fiadoCount])).toEqual([
      ['Teteu', 2000, 0],
      ['Bia', 2000, 1],
      ['Alguém', 50, 3],
    ]);
    expect(rows[1].avatarUrl).toBe('https://signed/a.jpg');
  });

  it('erro do banco sobe', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getLeaderboard()).rejects.toEqual({ message: 'boom' });
  });
});

describe('carteira sentada e mesa de poker', () => {
  it('fichas na mesa vêm na carteira; fiado sentado vira frase', async () => {
    mockRpc.mockResolvedValue({ data: { ...ROW, seated_stack: 300 }, error: null });
    expect((await getWallet()).seatedStack).toBe(300);
    expect(gamesErrorMessage({ message: 'fiado_seated' })).toBe('Levanta da mesa de poker pra pegar fiado');
  });

  it('quantos na mesa e se eu estou nela', async () => {
    mockResult = { data: { state: { seats: [{ user_id: 'u1' }, { user_id: 'me' }] } }, error: null };
    await expect(getPokerTable('me')).resolves.toEqual({ count: 2, seated: true });
    await expect(getPokerTable('u9')).resolves.toEqual({ count: 2, seated: false });
    expect(mockCalls.find((c) => c.table === 'poker_tables' && c.op === 'eq')?.args).toEqual(['id', 1]);
    mockResult = { data: null, error: null };
    await expect(getPokerTable('me')).resolves.toEqual({ count: 0, seated: false });
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

describe('getLastUnicorn', () => {
  it('sem semana fechada: null', async () => {
    mockResult = { data: null, error: null };
    await expect(getLastUnicorn()).resolves.toBeNull();
  });
  it('unicórnio com nome do diretório e o valuation com que fechou', async () => {
    mockResult = { data: { week_start: '2026-10-05', unicorn_id: 'u2', podium: [{ user_id: 'u2', valuation: 7.1e12, era: 5 }] }, error: null };
    await expect(getLastUnicorn()).resolves.toEqual({ userId: 'u2', name: 'Teteu', username: 'teteu', avatarUrl: null, valuation: 7.1e12, weekStart: '2026-10-05' });
    expect(mockCalls.find((c) => c.op === 'select')).toMatchObject({ table: 'idle_weeks', args: ['week_start, unicorn_id, podium'] });
  });
});
