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
    await emit('error');
    expect(mockPlayer.replaceAsync).toHaveBeenCalledWith('https://r/orig');
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
});
