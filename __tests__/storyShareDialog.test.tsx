import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPrepare = jest.fn();
const mockBlob = jest.fn();
const mockShare = jest.fn();
let mockCanShare = true;
jest.mock('../lib/storyCard/draw', () => ({
  prepareCard: (s: unknown) => mockPrepare(s),
  storyBlob: (c: unknown, bg: string) => mockBlob(c, bg),
}));
jest.mock('../lib/storyCard/share', () => ({
  canShareFiles: () => mockCanShare,
  shareOrDownload: (b: unknown) => mockShare(b),
}));
const mockUpload = jest.fn();
const mockCreate = jest.fn();
jest.mock('../lib/api/stories', () => {
  class StoryUploadError extends Error {}
  return {
    StoryUploadError,
    uploadStoryMedia: (u: string, k: string) => mockUpload(u, k),
    createStory: (i: unknown) => mockCreate(i),
  };
});
const mockEmit = jest.fn();
jest.mock('../lib/storyViewerStore', () => ({ emitStoriesChanged: () => mockEmit() }));
const mockMembers = new Map();
jest.mock('../lib/memberDirectory', () => ({ useMembersByUsername: () => mockMembers }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
let mockTier = 'compact';
jest.mock('../lib/layout', () => ({ ...jest.requireActual('../lib/layout'), useLayoutTier: () => mockTier }));

import { StoryShareDialog } from '../components/share/StoryShareDialog';
import type { FeedPost } from '../lib/api/posts';
import { StoryUploadError } from '../lib/api/stories';

const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const BLOB = { size: 1 } as unknown as Blob;
const post: FeedPost = {
  id: 'p1', body: 'o padeiro pediu bis', images: [], imageUrl: null, createdAt: '2026-10-09T10:00:00Z',
  author: { id: 'u1', username: 'caio', display_name: 'Caio Ramos', avatar_url: null },
  likeCount: 0, commentCount: 0, likedByMe: false, reactions: [], myReaction: null,
};
const withPhoto = { ...post, images: ['https://x/a.jpg'], imageUrl: 'https://x/a.jpg' };

async function open(p: FeedPost = post, onClose = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StoryShareDialog post={p} visible onClose={onClose} />
    </SafeAreaProvider>,
  );
  await screen.findByTestId('story-share-preview');
  return onClose;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanShare = true;
  mockTier = 'compact';
  mockPrepare.mockResolvedValue({ hasPhoto: false });
  mockBlob.mockResolvedValue(BLOB);
  URL.createObjectURL = jest.fn(() => 'blob:story');
  URL.revokeObjectURL = jest.fn();
});

