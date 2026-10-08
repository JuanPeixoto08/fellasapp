import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Champion, LeaderRow, Wallet } from '../lib/api/games';

const mockApi = {
  getWallet: jest.fn<Promise<Wallet>, []>(),
  takeFiado: jest.fn<Promise<Wallet>, []>(),
  getLeaderboard: jest.fn<Promise<LeaderRow[]>, []>(),
  getLastChampion: jest.fn<Promise<Champion | null>, []>(),
};
jest.mock('../lib/api/games', () => ({
  ...jest.requireActual('../lib/api/games'),
  getWallet: () => mockApi.getWallet(),
  takeFiado: () => mockApi.takeFiado(),
  getLeaderboard: () => mockApi.getLeaderboard(),
  getLastChampion: () => mockApi.getLastChampion(),
}));
const mockOpen = jest.fn();
jest.mock('../lib/games', () => ({ openGame: (slug: string) => mockOpen(slug) }));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (fn: () => void) => useEffect(fn, [fn]) };
});
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../lib/useMyAvatar', () => ({ useMyAvatar: () => ({ name: 'Juan', uri: null }) }));

import GamesScreen from '../app/(tabs)/games';
import { setMemberDirectory } from '../lib/memberDirectory';

const wallet = (extra: Partial<Wallet> = {}): Wallet => ({
  balance: 1090,
  fiadoCount: 0,
  canFiado: false,
  openRoundId: null,
  weekStart: '2026-10-05',
  ...extra,
});
const row = (userId: string, name: string, balance: number, fiadoCount = 0): LeaderRow => ({
  userId,
  name,
  username: name.toLowerCase(),
  avatarUrl: null,
  balance,
  fiadoCount,
});

const Wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    {children}
  </SafeAreaProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.getWallet.mockResolvedValue(wallet());
  mockApi.getLeaderboard.mockResolvedValue([row('u1', 'Oliveira', 3420), row('me', 'Juan', 1090), row('u2', 'Rafa', 640, 1)]);
  mockApi.getLastChampion.mockResolvedValue({
    userId: 'u1',
    name: 'Oliveira',
    username: 'oliveira',
    avatarUrl: null,
    balance: 4870,
    weekStart: '2026-09-28',
  });
});

describe('Fellas Games', () => {
  it('placar chegou antes da lista de fellas: os nomes aparecem quando ela carrega', async () => {
    // voltando da mesa o app reabre direto na aba: o placar costuma ganhar da lista de fellas
    setMemberDirectory([]);
    mockApi.getLeaderboard.mockResolvedValue([row('u1', 'Alguém', 3420), row('me', 'Alguém', 1090)]);
    mockApi.getLastChampion.mockResolvedValue({ userId: 'u1', name: 'Alguém', username: '', avatarUrl: null, balance: 4870, weekStart: '2026-09-28' });
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Placar da semana')).toBeTruthy());
    expect(screen.queryByText('Oliveira')).toBeNull();
    await act(async () => {
      setMemberDirectory([
        { id: 'u1', username: 'oliveira', name: 'Oliveira', avatarUrl: null },
        { id: 'me', username: 'juan', name: 'Juan', avatarUrl: null },
      ]);
    });
    // placar e campeão
    expect(screen.getAllByText('Oliveira')).toHaveLength(2);
    expect(screen.queryByText('Alguém')).toBeNull();
    setMemberDirectory([]);
  });

  it('carregando: linhas fantasma no lugar do placar', async () => {
    mockApi.getWallet.mockReturnValue(new Promise(() => {}));
    await render(<GamesScreen />, { wrapper: Wrapper });
    expect(screen.getByLabelText('Carregando o placar')).toBeTruthy();
  });

  it('meus créditos, posição, campeão com troféu, placar e o fiado de quem pegou', async () => {
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Placar da semana')).toBeTruthy());
    expect(screen.getAllByText('1.090').length).toBeGreaterThan(0);
    expect(screen.getByText('2º lugar')).toBeTruthy();
    expect(screen.getByText('Campeão da semana passada')).toBeTruthy();
    expect(screen.getByText('fechou com 4.870')).toBeTruthy();
    expect(screen.getAllByLabelText('Campeão da semana').length).toBeGreaterThan(0);
    expect(screen.getByText('· 1 fiado')).toBeTruthy();
    expect(screen.getByTestId('board-row-me')).toBeTruthy();
  });

  it('primeira semana: sem campeão e sem ninguém no placar', async () => {
    mockApi.getLastChampion.mockResolvedValue(null);
    mockApi.getLeaderboard.mockResolvedValue([]);
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Ninguém jogou essa semana ainda. Abre os trabalhos.')).toBeTruthy());
    expect(screen.queryByText('Campeão da semana passada')).toBeNull();
    expect(screen.getByText('Fora do placar até a primeira mão')).toBeTruthy();
  });

  it('erro: frase e Tentar de novo recarrega', async () => {
    mockApi.getWallet.mockRejectedValueOnce(new Error('rede'));
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Não deu pra carregar o placar. Tenta de novo.')).toBeTruthy());
    await fireEvent.press(screen.getByText('Tentar de novo'));
    await waitFor(() => expect(screen.getByText('Placar da semana')).toBeTruthy());
    expect(mockApi.getWallet).toHaveBeenCalledTimes(2);
  });

  it('sem dar pra apostar: pega o fiado e o saldo atualiza', async () => {
    mockApi.getWallet.mockResolvedValue(wallet({ balance: 0, canFiado: true }));
    mockApi.takeFiado.mockResolvedValue(wallet({ balance: 100, fiadoCount: 1 }));
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Pegar fiado (+100)')).toBeTruthy());
    await fireEvent.press(screen.getByText('Pegar fiado (+100)'));
    await waitFor(() => expect(screen.getAllByText('100').length).toBeGreaterThan(0));
    expect(screen.queryByText('Pegar fiado (+100)')).toBeNull();
  });

  it('fiado de hoje já foi', async () => {
    mockApi.getWallet.mockResolvedValue(wallet({ balance: 0, canFiado: true }));
    mockApi.takeFiado.mockRejectedValue({ message: 'fiado_today' });
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Pegar fiado (+100)')).toBeTruthy());
    await fireEvent.press(screen.getByText('Pegar fiado (+100)'));
    await waitFor(() => expect(screen.getByText('Fiado de hoje já foi. Volta amanhã.')).toBeTruthy());
  });

  it('sem saldo e já pegou o fiado de hoje: a aba explica sozinha', async () => {
    mockApi.getWallet.mockResolvedValue(wallet({ balance: 5, canFiado: false, fiadoCount: 1 }));
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Fiado de hoje já foi. Volta amanhã.')).toBeTruthy());
    expect(screen.queryByText('Pegar fiado (+100)')).toBeNull();
  });

  it('sem saldo com mão aberta: nada de aviso de fiado (dá pra continuar a mão)', async () => {
    mockApi.getWallet.mockResolvedValue(wallet({ balance: 0, canFiado: false, openRoundId: 'r1' }));
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Continuar mão')).toBeTruthy());
    expect(screen.queryByText('Fiado de hoje já foi. Volta amanhã.')).toBeNull();
  });

  it('Jogar abre a mesa; com mão aberta vira Continuar mão; Poker em breve', async () => {
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByLabelText('Jogar Blackjack')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Jogar Blackjack'));
    expect(mockOpen).toHaveBeenCalledWith('blackjack');
    expect(screen.getByText('Em breve')).toBeTruthy();
    mockApi.getWallet.mockResolvedValue(wallet({ openRoundId: 'r1' }));
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Continuar mão')).toBeTruthy());
  });
});
