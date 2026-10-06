const mockFrom = jest.fn();
const mockGetSession = jest.fn(async () => ({ data: { session: { access_token: 'tok' } } }));
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
        getSession: () => mockGetSession(),
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
jest.mock('../lib/storiesConfig', () => ({ STORIES_FUNCTION_URL: 'https://sb.test/functions/v1/stories-media' }));

import {
  createStory,
  deleteStory,
  listActiveStories,
  listStoryViewers,
  reactToStory,
  STORY_LIMIT_MESSAGE,
  StoryUploadError,
  uploadStoryMedia,
} from '../lib/api/stories';

beforeEach(() => {
  mockCalls.length = 0;
  mockResults = {};
});

const SIGNED = {
  uploadUrl: 'https://api.cloudinary.com/v1_1/slxposvw/video/upload',
  fields: { api_key: 'k', timestamp: '1', signature: 'sig', public_id: `stories/${'a'.repeat(64)}`, eager: 'e', eager_async: 'true' },
};
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: unknown = {}) => ({ ok: false, status, json: async () => body });

describe('uploadStoryMedia', () => {
  it('assina na função, envia ao Cloudinary com os campos e devolve o nome e a duração do vídeo', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(ok({ public_id: SIGNED.fields.public_id, duration: 9.42 }));
    globalThis.fetch = fetchMock as never;
    await expect(uploadStoryMedia('file://v.mp4', 'video')).resolves.toEqual({
      mediaId: SIGNED.fields.public_id,
      durationMs: 9420,
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://sb.test/functions/v1/stories-media/sign');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ kind: 'video' });
    expect(fetchMock.mock.calls[1][0]).toBe(SIGNED.uploadUrl);
    const form = fetchMock.mock.calls[1][1].body as FormData;
    expect(form.get('signature')).toBe('sig');
    expect(form.get('public_id')).toBe(SIGNED.fields.public_id);
    expect(form.get('api_key')).toBe('k');
    expect(form.has('file')).toBe(true);
  });

  it('foto: 5000 ms; vídeo com duração acima de 15 s grava 15000', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(ok({ public_id: 'p' })) as never;
    await expect(uploadStoryMedia('file://a.jpg', 'photo')).resolves.toEqual({ mediaId: 'p', durationMs: 5000 });
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(ok({ public_id: 'p', duration: 15.3 })) as never;
    await expect(uploadStoryMedia('file://v.mp4', 'video')).resolves.toEqual({ mediaId: 'p', durationMs: 15000 });
  });

  it.each([
    [401, 'Sua sessão expirou. Entra de novo.'],
    [403, 'Só fellas podem postar story.'],
    [500, 'Não rolou enviar. Tenta de novo.'],
  ])('assinatura recusada %i vira mensagem pt-BR', async (status, message) => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce(fail(status)) as never;
    await expect(uploadStoryMedia('file://a.jpg', 'photo')).rejects.toThrow(message);
  });

  it('Cloudinary sem cota: avisa do limite do mês', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(fail(420, { error: { message: 'Rate Limit Exceeded' } })) as never;
    await expect(uploadStoryMedia('file://a.jpg', 'photo')).rejects.toThrow(STORY_LIMIT_MESSAGE);
    expect(STORY_LIMIT_MESSAGE).toBe('Os stories bateram o limite do mês. Volta dia 1.');
  });

  it('assinatura vencida: pede outra e tenta de novo uma vez', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(fail(401, { error: { message: 'Stale request - reported time is 2026-10-06 which is more than 1 hour ago' } }))
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(ok({ public_id: 'p' }));
    globalThis.fetch = fetchMock as never;
    mockGetSession
      .mockResolvedValueOnce({ data: { session: { access_token: 'tok' } } })
      .mockResolvedValueOnce({ data: { session: { access_token: 'tok2' } } });
    await expect(uploadStoryMedia('file://a.jpg', 'photo')).resolves.toEqual({ mediaId: 'p', durationMs: 5000 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer tok2');
  });

  it('duas assinaturas vencidas seguidas: desiste (4 chamadas, sem terceira tentativa)', async () => {
    const stale = fail(401, { error: { message: 'Stale request - reported time is 2026-10-06 which is more than 1 hour ago' } });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(stale);
    globalThis.fetch = fetchMock as never;
    await expect(uploadStoryMedia('file://a.jpg', 'photo')).rejects.toThrow('Não rolou enviar. Tenta de novo.');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('sem rede: mensagem pt-BR (StoryUploadError)', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) as never;
    const err = await uploadStoryMedia('file://a.jpg', 'photo').catch((e) => e);
    expect(err).toBeInstanceOf(StoryUploadError);
    expect(err.message).toBe('Sem conexão. Confere a internet e tenta de novo.');
  });
});

describe('deleteStory', () => {
  it('apaga pela função (arquivo e linha)', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(ok({ ok: true }));
    globalThis.fetch = fetchMock as never;
    await deleteStory('s1');
    expect(fetchMock.mock.calls[0][0]).toBe('https://sb.test/functions/v1/stories-media/delete');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ storyId: 's1' });
  });

  it('falhou: erro', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce(fail(403)) as never;
    await expect(deleteStory('s1')).rejects.toThrow();
  });
});

describe('listActiveStories', () => {
  it('autor pela chave do story (story_views e story_reactions também ligam stories a perfis: sem isso o Supabase recusa)', async () => {
    await listActiveStories(new Date('2026-10-04T12:00:00Z'));
    const select = mockCalls.find((c) => c.table === 'stories' && c.op === 'select')?.args[0] as string;
    expect(select).toContain('author:profiles!stories_author_id_fkey(');
  });

  it('agrupa por autor (mais antigo primeiro), marca visto e minha reação; só últimas 24 h', async () => {
    const now = new Date('2026-10-04T12:00:00Z');
    mockResults['stories.select'] = {
      data: [
        { id: 's1', author_id: 'ana', kind: 'photo', media_id: `stories/${'1'.repeat(64)}`, duration_ms: 5000, created_at: '2026-10-04T08:00:00Z', author: { id: 'ana', username: 'ana', display_name: 'Ana', avatar_url: null } },
        { id: 's2', author_id: 'ana', kind: 'video', media_id: `stories/${'2'.repeat(64)}`, duration_ms: 9000, created_at: '2026-10-04T10:00:00Z', author: { id: 'ana', username: 'ana', display_name: 'Ana', avatar_url: null } },
        { id: 's3', author_id: 'bia', kind: 'photo', media_id: `stories/${'3'.repeat(64)}`, duration_ms: 5000, created_at: '2026-10-04T11:00:00Z', author: { id: 'bia', username: 'bia', display_name: null, avatar_url: null } },
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
    expect(ana.stories[1].mediaUrl).toBe(`https://res.cloudinary.com/slxposvw/video/upload/c_limit,w_1280,h_1280,q_auto,f_mp4/stories/${'2'.repeat(64)}`);
    expect(ana.stories[1].originalUrl).toBe(`https://res.cloudinary.com/slxposvw/video/upload/stories/${'2'.repeat(64)}`);
  });
});

describe('createStory e reactToStory', () => {
  it('cria em meu nome', async () => {
    await createStory({ kind: 'photo', mediaId: `stories/${'1'.repeat(64)}`, durationMs: 5000 });
    expect(mockCalls.find((c) => c.table === 'stories' && c.op === 'insert')?.args[0]).toEqual({
      author_id: 'me', kind: 'photo', media_id: `stories/${'1'.repeat(64)}`, duration_ms: 5000,
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
