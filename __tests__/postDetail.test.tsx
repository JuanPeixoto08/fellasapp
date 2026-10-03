import { render, screen, waitFor } from '@testing-library/react-native';

import PostDetailScreen from '../app/post/[id]';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'p1' }),
}));
jest.mock('../lib/api/posts', () => ({
  getPost: jest.fn().mockResolvedValue({
    id: 'p1',
    body: 'Olá galera',
    imageUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    author: { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: null },
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
  }),
  listComments: jest.fn().mockResolvedValue([]),
  addComment: jest.fn(),
  toggleLike: jest.fn(),
}));

describe('PostDetailScreen', () => {
  it('shows the empty comments copy in pt-BR', async () => {
    await render(<PostDetailScreen />);
    await waitFor(() => expect(screen.getByText('Sem comentários ainda. Puxa o assunto.')).toBeTruthy());
    expect(screen.getByPlaceholderText('Fala aí…')).toBeTruthy();
  });
});
