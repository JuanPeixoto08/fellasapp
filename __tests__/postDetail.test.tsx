import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import PostDetailScreen from '../app/post/[id]';
import { addComment, deletePost, getPost, listComments, toggleLike } from '../lib/api/posts';
import { setCommentReaction, setPostReaction } from '../lib/api/reactions';
import { emitLive, LIVE_DEBOUNCE_MS, type LiveChange } from '../lib/realtime';
import { setMemberDirectory } from '../lib/memberDirectory';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
const mockBack = jest.fn();
let mockMe = 'u9';
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'p1' }),
  useRouter: () => ({ back: mockBack }),
}));
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: mockMe } } }),
}));
jest.mock('../lib/api/reactions', () => ({
  setPostReaction: jest.fn().mockResolvedValue(undefined),
  setCommentReaction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../lib/api/posts', () => ({
  getPost: jest.fn().mockResolvedValue({
    id: 'p1',
    body: 'Olá galera',
    images: [],
    imageUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    author: { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: null },
    likeCount: 0,
    commentCount: 1,
    likedByMe: false,
    reactions: [],
    myReaction: null,
  }),
  listComments: jest.fn().mockResolvedValue([
    {
      id: 'c1',
      body: 'Boa!',
      createdAt: '2026-01-01T00:00:00Z',
      author: { id: 'u2', username: 'bia', display_name: 'Bia', avatar_url: null },
      reactions: [],
      myReaction: null,
    },
  ]),
  addComment: jest.fn(),
  toggleLike: jest.fn(),
  deletePost: jest.fn(),
}));

const setPost = setPostReaction as jest.Mock;
const setComment = setCommentReaction as jest.Mock;
const getPostMock = getPost as jest.Mock;
const toggleLikeMock = toggleLike as jest.Mock;
const addCommentMock = addComment as jest.Mock;
const listCommentsMock = listComments as jest.Mock;
const deletePostMock = deletePost as jest.Mock;

beforeEach(() => {
  setPost.mockClear().mockResolvedValue(undefined);
  setComment.mockClear().mockResolvedValue(undefined);
  getPostMock.mockClear();
  listCommentsMock.mockClear();
  toggleLikeMock.mockReset().mockResolvedValue(true);
  addCommentMock.mockReset();
  deletePostMock.mockReset().mockResolvedValue(undefined);
  mockBack.mockClear();
  mockMe = 'u9';
});

const SafeArea = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
  >
    {children}
  </SafeAreaProvider>
);

async function renderLoaded() {
  await render(<PostDetailScreen />, { wrapper: SafeArea });
  await waitFor(() => expect(screen.getByText('Boa!')).toBeTruthy());
}

