const mockNowPlaying = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  getNowPlaying: (user: string) => mockNowPlaying(user),
}));

import { NOW_PLAYING_MS, resetNowPlayingStore, subscribeNowPlaying } from '../lib/lastfm/nowPlayingStore';

const track = (name: string) => ({ name, artist: 'A', album: null, image: null, url: 'u', playedAt: null, nowPlaying: true });
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  resetNowPlayingStore();
  mockNowPlaying.mockReset().mockResolvedValue(track('Agora'));
});
afterEach(() => jest.useRealTimers());

describe('nowPlayingStore', () => {
  it('vários assinantes do mesmo usuário: uma chamada só, todos recebem', async () => {
    const a = jest.fn();
    const b = jest.fn();
    subscribeNowPlaying('juan', a);
    subscribeNowPlaying('juan', b);
    await flush();
    expect(mockNowPlaying).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Agora' }));
    expect(b).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Agora' }));
  });

  it('pergunta de novo a cada NOW_PLAYING_MS e para quando ninguém mais assina', async () => {
    const stopA = subscribeNowPlaying('juan', jest.fn());
    const stopB = subscribeNowPlaying('juan', jest.fn());
    await flush();
    jest.advanceTimersByTime(NOW_PLAYING_MS);
    await flush();
    expect(mockNowPlaying).toHaveBeenCalledTimes(2);
    stopA();
    jest.advanceTimersByTime(NOW_PLAYING_MS);
    await flush();
    expect(mockNowPlaying).toHaveBeenCalledTimes(3);
    stopB();
    jest.advanceTimersByTime(NOW_PLAYING_MS * 3);
    await flush();
    expect(mockNowPlaying).toHaveBeenCalledTimes(3);
  });

  it('reassinar logo depois (rolando o feed) entrega o último valor sem perguntar de novo', async () => {
    const stop = subscribeNowPlaying('juan', jest.fn());
    await flush();
    stop();
    jest.advanceTimersByTime(NOW_PLAYING_MS / 2);
    const again = jest.fn();
    subscribeNowPlaying('juan', again);
    expect(again).toHaveBeenCalledWith(expect.objectContaining({ name: 'Agora' }));
    await flush();
    expect(mockNowPlaying).toHaveBeenCalledTimes(1);
  });

  it('resposta velha: reassinar pergunta de novo', async () => {
    const stop = subscribeNowPlaying('juan', jest.fn());
    await flush();
    stop();
    jest.advanceTimersByTime(NOW_PLAYING_MS);
    subscribeNowPlaying('juan', jest.fn());
    await flush();
    expect(mockNowPlaying).toHaveBeenCalledTimes(2);
  });

  it('erro do Last.fm vira null', async () => {
    mockNowPlaying.mockRejectedValue(new Error('fora'));
    const listener = jest.fn();
    subscribeNowPlaying('juan', listener);
    await flush();
    expect(listener).toHaveBeenLastCalledWith(null);
  });

  it('usuários diferentes não se misturam', async () => {
    mockNowPlaying.mockImplementation((u: string) => Promise.resolve(track(`de ${u}`)));
    const a = jest.fn();
    const b = jest.fn();
    subscribeNowPlaying('ana', a);
    subscribeNowPlaying('bia', b);
    await flush();
    expect(a).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'de ana' }));
    expect(b).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'de bia' }));
  });
});
