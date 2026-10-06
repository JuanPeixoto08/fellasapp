import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { FeedPost } from '../lib/api/posts';

const mockListFeed = jest.fn();
const mockGetPost = jest.fn();
jest.mock('../lib/api/posts', () => ({
  listFeed: (...args: unknown[]) => mockListFeed(...args),
  getPost: (id: string) => mockGetPost(id),
  deletePost: jest.fn(),
  toggleLike: jest.fn(),
}));
jest.mock('../lib/api/reactions', () => ({ setPostReaction: jest.fn() }));

import { emitLive, LIVE_DEBOUNCE_MS, type LiveChange } from '../lib/realtime';
import { usePostList } from '../lib/usePostList';

const post = (id: string, over: Partial<FeedPost> = {}): FeedPost => ({
  id,
  body: id,
  images: [],
  imageUrl: null,
  createdAt: '2026-10-04T12:00:00Z',
  author: { id: 'ana', username: 'ana', display_name: 'Ana', avatar_url: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
  ...over,
});
const change = (table: LiveChange['table'], type: LiveChange['type'], row: Record<string, unknown>, mine = false) =>
  emitLive({ kind: 'change', table, type, row, mine });
const settle = () => act(async () => new Promise((r) => setTimeout(r, LIVE_DEBOUNCE_MS + 50)));

async function feed(filter = {}) {
  const view = await renderHook(() => usePostList(filter));
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListFeed.mockResolvedValue({ posts: [post('p1'), post('p2')], nextCursor: null });
});

