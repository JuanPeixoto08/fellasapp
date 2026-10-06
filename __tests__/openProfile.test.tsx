import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockPush = jest.fn();
let mockId = 'u2';
jest.mock('expo-router', () => {
  const { Text: RNText } = require('react-native');
  return {
    router: { push: (href: string) => mockPush(href) },
    useLocalSearchParams: () => ({ id: mockId }),
    Stack: { Screen: () => null },
    Redirect: ({ href }: { href: string }) => <RNText>{`redirect:${href}`}</RNText>,
  };
});
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../components/ProfileView', () => {
  const { Text: RNText } = require('react-native');
  return { __esModule: true, default: () => <RNText>perfil</RNText> };
});

import { PostCard } from '../components/PostCard';
import { CommentItem } from '../components/feed/CommentItem';
import UserProfileScreen from '../app/user/[id]';
import type { Comment, FeedPost } from '../lib/api/posts';

const author = { id: 'u2', username: 'bia', display_name: 'Bia', avatar_url: null };
const post: FeedPost = {
  id: 'p1',
  body: 'Olá',
  images: [],
  imageUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  author,
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};
const comment: Comment = { id: 'c1', body: 'boa', createdAt: '2026-01-01T00:00:00Z', author, reactions: [], myReaction: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 'u2';
});

describe('foto e nome do autor abrem o perfil', () => {
  it('no post: foto e nome', async () => {
    await render(<PostCard post={post} />);
    const links = screen.getAllByRole('link', { name: 'Ver perfil de Bia' });
    expect(links).toHaveLength(2);
    await fireEvent.press(links[0]);
    await fireEvent.press(links[1]);
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/user/u2');
  });

  it('no post: o resto da linha abre o post, não o perfil', async () => {
    const onPress = jest.fn();
    await render(<PostCard post={post} onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('post-row'));
    expect(onPress).toHaveBeenCalledWith(post);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('no post: a foto não estica até o fim da linha (abaixo dela já é o post)', async () => {
    await render(<PostCard post={post} />);
    const [photo] = screen.getAllByRole('link', { name: 'Ver perfil de Bia' });
    expect(StyleSheet.flatten(photo.props.style)).toMatchObject({ alignSelf: 'flex-start' });
  });

  it('no perfil da própria pessoa o post não vira link (não empilha o mesmo perfil)', async () => {
    await render(<PostCard post={post} linkAuthor={false} />);
    expect(screen.queryByRole('link', { name: 'Ver perfil de Bia' })).toBeNull();
    expect(screen.getByText('Bia')).toBeTruthy();
  });

  it('no comentário: foto e nome', async () => {
    await render(<CommentItem comment={comment} />);
    const links = screen.getAllByRole('link', { name: 'Ver perfil de Bia' });
    expect(links).toHaveLength(2);
    await fireEvent.press(links[1]);
    expect(mockPush).toHaveBeenCalledWith('/user/u2');
  });
});

describe('/user/<id>', () => {
  it('de outra pessoa mostra o perfil', async () => {
    await render(<UserProfileScreen />);
    expect(screen.getByText('perfil')).toBeTruthy();
  });

  it('o meu vai pra aba Perfil', async () => {
    mockId = 'me';
    await render(<UserProfileScreen />);
    expect(screen.getByText('redirect:/profile')).toBeTruthy();
  });
});
