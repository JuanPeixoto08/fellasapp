const mockFrom = jest.fn();
const mockCalls: { table: string; op: string; args: unknown[] }[] = [];
let mockResults: Record<string, unknown> = {};
jest.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    let op = 'select';
    const b: any = {};
    for (const m of ['select', 'insert', 'upsert', 'delete', 'eq', 'neq', 'in', 'gt', 'order']) {
      b[m] = (...args: unknown[]) => {
        if (['insert', 'upsert', 'delete'].includes(m)) op = m;
        mockCalls.push({ table, op: m, args });
        return b;
      };
    }
    b.then = (res: any, rej: any) => Promise.resolve(mockResults[`${table}.${op}`] ?? { data: [], error: null }).then(res, rej);
    return b;
  };
  return {
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: { id: 'me' } }, error: null }),
        getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      },
      from: (t: string) => {
        mockFrom(t);
        return builder(t);
      },
    },
  };
});
jest.mock('../lib/api/storage', () => ({
  signPaths: async () => new Map(),
  resolveUrl: () => null,
}));
jest.mock('../lib/storiesConfig', () => ({ STORIES_URL: 'https://w.test' }));

import { createStory, listActiveStories, listStoryViewers, reactToStory, StoryUploadError, uploadStoryMedia } from '../lib/api/stories';

beforeEach(() => {
  mockCalls.length = 0;
  mockResults = {};
});

describe('uploadStoryMedia', () => {
  it('manda o arquivo com o token e devolve o endereço', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ blob: async () => ({ type: 'video/mp4', size: 10 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ url: 'https://w.test/m/x.mp4' }) });
    globalThis.fetch = fetchMock as never;
    await expect(uploadStoryMedia('blob:v')).resolves.toEqual({ url: 'https://w.test/m/x.mp4', contentType: 'video/mp4' });
    expect(fetchMock.mock.calls[1][0]).toBe('https://w.test/upload');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok');
    expect(fetchMock.mock.calls[1][1].headers['Content-Type']).toBe('video/mp4');
  });

  it.each([
    [401, 'Sua sessão expirou. Entra de novo.'],
    [403, 'Só fellas podem postar story.'],
    [413, 'Arquivo grande demais: foto até 5 MB, vídeo até 50 MB.'],
    [415, 'Esse tipo de arquivo não rola. Usa foto ou vídeo.'],
    [500, 'Não rolou enviar. Tenta de novo.'],
  ])('erro %i vira mensagem pt-BR', async (status, message) => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({ blob: async () => ({ type: 'image/jpeg', size: 1 }) })
      .mockResolvedValueOnce({ ok: false, status, json: async () => ({}) }) as never;
    await expect(uploadStoryMedia('file://a.jpg')).rejects.toThrow(message);
  });
});

describe('uploadStoryMedia sem rede', () => {
  it('falha de rede vira mensagem pt-BR (e é um StoryUploadError)', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({ blob: async () => ({ type: 'image/jpeg', size: 1 }) })
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) as never;
    const err = await uploadStoryMedia('file://a.jpg').catch((e) => e);
    expect(err).toBeInstanceOf(StoryUploadError);
    expect(err.message).toBe('Sem conexão. Confere a internet e tenta de novo.');
  });
});

describe('listActiveStories', () => {
  it('agrupa por autor (mais antigo primeiro), marca visto e minha reação; só últimas 24 h', async () => {
    const now = new Date('2026-10-04T12:00:00Z');
    mockResults['stories.select'] = {
      data: [
        { id: 's1', author_id: 'ana', kind: 'photo', media_url: 'https://w/m/1.jpg', duration_ms: 5000, created_at: '2026-10-04T08:00:00Z', author: { id: 'ana', username: 'ana', display_name: 'Ana', avatar_url: null } },
        { id: 's2', author_id: 'ana', kind: 'video', media_url: 'https://w/m/2.mp4', duration_ms: 9000, created_at: '2026-10-04T10:00:00Z', author: { id: 'ana', username: 'ana', display_name: 'Ana', avatar_url: null } },
        { id: 's3', author_id: 'bia', kind: 'photo', media_url: 'https://w/m/3.jpg', duration_ms: 5000, created_at: '2026-10-04T11:00:00Z', author: { id: 'bia', username: 'bia', display_name: null, avatar_url: null } },
      ],
      error: null,
    };
    mockResults['story_views.select'] = { data: [{ story_id: 's1' }], error: null };
    mockResults['story_reactions.select'] = { data: [{ story_id: 's2', emoji: '😂' }], error: null };
    const groups = await listActiveStories(now);
    expect(mockCalls.find((c) => c.table === 'stories' && c.op === 'gt')?.args).toEqual(['created_at', '2026-10-03T12:00:00.000Z']);
    const ana = groups.find((g) => g.author.id === 'ana')!;
    expect(ana.stories.map((s) => [s.id, s.seen, s.myReaction])).toEqual([
      ['s1', true, null],
      ['s2', false, '😂'],
    ]);
    expect(ana.hasUnseen).toBe(true);
    expect(ana.latestAt).toBe('2026-10-04T10:00:00Z');
    expect(groups.find((g) => g.author.id === 'bia')!.author.name).toBe('bia');
  });
});

describe('createStory e reactToStory', () => {
  it('cria em meu nome', async () => {
    await createStory({ kind: 'photo', mediaUrl: 'https://w/m/1.jpg', durationMs: 5000 });
    expect(mockCalls.find((c) => c.table === 'stories' && c.op === 'insert')?.args[0]).toEqual({
      author_id: 'me', kind: 'photo', media_url: 'https://w/m/1.jpg', duration_ms: 5000,
    });
  });

  it('reagir faz upsert; null remove', async () => {
    await reactToStory('s1', '🔥');
    expect(mockCalls.find((c) => c.op === 'upsert')?.args[0]).toEqual({ story_id: 's1', user_id: 'me', emoji: '🔥' });
    await reactToStory('s1', null);
    expect(mockCalls.some((c) => c.table === 'story_reactions' && c.op === 'delete')).toBe(true);
  });
});

describe('listStoryViewers', () => {
  it('não conta o dono (eu também marco que vi o meu)', async () => {
    await listStoryViewers('s1');
    expect(mockCalls.find((c) => c.table === 'story_views' && c.op === 'neq')?.args).toEqual(['viewer_id', 'me']);
  });
});