describe('StoryShareDialog', () => {
  it('post sem foto: abre no violeta, 4 fundos', async () => {
    await open();
    expect(mockBlob).toHaveBeenCalledWith(expect.anything(), 'violeta');
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.queryByLabelText('Fundo com a foto do post')).toBeNull();
    expect(screen.getByLabelText('Fundo violeta').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('post com foto: abre na própria foto, 5 fundos', async () => {
    mockPrepare.mockResolvedValue({ hasPhoto: true });
    await open(withPhoto);
    expect(mockBlob).toHaveBeenCalledWith(expect.anything(), 'photo');
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('trocar o fundo gera a imagem de novo', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Fundo tinta'));
    await waitFor(() => expect(mockBlob).toHaveBeenLastCalledWith(expect.anything(), 'tinta'));
  });

  it('Instagram compartilha a imagem já pronta, na hora do toque', async () => {
    mockShare.mockReturnValue(new Promise(() => {}));
    await open();
    await fireEvent.press(screen.getByLabelText('Instagram'));
    expect(mockShare).toHaveBeenCalledWith(BLOB);
  });

  it('sem planilha de arquivos (computador): "Baixar imagem"', async () => {
    mockCanShare = false;
    mockTier = 'expanded';
    mockShare.mockResolvedValue('downloaded');
    await open();
    await fireEvent.press(screen.getByLabelText('Baixar imagem'));
    expect(mockShare).toHaveBeenCalledWith(BLOB);
  });

  it('Story do Fellas: sobe, liga ao post, avisa e fecha', async () => {
    mockUpload.mockResolvedValue({ mediaId: 'stories/x', durationMs: 5000 });
    mockCreate.mockResolvedValue(undefined);
    const onClose = await open();
    await fireEvent.press(screen.getByLabelText('Story do Fellas'));
    expect(await screen.findByText('Foi pro seu story')).toBeTruthy();
    expect(mockUpload).toHaveBeenCalledWith('blob:story', 'photo');
    expect(mockCreate).toHaveBeenCalledWith({ kind: 'photo', mediaId: 'stories/x', durationMs: 5000, postId: 'p1' });
    expect(mockEmit).toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('erro ao subir: mensagem e continua aberto', async () => {
    mockUpload.mockRejectedValue(new StoryUploadError('Sem conexão. Confere a internet e tenta de novo.'));
    const onClose = await open();
    await fireEvent.press(screen.getByLabelText('Story do Fellas'));
    expect(await screen.findByText('Sem conexão. Confere a internet e tenta de novo.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('enquanto sobe, o ✕ fica desabilitado', async () => {
    mockUpload.mockReturnValue(new Promise(() => {}));
    await open();
    await fireEvent.press(screen.getByLabelText('Story do Fellas'));
    expect(screen.getByLabelText('Fechar').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('não montou a imagem: avisa e deixa tentar de novo', async () => {
    mockPrepare.mockRejectedValueOnce(new Error('x'));
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <StoryShareDialog post={post} visible onClose={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(await screen.findByText('Não rolou montar a imagem. Tenta de novo.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Tentar de novo'));
    await screen.findByTestId('story-share-preview');
    expect(mockPrepare).toHaveBeenCalledTimes(2);
  });
});

describe('StoryShareDialog: revisão final', () => {
  it('trocar o fundo durante o envio não derruba o arquivo que está subindo', async () => {
    let n = 0;
    URL.createObjectURL = jest.fn(() => `blob:${++n}`);
    let finish: (v: unknown) => void = () => {};
    mockUpload.mockReturnValue(new Promise((r) => (finish = r)));
    mockCreate.mockResolvedValue(undefined);
    await open();
    await fireEvent.press(screen.getByLabelText('Story do Fellas'));
    const uploading = mockUpload.mock.calls[0][0];
    await fireEvent.press(screen.getByLabelText('Fundo tinta'));
    expect(mockBlob).not.toHaveBeenCalledWith(expect.anything(), 'tinta');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(uploading);
    finish({ mediaId: 'stories/x', durationMs: 5000 });
    await screen.findByText('Foi pro seu story');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(uploading);
  });

  it('o post atualizado ao vivo (curtida, volta do Instagram) não remonta a imagem', async () => {
    const onClose = jest.fn();
    const ui = (p: FeedPost) => (
      <SafeAreaProvider initialMetrics={metrics}>
        <StoryShareDialog post={p} visible onClose={onClose} />
      </SafeAreaProvider>
    );
    const r = await render(ui(post));
    await screen.findByTestId('story-share-preview');
    await fireEvent.press(screen.getByLabelText('Fundo tinta'));
    await r.rerender(ui({ ...post, likeCount: 9 }));
    await waitFor(() => expect(mockBlob).toHaveBeenLastCalledWith(expect.anything(), 'tinta'));
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Fundo tinta').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('a prévia cabe inteira na área (largura limitada, 9:16)', async () => {
    mockTier = 'expanded';
    await open();
    await fireEvent(screen.getByTestId('story-share-area'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 700 } } });
    const style = StyleSheet.flatten(screen.getByTestId('story-share-frame').props.style);
    expect(style.width).toBe(300);
    expect(style.height).toBeCloseTo((300 * 16) / 9);
    await fireEvent(screen.getByTestId('story-share-area'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 600, height: 400 } } });
    const wide = StyleSheet.flatten(screen.getByTestId('story-share-frame').props.style);
    expect(wide.height).toBe(400);
    expect(wide.width).toBeCloseTo((400 * 9) / 16);
  });
});
