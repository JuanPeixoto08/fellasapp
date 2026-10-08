import { handle, type Deps, type Env } from '../supabase/functions/letterboxd-reviews/handler';
import { decodeEntities, parseReviews, rssUrl } from '../supabase/functions/letterboxd-reviews/rules';

// mesmo formato do RSS público do Letterboxd (conferido em 2026-10-08), com texto de exemplo
const item = ({
  guid = 'letterboxd-review-1',
  title = 'A Story of Yonosuke, 2013 - ★★★★',
  link = 'https://letterboxd.com/oliveira/film/a-story-of-yonosuke/',
  rating = '<letterboxd:memberRating>4.0</letterboxd:memberRating>',
  like = 'Yes',
  rewatch = 'No',
  year = '<letterboxd:filmYear>2013</letterboxd:filmYear>',
  poster = '<p><img src="https://a.ltrbxd.com/resized/film-poster/1/2/3-0-600-0-900-crop.jpg?v=81ec"/></p>',
  body = '<p>Parece abrir um &aacute;lbum &amp; fotos.</p><p>Nada nele &#233; alto. Ele n&#039;existe &quot;assim&quot;<br />de novo.</p>',
} = {}) => `<item>
  <title>${title}</title>
  <link>${link}</link>
  <guid isPermaLink="false">${guid}</guid>
  <letterboxd:watchedDate>2025-12-30</letterboxd:watchedDate>
  <letterboxd:rewatch>${rewatch}</letterboxd:rewatch>
  <letterboxd:filmTitle>A Story of Yonosuke</letterboxd:filmTitle>
  ${year}
  ${rating}
  <letterboxd:memberLike>${like}</letterboxd:memberLike>
  <description><![CDATA[ ${poster} ${body} ]]></description>
</item>`;
const rss = (...items: string[]) => `<?xml version='1.0'?><rss><channel><title>Letterboxd</title>${items.join('')}</channel></rss>`;

describe('parseReviews (RSS → anexos de review)', () => {
  it('lê a review com todos os campos; texto em parágrafos, sem HTML', () => {
    const [r] = parseReviews(rss(item()));
    expect(r).toEqual({
      kind: 'review',
      title: 'A Story of Yonosuke',
      year: 2013,
      rating: 4,
      liked: true,
      rewatch: false,
      watched: '2025-12-30',
      poster: 'https://a.ltrbxd.com/resized/film-poster/1/2/3-0-600-0-900-crop.jpg?v=81ec',
      url: 'https://letterboxd.com/oliveira/film/a-story-of-yonosuke/',
      text: 'Parece abrir um álbum & fotos.\n\nNada nele é alto. Ele n\'existe "assim"\nde novo.',
      spoiler: false,
    });
  });

  it('só reviews: diário sem review (letterboxd-watch-) e listas ficam de fora', () => {
    const out = parseReviews(rss(item({ guid: 'letterboxd-watch-9' }), item({ guid: 'letterboxd-list-3' }), item()));
    expect(out).toHaveLength(1);
  });

  it('spoiler marcado: flag ligada e a linha em inglês sai do texto', () => {
    const [r] = parseReviews(
      rss(
        item({
          title: 'A Story of Yonosuke, 2013 - ★★★★ (contains spoilers)',
          body: '<p><em>This review may contain spoilers.</em></p><p>O final me pegou.</p>',
        }),
      ),
    );
    expect(r.spoiler).toBe(true);
    expect(r.text).toBe('O final me pegou.');
  });

  it('sem nota, sem ano, revi, sem curtir, pôster de outro host: campos vazios', () => {
    const [r] = parseReviews(
      rss(item({ rating: '', year: '', rewatch: 'Yes', like: 'No', poster: '<p><img src="https://evil.example/x.jpg"/></p>' })),
    );
    expect(r).toMatchObject({ rating: null, year: null, rewatch: true, liked: false, poster: null });
  });

  it('link de outro site: ignora o item', () => {
    expect(parseReviews(rss(item({ link: 'https://evil.example/film/x/' })))).toEqual([]);
  });

  it('texto muito longo é cortado com …', () => {
    const [r] = parseReviews(rss(item({ body: `<p>${'palavra '.repeat(1500)}</p>` })));
    expect(r.text.length).toBeLessThanOrEqual(6000);
    expect(r.text.endsWith('…')).toBe(true);
  });

  it('entidades numéricas e nomeadas', () => {
    expect(decodeEntities('&lt;b&gt; &#x2019; &#8217; &nbsp;x')).toBe('<b> ’ ’  x');
  });

  it('endereço do feed só com usuário válido', () => {
    expect(rssUrl('oliveira')).toBe('https://letterboxd.com/oliveira/rss/');
    expect(rssUrl('../evil')).toBeNull();
    expect(rssUrl('a')).toBeNull();
  });
});

describe('handler', () => {
  const env: Env = { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'anon' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const req = (token?: string) =>
    new Request('https://sb.test/functions/v1/letterboxd-reviews', {
      method: 'POST',
      headers: { Origin: 'https://fellasapp.pages.dev', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  /** Respostas falsas por endereço: login, membro, perfil e o RSS. */
  const fake = (routes: Record<string, () => Response>) => {
    const calls: string[] = [];
    const fetch = jest.fn(async (url: string) => {
      calls.push(url);
      const key = Object.keys(routes).find((k) => url.includes(k));
      return key ? routes[key]() : new Response('?', { status: 500 });
    });
    return { deps: { fetch: fetch as unknown as typeof globalThis.fetch } as Deps, calls };
  };
  const ok = {
    '/auth/v1/user': () => json({ id: 'u1' }),
    '/rpc/is_member': () => json(true),
    '/rest/v1/profiles': () => json([{ letterboxd_user: 'oliveira' }]),
    'letterboxd.com/oliveira/rss/': () => new Response(rss(item()), { status: 200 }),
  };

  it('sem login: 401 e não busca nada', async () => {
    const { deps, calls } = fake(ok);
    expect((await handle(req(), env, deps)).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('não membro: 403', async () => {
    const { deps } = fake({ ...ok, '/rpc/is_member': () => json(false) });
    expect((await handle(req('t'), env, deps)).status).toBe(403);
  });

  it('membro: devolve as reviews do próprio Letterboxd (o usuário vem do perfil, não do pedido)', async () => {
    const { deps, calls } = fake(ok);
    const res = await handle(req('t'), env, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://fellasapp.pages.dev');
    const body = await res.json();
    expect(body.reviews).toHaveLength(1);
    expect(calls).toContain('https://letterboxd.com/oliveira/rss/');
    expect(calls.some((c) => c.includes('/rest/v1/profiles') && c.includes('id=eq.u1'))).toBe(true);
  });

  it('perfil sem Letterboxd: no_user', async () => {
    const { deps } = fake({ ...ok, '/rest/v1/profiles': () => json([{ letterboxd_user: null }]) });
    const res = await handle(req('t'), env, deps);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('no_user');
  });

  it('usuário que não existe no Letterboxd: not_found', async () => {
    const { deps } = fake({ ...ok, 'letterboxd.com/oliveira/rss/': () => new Response('', { status: 404 }) });
    const res = await handle(req('t'), env, deps);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  it('Letterboxd fora do ar ou redirecionando: unavailable', async () => {
    const { deps } = fake({ ...ok, 'letterboxd.com/oliveira/rss/': () => new Response('', { status: 302 }) });
    const res = await handle(req('t'), env, deps);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('unavailable');
  });

  it('OPTIONS responde o CORS só para o site', async () => {
    const res = await handle(new Request('https://sb.test/x', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
