import { createPost, deleteComment, deletePost, listComments, listFeed, toggleLike } from '../lib/api/posts';
import { clearSignedUrlCache } from '../lib/api/storage';

const mockCalls: { table: string; op: string; args: unknown[] }[] = [];
let mockResults: Record<string, unknown> = {};
const mockSignCalls: string[][] = [];
const mockRemoved: string[] = [];
const mockUploaded: string[] = [];
/** Índices (como string) das fotos cujo upload deve falhar. */
let mockUploadFail: string[] = [];

globalThis.fetch = jest.fn(async (uri: string) => ({
  blob: async () => ({ type: String(uri).endsWith('.gif') ? 'image/gif' : 'image/jpeg' }),
})) as unknown as typeof fetch;

jest.mock('../lib/imageUpload', () => ({ shrinkForUpload: async (uri: string) => uri + '#reduzida' }));

jest.mock('../lib/supabase', () => {
  const makeBuilder = (table: string) => {
    let op = 'select';
    const b: any = {};
    for (const m of ['select', 'insert', 'upsert', 'delete', 'eq', 'in', 'lt', 'not', 'order', 'limit', 'contains']) {
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
          upload: async (path: string) => {
            if (mockUploadFail.includes(path.split('-').pop()!.split('.')[0])) {
              return { data: null, error: new Error('upload falhou') };
            }
            mockUploaded.push(path);
            return { data: { path }, error: null };
          },
          remove: async (paths: string[]) => {
            mockRemoved.push(...paths);
            return { data: null, error: null };
          },
          createSignedUrls: async (paths: string[]) => {
            mockSignCalls.push(paths);
            return {
              data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })),
              error: null,
            };
          },
        }),
      },
    },
  };
});

beforeEach(() => {
  clearSignedUrlCache();
  mockCalls.length = 0;
  mockSignCalls.length = 0;
  mockRemoved.length = 0;
  mockResults = {};
});

describe('listFeed filters (perfil)', () => {
  it('filtra por autor e só fotos', async () => {
    mockResults['posts.select'] = { data: [], error: null };
    await listFeed({ authorId: 'u1', photosOnly: true });
    expect(mockCalls).toContainEqual({ table: 'posts', op: 'eq', args: ['author_id', 'u1'] });
    expect(mockCalls).toContainEqual({ table: 'posts', op: 'not', args: ['image_url', 'is', null] });
  });

  it('sem filtro não restringe autor nem foto', async () => {
    mockResults['posts.select'] = { data: [], error: null };
    await listFeed();
    expect(mockCalls.some((c) => c.table === 'posts' && (c.op === 'eq' || c.op === 'not'))).toBe(false);
  });
});

