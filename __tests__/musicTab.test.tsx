import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockInfo = jest.fn();
const mockRecent = jest.fn();
const mockTop = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  getUserInfo: (u: string) => mockInfo(u),
  getRecentTracks: (u: string, p: number) => mockRecent(u, p),
  getTop: (k: string, u: string, per: string, p: number) => mockTop(k, u, per, p),
}));

import { MusicTab } from '../components/music/MusicTab';
import { LastfmError } from '../lib/lastfm/api';

const recentPage = {
  items: [{ name: '360', artist: 'Charli xcx', album: 'Brat', image: null, url: 'https://last.fm/360', playedAt: new Date().toISOString(), nowPlaying: false }],
  page: 1,
  totalPages: 1,
};
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <MusicTab user="juan" top={<Text>topo do perfil</Text>} />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockInfo.mockResolvedValue({ name: 'juan', playcount: 12430, registeredAt: '2019-03-01T00:00:00.000Z' });
  mockRecent.mockResolvedValue(recentPage);
  mockTop.mockResolvedValue({ items: [{ rank: 1, name: 'Pablo Vittar', artist: null, image: null, url: 'u', plays: 212 }], page: 1, totalPages: 1 });
});

describe('MusicTab', () => {
  it('topo do perfil, resumo e Recentes de início', async () => {
    await open();
    expect(screen.getByText('topo do perfil')).toBeTruthy();
    expect(await screen.findByText('12.430 scrobbles · desde 2019')).toBeTruthy();
    expect(await screen.findByText('360')).toBeTruthy();
    expect(mockRecent).toHaveBeenCalledWith('juan', 1);
  });

  it('sub-aba Artistas usa 1 mês; trocar período busca de novo', async () => {
    await open();
    await fireEvent.press(screen.getByRole('tab', { name: 'Artistas' }));
    await waitFor(() => expect(mockTop).toHaveBeenCalledWith('artists', 'juan', '1month', 1));
    expect(await screen.findByText('Pablo Vittar')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '7 dias' }));
    await waitFor(() => expect(mockTop).toHaveBeenLastCalledWith('artists', 'juan', '7day', 1));
  });

  it('Recentes não mostra seletor de período', async () => {
    await open();
    await screen.findByText('360');
    expect(screen.queryByRole('button', { name: '7 dias' })).toBeNull();
  });

  it('tocar numa música abre no Last.fm', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await open();
    await fireEvent.press(await screen.findByLabelText('360, de Charli xcx'));
    expect(spy).toHaveBeenCalledWith('https://last.fm/360');
  });

  it.each([
    ['private', 'O Last.fm dessa pessoa está privado.'],
    ['not_found', 'Esse usuário do Last.fm não existe mais.'],
    ['no_key', 'Last.fm não configurado.'],
  ])('erro %s mostra o aviso certo', async (kind, text) => {
    mockRecent.mockRejectedValue(new LastfmError(kind as never));
    await open();
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it('falha de rede: tentar de novo', async () => {
    mockRecent.mockRejectedValueOnce(new LastfmError('network')).mockResolvedValueOnce(recentPage);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('360')).toBeTruthy();
  });

  it('sem nada: "Nada por aqui ainda."', async () => {
    mockRecent.mockResolvedValue({ items: [], page: 1, totalPages: 0 });
    await open();
    expect(await screen.findByText('Nada por aqui ainda.')).toBeTruthy();
  });
});
