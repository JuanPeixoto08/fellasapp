import { listFeed, toggleLike } from '../lib/api/posts';

const mockCalls: { table: string; op: string; args: unknown[] }[] = [];
let mockResults: Record<string, unknown> = {};

jest.mock('../lib/supabase', () => {
  const makeBuilder = (table: string) => {
    let op = 'select';
    const b: any = {};
    for (const m of ['select', 'insert', 'delete', 'eq', 'in', 'lt', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => {
        if (['insert', 'delete'].includes(m)) op = m;
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
    expect(page.posts[1]).toMatchObject({ likedByMe: false, imageUrl: null });
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
