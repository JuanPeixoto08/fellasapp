import { listComments, listFeed, toggleLike } from '../lib/api/posts';

const mockCalls: { table: string; op: string; args: unknown[] }[] = [];
let mockResults: Record<string, unknown> = {};

jest.mock('../lib/supabase', () => {
  const makeBuilder = (table: string) => {
    let op = 'select';
    const b: any = {};
    for (const m of ['select', 'insert', 'upsert', 'delete', 'eq', 'in', 'lt', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => {
        if (['insert', 'upsert', 'delete'].includes(m)) op = m;
        mockCalls.push({ table, op: m, args });
        return b;
      };
    }
    const settle = () =>
      Promise.resolve(mockResults[`${table}.${op}`] ?? { data: null, error: null });
    b.maybeSingle = settle;
    b.single = settle;
    b.then = (res: any, rej: any) => settle().then(res, rej);
    return b;
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) },
      from: (table: string) => makeBuilder(table),
      storage: {
        from: () => ({
          createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signed/${p}` } }),
        }),
      },
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockResults = {};
});

describe('listFeed', () => {
  it('maps rows with author, counts, liked flag and signed image', async () => {
    mockResults['posts.select'] = {
      data: [
        {
          id: 'p1',
          author_id: 'u1',
          body: 'oi',
          image_url: 'u1/a.jpg',
          created_at: '2026-01-02T00:00:00Z',
          author: { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: null },
          likes: [{ count: 3 }],
          comments: [{ count: 2 }],
        },
        {
          id: 'p2',
          author_id: 'u2',
          body: 'tchau',
          image_url: null,
          created_at: '2026-01-01T00:00:00Z',
          author: null,
          likes: [{ count: 0 }],
          comments: [{ count: 0 }],
        },
      ],
      error: null,
    };
    mockResults['likes.select'] = { data: [{ post_id: 'p1' }], error: null };
    mockResults['post_reactions.select'] = {
      data: [
        { post_id: 'p1', user_id: 'me', emoji: '❤️' },
        { post_id: 'p1', user_id: 'u9', emoji: '❤️' },
        { post_id: 'p1', user_id: 'u8', emoji: '😂' },
      ],
      error: null,
    };

    const page = await listFeed({ cursor: '2026-02-01T00:00:00Z' });

    expect(page.posts[0]).toMatchObject({
      id: 'p1',
      body: 'oi',
      imageUrl: 'https://signed/u1/a.jpg',
      likeCount: 3,
      commentCount: 2,
      likedByMe: true,
      author: { username: 'ana' },
    });
    expect(page.posts[0]).toMatchObject({
      reactions: [
        { emoji: '❤️', count: 2 },
        { emoji: '😂', count: 1 },
      ],
      myReaction: '❤️',
    });
    expect(page.posts[1]).toMatchObject({
      likedByMe: false,
      imageUrl: null,
      reactions: [],
      myReaction: null,
    });
    expect(page.nextCursor).toBeNull();
    expect(mockCalls).toContainEqual({
      table: 'posts',
      op: 'lt',
      args: ['created_at', '2026-02-01T00:00:00Z'],
    });
  });
});

describe('toggleLike', () => {
  it('inserts when not liked yet', async () => {
    mockResults['likes.select'] = { data: null, error: null };
    await expect(toggleLike('p1')).resolves.toBe(true);
    expect(mockCalls).toContainEqual({
      table: 'likes',
      op: 'insert',
      args: [{ post_id: 'p1', user_id: 'me' }],
    });
  });

  it('removes when already liked', async () => {
    mockResults['likes.select'] = { data: { post_id: 'p1' }, error: null };
    await expect(toggleLike('p1')).resolves.toBe(false);
    expect(mockCalls.some((c) => c.op === 'delete')).toBe(true);
    expect(mockCalls.some((c) => c.op === 'insert')).toBe(false);
  });
});

describe('listComments', () => {
  it('fills reactions in one batch select', async () => {
    mockResults['comments.select'] = {
      data: [
        { id: 'c1', body: 'a', created_at: 't', author_id: 'u1', author: null },
        { id: 'c2', body: 'b', created_at: 't', author_id: 'u1', author: null },
      ],
      error: null,
    };
    mockResults['comment_reactions.select'] = {
      data: [{ comment_id: 'c2', user_id: 'me', emoji: '👍' }],
      error: null,
    };
    const list = await listComments('p1');
    expect(list[0]).toMatchObject({ reactions: [], myReaction: null });
    expect(list[1]).toMatchObject({
      reactions: [{ emoji: '👍', count: 1 }],
      myReaction: '👍',
    });
    expect(mockCalls.filter((c) => c.table === 'comment_reactions' && c.op === 'in')).toHaveLength(1);
  });
});
