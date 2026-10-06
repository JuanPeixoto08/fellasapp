import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) };
});
const mockNowPlaying = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  getNowPlaying: (user: string) => mockNowPlaying(user),
}));

import { LastfmError } from '../lib/lastfm/api';
import type { LastfmPage } from '../lib/lastfm/types';
import { useLastfmPages } from '../lib/lastfm/useLastfmPages';
import { NOW_PLAYING_MS, useNowPlaying } from '../lib/lastfm/useNowPlaying';

const page = (items: string[], n: number, total: number): LastfmPage<string> => ({ items, page: n, totalPages: total });

describe('useLastfmPages', () => {
  it('carrega a primeira página e as próximas até a última', async () => {
    const fetchPage = jest.fn((n: number) => Promise.resolve(page([`p${n}`], n, 2)));
    const { result } = await renderHook(() => useLastfmPages('k', fetchPage));
    await waitFor(() => expect(result.current.items).toEqual(['p1']));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toEqual(['p1', 'p2']));
    await act(async () => result.current.loadMore());
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('conta vazia (0 páginas): não pede a página 2', async () => {
    const fetchPage = jest.fn(() => Promise.resolve(page([], 1, 0)));
    const { result } = await renderHook(() => useLastfmPages('k', fetchPage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.loadMore());
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([]);
  });

  it('trocar a chave recomeça e ignora a resposta atrasada da anterior', async () => {
    let slow: (v: LastfmPage<string>) => void = () => {};
    const fetchA = jest.fn(() => new Promise<LastfmPage<string>>((r) => (slow = r)));
    const fetchB = jest.fn(() => Promise.resolve(page(['b1'], 1, 1)));
    type Props = { k: string; f: (n: number) => Promise<LastfmPage<string>> };
    const view = await renderHook(({ k, f }: Props) => useLastfmPages(k, f), { initialProps: { k: 'a', f: fetchA } as Props });
    await view.rerender({ k: 'b', f: fetchB });
    await waitFor(() => expect(view.result.current.items).toEqual(['b1']));
    await act(async () => slow(page(['a1'], 1, 1)));
    expect(view.result.current.items).toEqual(['b1']);
  });

  it('erro fica disponível e reload tenta de novo', async () => {
    const fetchPage = jest
      .fn()
      .mockRejectedValueOnce(new LastfmError('private'))
      .mockResolvedValueOnce(page(['ok'], 1, 1));
    const { result } = await renderHook(() => useLastfmPages('k', fetchPage));
    await waitFor(() => expect(result.current.error?.kind).toBe('private'));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.items).toEqual(['ok']));
    expect(result.current.error).toBeNull();
  });

  it('sem chave (sem usuário): não busca nada', async () => {
    const fetchPage = jest.fn();
    await renderHook(() => useLastfmPages(null, fetchPage));
    expect(fetchPage).not.toHaveBeenCalled();
  });
});

describe('useNowPlaying', () => {
  afterEach(() => jest.useRealTimers());

  it('busca ao abrir, de novo a cada 60 s, e para ao sair', async () => {
    jest.useFakeTimers();
    mockNowPlaying.mockResolvedValue({ name: 'Agora', artist: 'A', album: null, image: null, url: 'u', playedAt: null, nowPlaying: true });
    const view = await renderHook(() => useNowPlaying('juan'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.result.current?.name).toBe('Agora');
    expect(mockNowPlaying).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(NOW_PLAYING_MS);
    });
    expect(mockNowPlaying).toHaveBeenCalledTimes(2);
    await view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(NOW_PLAYING_MS * 3);
    });
    expect(mockNowPlaying).toHaveBeenCalledTimes(2);
  });

  it('sem usuário: null e nenhuma chamada', async () => {
    mockNowPlaying.mockClear();
    const { result } = await renderHook(() => useNowPlaying(null));
    expect(result.current).toBeNull();
    expect(mockNowPlaying).not.toHaveBeenCalled();
  });
});
