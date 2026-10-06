import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPick = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (...a: unknown[]) => mockPick(...a) }));
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return {
    useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), muted: true }),
    VideoView: (props: object) => <View testID="preview-video" {...props} />,
  };
});
jest.mock('../lib/imageUpload', () => ({ shrinkForUpload: async (u: string) => `${u}#reduzida` }));
let mockDuration: number | null = 9000;
jest.mock('../lib/videoDuration', () => ({ videoDurationMs: async () => mockDuration }));
const mockUpload = jest.fn();
const mockCreate = jest.fn();
jest.mock('../lib/api/stories', () => ({
  MAX_VIDEO_MS: 15000,
  StoryUploadError: class StoryUploadError extends Error {},
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
    const { StoryUploadError } = jest.requireMock('../lib/api/stories');
    mockUpload.mockRejectedValue(new StoryUploadError('Só fellas podem postar story.'));
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

describe('StoryComposer no site', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'web'));
  afterEach(() => jest.restoreAllMocks());

  it('abre com botão de escolher e dica de colar (a galeria não abre sozinha; cancelar não fecha)', async () => {
    mockPick.mockResolvedValue({ canceled: true, assets: null });
    const onClose = jest.fn();
    await open(onClose);
    expect(screen.getByText(/Ctrl\+V/)).toBeTruthy();
    expect(mockPick).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Escolher foto ou vídeo'));
    await waitFor(() => expect(mockPick).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a galeria do site dá a duração em segundos: vale a lida do arquivo (20 s é recusado)', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'blob:v', type: 'video', duration: 20 }] });
    mockDuration = 20000;
    await open();
    await fireEvent.press(screen.getByLabelText('Escolher foto ou vídeo'));
    expect(await screen.findByText('Esse vídeo passa de 15 s. Escolhe um menor.')).toBeTruthy();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('vídeo de 9 s no site é postado com 9000 ms', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'blob:v', type: 'video', duration: 9 }] });
    mockDuration = 9000;
    await open();
    await fireEvent.press(screen.getByLabelText('Escolher foto ou vídeo'));
    await fireEvent.press(await screen.findByLabelText('Postar story'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ kind: 'video', mediaUrl: 'https://w/m/x', durationMs: 9000 }));
  });

  it('duração ilegível: recusa com aviso', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'blob:v', type: 'video', duration: 0 }] });
    mockDuration = null;
    await open();
    await fireEvent.press(screen.getByLabelText('Escolher foto ou vídeo'));
    expect(await screen.findByText('Não consegui ler esse vídeo. Tenta outro.')).toBeTruthy();
  });
});

describe('StoryComposer: erros e vídeo', () => {
  it('erro do banco não aparece cru na tela', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://a.jpg', type: 'image' }] });
    mockCreate.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
    await open();
    await fireEvent.press(await screen.findByLabelText('Postar story'));
    expect(await screen.findByText('Não rolou postar. Tenta de novo.')).toBeTruthy();
  });

  it('prévia do vídeo toca dentro da tela (playsInline, por causa do iPhone)', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://v.mp4', type: 'video', duration: 9000 }] });
    await open();
    expect((await screen.findByTestId('preview-video')).props.playsInline).toBe(true);
  });
});
