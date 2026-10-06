import { getArtistCover, getNowPlaying, getRecentTracks, getTop, getTrackCover, getUserInfo, hasLastfmKey, LastfmError } from '../lib/lastfm/api';

const mockFetch = jest.fn();
const ORIGINAL_KEY = process.env.EXPO_PUBLIC_LASTFM_API_KEY;

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_LASTFM_API_KEY = 'k123';
});
afterAll(() => {
  process.env.EXPO_PUBLIC_LASTFM_API_KEY = ORIGINAL_KEY;
});

const ok = (json: unknown) => mockFetch.mockResolvedValue({ ok: true, json: async () => json });
const query = () => new URL(mockFetch.mock.calls[0][0] as string).searchParams;

describe('api do Last.fm', () => {
  it('recentes: método, usuário, página, 50 por vez, chave e json', async () => {
    ok({ recenttracks: { track: [], '@attr': { page: '2', totalPages: '9' } } });
    await expect(getRecentTracks('juan', 2)).resolves.toEqual({ items: [], page: 2, totalPages: 9 });
    const q = query();
    expect(q.get('method')).toBe('user.getrecenttracks');
    expect(q.get('user')).toBe('juan');
    expect(q.get('page')).toBe('2');
    expect(q.get('limit')).toBe('50');
    expect(q.get('api_key')).toBe('k123');
    expect(q.get('format')).toBe('json');
    expect((mockFetch.mock.calls[0][0] as string).startsWith('https://ws.audioscrobbler.com/2.0/?')).toBe(true);
  });

  it('recentes depois da página 1: tira o "ouvindo agora" repetido', async () => {
    ok({
      recenttracks: {
        track: [
          { name: 'Agora', artist: { '#text': 'A' }, url: 'https://www.last.fm/x', '@attr': { nowplaying: 'true' } },
          { name: 'Antes', artist: { '#text': 'B' }, url: 'https://www.last.fm/y', date: { uts: '1' } },
        ],
        '@attr': { page: '2', totalPages: '3' },
      },
    });
    const page2 = await getRecentTracks('juan', 2);
    expect(page2.items.map((t) => t.name)).toEqual(['Antes']);
  });

  it('capa de uma música: vem do álbum dela (track.getinfo); estrela ou sem álbum = null', async () => {
    ok({ track: { name: '360', album: { image: [{ '#text': 'https://x/34s/c.png' }, { '#text': 'https://x/300x300/c.png' }] } } });
    await expect(getTrackCover('Charli xcx', '360')).resolves.toBe('https://x/300x300/c.png');
    expect(query().get('method')).toBe('track.getinfo');
    expect(query().get('artist')).toBe('Charli xcx');
    expect(query().get('track')).toBe('360');
    mockFetch.mockReset();
    ok({ track: { name: 'x' } });
    await expect(getTrackCover('A', 'x')).resolves.toBeNull();
  });

  it('imagem de artista: capa do álbum mais ouvido dele (artist.gettopalbums, 1 só)', async () => {
    ok({ topalbums: { album: { name: 'Nada Como um Dia', image: [{ '#text': 'https://x/34s/r.png' }, { '#text': 'https://x/300x300/r.png' }] } } });
    await expect(getArtistCover("Racionais MC's")).resolves.toBe('https://x/300x300/r.png');
    expect(query().get('method')).toBe('artist.gettopalbums');
    expect(query().get('artist')).toBe("Racionais MC's");
    expect(query().get('limit')).toBe('1');
    mockFetch.mockReset();
    ok({ topalbums: { album: [] } });
    await expect(getArtistCover('Ninguém')).resolves.toBeNull();
  });

  it('tops: método por tipo e período', async () => {
    ok({ topalbums: { album: [], '@attr': { page: '1', totalPages: '0' } } });
    await getTop('albums', 'juan', '7day', 1);
    expect(query().get('method')).toBe('user.gettopalbums');
    expect(query().get('period')).toBe('7day');
  });

  it('resumo da conta', async () => {
    ok({ user: { name: 'juan', playcount: '10', registered: { unixtime: '1546300800' } } });
    await expect(getUserInfo('juan')).resolves.toMatchObject({ name: 'juan', playcount: 10 });
    expect(query().get('method')).toBe('user.getinfo');
  });

  it('ouvindo agora: a música marcada, ou null', async () => {
    ok({
      recenttracks: {
        track: [{ name: 'Agora', artist: { '#text': 'A' }, url: 'u', '@attr': { nowplaying: 'true' } }],
        '@attr': { page: '1', totalPages: '1' },
      },
    });
    await expect(getNowPlaying('juan')).resolves.toMatchObject({ name: 'Agora', nowPlaying: true });
    expect(query().get('limit')).toBe('1');
    ok({ recenttracks: { track: [{ name: 'Antes', artist: { '#text': 'A' }, url: 'u', date: { uts: '1' } }] } });
    await expect(getNowPlaying('juan')).resolves.toBeNull();
  });

  it.each([
    [6, 'not_found'],
    [17, 'private'],
    [29, 'rate_limit'],
    [8, 'other'],
  ])('erro %s do Last.fm vira %s', async (code, kind) => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: code, message: 'x' }) });
    const error = await getUserInfo('juan').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LastfmError);
    expect((error as LastfmError).kind).toBe(kind);
  });

  it('sem rede vira network', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(getUserInfo('juan')).rejects.toMatchObject({ kind: 'network' });
  });

  it('sem chave: no_key e nem chama a rede', async () => {
    process.env.EXPO_PUBLIC_LASTFM_API_KEY = '';
    expect(hasLastfmKey()).toBe(false);
    await expect(getUserInfo('juan')).rejects.toMatchObject({ kind: 'no_key' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
