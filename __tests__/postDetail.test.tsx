import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import PostDetailScreen from '../app/post/[id]';
import { addComment, getPost, listComments, toggleLike } from '../lib/api/posts';
import { setCommentReaction, setPostReaction } from '../lib/api/reactions';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'p1' }),
}));
jest.mock('../lib/api/reactions', () => ({
  setPostReaction: jest.fn().mockResolvedValue(undefined),
  setCommentReaction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../lib/api/posts', () => ({
  getPost: jest.fn().mockResolvedValue({
    id: 'p1',
    body: 'Olá galera',
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
}));

const setPost = setPostReaction as jest.Mock;
const setComment = setCommentReaction as jest.Mock;
const getPostMock = getPost as jest.Mock;
const toggleLikeMock = toggleLike as jest.Mock;
const addCommentMock = addComment as jest.Mock;
const listCommentsMock = listComments as jest.Mock;

beforeEach(() => {
  setPost.mockClear().mockResolvedValue(undefined);
  setComment.mockClear().mockResolvedValue(undefined);
  getPostMock.mockClear();
  listCommentsMock.mockClear();
  toggleLikeMock.mockReset().mockResolvedValue(true);
  addCommentMock.mockReset();
});

async function renderLoaded() {
  await render(<PostDetailScreen />);
  await waitFor(() => expect(screen.getByText('Boa!')).toBeTruthy());
}

// Reagir buttons: [0] = post, [1] = comentário.
describe('PostDetailScreen', () => {
  it('shows the comment input in pt-BR', async () => {
    await renderLoaded();
    expect(screen.getByPlaceholderText('Fala aí…')).toBeTruthy();
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
    await fireEvent.changeText(screen.getByPlaceholderText('Fala aí…'), 'kkkk');
    await fireEvent.press(screen.getByLabelText('Enviar'));
    expect(await screen.findByText('Não rolou mandar o comentário. Tenta de novo.')).toBeTruthy();
    expect(screen.queryByText(/row-level security/)).toBeNull();
    expect(screen.getByDisplayValue('kkkk')).toBeTruthy();
  });

  it('sends a comment and refreshes only the comments', async () => {
    addCommentMock.mockResolvedValueOnce({ id: 'c2' });
    await renderLoaded();
    await fireEvent.changeText(screen.getByPlaceholderText('Fala aí…'), 'kkkk');
    await fireEvent.press(screen.getByLabelText('Enviar'));
    await waitFor(() => expect(addCommentMock).toHaveBeenCalledWith('p1', 'kkkk'));
    await waitFor(() => expect(listCommentsMock).toHaveBeenCalledTimes(2));
    expect(getPostMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByDisplayValue('kkkk')).toBeNull();
  });

  it('shows a retry state when the post fails to load', async () => {
    getPostMock.mockRejectedValueOnce(new Error('JSON object requested, multiple (or no) rows returned'));
    await render(<PostDetailScreen />);
    expect(await screen.findByText('Não deu pra abrir esse post')).toBeTruthy();
    expect(screen.queryByText(/JSON object/)).toBeNull();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    await waitFor(() => expect(screen.getByText('Boa!')).toBeTruthy());
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
