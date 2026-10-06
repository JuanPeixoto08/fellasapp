const mockRpc = jest.fn();
const mockEq = jest.fn();
let mockCount: { count: number | null; error: unknown } = { count: 3, error: null };
jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          mockEq(...args);
          return Promise.resolve(mockCount);
        },
      }),
    }),
  },
}));

import { countPlacePosts, suggestPlaces } from '../lib/api/places';

beforeEach(() => {
  jest.clearAllMocks();
  mockCount = { count: 3, error: null };
});

describe('suggestPlaces', () => {
  it('chama a função com o digitado (o banco normaliza)', async () => {
    mockRpc.mockResolvedValue({ data: [{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }], error: null });
    await expect(suggestPlaces('Bar')).resolves.toEqual([{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }]);
    expect(mockRpc).toHaveBeenCalledWith('place_suggestions', { p_prefix: 'Bar', p_limit: 5 });
  });

  it('erro sobe', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(suggestPlaces('bar')).rejects.toMatchObject({ message: 'x' });
  });
});

describe('countPlacePosts', () => {
  it('conta posts com a chave do local', async () => {
    await expect(countPlacePosts('bar do ze')).resolves.toBe(3);
    expect(mockEq).toHaveBeenCalledWith('place_key', 'bar do ze');
  });

  it('erro sobe', async () => {
    mockCount = { count: null, error: { message: 'y' } };
    await expect(countPlacePosts('bar do ze')).rejects.toMatchObject({ message: 'y' });
  });
});
