jest.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));

import { LetterboxdError, listMyReviews } from '../lib/api/letterboxd';

const good = {
  kind: 'review',
  title: 'A Story of Yonosuke',
  year: 2013,
  rating: 4,
  liked: true,
  rewatch: false,
  watched: '2025-12-30',
  poster: 'https://a.ltrbxd.com/p.jpg',
  url: 'https://letterboxd.com/oliveira/film/a-story-of-yonosuke/',
  text: 'Bom.',
  spoiler: false,
};
const respond = (body: unknown, status = 200) =>
  (globalThis.fetch = jest.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch);

describe('listMyReviews', () => {
  it('chama a função com o login e devolve só reviews válidas', async () => {
    respond({ reviews: [good, { ...good, poster: 'https://evil.example/p.jpg' }] });
    const reviews = await listMyReviews();
    expect(reviews).toEqual([good]);
    const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('erros viram mensagens em pt-BR por tipo', async () => {
    respond({ error: 'no_user' }, 409);
    await expect(listMyReviews()).rejects.toMatchObject({ kind: 'no_user' });
    respond({ error: 'not_found' }, 404);
    await expect(listMyReviews()).rejects.toMatchObject({ kind: 'not_found' });
    respond({ error: 'unavailable' }, 502);
    await expect(listMyReviews()).rejects.toBeInstanceOf(LetterboxdError);
  });

  it('sem conexão', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(listMyReviews()).rejects.toMatchObject({ kind: 'offline' });
  });
});
