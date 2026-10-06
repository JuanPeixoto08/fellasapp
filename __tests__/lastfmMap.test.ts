import {
  DEFAULT_PERIOD,
  formatThousands,
  isValidLastfmUser,
  mapRecentTracks,
  mapTop,
  mapUserInfo,
  PERIODS,
  pickImage,
  safeLastfmUrl,
  sinceYear,
} from '../lib/lastfm/map';

const STAR = 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png';
const img = (url: string) => [
  { '#text': url.replace('300x300', '34s'), size: 'small' },
  { '#text': url, size: 'extralarge' },
];

describe('pickImage', () => {
  it('a maior não vazia; estrela genérica e vazia viram null', () => {
    expect(pickImage(img('https://x/300x300/capa.png'))).toBe('https://x/300x300/capa.png');
    expect(pickImage(img(STAR))).toBeNull();
    expect(pickImage([{ '#text': '', size: 'small' }])).toBeNull();
    expect(pickImage(undefined)).toBeNull();
  });
});

describe('mapRecentTracks', () => {
  it('converte, marca "ouvindo agora" sem data e lê a paginação', () => {
    const page = mapRecentTracks({
      recenttracks: {
        track: [
          {
            name: 'Ama Sofre Chora',
            artist: { '#text': 'Pablo Vittar' },
            album: { '#text': 'Batidão Tropical' },
            image: img('https://x/300x300/a.png'),
            url: 'https://www.last.fm/music/Pablo+Vittar/_/Ama+Sofre+Chora',
            '@attr': { nowplaying: 'true' },
          },
          {
            name: '360',
            artist: { '#text': 'Charli xcx' },
            album: { '#text': '' },
            image: img('https://x/300x300/b.png'),
            url: 'https://www.last.fm/music/Charli+xcx/_/360',
            date: { uts: '1791262000', '#text': '06 Oct 2026, 12:06' },
          },
        ],
        '@attr': { page: '1', totalPages: '249' },
      },
    });
    expect(page).toEqual({
      page: 1,
      totalPages: 249,
      items: [
        {
          name: 'Ama Sofre Chora',
          artist: 'Pablo Vittar',
          album: 'Batidão Tropical',
          image: 'https://x/300x300/a.png',
          url: 'https://www.last.fm/music/Pablo+Vittar/_/Ama+Sofre+Chora',
          playedAt: null,
          nowPlaying: true,
        },
        {
          name: '360',
          artist: 'Charli xcx',
          album: null,
          image: 'https://x/300x300/b.png',
          url: 'https://www.last.fm/music/Charli+xcx/_/360',
          playedAt: new Date(1791262000 * 1000).toISOString(),
          nowPlaying: false,
        },
      ],
    });
  });

  it('um item só vem como objeto: vira lista de 1', () => {
    const page = mapRecentTracks({
      recenttracks: {
        track: { name: 'Só', artist: { '#text': 'Uma' }, url: 'u', date: { uts: '1' } },
        '@attr': { page: '1', totalPages: '1' },
      },
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].name).toBe('Só');
  });

  it('conta sem scrobbles: lista vazia e 0 páginas', () => {
    expect(mapRecentTracks({ recenttracks: { track: [], '@attr': { page: '1', totalPages: '0' } } })).toEqual({
      items: [],
      page: 1,
      totalPages: 0,
    });
  });
});

