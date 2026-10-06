import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Idea } from '../lib/ideas';

const mockFetch = jest.fn();
const mockVote = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
jest.mock('../lib/api/ideas', () => ({
  fetchIdeas: (sort: string) => mockFetch(sort),
  voteIdea: (...args: unknown[]) => mockVote(...args),
  createIdea: (...args: unknown[]) => mockCreate(...args),
  deleteIdea: (id: string) => mockDelete(id),
  ideaErrorMessage: (_e: unknown, action: string) => `erro:${action}`,
}));

import { emitLive, LIVE_DEBOUNCE_MS } from '../lib/realtime';
import { useIdeas } from '../lib/useIdeas';

const idea = (over: Partial<Idea> = {}): Idea => ({
  id: 'i1',
  body: 'modo escuro',
  createdAt: '2026-10-06T12:00:00Z',
  author: { id: 'u2', name: 'Bia', avatarUrl: null },
  score: 3,
  myVote: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue([idea()]);
  mockVote.mockResolvedValue(undefined);
  mockCreate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

async function loaded() {
  const view = await renderHook(() => useIdeas('me'));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe('useIdeas', () => {
  it('começa na aba Top e troca de aba recarrega com o sort certo', async () => {
    const { result } = await loaded();
    expect(mockFetch).toHaveBeenLastCalledWith('top');
    await act(async () => result.current.setSort('new'));
    await waitFor(() => expect(mockFetch).toHaveBeenLastCalledWith('new'));
    expect(result.current.sort).toBe('new');
  });

  it('voto aparece na hora e vai pro banco', async () => {
    const { result } = await loaded();
    await act(async () => result.current.vote('i1', 1));
    expect(result.current.ideas[0]).toMatchObject({ myVote: 1, score: 4 });
    expect(mockVote).toHaveBeenCalledWith('i1', 'me', 1);
  });

  it('voto recusado volta ao que era e avisa', async () => {
    mockVote.mockRejectedValue(new Error('boom'));
    const { result } = await loaded();
    await act(async () => result.current.vote('i1', -1));
    await waitFor(() => expect(result.current.ideas[0]).toMatchObject({ myVote: null, score: 3 }));
    expect(result.current.voteError).toBe('erro:vote');
  });

  it('toques seguidos na mesma ideia enquanto o voto está indo são ignorados', async () => {
    let finish: () => void = () => {};
    mockVote.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    const { result } = await loaded();
    await act(async () => {
      result.current.vote('i1', 1);
      result.current.vote('i1', 1);
      result.current.vote('i1', -1);
    });
    expect(mockVote).toHaveBeenCalledTimes(1);
    expect(result.current.ideas[0]).toMatchObject({ myVote: 1, score: 4 });
    await act(async () => finish());
    await act(async () => result.current.vote('i1', 1));
    expect(mockVote).toHaveBeenCalledTimes(2);
    expect(result.current.ideas[0]).toMatchObject({ myVote: null, score: 3 });
  });

  it('resposta atrasada da aba antiga não sobrescreve a aba nova', async () => {
    const { result } = await loaded();
    let slowTop: (v: Idea[]) => void = () => {};
    mockFetch.mockImplementationOnce(() => new Promise<Idea[]>((r) => (slowTop = r)));
    await act(async () => result.current.reload());
    mockFetch.mockResolvedValueOnce([idea({ id: 'nova', body: 'da aba Novas' })]);
    await act(async () => result.current.setSort('new'));
    await waitFor(() => expect(result.current.ideas[0].id).toBe('nova'));
    await act(async () => slowTop([idea({ id: 'velha' })]));
    expect(result.current.ideas[0].id).toBe('nova');
  });

  it('mudança ao vivo de outra pessoa recarrega; a minha não', async () => {
    jest.useFakeTimers();
    try {
      await loaded();
      mockFetch.mockClear();
      await act(async () => {
        emitLive({ kind: 'change', table: 'idea_votes', type: 'INSERT', row: { user_id: 'me' }, mine: true });
        jest.advanceTimersByTime(LIVE_DEBOUNCE_MS + 10);
      });
      expect(mockFetch).not.toHaveBeenCalled();
      await act(async () => {
        emitLive({ kind: 'change', table: 'ideas', type: 'INSERT', row: { author_id: 'u2' }, mine: false });
        jest.advanceTimersByTime(LIVE_DEBOUNCE_MS + 10);
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('mandar ideia recarrega; apagar tira da lista', async () => {
    const { result } = await loaded();
    mockFetch.mockClear();
    await act(async () => result.current.create('bora'));
    expect(mockCreate).toHaveBeenCalledWith('bora', 'me');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await act(async () => result.current.remove('i1'));
    expect(result.current.ideas).toEqual([]);
  });
});
