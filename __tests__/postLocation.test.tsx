import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../lib/supabase', () => ({ supabase: {} }));

import { PostCard } from '../components/PostCard';
import type { FeedPost } from '../lib/api/posts';

const post: FeedPost = {
  id: 'p1',
  body: 'saindo pro rolê',
  images: [],
  imageUrl: null,
  createdAt: '2026-10-06T12:00:00Z',
  location: 'Bar do Zé',
  placeKey: 'bar do ze',
  author: { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};

beforeEach(() => mockPush.mockClear());

describe('local no post', () => {
  it('mostra o local abaixo do nome e o toque abre a página do local', async () => {
    await render(<PostCard post={post} />);
    expect(screen.getByText('Bar do Zé')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ver posts em Bar do Zé'));
    expect(mockPush).toHaveBeenCalledWith('/place/bar%20do%20ze?name=Bar%20do%20Z%C3%A9');
  });

  it('o alvo de toque do local cresce para baixo, não por cima do nome do autor', async () => {
    await render(<PostCard post={post} />);
    const slop = screen.getByLabelText('Ver posts em Bar do Zé').props.hitSlop;
    expect(slop?.top ?? 0).toBe(0);
    expect(slop.bottom).toBeGreaterThan(0);
  });

  it('sem local não tem a linha', async () => {
    await render(<PostCard post={{ ...post, location: null, placeKey: null }} />);
    expect(screen.queryByLabelText(/Ver posts em/)).toBeNull();
  });

  it('na página do próprio local (linkPlace false) mostra sem ser link', async () => {
    await render(<PostCard post={post} linkPlace={false} />);
    expect(screen.getByText('Bar do Zé')).toBeTruthy();
    expect(screen.queryByLabelText('Ver posts em Bar do Zé')).toBeNull();
  });
});
