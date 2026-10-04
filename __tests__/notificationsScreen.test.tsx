import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppNotification } from '../lib/notifications';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
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

import NotificationsScreen from '../app/notifications';

const ana = { id: 'u2', name: 'Ana', avatarUrl: null };
const item = (over: Partial<AppNotification>): AppNotification => ({
  key: over.kind ?? 'like',
  kind: 'like',
  postId: 'p1',
  commentId: null,
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

  it('toque leva ao post ou ao perfil', async () => {
    mockFetch.mockResolvedValue([item({}), item({ kind: 'birthday', postId: null })]);
    await open();
    await fireEvent.press(await screen.findByLabelText(/Ana curtiu seu post/));
    expect(mockPush).toHaveBeenCalledWith('/post/p1');
    await fireEvent.press(screen.getByLabelText(/Hoje é aniversário de Ana/));
    expect(mockPush).toHaveBeenCalledWith('/user/u2');
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
