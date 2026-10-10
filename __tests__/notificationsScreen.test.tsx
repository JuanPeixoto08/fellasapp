import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppNotification } from '../lib/notifications';

const mockPush = jest.fn();
/** Último callback de foco: chamar de novo simula voltar para a tela. */
let mockRefocus: () => void = () => {};
let mockFocused = true;
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useIsFocused: () => mockFocused,
    useFocusEffect: (cb: () => void) => {
      mockRefocus = cb;
      useEffect(cb, [cb]);
    },
    Stack: { Screen: () => null },
  };
});
const mockFetch = jest.fn();
const mockMarkSeen = jest.fn();
jest.mock('../lib/api/notifications', () => ({
  fetchNotifications: () => mockFetch(),
  markNotificationsSeen: () => mockMarkSeen(),
}));
const mockSetUnread = jest.fn();
jest.mock('../lib/notificationsStore', () => ({ setUnreadNotifications: (n: number) => mockSetUnread(n) }));

const mockListStories = jest.fn();
const mockOpenStories = jest.fn();
jest.mock('../lib/api/stories', () => ({ listActiveStories: () => mockListStories() }));
jest.mock('../lib/storyViewerStore', () => ({ openStories: (...a: unknown[]) => mockOpenStories(...a) }));

const mockOpenGame = jest.fn();
jest.mock('../lib/games', () => ({ openGame: (slug: string) => mockOpenGame(slug) }));

import NotificationsScreen from '../app/(tabs)/notifications';
import { emitLive, LIVE_DEBOUNCE_MS } from '../lib/realtime';

const ana = { id: 'u2', username: 'ana', name: 'Ana', avatarUrl: null };
const item = (over: Partial<AppNotification>): AppNotification => ({
  key: over.kind ?? 'like',
  kind: 'like',
  postId: 'p1',
  commentId: null,
  storyId: null,
  actors: [ana],
  actorCount: 1,
  emojis: [],
  body: null,
  latestAt: '2026-10-04T12:00:00Z',
  unread: false,
  thumbUrl: null,
  ...over,
});
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function open() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <NotificationsScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  mockMarkSeen.mockResolvedValue(undefined);
});