describe('mapTop', () => {
  it('artistas: sem artista na linha; estrela genérica vira null', () => {
    const page = mapTop('artists', {
      topartists: {
        artist: [{ name: 'Pablo Vittar', playcount: '212', url: 'https://www.last.fm/music/Pablo+Vittar', image: img(STAR), '@attr': { rank: '1' } }],
        '@attr': { page: '1', totalPages: '3' },
      },
    });
    expect(page).toEqual({
      page: 1,
      totalPages: 3,
      items: [{ rank: 1, name: 'Pablo Vittar', artist: null, image: null, url: 'https://www.last.fm/music/Pablo+Vittar', plays: 212 }],
    });
  });

  it('álbuns e músicas trazem o artista; um item só vira lista', () => {
    const albums = mapTop('albums', {
      topalbums: {
        album: { name: 'Brat', playcount: '140', url: 'https://www.last.fm/music/Charli+xcx/Brat', artist: { name: 'Charli xcx' }, image: img('https://x/300x300/c.png'), '@attr': { rank: '1' } },
        '@attr': { page: '1', totalPages: '1' },
      },
    });
    expect(albums.items).toEqual([
      { rank: 1, name: 'Brat', artist: 'Charli xcx', image: 'https://x/300x300/c.png', url: 'https://www.last.fm/music/Charli+xcx/Brat', plays: 140 },
    ]);
    const tracks = mapTop('tracks', {
      toptracks: {
        track: [{ name: '360', playcount: '50', url: 'u3', artist: { name: 'Charli xcx' }, image: [], '@attr': { rank: '2' } }],
        '@attr': { page: '2', totalPages: '4' },
      },
    });
    expect(tracks).toMatchObject({ page: 2, totalPages: 4, items: [{ rank: 2, artist: 'Charli xcx', image: null, plays: 50 }] });
  });
});

describe('mapUserInfo e números', () => {
  it('resumo da conta', () => {
    expect(
      mapUserInfo({ user: { name: 'juan', playcount: '12430', registered: { unixtime: '1546300800' } } }),
    ).toEqual({ name: 'juan', playcount: 12430, registeredAt: new Date(1546300800 * 1000).toISOString() });
    expect(formatThousands(12430)).toBe('12.430');
    expect(formatThousands(999)).toBe('999');
    expect(sinceYear('2019-01-01T00:00:00.000Z')).toBe('2019');
    expect(sinceYear(null)).toBeNull();
  });
});

describe('isValidLastfmUser e períodos', () => {
  it('regra do usuário do Last.fm', () => {
    expect(isValidLastfmUser('juan_08')).toBe(true);
    expect(isValidLastfmUser('a')).toBe(false);
    expect(isValidLastfmUser('1abc')).toBe(false);
    expect(isValidLastfmUser('juan peixoto')).toBe(false);
    expect(isValidLastfmUser('abcdefghijklmnop')).toBe(false);
  });

  it('períodos na ordem, 1 mês de padrão', () => {
    expect(PERIODS.map((p) => p.label)).toEqual(['7 dias', '1 mês', '3 meses', '1 ano', 'sempre']);
    expect(PERIODS.map((p) => p.value)).toEqual(['7day', '1month', '3month', '12month', 'overall']);
    expect(DEFAULT_PERIOD).toBe('1month');
  });
});

describe('safeLastfmUrl', () => {
  it('só páginas do site do Last.fm passam; o resto vira vazio', () => {
    expect(safeLastfmUrl('https://www.last.fm/music/Cher')).toBe('https://www.last.fm/music/Cher');
    expect(safeLastfmUrl('https://last.fm/user/rj')).toBe('https://last.fm/user/rj');
    expect(safeLastfmUrl('javascript:alert(1)')).toBe('');
    expect(safeLastfmUrl('https://last.fm.evil.com/x')).toBe('');
    expect(safeLastfmUrl('https://evillast.fm/x')).toBe('');
    expect(safeLastfmUrl('http://www.last.fm/music/Cher')).toBe('');
    expect(safeLastfmUrl(undefined)).toBe('');
  });

  it('as conversões usam a url segura', () => {
    const page = mapRecentTracks({ recenttracks: { track: [{ name: 'x', artist: { '#text': 'y' }, url: 'javascript:alert(1)' }] } });
    expect(page.items[0].url).toBe('');
    const top = mapTop('artists', { topartists: { artist: [{ name: 'z', url: 'data:text/html,oi', playcount: '1' }] } });
    expect(top.items[0].url).toBe('');
  });
});
