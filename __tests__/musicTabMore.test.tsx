import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockRetryMore = jest.fn();
const mockState = { items: [] as unknown[], loading: false, error: null as unknown, loadMore: jest.fn(), reload: jest.fn(), retryMore: mockRetryMore };
jest.mock('../lib/lastfm/useLastfmPages', () => ({ useLastfmPages: () => mockState }));
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  getUserInfo: () => Promise.resolve({ name: 'juan', playcount: 1, registeredAt: null }),
}));

import { MusicTab } from '../components/music/MusicTab';
import { LastfmError } from '../lib/lastfm/api';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <MusicTab user="juan" top={<Text>topo</Text>} />
    </SafeAreaProvider>,
  );
const track = { name: '360', artist: 'Charli xcx', album: null, image: null, url: 'https://www.last.fm/x', playedAt: null, nowPlaying: false };

describe('MusicTab: rolando a lista', () => {
  it('falhou carregar mais com músicas na tela: aviso no pé e tentar de novo', async () => {
    mockState.items = [track];
    mockState.error = new LastfmError('network');
    await open();
    expect(screen.getByText('Não deu pra carregar mais.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(mockRetryMore).toHaveBeenCalled();
  });

  it('sub-abas com alvo de toque de pelo menos 44', async () => {
    mockState.items = [track];
    mockState.error = null;
    await open();
    const chip = screen.getByRole('tab', { name: 'Recentes' });
    const minHeight = StyleSheet.flatten(chip.props.style).minHeight as number;
    const slop = (chip.props.hitSlop?.top ?? 0) + (chip.props.hitSlop?.bottom ?? 0);
    expect(minHeight + slop).toBeGreaterThanOrEqual(44);
  });
});