describe('usePostList ao vivo', () => {
  it('post novo de outra pessoa não empurra a lista: conta em "Posts novos" até a pessoa pedir', async () => {
    const { result } = await feed();
    await act(async () => {
      change('posts', 'INSERT', { id: 'p9', author_id: 'bia' });
      change('posts', 'INSERT', { id: 'p8', author_id: 'bia' });
    });
    expect(result.current.newPosts).toBe(2);
    expect(result.current.posts.map((p) => p.id)).toEqual(['p1', 'p2']);
    mockListFeed.mockResolvedValue({ posts: [post('p9'), post('p8'), post('p1'), post('p2')], nextCursor: null });
    await act(async () => result.current.showNewPosts());
    await waitFor(() => expect(result.current.posts).toHaveLength(4));
    expect(result.current.newPosts).toBe(0);
  });

  it('puxar para atualizar (ou qualquer recarga do topo) já mostra os novos e some com o botão', async () => {
    const { result } = await feed();
    await act(async () => {
      change('posts', 'INSERT', { id: 'p9', author_id: 'bia' });
    });
    expect(result.current.newPosts).toBe(1);
    mockListFeed.mockResolvedValue({ posts: [post('p9'), post('p1'), post('p2')], nextCursor: null });
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.posts).toHaveLength(3));
    expect(result.current.newPosts).toBe(0);
  });

  it('post contado que foi apagado sai da conta; o mesmo post não conta duas vezes', async () => {
    const { result } = await feed();
    await act(async () => {
      change('posts', 'INSERT', { id: 'p9', author_id: 'bia' });
      change('posts', 'INSERT', { id: 'p9', author_id: 'bia' });
      change('posts', 'INSERT', { id: 'p8', author_id: 'bia' });
    });
    expect(result.current.newPosts).toBe(2);
    await act(async () => {
      change('posts', 'DELETE', { id: 'p9' });
    });
    expect(result.current.newPosts).toBe(1);
  });

  it('no perfil de alguém só conta post daquela pessoa', async () => {
    const { result } = await feed({ authorId: 'ana' });
    await act(async () => {
      change('posts', 'INSERT', { id: 'p9', author_id: 'bia' });
    });
    expect(result.current.newPosts).toBe(0);
  });

  it('curtida, reação ou comentário de outra pessoa atualiza só aquele post (rajada vira uma busca)', async () => {
    const { result } = await feed();
    mockGetPost.mockResolvedValue(post('p2', { likeCount: 3, commentCount: 1 }));
    await act(async () => {
      change('likes', 'INSERT', { post_id: 'p2', user_id: 'bia' });
      change('comments', 'INSERT', { id: 'c1', post_id: 'p2', author_id: 'bia' });
      change('post_reactions', 'INSERT', { post_id: 'p2', user_id: 'bia' });
      change('likes', 'INSERT', { post_id: 'fora-da-lista', user_id: 'bia' });
    });
    await settle();
    expect(mockGetPost).toHaveBeenCalledTimes(1);
    expect(mockGetPost).toHaveBeenCalledWith('p2');
    expect(result.current.posts.find((p) => p.id === 'p2')?.likeCount).toBe(3);
  });

  it('curtida minha ainda indo para o servidor não é desfeita por atualização ao vivo', async () => {
    const { result } = await feed();
    let finishLike: (v: boolean) => void = () => {};
    const { toggleLike } = jest.requireMock('../lib/api/posts') as { toggleLike: jest.Mock };
    toggleLike.mockReturnValue(new Promise<boolean>((r) => (finishLike = r)));
    // o servidor ainda não tem a minha curtida
    mockGetPost.mockResolvedValue(post('p1', { likeCount: 1, likedByMe: false }));
    let liking: Promise<void> = Promise.resolve();
    await act(async () => {
      liking = result.current.like(result.current.posts[0]);
    });
    expect(result.current.posts[0].likedByMe).toBe(true);
    await act(async () => {
      change('likes', 'INSERT', { post_id: 'p1', user_id: 'bia' });
    });
    await settle();
    expect(result.current.posts[0].likedByMe).toBe(true);
    // a curtida chegou: agora busca a verdade do servidor (com a minha curtida e a da Bia)
    mockGetPost.mockResolvedValue(post('p1', { likeCount: 2, likedByMe: true }));
    await act(async () => {
      finishLike(true);
      await liking;
    });
    await settle();
    await waitFor(() => expect(result.current.posts[0].likeCount).toBe(2));
    expect(result.current.posts[0].likedByMe).toBe(true);
  });

  it('minha própria curtida não busca de novo (a tela já atualizou na hora)', async () => {
    await feed();
    await act(async () => {
      change('likes', 'INSERT', { post_id: 'p1', user_id: 'me' }, true);
    });
    await settle();
    expect(mockGetPost).not.toHaveBeenCalled();
  });

  it('post apagado por alguém some da lista', async () => {
    const { result } = await feed();
    await act(async () => {
      change('posts', 'DELETE', { id: 'p1' });
    });
    expect(result.current.posts.map((p) => p.id)).toEqual(['p2']);
  });

  it('voltar/reconectar: atualiza os posts da tela e conta os novos sem empurrar a lista', async () => {
    const { result } = await feed();
    mockListFeed.mockResolvedValue({
      posts: [post('p9'), post('p1', { likeCount: 5 }), post('p2')],
      nextCursor: null,
    });
    await act(async () => {
      emitLive({ kind: 'resync' });
    });
    await waitFor(() => expect(result.current.newPosts).toBe(1));
    expect(result.current.posts.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.posts[0].likeCount).toBe(5);
  });
});

describe('usePostList com post fixado', () => {
  it('fixado vem primeiro e não repete quando a página dele chega', async () => {
    mockListFeed.mockResolvedValue({ posts: [post('p1'), post('p2')], nextCursor: 'c1' });
    mockGetPost.mockResolvedValue(post('p9'));
    const { result } = await feed({ authorId: 'ana', pinnedId: 'p9' });
    expect(result.current.posts.map((p) => p.id)).toEqual(['p9', 'p1', 'p2']);
    mockListFeed.mockResolvedValue({ posts: [post('p9'), post('p3')], nextCursor: null });
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.posts.map((p) => p.id)).toEqual(['p9', 'p1', 'p2', 'p3']));
  });

  it('fixado que não carrega (apagado) não derruba a lista', async () => {
    mockGetPost.mockRejectedValue(new Error('não achou'));
    const { result } = await feed({ authorId: 'ana', pinnedId: 'p9' });
    expect(result.current.posts.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.error).toBeNull();
  });
});
