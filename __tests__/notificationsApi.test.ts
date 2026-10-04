const mockRpc = jest.fn();
const mockIn = jest.fn();
let mockTables: Record<string, unknown[]> = {};

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => ({
      select: () => ({
        in: (col: string, ids: string[]) => {
          mockIn(table, col, ids);
          return Promise.resolve({ data: mockTables[table] ?? [], error: null });
        },
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })),
          error: null,
        }),
      }),
    },
  },
}));

import { fetchNotifications, fetchUnreadCount, markNotificationsSeen } from '../lib/api/notifications';

const row = (over: Record<string, unknown>) => ({
  kind: 'like',
  post_id: 'p1',
  comment_id: null,
  actor_ids: ['u2'],
  actor_count: 1,
  emojis: [],
  body: null,
  latest_at: '2026-10-04T12:00:00Z',
  unread: true,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockTables = {
    profiles: [
      { id: 'u2', username: 'ana', display_name: 'Ana', avatar_url: 'u2/a.jpg' },
      { id: 'u3', username: 'pedro', display_name: null, avatar_url: null },
    ],
    posts: [
      { id: 'p1', image_url: 'u1/1.jpg', images: ['u1/1.jpg', 'u1/2.jpg'] },
      { id: 'p2', image_url: null, images: [] },
    ],
  };
});

describe('fetchNotifications', () => {
  it('junta pessoas, miniatura do post e marca de não lida', async () => {
    mockRpc.mockResolvedValue({
      data: [row({}), row({ kind: 'comment', post_id: 'p2', comment_id: 'c1', actor_ids: ['u3'], body: 'oi', unread: false })],
      error: null,
    });
    const list = await fetchNotifications();
    expect(mockRpc).toHaveBeenCalledWith('notifications_feed', { p_limit: 50 });
    expect(list[0]).toMatchObject({
      kind: 'like',
      postId: 'p1',
      actors: [{ id: 'u2', name: 'Ana', avatarUrl: 'https://signed/u2/a.jpg' }],
      thumbUrl: 'https://signed/u1/1.jpg',
      unread: true,
    });
    // sem display_name usa o username; post sem foto não tem miniatura
    expect(list[1]).toMatchObject({ actors: [{ id: 'u3', name: 'pedro', avatarUrl: null }], thumbUrl: null, body: 'oi' });
    expect(new Set(list.map((n) => n.key)).size).toBe(2);
  });

  it('ator sem perfil e post apagado não quebram a linha', async () => {
    mockRpc.mockResolvedValue({ data: [row({ post_id: 'sumiu', actor_ids: ['fantasma'] })], error: null });
    const [only] = await fetchNotifications();
    expect(only.actors).toEqual([]);
    expect(only.thumbUrl).toBeNull();
  });

  it('tipo que o app não conhece (migração mais nova) é descartado em vez de quebrar a tela', async () => {
    mockRpc.mockResolvedValue({ data: [row({ kind: 'mention' }), row({})], error: null });
    const list = await fetchNotifications();
    expect(list.map((n) => n.kind)).toEqual(['like']);
  });

  it('lista vazia não busca perfis nem posts', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchNotifications()).toEqual([]);
    expect(mockIn).not.toHaveBeenCalled();
  });

  it('erro da função sobe', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('falhou') });
    await expect(fetchNotifications()).rejects.toThrow('falhou');
  });
});

describe('contagem e marcar visto', () => {
  it('fetchUnreadCount devolve o número', async () => {
    mockRpc.mockResolvedValue({ data: 4, error: null });
    await expect(fetchUnreadCount()).resolves.toBe(4);
    expect(mockRpc).toHaveBeenCalledWith('unread_notifications_count');
  });

  it('markNotificationsSeen chama a função', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await markNotificationsSeen();
    expect(mockRpc).toHaveBeenCalledWith('mark_notifications_seen');
  });
});
