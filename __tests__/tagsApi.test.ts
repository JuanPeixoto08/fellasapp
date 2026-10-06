const mockRpc = jest.fn();
const mockContains = jest.fn();
let mockCount: { count: number | null; error: unknown } = { count: 3, error: null };
jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        contains: (...args: unknown[]) => {
          mockContains(...args);
          return Promise.resolve(mockCount);
        },
      }),
    }),
  },
}));

import { countTagPosts, suggestTags } from '../lib/api/tags';

beforeEach(() => {
  jest.clearAllMocks();
  mockCount = { count: 3, error: null };
});

describe('suggestTags', () => {
  it('chama a função com o prefixo normalizado', async () => {
    mockRpc.mockResolvedValue({ data: [{ tag: 'artes', posts: 12 }], error: null });
    await expect(suggestTags('#Ar')).resolves.toEqual([{ tag: 'artes', posts: 12 }]);
    expect(mockRpc).toHaveBeenCalledWith('tag_suggestions', { p_prefix: 'ar', p_limit: 5 });
  });

  it('erro sobe', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(suggestTags('ar')).rejects.toMatchObject({ message: 'x' });
  });
});

describe('countTagPosts', () => {
  it('conta posts que têm a tag', async () => {
    await expect(countTagPosts('artes')).resolves.toBe(3);
    expect(mockContains).toHaveBeenCalledWith('tags', ['artes']);
  });

  it('sem contagem vira 0', async () => {
    mockCount = { count: null, error: null };
    await expect(countTagPosts('artes')).resolves.toBe(0);
  });
});
