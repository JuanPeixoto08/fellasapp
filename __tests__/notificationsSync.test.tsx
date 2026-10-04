import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockFetchUnread = jest.fn();
let mockSession: { session: { user: { id: string } } | null; profile: { is_member: boolean } | null } = {
  session: null,
  profile: null,
};
jest.mock('../lib/api/notifications', () => ({ fetchUnreadCount: () => mockFetchUnread() }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => mockSession }));

import { NotificationsSync } from '../components/notifications/NotificationsSync';
import { getUnreadNotifications, setUnreadNotifications, UNREAD_POLL_MS } from '../lib/notificationsStore';
import { emitLive, LIVE_DEBOUNCE_MS } from '../lib/realtime';

const member = (id: string) => ({ session: { user: { id } }, profile: { is_member: true } });
let appStateHandler: ((s: string) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSession = { session: null, profile: null };
  setUnreadNotifications(0);
  mockFetchUnread.mockResolvedValue(3);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler as (s: string) => void;
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => jest.useRealTimers());

/** Deixa as promessas pendentes (busca do número) terminarem. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('NotificationsSync', () => {
  it('sem sessão ou sem ser membro não chama a API e a bolinha fica 0', async () => {
    await render(<NotificationsSync />);
    mockSession = { session: { user: { id: 'u1' } }, profile: { is_member: false } };
    await render(<NotificationsSync />);
    await act(async () => {
      jest.advanceTimersByTime(UNREAD_POLL_MS * 2);
    });
    expect(mockFetchUnread).not.toHaveBeenCalled();
    expect(getUnreadNotifications()).toBe(0);
  });

  it('membro: busca ao entrar, a cada minuto e ao voltar para o app', async () => {
    mockSession = member('u1');
    await render(<NotificationsSync />);
    await flush();
    expect(mockFetchUnread).toHaveBeenCalledTimes(1);
    expect(getUnreadNotifications()).toBe(3);
    await act(async () => {
      jest.advanceTimersByTime(UNREAD_POLL_MS);
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(2);
    await act(async () => {
      appStateHandler?.('active');
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(3);
  });

  it('em segundo plano não busca; volta a buscar quando o app volta', async () => {
    mockSession = member('u1');
    await render(<NotificationsSync />);
    await flush();
    expect(mockFetchUnread).toHaveBeenCalledTimes(1);
    await act(async () => {
      appStateHandler?.('background');
      jest.advanceTimersByTime(UNREAD_POLL_MS * 3);
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(1);
    await act(async () => {
      appStateHandler?.('active');
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(2);
    await act(async () => {
      jest.advanceTimersByTime(UNREAD_POLL_MS);
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(3);
  });

  it('tempo real: curtida/comentário/reação de outra pessoa busca o número (rajada vira uma busca)', async () => {
    mockSession = member('u1');
    await render(<NotificationsSync />);
    await flush();
    expect(mockFetchUnread).toHaveBeenCalledTimes(1);
    const change = (table: string, mine = false, type = 'INSERT') =>
      emitLive({ kind: 'change', table, type, row: {}, mine } as never);
    await act(async () => {
      change('likes');
      change('comments');
      change('post_reactions');
      jest.advanceTimersByTime(LIVE_DEBOUNCE_MS);
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(2);
    await act(async () => {
      change('likes', true); // eu mesmo
      change('posts', true); // post meu
      change('profiles', false, 'UPDATE'); // alguém mexeu no perfil
      jest.advanceTimersByTime(LIVE_DEBOUNCE_MS);
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(2);
    await act(async () => {
      change('profiles', false, 'INSERT'); // fella novo
      jest.advanceTimersByTime(LIVE_DEBOUNCE_MS);
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(3);
  });

  it('trocar de conta zera o número antes de chegar o da conta nova', async () => {
    mockSession = member('u1');
    const view = await render(<NotificationsSync />);
    await flush();
    expect(getUnreadNotifications()).toBe(3);
    let resolveNext: (n: number) => void = () => {};
    mockFetchUnread.mockReturnValue(new Promise<number>((r) => (resolveNext = r)));
    mockSession = member('u2');
    await view.rerender(<NotificationsSync />);
    expect(getUnreadNotifications()).toBe(0);
    await act(async () => {
      resolveNext(7);
    });
    await flush();
    expect(getUnreadNotifications()).toBe(7);
  });

  it('erro de rede mantém o último número', async () => {
    mockSession = member('u1');
    await render(<NotificationsSync />);
    await flush();
    mockFetchUnread.mockRejectedValue(new Error('offline'));
    await act(async () => {
      jest.advanceTimersByTime(UNREAD_POLL_MS);
    });
    await flush();
    expect(getUnreadNotifications()).toBe(3);
  });
});
