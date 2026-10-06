const mockRpc = jest.fn();
const mockInsert = jest.fn();
const mockUpsert = jest.fn();
const mockDeleteEq = jest.fn();
let mockDeleteResult: { data: unknown; error: unknown } = { data: [{ id: 'i1' }], error: null };

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => ({
      insert: (row: unknown) => mockInsert(table, row),
      upsert: (row: unknown, opts: unknown) => mockUpsert(table, row, opts),
      delete: () => {
        // .eq(...).eq(...) para voto; .eq(...).select(...) para ideia
        const chain = {
          eq: (col: string, val: string) => {
            mockDeleteEq(table, col, val);
            return chain;
          },
          select: () => Promise.resolve(mockDeleteResult),
          then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
        };
        return chain;
      },
    }),
  },
}));

import { createIdea, deleteIdea, fetchIdeas, ideaErrorMessage, voteIdea } from '../lib/api/ideas';
import { setMemberDirectory } from '../lib/memberDirectory';

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockUpsert.mockResolvedValue({ error: null });
  mockDeleteResult = { data: [{ id: 'i1' }], error: null };
  setMemberDirectory([{ id: 'u1', username: 'bia', name: 'Bia', avatarUrl: 'https://signed/a.jpg' }]);
});

describe('fetchIdeas', () => {
  it('chama ideas_feed com a aba e junta o autor do diretório', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'i1', author_id: 'u1', body: 'modo escuro', created_at: '2026-10-06T12:00:00Z', score: -2, my_vote: -1 }],
      error: null,
    });
    await expect(fetchIdeas('new')).resolves.toEqual([
      {
        id: 'i1',
        body: 'modo escuro',
        createdAt: '2026-10-06T12:00:00Z',
        score: -2,
        myVote: -1,
        author: { id: 'u1', name: 'Bia', avatarUrl: 'https://signed/a.jpg' },
      },
    ]);
    expect(mockRpc).toHaveBeenCalledWith('ideas_feed', { p_sort: 'new' });
  });

  it('autor fora do diretório vira "Alguém"; my_vote estranho vira null', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'i2', author_id: 'sumiu', body: 'x', created_at: '2026-10-06T12:00:00Z', score: 0, my_vote: null }],
      error: null,
    });
    const [idea] = await fetchIdeas('top');
    expect(idea.author).toEqual({ id: 'sumiu', name: 'Alguém', avatarUrl: null });
    expect(idea.myVote).toBeNull();
  });
});

describe('createIdea', () => {
  it('manda o texto aparado em nome de quem escreveu', async () => {
    await createIdea('  bora  ', 'u1');
    expect(mockInsert).toHaveBeenCalledWith('ideas', { body: 'bora', author_id: 'u1' });
  });

  it('texto vazio nem chega no banco', async () => {
    await expect(createIdea('   ', 'u1')).rejects.toThrow();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe('voteIdea', () => {
  it('+1/−1 viram upsert; null apaga o meu voto', async () => {
    await voteIdea('i1', 'u1', 1);
    expect(mockUpsert).toHaveBeenCalledWith(
      'idea_votes',
      { idea_id: 'i1', user_id: 'u1', value: 1 },
      { onConflict: 'idea_id,user_id' },
    );
    await voteIdea('i1', 'u1', -1);
    expect(mockUpsert).toHaveBeenLastCalledWith(
      'idea_votes',
      { idea_id: 'i1', user_id: 'u1', value: -1 },
      { onConflict: 'idea_id,user_id' },
    );
    await voteIdea('i1', 'u1', null);
    expect(mockDeleteEq).toHaveBeenCalledWith('idea_votes', 'idea_id', 'i1');
    expect(mockDeleteEq).toHaveBeenCalledWith('idea_votes', 'user_id', 'u1');
  });
});

describe('deleteIdea', () => {
  it('apaga pelo id', async () => {
    await deleteIdea('i1');
    expect(mockDeleteEq).toHaveBeenCalledWith('ideas', 'id', 'i1');
  });

  it('banco barrou (0 linhas, sem erro) vira erro', async () => {
    mockDeleteResult = { data: [], error: null };
    await expect(deleteIdea('i1')).rejects.toThrow();
  });
});

describe('ideaErrorMessage', () => {
  it('mensagem por ação; rede tem a dela', () => {
    expect(ideaErrorMessage(new Error('boom'), 'create')).toBe('Não deu pra mandar a ideia. Tenta de novo.');
    expect(ideaErrorMessage(new Error('boom'), 'vote')).toBe('Não deu pra votar. Tenta de novo.');
    expect(ideaErrorMessage(new TypeError('Network request failed'), 'vote')).toBe(
      'Sem conexão. Confere a internet e tenta de novo.',
    );
  });
});
