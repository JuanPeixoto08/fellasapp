import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPush = jest.fn();
let mockName = 'Artes';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ name: mockName }),
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
}));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
const mockCount = jest.fn();
jest.mock('../lib/api/tags', () => ({ countTagPosts: (tag: string) => mockCount(tag) }));
const mockUsePostList = jest.fn();
jest.mock('../lib/usePostList', () => ({
  usePostList: (opts: unknown) => mockUsePostList(opts),
  removePost: jest.fn(),
}));

import TagScreen from '../app/tag/[name]';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TagScreen />
    </SafeAreaProvider>,
  );
const list = (over: Record<string, unknown> = {}) => ({
  posts: [],
  loading: false,
  refreshing: false,
  error: null,
  refresh: jest.fn(),
  reload: jest.fn(),
  loadMore: jest.fn(),
  like: jest.fn(),
  react: jest.fn(),
  ...over,
});
const post = {
  id: 'p1',
  body: 'olha #artes',
  images: [],
  imageUrl: null,
  createdAt: '2026-10-06T12:00:00Z',
  author: { id: 'u2', username: 'bia', display_name: 'Bia', avatar_url: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockName = 'Artes';
  mockCount.mockResolvedValue(2);
  mockUsePostList.mockReturnValue(list({ posts: [post] }));
});

describe('Página da tag', () => {
  it('normaliza o nome, lista os posts e mostra a contagem', async () => {
    await open();
    expect(mockUsePostList).toHaveBeenCalledWith({ tag: 'artes' });
    expect(mockCount).toHaveBeenCalledWith('artes');
    expect(await screen.findByText('2 posts')).toBeTruthy();
    expect(screen.getByText('Bia')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Abrir post de Bia'));
    expect(mockPush).toHaveBeenCalledWith('/post/p1');
  });

  it('nome com acento vindo da URL', async () => {
    mockName = 'AÇÃO';
    await open();
    expect(mockUsePostList).toHaveBeenCalledWith({ tag: 'ação' });
  });

  it('vazio convida a usar a tag', async () => {
    mockUsePostList.mockReturnValue(list());
    mockCount.mockResolvedValue(0);
    await open();
    expect(screen.getByText('Ninguém usou #artes ainda.')).toBeTruthy();
  });

  it('erro oferece tentar de novo', async () => {
    const failed = list({ error: 'caiu' });
    mockUsePostList.mockReturnValue(failed);
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(failed.reload).toHaveBeenCalled();
  });
});
