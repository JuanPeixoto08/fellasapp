import { act, render } from '@testing-library/react-native';

const mockStatus: ((e: { status: string }) => void)[] = [];
const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  replaceAsync: jest.fn().mockResolvedValue(undefined),
  muted: false,
  loop: false,
  playing: true,
  status: 'loading',
  addListener: (event: string, fn: (e: { status: string }) => void) => {
    if (event === 'statusChange') mockStatus.push(fn);
    return { remove: () => {} };
  },
};
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return { useVideoPlayer: () => mockPlayer, VideoView: (props: object) => <View {...props} /> };
});

import { StoryVideo } from '../components/stories/StoryVideo';

const emit = (status: string) => act(() => mockStatus.forEach((fn) => fn({ status })));

beforeEach(() => {
  mockStatus.length = 0;
  jest.clearAllMocks();
});

describe('StoryVideo', () => {
  it('reduzida falhou: troca para o original uma vez e só então libera o relógio', async () => {
    const onReady = jest.fn();
    await render(<StoryVideo uri="https://r/red" fallbackUri="https://r/orig" paused={false} muted={false} onReady={onReady} onBlocked={() => {}} />);
    mockPlayer.play.mockClear();
    await emit('error');
    await act(async () => {});
    expect(mockPlayer.replaceAsync).toHaveBeenCalledWith('https://r/orig');
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
    await emit('readyToPlay');
    expect(onReady).toHaveBeenCalled();
  });

  it('original também falhou: libera o relógio (o story passa)', async () => {
    const onReady = jest.fn();
    await render(<StoryVideo uri="https://r/red" fallbackUri="https://r/orig" paused={false} muted={false} onReady={onReady} onBlocked={() => {}} />);
    await emit('error');
    await emit('error');
    expect(mockPlayer.replaceAsync).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalled();
  });

  it('sem original: erro libera o relógio direto', async () => {
    const onReady = jest.fn();
    await render(<StoryVideo uri="https://r/red" paused={false} muted={false} onReady={onReady} onBlocked={() => {}} />);
    await emit('error');
    expect(mockPlayer.replaceAsync).not.toHaveBeenCalled();
    expect(onReady).toHaveBeenCalled();
  });

  it('troca rejeitada: libera o relógio', async () => {
    mockPlayer.replaceAsync.mockRejectedValueOnce(new Error('x'));
    const onReady = jest.fn();
    await render(<StoryVideo uri="https://r/red" fallbackUri="https://r/orig" paused={false} muted={false} onReady={onReady} onBlocked={() => {}} />);
    await emit('error');
    await act(async () => {});
    expect(onReady).toHaveBeenCalled();
  });

  it('pausado: a troca não manda tocar', async () => {
    await render(<StoryVideo uri="https://r/red" fallbackUri="https://r/orig" paused muted={false} onReady={() => {}} onBlocked={() => {}} />);
    mockPlayer.play.mockClear();
    await emit('error');
    await act(async () => {});
    expect(mockPlayer.replaceAsync).toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  describe('vídeo que demora sem dar erro', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());
    const mount = (props: object = { fallbackUri: 'https://r/orig' }) =>
      render(<StoryVideo uri="https://r/red" paused={false} muted={false} onReady={() => {}} onBlocked={() => {}} {...props} />);

    it('sem status por 4 s: troca para o original uma vez', async () => {
      await mount();
      await act(async () => { jest.advanceTimersByTime(4100); });
      expect(mockPlayer.replaceAsync).toHaveBeenCalledTimes(1);
      expect(mockPlayer.replaceAsync).toHaveBeenCalledWith('https://r/orig');
    });

    it('readyToPlay antes de 4 s: não troca', async () => {
      await mount();
      await emit('readyToPlay');
      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(mockPlayer.replaceAsync).not.toHaveBeenCalled();
    });

    it('erro com 1 s troca; passar de 4 s não troca de novo', async () => {
      await mount();
      await act(async () => { jest.advanceTimersByTime(1000); });
      await emit('error');
      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(mockPlayer.replaceAsync).toHaveBeenCalledTimes(1);
    });

    it('sem fallbackUri: não troca', async () => {
      await mount({});
      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(mockPlayer.replaceAsync).not.toHaveBeenCalled();
    });
  });
});