describe('fotos (até 4)', () => {
  beforeEach(() => {
    mockUploaded.length = 0;
    mockUploadFail = [];
  });

  it('lê a lista images e assina todas; post antigo cai na image_url', async () => {
    mockResults['posts.select'] = {
      data: [
        { id: 'a', author_id: 'u1', body: '', image_url: 'u1/1.jpg', images: ['u1/1.jpg', 'u1/2.jpg', 'u1/3.jpg'], created_at: 't', author: null, likes: [], comments: [] },
        { id: 'b', author_id: 'u1', body: '', image_url: 'u1/old.jpg', images: [], created_at: 't', author: null, likes: [], comments: [] },
      ],
      error: null,
    };
    const { posts } = await listFeed();
    expect(posts[0].images).toEqual(['https://signed/u1/1.jpg', 'https://signed/u1/2.jpg', 'https://signed/u1/3.jpg']);
    expect(posts[0].imageUrl).toBe('https://signed/u1/1.jpg');
    expect(posts[1].images).toEqual(['https://signed/u1/old.jpg']);
  });

  it('1 foto grava só image_url (funciona sem a migration 0005)', async () => {
    mockResults['posts.insert'] = { data: { id: 'n' }, error: null };
    await createPost({ body: 'oi', imageUris: ['file://a.jpg'] });
    const insert = mockCalls.find((c) => c.table === 'posts' && c.op === 'insert');
    expect(insert?.args[0]).toEqual({ author_id: 'me', body: 'oi', image_url: mockUploaded[0] });
  });

  it('3 fotos gravam images na ordem e image_url = primeira', async () => {
    mockResults['posts.insert'] = { data: { id: 'n' }, error: null };
    await createPost({ body: '', imageUris: ['file://a', 'file://b', 'file://c'] });
    const row = mockCalls.find((c) => c.table === 'posts' && c.op === 'insert')?.args[0] as Record<string, unknown>;
    expect(row.images).toEqual(mockUploaded);
    expect(row.image_url).toBe(mockUploaded[0]);
    expect((row.images as string[]).map((p) => p.split('-').pop())).toEqual(['0.jpg', '1.jpg', '2.jpg']);
  });

  it('falha de upload apaga as que subiram e não cria o post', async () => {
    mockUploadFail = ['1'];
    await expect(createPost({ body: '', imageUris: ['file://a', 'file://b'] })).rejects.toThrow('upload falhou');
    expect(mockRemoved).toEqual(mockUploaded);
    expect(mockCalls.some((c) => c.table === 'posts' && c.op === 'insert')).toBe(false);
  });

  it('foto sobe reduzida; GIF sobe como está (senão perde a animação)', async () => {
    mockResults['posts.insert'] = { data: { id: 'n' }, error: null };
    await createPost({ body: '', imageUris: ['file://a.jpg', 'file://b.gif'] });
    const fetched = (globalThis.fetch as jest.Mock).mock.calls.map((c) => c[0]);
    expect(fetched).toContain('file://a.jpg#reduzida');
    expect(fetched).not.toContain('file://b.gif#reduzida');
    expect(mockUploaded.map((p) => p.split('.').pop()).sort()).toEqual(['gif', 'jpg']);
  });

  it('mais de 4 fotos é recusado antes de subir', async () => {
    await expect(createPost({ body: '', imageUris: ['1', '2', '3', '4', '5'] })).rejects.toThrow(/4 fotos/);
    expect(mockUploaded).toEqual([]);
  });

  it('apagar o post remove todas as fotos do bucket', async () => {
    mockResults['posts.delete'] = { data: [{ image_url: 'me/1.jpg', images: ['me/1.jpg', 'me/2.jpg'] }], error: null };
    await deletePost('p1');
    expect(mockRemoved.sort()).toEqual(['me/1.jpg', 'me/2.jpg']);
  });
});

describe('deletePost', () => {
  it('apaga só o meu post e remove a foto do bucket', async () => {
    mockResults['posts.delete'] = { data: [{ image_url: 'me/a.jpg' }], error: null };
    await deletePost('p1');
    expect(mockCalls).toContainEqual({ table: 'posts', op: 'eq', args: ['id', 'p1'] });
    expect(mockCalls).toContainEqual({ table: 'posts', op: 'eq', args: ['author_id', 'me'] });
    expect(mockRemoved).toEqual(['me/a.jpg']);
  });

  it('falha quando nada foi apagado (post de outro ou inexistente)', async () => {
    mockResults['posts.delete'] = { data: [], error: null };
    await expect(deletePost('p1')).rejects.toThrow();
    expect(mockRemoved).toEqual([]);
  });
});

describe('deleteComment', () => {
  it('apaga só o meu comentário', async () => {
    mockResults['comments.delete'] = { data: [{ id: 'c1' }], error: null };
    await deleteComment('c1');
    expect(mockCalls).toContainEqual({ table: 'comments', op: 'eq', args: ['id', 'c1'] });
    expect(mockCalls).toContainEqual({ table: 'comments', op: 'eq', args: ['author_id', 'me'] });
  });

  it('falha quando nada foi apagado (comentário de outro ou já apagado)', async () => {
    mockResults['comments.delete'] = { data: [], error: null };
    await expect(deleteComment('c1')).rejects.toThrow();
  });
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
          author: { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: 'u1/avatar.jpg' },
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
    expect(page.posts[0].author.avatar_url).toBe('https://signed/u1/avatar.jpg');
    // fotos e avatares numa assinatura só (bucket privado)
    expect(mockSignCalls).toEqual([['u1/a.jpg', 'u1/avatar.jpg']]);
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

describe('listFeed por tag', () => {
  it('filtra os posts que têm a tag', async () => {
    mockResults['posts.select'] = { data: [], error: null };
    await listFeed({ tag: 'artes' });
    expect(mockCalls).toContainEqual({ table: 'posts', op: 'contains', args: ['tags', ['artes']] });
  });
});