describe('Tela de notificações', () => {
  it('mostra as linhas, marca como visto depois de carregar e zera a bolinha', async () => {
    mockFetch.mockResolvedValue([item({ unread: true }), item({ kind: 'new_member', postId: null, actors: [{ ...ana, name: 'Pedro', id: 'u3' }] })]);
    await open();
    expect(await screen.findByLabelText(/Ana curtiu seu post/)).toBeTruthy();
    expect(screen.getByLabelText(/Pedro entrou no fellas/)).toBeTruthy();
    await waitFor(() => expect(mockMarkSeen).toHaveBeenCalledTimes(1));
    expect(mockSetUnread).toHaveBeenCalledWith(0);
  });

  it('só a linha nova tem o ponto de não lida', async () => {
    mockFetch.mockResolvedValue([item({ unread: true }), item({ kind: 'comment', commentId: 'c1', body: 'oi' })]);
    await open();
    await screen.findByLabelText(/Ana curtiu seu post/);
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(1);
  });

  it('voltar de uma notificação mantém o destaque das novas desta visita', async () => {
    mockFetch.mockResolvedValueOnce([item({ unread: true }), item({ kind: 'comment', commentId: 'c1', body: 'oi', unread: true })]);
    // na volta, o banco já marcou tudo como visto
    mockFetch.mockResolvedValueOnce([item({}), item({ kind: 'comment', commentId: 'c1', body: 'oi' })]);
    await open();
    await screen.findByLabelText(/Ana curtiu seu post/);
    await waitFor(() => expect(mockMarkSeen).toHaveBeenCalledTimes(1));
    await act(async () => {
      mockRefocus();
    });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockMarkSeen).toHaveBeenCalledTimes(2));
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(2);
  });

  it('tempo real: com a tela aberta, notificação nova entra sozinha', async () => {
    mockFetch.mockResolvedValueOnce([item({})]);
    mockFetch.mockResolvedValueOnce([item({ kind: 'comment', commentId: 'c9', body: 'chegou', unread: true }), item({})]);
    await open();
    await screen.findByLabelText(/Ana curtiu seu post/);
    await act(async () => {
      emitLive({ kind: 'change', table: 'comments', type: 'INSERT', row: {}, mine: false });
      await new Promise((r) => setTimeout(r, LIVE_DEBOUNCE_MS + 50));
    });
    expect(await screen.findByLabelText(/Ana comentou: “chegou”/)).toBeTruthy();
  });

  it('escondida atrás de um post aberto, não recarrega nem marca como visto', async () => {
    mockFetch.mockResolvedValue([item({})]);
    const view = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <NotificationsScreen />
      </SafeAreaProvider>,
    );
    await screen.findByLabelText(/Ana curtiu seu post/);
    await waitFor(() => expect(mockMarkSeen).toHaveBeenCalledTimes(1));
    mockFocused = false;
    await view.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <NotificationsScreen />
      </SafeAreaProvider>,
    );
    await act(async () => {
      emitLive({ kind: 'change', table: 'likes', type: 'INSERT', row: {}, mine: false });
      await new Promise((r) => setTimeout(r, LIVE_DEBOUNCE_MS + 50));
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockMarkSeen).toHaveBeenCalledTimes(1);
  });

  it('lista vazia: o que chega ao vivo não pisca o carregando', async () => {
    mockFetch.mockResolvedValueOnce([]);
    await open();
    await screen.findByText('Nada por aqui ainda.');
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    await act(async () => {
      emitLive({ kind: 'change', table: 'likes', type: 'INSERT', row: {}, mine: false });
      await new Promise((r) => setTimeout(r, LIVE_DEBOUNCE_MS + 50));
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText('Carregando notificações')).toBeNull();
    expect(screen.getByText('Nada por aqui ainda.')).toBeTruthy();
  });

  it('toque leva ao post ou ao perfil', async () => {
    mockFetch.mockResolvedValue([item({}), item({ kind: 'birthday', postId: null })]);
    await open();
    await fireEvent.press(await screen.findByLabelText(/Ana curtiu seu post/));
    expect(mockPush).toHaveBeenCalledWith('/post/p1');
    await fireEvent.press(screen.getByLabelText(/Hoje é aniversário de Ana/));
    expect(mockPush).toHaveBeenCalledWith('/@ana');
  });

  it('aniversário não mostra "há 15 h" (o texto já diz hoje)', async () => {
    mockFetch.mockResolvedValue([item({ kind: 'birthday', postId: null, latestAt: '2026-10-04T03:00:00Z' })]);
    await open();
    expect(await screen.findByLabelText('Hoje é aniversário de Ana')).toBeTruthy();
    expect(screen.queryByText(/^há /)).toBeNull();
  });

  it('reação no meu story: toque abre o story', async () => {
    const groups = [{ author: { id: 'me' }, stories: [{ id: 's1' }] }];
    mockListStories.mockResolvedValue(groups);
    mockFetch.mockResolvedValue([item({ kind: 'story_reaction', postId: null, storyId: 's1', emojis: ['😂'] })]);
    await open();
    await fireEvent.press(await screen.findByLabelText(/Ana reagiu 😂 ao seu story/));
    await waitFor(() => expect(mockOpenStories).toHaveBeenCalledWith(groups, 'me', 's1'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('contrato na Fellas Inc.: toque abre o jogo', async () => {
    mockFetch.mockResolvedValue([item({ kind: 'idle_hired', postId: null, body: 'CEO de nada' })]);
    await open();
    await fireEvent.press(await screen.findByLabelText(/Ana te contratou como CEO de nada na Fellas Inc\./));
    expect(mockOpenGame).toHaveBeenCalledWith('idle');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('lista vazia convida', async () => {
    mockFetch.mockResolvedValue([]);
    await open();
    expect(await screen.findByText('Nada por aqui ainda.')).toBeTruthy();
  });

  it('erro mostra "Tentar de novo" e não marca como visto', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([item({})]);
    await open();
    expect(await screen.findByText('Não deu pra carregar as notificações.')).toBeTruthy();
    expect(mockMarkSeen).not.toHaveBeenCalled();
    expect(mockSetUnread).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Tentar de novo'));
    expect(await screen.findByLabelText(/Ana curtiu seu post/)).toBeTruthy();
  });
});
