import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import PostDetailScreen from '../app/post/[id]';
import { addComment, deletePost, getPost, listComments, toggleLike } from '../lib/api/posts';
import { setCommentReaction, setPostReaction } from '../lib/api/reactions';

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
