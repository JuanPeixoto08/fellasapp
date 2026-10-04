import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';

type Handler = (payload: Record<string, unknown>) => void;
const mockHandlers: { table: string; handler: Handler }[] = [];
let mockStatus: (status: string) => void = () => {};
const mockRemoveChannel = jest.fn();
const mockChannelName = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    channel: (name: string) => {
      mockChannelName(name);
      const ch = {
        on: (_type: string, filter: { table: string }, handler: Handler) => {
          mockHandlers.push({ table: filter.table, handler });
          return ch;
        },
        subscribe: (cb: (status: string) => void) => {
          mockStatus = cb;
          return ch;
        },
      };
      return ch;
    },
    removeChannel: (ch: unknown) => mockRemoveChannel(ch),
  },
}));
let mockSession: { session: { user: { id: string } } | null; profile: { is_member: boolean } | null } = {
  session: null,
  profile: null,
};
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => mockSession }));

import { RealtimeSync } from '../components/realtime/RealtimeSync';
import { affectsNotifications, debounce, LIVE_TABLES, onLive, postIdOf, type LiveEvent } from '../lib/realtime';

const member = (id: string) => ({ session: { user: { id } }, profile: { is_member: true } });
let appStateHandler: ((s: string) => void) | null = null;
let events: LiveEvent[] = [];
let off: () => void = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  mockHandlers.length = 0;
  mockSession = { session: null, profile: null };
  events = [];
  off = onLive((e) => events.push(e));
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler as (s: string) => void;
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => off());

const fire = (table: string, payload: Record<string, unknown>) =>
  act(async () => {
    mockHandlers.find((h) => h.table === table)?.handler(payload);
  });

describe('RealtimeSync', () => {
  it('sem ser membro não abre conexão', async () => {
    await render(<RealtimeSync />);
    mockSession = { session: { user: { id: 'u1' } }, profile: { is_member: false } };
    await render(<RealtimeSync />);
    expect(mockChannelName).not.toHaveBeenCalled();
  });

  it('membro escuta as 6 tabelas e repassa cada mudança, marcando o que é meu', async () => {
    mockSession = member('me');
    await render(<RealtimeSync />);
    expect(mockHandlers.map((h) => h.table).sort()).toEqual([...LIVE_TABLES].sort());
    await fire('likes', { eventType: 'INSERT', new: { post_id: 'p1', user_id: 'ana' }, old: {} });
    await fire('comments', { eventType: 'INSERT', new: { id: 'c1', post_id: 'p1', author_id: 'me' }, old: {} });
    await fire('posts', { eventType: 'DELETE', new: {}, old: { id: 'p2' } });
    expect(events).toEqual([
      { kind: 'change', table: 'likes', type: 'INSERT', row: { post_id: 'p1', user_id: 'ana' }, mine: false },
      { kind: 'change', table: 'comments', type: 'INSERT', row: { id: 'c1', post_id: 'p1', author_id: 'me' }, mine: true },
      { kind: 'change', table: 'posts', type: 'DELETE', row: { id: 'p2' }, mine: false },
    ]);
  });

  it('reconectou depois de cair: pede para todo mundo se atualizar', async () => {
    mockSession = member('me');
    await render(<RealtimeSync />);
    await act(async () => mockStatus('SUBSCRIBED'));
    expect(events).toEqual([]);
    await act(async () => mockStatus('CHANNEL_ERROR'));
    await act(async () => mockStatus('SUBSCRIBED'));
    expect(events).toEqual([{ kind: 'resync' }]);
  });

  it('voltar para o app também pede atualização', async () => {
    mockSession = member('me');
    await render(<RealtimeSync />);
    await act(async () => appStateHandler?.('active'));
    expect(events).toEqual([{ kind: 'resync' }]);
  });

  it('sair da conta fecha a conexão', async () => {
    mockSession = member('me');
    const view = await render(<RealtimeSync />);
    mockSession = { session: null, profile: null };
    await view.rerender(<RealtimeSync />);
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});

describe('postIdOf', () => {
  it('acha o post afetado quando a linha diz', () => {
    const c = (table: string, row: Record<string, unknown>) =>
      ({ kind: 'change', table, type: 'INSERT', row, mine: false }) as never;
    expect(postIdOf(c('posts', { id: 'p1' }))).toBe('p1');
    expect(postIdOf(c('likes', { post_id: 'p2', user_id: 'u' }))).toBe('p2');
    expect(postIdOf(c('comments', { id: 'c', post_id: 'p3' }))).toBe('p3');
    expect(postIdOf(c('post_reactions', { post_id: 'p4' }))).toBe('p4');
    expect(postIdOf(c('comments', { id: 'c' }))).toBeNull(); // DELETE só traz a chave
    expect(postIdOf(c('comment_reactions', { comment_id: 'c' }))).toBeNull();
  });
});

describe('debounce', () => {
  it('junta rajadas numa chamada só', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const d = debounce(fn, 800);
    d();
    d();
    jest.advanceTimersByTime(799);
    expect(fn).not.toHaveBeenCalled();
    d();
    jest.advanceTimersByTime(800);
    expect(fn).toHaveBeenCalledTimes(1);
    d();
    d.cancel();
    jest.advanceTimersByTime(800);
    expect(fn).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

describe('affectsNotifications', () => {
  it('post novo de outra pessoa pode ter me marcado; o meu não', () => {
    const post = (mine: boolean) => ({ kind: 'change', table: 'posts', type: 'INSERT', row: {}, mine }) as never;
    expect(affectsNotifications(post(false))).toBe(true);
    expect(affectsNotifications(post(true))).toBe(false);
    expect(affectsNotifications({ kind: 'change', table: 'posts', type: 'DELETE', row: {}, mine: false })).toBe(false);
  });
});