// Reagir buttons: [0] = post, [1] = comentário.
describe('PostDetailScreen', () => {
  it('shows the comment input in pt-BR', async () => {
    await renderLoaded();
    expect(screen.getByPlaceholderText('Comentar como Você…')).toBeTruthy();
    expect(screen.getByLabelText('Enviar')).toBeTruthy();
  });

  it('reacts to the post and updates the bar', async () => {
    await renderLoaded();
    await fireEvent.press(screen.getAllByLabelText('Reagir')[0]);
    await fireEvent.press(screen.getByLabelText('Reagir com ❤️'));
    expect(setPost).toHaveBeenCalledWith('p1', '❤️');
    await waitFor(() => expect(screen.getByLabelText('❤️ 1 reação')).toBeTruthy());
  });

  it('reacts to a comment, then removes it by tapping my chip', async () => {
    await renderLoaded();
    await fireEvent.press(screen.getAllByLabelText('Reagir')[1]);
    await fireEvent.press(screen.getByLabelText('Reagir com 😂'));
    expect(setComment).toHaveBeenCalledWith('c1', '😂');
    await waitFor(() => expect(screen.getByLabelText('😂 1 reação')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('😂 1 reação'));
    expect(setComment).toHaveBeenLastCalledWith('c1', null);
    await waitFor(() => expect(screen.queryByLabelText('😂 1 reação')).toBeNull());
  });

  it('rolls back the post reaction when the API fails', async () => {
    setPost.mockRejectedValueOnce(new Error('x'));
    await renderLoaded();
    await fireEvent.press(screen.getAllByLabelText('Reagir')[0]);
    await fireEvent.press(screen.getByLabelText('Reagir com 🙏'));
    await waitFor(() => expect(setPost).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText('🙏 1 reação')).toBeNull());
  });

  it('likes optimistically without reloading the post', async () => {
    await renderLoaded();
    await fireEvent.press(screen.getByLabelText('Curtir'));
    expect(screen.getByLabelText('Descurtir')).toBeTruthy();
    await waitFor(() => expect(toggleLikeMock).toHaveBeenCalledWith('p1'));
    expect(getPostMock).toHaveBeenCalledTimes(1);
  });

  it('rolls back the like when the API fails', async () => {
    toggleLikeMock.mockRejectedValueOnce(new Error('x'));
    await renderLoaded();
    await fireEvent.press(screen.getByLabelText('Curtir'));
    await waitFor(() => expect(screen.getByLabelText('Curtir')).toBeTruthy());
  });

  it('shows a friendly message (not the raw error) when a comment fails, keeping the text', async () => {
    addCommentMock.mockRejectedValueOnce(new Error('new row violates row-level security policy'));
    await renderLoaded();
    await fireEvent.changeText(screen.getByLabelText('Comentar'), 'kkkk');
    await fireEvent.press(screen.getByLabelText('Enviar'));
    expect(await screen.findByText('Não rolou mandar o comentário. Tenta de novo.')).toBeTruthy();
    expect(screen.queryByText(/row-level security/)).toBeNull();
    expect(screen.getByDisplayValue('kkkk')).toBeTruthy();
  });

  it('sends a comment and refreshes only the comments', async () => {
    addCommentMock.mockResolvedValueOnce({ id: 'c2' });
    await renderLoaded();
    await fireEvent.changeText(screen.getByLabelText('Comentar'), 'kkkk');
    await fireEvent.press(screen.getByLabelText('Enviar'));
    await waitFor(() => expect(addCommentMock).toHaveBeenCalledWith('p1', 'kkkk'));
    await waitFor(() => expect(listCommentsMock).toHaveBeenCalledTimes(2));
    expect(getPostMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByDisplayValue('kkkk')).toBeNull();
  });

  it('shows a retry state when the post fails to load', async () => {
    getPostMock.mockRejectedValueOnce(new Error('JSON object requested, multiple (or no) rows returned'));
    await render(<PostDetailScreen />, { wrapper: SafeArea });
    expect(await screen.findByText('Não deu pra abrir esse post')).toBeTruthy();
    expect(screen.queryByText(/JSON object/)).toBeNull();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    await waitFor(() => expect(screen.getByText('Boa!')).toBeTruthy());
  });

  it('hides the delete button on posts that are not mine', async () => {
    await renderLoaded();
    expect(screen.queryByLabelText('Apagar post')).toBeNull();
  });

  it('deletes my post after confirming and goes back', async () => {
    mockMe = 'u1';
    await renderLoaded();
    await fireEvent.press(screen.getByLabelText('Apagar post'));
    expect(screen.getByText('Apagar esse post?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Apagar'));
    await waitFor(() => expect(deletePostMock).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('keeps the post and shows an error inside the dialog when delete fails', async () => {
    mockMe = 'u1';
    deletePostMock.mockRejectedValueOnce(new Error('permission denied'));
    await renderLoaded();
    await fireEvent.press(screen.getByLabelText('Apagar post'));
    await fireEvent.press(screen.getByLabelText('Apagar'));
    expect(await screen.findByText('Não rolou apagar. Tenta de novo.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('tapping a photo opens the full-screen viewer on that photo', async () => {
    const base = await getPostMock();
    getPostMock.mockResolvedValueOnce({ ...base, images: ['https://x/1.jpg', 'https://x/2.jpg'], imageUrl: 'https://x/1.jpg' });
    await renderLoaded();
    await fireEvent.press(screen.getByLabelText('Foto postada por Ana (2 de 2)'));
    expect(await screen.findByText('2/2')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fechar fotos'));
    await waitFor(() => expect(screen.queryByText('2/2')).toBeNull());
  });

  it('rolls back the comment reaction when the API fails', async () => {
    setComment.mockRejectedValueOnce(new Error('x'));
    await renderLoaded();
    await fireEvent.press(screen.getAllByLabelText('Reagir')[1]);
    await fireEvent.press(screen.getByLabelText('Reagir com 😮'));
    await waitFor(() => expect(setComment).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText('😮 1 reação')).toBeNull());
  });
});

describe('PostDetailScreen: marcar com @', () => {
  it('no comentário, @ sugere fellas e escolher completa', async () => {
    setMemberDirectory([
      { id: 'u1', username: 'ana', name: 'Ana', avatarUrl: null },
      { id: 'u2', username: 'bia', name: 'Bia', avatarUrl: null },
    ]);
    await renderLoaded();
    await fireEvent.changeText(screen.getByPlaceholderText('Comentar como Você…'), 'boa @b');
    await fireEvent.press(screen.getByLabelText('Marcar Bia (@bia)'));
    expect(screen.getByDisplayValue('boa @bia ')).toBeTruthy();
  });

  it('@ de fella no comentário aparece como link', async () => {
    setMemberDirectory([{ id: 'u2', username: 'bia', name: 'Bia', avatarUrl: null }]);
    listCommentsMock.mockResolvedValueOnce([
      {
        id: 'c1',
        body: 'valeu @bia',
        createdAt: '2026-01-01T00:00:00Z',
        // autor diferente da marcada: a foto/nome do autor também viram "Ver perfil de …"
        author: { id: 'u3', username: 'pedro', display_name: 'Pedro', avatar_url: null },
        reactions: [],
        myReaction: null,
      },
    ]);
    await render(<PostDetailScreen />, { wrapper: SafeArea });
    expect(await screen.findByLabelText('Ver perfil de Bia')).toBeTruthy();
  });
});

describe('PostDetailScreen ao vivo', () => {
  const settle = () => act(async () => new Promise((r) => setTimeout(r, LIVE_DEBOUNCE_MS + 50)));
  const change = (table: LiveChange['table'], type: LiveChange['type'], row: Record<string, unknown>, mine = false) =>
    act(async () => emitLive({ kind: 'change', table, type, row, mine }));

  it('comentário, curtida ou reação de outra pessoa neste post recarrega post e comentários', async () => {
    await renderLoaded();
    expect(getPostMock).toHaveBeenCalledTimes(1);
    await change('comments', 'INSERT', { id: 'c2', post_id: 'p1', author_id: 'u2' });
    await change('likes', 'INSERT', { post_id: 'p1', user_id: 'u2' });
    await settle();
    expect(getPostMock).toHaveBeenCalledTimes(2);
    expect(listCommentsMock).toHaveBeenCalledTimes(2);
  });

  it('reação em um comentário deste post e comentário apagado daqui também recarregam', async () => {
    await renderLoaded();
    await change('comment_reactions', 'INSERT', { comment_id: 'c1', user_id: 'u2' });
    await settle();
    expect(getPostMock).toHaveBeenCalledTimes(2);
    await change('comments', 'DELETE', { id: 'c1' });
    await settle();
    expect(getPostMock).toHaveBeenCalledTimes(3);
  });

  it('curtida minha ainda indo para o servidor não é desfeita pela atualização ao vivo', async () => {
    await renderLoaded();
    let finishLike: (v: boolean) => void = () => {};
    toggleLikeMock.mockReturnValue(new Promise<boolean>((r) => (finishLike = r)));
    // sem await: o toque só termina quando a curtida chegar ao servidor (de propósito, lá embaixo)
    void fireEvent.press(screen.getByLabelText('Curtir'));
    await waitFor(() => expect(screen.getByLabelText('Descurtir')).toBeTruthy());
    await change('comments', 'INSERT', { id: 'c2', post_id: 'p1', author_id: 'u2' });
    await settle();
    // o servidor ainda não tem a curtida: a tela não pode voltar para Curtir
    expect(screen.getByLabelText('Descurtir')).toBeTruthy();
    expect(getPostMock).toHaveBeenCalledTimes(1);
    getPostMock.mockResolvedValueOnce({ ...(await getPostMock.mock.results[0].value), likedByMe: true, likeCount: 1 });
    await act(async () => {
      finishLike(true);
    });
    await waitFor(() => expect(getPostMock).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Descurtir')).toBeTruthy();
  });

  it('o que é de outro post, ou meu, não recarrega', async () => {
    await renderLoaded();
    await change('comments', 'INSERT', { id: 'c3', post_id: 'p2', author_id: 'u2' });
    await change('likes', 'INSERT', { post_id: 'p1', user_id: 'u9' }, true);
    await change('comment_reactions', 'INSERT', { comment_id: 'outro', user_id: 'u2' });
    await settle();
    expect(getPostMock).toHaveBeenCalledTimes(1);
  });
});
