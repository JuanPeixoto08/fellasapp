import { act, render, screen, waitFor } from '@testing-library/react-native';

const mockCover = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  getTrackCover: (artist: string, track: string) => mockCover(artist, track),
}));

import { TopRow } from '../components/music/TopRow';
import { clearTrackCovers, loadTrackCover, TRACK_COVER_CONCURRENCY } from '../lib/lastfm/trackCovers';

beforeEach(() => {
  mockCover.mockReset();
  clearTrackCovers();
});

describe('loadTrackCover', () => {
  it('no máximo 2 pedidos ao mesmo tempo', async () => {
    const pending: ((v: string | null) => void)[] = [];
    mockCover.mockImplementation(() => new Promise((r) => pending.push(r)));
    expect(TRACK_COVER_CONCURRENCY).toBe(2);
    const all = [loadTrackCover('A', '1'), loadTrackCover('A', '2'), loadTrackCover('A', '3')];
    await Promise.resolve();
    expect(mockCover).toHaveBeenCalledTimes(2);
    await act(async () => pending[0]('https://x/1.png'));
    await waitFor(() => expect(mockCover).toHaveBeenCalledTimes(3));
    pending[1](null);
    pending[2]('https://x/3.png');
    await expect(Promise.all(all)).resolves.toEqual(['https://x/1.png', null, 'https://x/3.png']);
  });

  it('a mesma música (mesmo com maiúsculas diferentes) pede uma vez só', async () => {
    mockCover.mockResolvedValue('https://x/c.png');
    await loadTrackCover('Charli xcx', '360');
    await loadTrackCover('charli XCX', '360');
    expect(mockCover).toHaveBeenCalledTimes(1);
  });

  it('falhou: devolve null e tenta de novo na próxima vez', async () => {
    mockCover.mockRejectedValueOnce(new Error('caiu')).mockResolvedValueOnce('https://x/c.png');
    await expect(loadTrackCover('A', 'x')).resolves.toBeNull();
    await expect(loadTrackCover('A', 'x')).resolves.toBe('https://x/c.png');
  });
});

describe('TopRow de música sem capa', () => {
  it('busca a capa e mostra quando chega', async () => {
    mockCover.mockResolvedValue('https://x/capa.png');
    await render(
      <TopRow kind="tracks" item={{ rank: 1, name: '360', artist: 'Charli xcx', image: null, url: '', plays: 3 }} onPress={() => {}} />,
    );
    expect(await screen.findByLabelText('Imagem de 360')).toBeTruthy();
    expect(mockCover).toHaveBeenCalledWith('Charli xcx', '360');
  });

  it('álbum (ou música que já tem capa) não pede nada', async () => {
    await render(
      <TopRow kind="albums" item={{ rank: 1, name: 'Brat', artist: 'Charli xcx', image: null, url: '', plays: 3 }} onPress={() => {}} />,
    );
    await render(
      <TopRow kind="tracks" item={{ rank: 2, name: 'x', artist: 'y', image: 'https://x/t.png', url: '', plays: 1 }} onPress={() => {}} />,
    );
    expect(mockCover).not.toHaveBeenCalled();
  });
});
