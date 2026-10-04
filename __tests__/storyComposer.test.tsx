import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPick = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (...a: unknown[]) => mockPick(...a) }));
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return { useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), muted: true }), VideoView: () => <View testID="preview-video" /> };
});
jest.mock('../lib/imageUpload', () => ({ shrinkForUpload: async (u: string) => `${u}#reduzida` }));
let mockDuration: number | null = 9000;
jest.mock('../lib/videoDuration', () => ({ videoDurationMs: async () => mockDuration }));
const mockUpload = jest.fn();
const mockCreate = jest.fn();
jest.mock('../lib/api/stories', () => ({
  MAX_VIDEO_MS: 15000,
  STORY_PHOTO_MS: 5000,
  uploadStoryMedia: (u: string) => mockUpload(u),
  createStory: (i: unknown) => mockCreate(i),
}));

import { StoryComposer } from '../components/stories/StoryComposer';

const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = (onClose = jest.fn()) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StoryComposer visible onClose={onClose} />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockDuration = 9000;
  mockUpload.mockResolvedValue({ url: 'https://w/m/x', contentType: 'image/jpeg' });
  mockCreate.mockResolvedValue(undefined);
});

describe('StoryComposer', () => {
  it('foto: reduz, envia e cria com 5 s', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://a.jpg', type: 'image' }] });
    const onClose = jest.fn();
    await open(onClose);
    await fireEvent.press(await screen.findByLabelText('Postar story'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ kind: 'photo', mediaUrl: 'https://w/m/x', durationMs: 5000 }));
    expect(mockUpload).toHaveBeenCalledWith('file://a.jpg#reduzida');
    expect(onClose).toHaveBeenCalled();
  });

  it('vídeo até 15 s: envia com a duração', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://v.mp4', type: 'video', duration: 9000 }] });
    await open();
    expect(await screen.findByTestId('preview-video')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Postar story'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ kind: 'video', mediaUrl: 'https://w/m/x', durationMs: 9000 }));
  });

  it('vídeo maior que 15 s é recusado antes de enviar', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'blob:v', type: 'video', duration: null }] });
    mockDuration = 20000;
    await open();
    expect(await screen.findByText('Esse vídeo passa de 15 s. Escolhe um menor.')).toBeTruthy();
    expect(screen.queryByLabelText('Postar story')).toBeNull();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('erro no envio: mensagem e não cria', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://a.jpg', type: 'image' }] });
    mockUpload.mockRejectedValue(new Error('Só fellas podem postar story.'));
    await open();
    await fireEvent.press(await screen.findByLabelText('Postar story'));
    expect(await screen.findByText('Só fellas podem postar story.')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('desistiu na galeria: fecha', async () => {
    mockPick.mockResolvedValue({ canceled: true, assets: null });
    const onClose = jest.fn();
    await open(onClose);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

it('redesenhar a tela de fora não reabre a galeria', async () => {
  mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://a.jpg', type: 'image' }] });
  const view = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StoryComposer visible onClose={() => {}} />
    </SafeAreaProvider>,
  );
  await screen.findByLabelText('Postar story');
  await view.rerender(
    <SafeAreaProvider initialMetrics={metrics}>
      <StoryComposer visible onClose={() => {}} />
    </SafeAreaProvider>,
  );
  expect(mockPick).toHaveBeenCalledTimes(1);
});
