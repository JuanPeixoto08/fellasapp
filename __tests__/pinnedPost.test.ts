const mockRpc = jest.fn();
jest.mock('../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

import { setPinnedPost } from '../lib/api/profiles';

beforeEach(() => mockRpc.mockReset().mockResolvedValue({ data: null, error: null }));

describe('setPinnedPost', () => {
  it('fixa e desafixa pela função do banco', async () => {
    await setPinnedPost('p1');
    expect(mockRpc).toHaveBeenCalledWith('set_pinned_post', { p_post_id: 'p1' });
    await setPinnedPost(null);
    expect(mockRpc).toHaveBeenLastCalledWith('set_pinned_post', { p_post_id: null });
  });

  it('erro do banco sobe', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not_your_post' } });
    await expect(setPinnedPost('p1')).rejects.toMatchObject({ message: 'not_your_post' });
  });
});
