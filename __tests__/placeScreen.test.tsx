import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPush = jest.fn();
let mockParams: Record<string, string | undefined> = { key: 'bar do ze', name: 'Bar do Zé' };
const mockScreenOptions = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: (props: { options: unknown }) => (mockScreenOptions(props.options), null) },
  router: { push: jest.fn() },
}));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
const mockCount = jest.fn();
jest.mock('../lib/api/places', () => ({ countPlacePosts: (key: string) => mockCount(key) }));
const mockUsePostList = jest.fn();
jest.mock('../lib/usePostList', () => ({
  usePostList: (opts: unknown) => mockUsePostList(opts),
  removePost: jest.fn(),
}));

import PlaceScreen from '../app/place/[key]';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PlaceScreen />
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
  body: 'chegamos',
  images: [],
  imageUrl: null,
  createdAt: '2026-10-06T12:00:00Z',
  location: 'Bar do Zé',
  placeKey: 'bar do ze',
  author: { id: 'u2', username: 'bia', display_name: 'Bia', avatar_url: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};
const lastTitle = () => {
  const options = mockScreenOptions.mock.calls.at(-1)?.[0] as { title?: string };
  return options?.title;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { key: 'bar do ze', name: 'Bar do Zé' };
  mockCount.mockResolvedValue(2);
  mockUsePostList.mockReturnValue(list({ posts: [post] }));
});

describe('Página do local', () => {
  it('lista os posts do local com a contagem; o local nos posts não é link', async () => {
    await open();
    expect(mockUsePostList).toHaveBeenCalledWith({ place: 'bar do ze' });
    expect(mockCount).toHaveBeenCalledWith('bar do ze');
    expect(await screen.findByText('2 posts')).toBeTruthy();
    expect(screen.queryByLabelText('Ver posts em Bar do Zé')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Abrir post de Bia'));
    expect(mockPush).toHaveBeenCalledWith('/post/p1');
  });

  it('título: a grafia de quem postou', async () => {
    mockParams = { key: 'bar do ze', name: 'bar do ze' };
    await open();
    expect(lastTitle()).toBe('Bar do Zé');
  });

  it('título antes de carregar: o nome que veio no link', async () => {
    mockUsePostList.mockReturnValue(list({ loading: true }));
    mockParams = { key: 'praia', name: 'Praia' };
    await open();
    expect(lastTitle()).toBe('Praia');
  });

  it('título sem post nem nome: "Local"', async () => {
    mockUsePostList.mockReturnValue(list({ loading: true }));
    mockParams = { key: 'praia' };
    await open();
    expect(lastTitle()).toBe('Local');
  });

  it('URL com maiúscula e acento acha a chave', async () => {
    mockParams = { key: 'Bar do Zé' };
    await open();
    expect(mockUsePostList).toHaveBeenCalledWith({ place: 'bar do ze' });
  });

  it('vazio convida a postar de lá', async () => {
    mockUsePostList.mockReturnValue(list());
    mockCount.mockResolvedValue(0);
    await open();
    expect(screen.getByText('Ninguém postou daqui ainda.')).toBeTruthy();
    expect(screen.getByText('Posta algo marcando esse lugar.')).toBeTruthy();
  });

  it('erro oferece tentar de novo', async () => {
    const failed = list({ error: 'caiu' });
    mockUsePostList.mockReturnValue(failed);
    await open();
    expect(screen.getByText('Não deu pra carregar esse local')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(failed.reload).toHaveBeenCalled();
  });
});
