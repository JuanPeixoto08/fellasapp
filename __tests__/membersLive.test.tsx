import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockListMembers = jest.fn();
jest.mock('../lib/api/profiles', () => ({ listMembers: () => mockListMembers() }));
jest.mock('../lib/api/storage', () => ({ signPaths: async () => new Map() }));

import { emitLive, type LiveChange } from '../lib/realtime';
import { useMembers } from '../lib/useMembers';
import { useToday } from '../lib/useToday';

const ana = { id: 'ana', username: 'ana', display_name: 'Ana', avatar_url: null, birthday: null, is_member: true };
const profileChange = (type: LiveChange['type'], row: Record<string, unknown>) =>
  act(async () => emitLive({ kind: 'change', table: 'profiles', type, row, mine: false }));

describe('useMembers ao vivo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListMembers.mockResolvedValue([ana]);
  });

  async function members() {
    const view = await renderHook(() => useMembers());
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    return view;
  }

  it('fella novo entra sem mostrar carregando', async () => {
    const { result } = await members();
    const loadingSeen: boolean[] = [];
    mockListMembers.mockResolvedValue([ana, { ...ana, id: 'bia', username: 'bia', display_name: 'Bia' }]);
    await profileChange('INSERT', { id: 'bia', is_member: true });
    loadingSeen.push(result.current.loading);
    await waitFor(() => expect(result.current.members).toHaveLength(2));
    expect(loadingSeen).toEqual([false]);
  });

  it('mudou nome/foto/aniversário de alguém: recarrega; só abriu as notificações: não', async () => {
    await members();
    expect(mockListMembers).toHaveBeenCalledTimes(1);
    // mesmo perfil, só o horário das notificações mudou
    await profileChange('UPDATE', { ...ana, notifications_seen_at: '2026-10-04T15:00:00Z' });
    expect(mockListMembers).toHaveBeenCalledTimes(1);
    await profileChange('UPDATE', { ...ana, birthday: '1999-10-05' });
    await waitFor(() => expect(mockListMembers).toHaveBeenCalledTimes(2));
  });

  it('voltar/reconectar recarrega', async () => {
    await members();
    await act(async () => emitLive({ kind: 'resync' }));
    await waitFor(() => expect(mockListMembers).toHaveBeenCalledTimes(2));
  });
});

describe('useToday', () => {
  let appStateHandler: ((s: string) => void) | null = null;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      appStateHandler = handler as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
  });
  afterEach(() => jest.useRealTimers());

  it('vira o dia sozinho à meia-noite', async () => {
    jest.setSystemTime(new Date(2026, 9, 4, 23, 59, 30));
    const { result } = await renderHook(() => useToday());
    expect(result.current.getDate()).toBe(4);
    await act(async () => {
      jest.advanceTimersByTime(31_000);
    });
    expect(result.current.getDate()).toBe(5);
  });

  it('voltar para o app num dia novo atualiza (timer pode ter sido segurado em segundo plano)', async () => {
    jest.setSystemTime(new Date(2026, 9, 4, 22, 0, 0));
    const { result } = await renderHook(() => useToday());
    jest.setSystemTime(new Date(2026, 9, 6, 9, 0, 0));
    await act(async () => appStateHandler?.('active'));
    expect(result.current.getDate()).toBe(6);
  });
});
