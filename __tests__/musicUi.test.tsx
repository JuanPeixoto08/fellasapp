import { fireEvent, render, screen } from '@testing-library/react-native';

const mockUseNowPlaying = jest.fn();
jest.mock('../lib/lastfm/useNowPlaying', () => ({ useNowPlaying: (u: string) => mockUseNowPlaying(u) }));

import { ArtistTile } from '../components/music/ArtistTile';
import { NowPlayingLine } from '../components/music/NowPlayingLine';
import { TopRow } from '../components/music/TopRow';
import { TrackRow } from '../components/music/TrackRow';
import type { LastfmTrack } from '../lib/lastfm/types';

const track = (over: Partial<LastfmTrack> = {}): LastfmTrack => ({
  name: '360',
  artist: 'Charli xcx',
  album: 'Brat',
  image: 'https://x/c.png',
  url: 'u',
  playedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  nowPlaying: false,
  ...over,
});

describe('ArtistTile', () => {
  it('com imagem mostra a foto; artista sem foto mostra a inicial; capa vazia mostra a nota', async () => {
    const view = await render(<ArtistTile name="Pablo Vittar" uri="https://x/p.png" size={40} round />);
    expect(screen.getByLabelText('Imagem de Pablo Vittar')).toBeTruthy();
    await view.rerender(<ArtistTile name="Pablo Vittar" uri={null} size={40} round />);
    expect(screen.getByText('PV')).toBeTruthy();
    await view.rerender(<ArtistTile name="Brat" uri={null} size={40} />);
    expect(screen.getByTestId('cover-empty')).toBeTruthy();
  });
});

describe('TrackRow', () => {
  it('música, artista e há quanto tempo; tocando agora mostra "agora"', async () => {
    const onPress = jest.fn();
    const view = await render(<TrackRow track={track()} onPress={onPress} />);
    expect(screen.getByText('360')).toBeTruthy();
    expect(screen.getByText('Charli xcx')).toBeTruthy();
    expect(screen.getByText('há 4 min')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('360, de Charli xcx'));
    expect(onPress).toHaveBeenCalled();
    await view.rerender(<TrackRow track={track({ nowPlaying: true, playedAt: null })} onPress={onPress} />);
    expect(screen.getByText('● agora')).toBeTruthy();
    expect(screen.getByLabelText('360, de Charli xcx, ouvindo agora')).toBeTruthy();
  });
});

describe('TopRow', () => {
  it('posição, nome, artista e plays com milhar', async () => {
    const onPress = jest.fn();
    await render(
      <TopRow
        kind="albums"
        item={{ rank: 2, name: 'Brat', artist: 'Charli xcx', image: null, url: 'u', plays: 1240 }}
        onPress={onPress}
      />,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1.240 plays')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('2º Brat, de Charli xcx, 1.240 plays'));
    expect(onPress).toHaveBeenCalled();
  });

  it('1 play no singular; artista sem linha de artista', async () => {
    await render(
      <TopRow kind="artists" item={{ rank: 1, name: 'Matuê', artist: null, image: null, url: 'u', plays: 1 }} onPress={() => {}} />,
    );
    expect(screen.getByText('1 play')).toBeTruthy();
    expect(screen.getByLabelText('1º Matuê, 1 play')).toBeTruthy();
  });
});

describe('NowPlayingLine', () => {
  it('aparece tocando, com rótulo, e abre a aba Música', async () => {
    mockUseNowPlaying.mockReturnValue(track({ name: 'Ama Sofre Chora', artist: 'Pablo Vittar', nowPlaying: true, playedAt: null }));
    const onPress = jest.fn();
    await render(<NowPlayingLine user="juan" onPress={onPress} />);
    expect(mockUseNowPlaying).toHaveBeenCalledWith('juan');
    await fireEvent.press(screen.getByLabelText('Ouvindo agora: Ama Sofre Chora, de Pablo Vittar'));
    expect(onPress).toHaveBeenCalled();
  });

  it('nada tocando: não aparece', async () => {
    mockUseNowPlaying.mockReturnValue(null);
    await render(<NowPlayingLine user="juan" onPress={() => {}} />);
    expect(screen.queryByLabelText(/Ouvindo agora/)).toBeNull();
  });
});
