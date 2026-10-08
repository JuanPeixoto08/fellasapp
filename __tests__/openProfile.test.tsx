import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockPush = jest.fn();
let mockParams: Record<string, string> = { id: 'u2' };
jest.mock('expo-router', () => {
  const { Text: RNText } = require('react-native');
  return {
    router: { push: (href: string) => mockPush(href) },
    useLocalSearchParams: () => mockParams,
    Stack: { Screen: () => null },
    Redirect: ({ href }: { href: string }) => <RNText>{`redirect:${href}`}</RNText>,
    useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(cb, [cb]),
  };
});
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  getNowPlaying: async () => ({ name: 'Espresso', artist: 'Sabrina', album: null, image: null, url: 'u', playedAt: null, nowPlaying: true }),
}));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../components/ProfileView', () => {
  const { Text: RNText } = require('react-native');
  return {
    __esModule: true,
    default: ({ userId, initialTab }: { userId: string; initialTab?: string }) => (
      <RNText>{`perfil:${userId}${initialTab ? `:${initialTab}` : ''}`}</RNText>
    ),
  };
});
const mockGetProfile = jest.fn();
const mockByUsername = jest.fn();
jest.mock('../lib/api/profiles', () => ({
  getProfile: (id: string) => mockGetProfile(id),
  getProfileByUsername: (u: string) => mockByUsername(u),
}));

import { PostCard } from '../components/PostCard';
import { CommentItem } from '../components/feed/CommentItem';
import HandleScreen from '../app/[handle]';
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
  mockParams = { id: 'u2' };
  mockGetProfile.mockResolvedValue({ id: 'u2', username: 'bia' });
  mockByUsername.mockResolvedValue({ id: 'u2', username: 'bia' });
});

describe('foto e nome do autor abrem o perfil', () => {
  it('no post: foto e nome', async () => {
    await render(<PostCard post={post} />);
    const links = screen.getAllByRole('link', { name: 'Ver perfil de Bia' });
    expect(links).toHaveLength(2);
    await fireEvent.press(links[0]);
    await fireEvent.press(links[1]);
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/@bia');
  });

  it('no post: tocar no "ouvindo" abre a aba Música do autor', async () => {
    await render(<PostCard post={{ ...post, author: { ...author, lastfm_user: 'biafm' } }} />);
    await fireEvent.press(await screen.findByRole('link', { name: 'Ouvindo Espresso, de Sabrina' }));
    expect(mockPush).toHaveBeenCalledWith('/@bia?aba=musica');
  });

  it('no perfil da própria pessoa (nome sem link): o "ouvindo" só mostra', async () => {
    await render(<PostCard post={{ ...post, author: { ...author, lastfm_user: 'biafm' } }} linkAuthor={false} />);
    expect(await screen.findByLabelText('Ouvindo Espresso, de Sabrina')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Ouvindo Espresso, de Sabrina' })).toBeNull();
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
    expect(mockPush).toHaveBeenCalledWith('/@bia');
  });
});

describe('/@usuario', () => {
  it('abre o perfil pelo @ (maiúscula no link também)', async () => {
    mockParams = { handle: '@Bia' };
    await render(<HandleScreen />);
    expect(await screen.findByText('perfil:u2')).toBeTruthy();
    expect(mockByUsername).toHaveBeenCalledWith('bia');
  });

  it('?aba=musica abre o perfil na aba Música', async () => {
    mockParams = { handle: '@bia', aba: 'musica' };
    await render(<HandleScreen />);
    expect(await screen.findByText('perfil:u2:music')).toBeTruthy();
  });

  it('o meu com ?aba=musica vai pra aba Perfil já na Música', async () => {
    mockParams = { handle: '@eu', aba: 'musica' };
    mockByUsername.mockResolvedValue({ id: 'me', username: 'eu' });
    await render(<HandleScreen />);
    expect(await screen.findByText('redirect:/profile?aba=musica')).toBeTruthy();
  });

  it('o meu vai pra aba Perfil', async () => {
    mockParams = { handle: '@eu' };
    mockByUsername.mockResolvedValue({ id: 'me', username: 'eu' });
    await render(<HandleScreen />);
    expect(await screen.findByText('redirect:/profile')).toBeTruthy();
  });

  it('@ que não existe (ou trocado): avisa', async () => {
    mockParams = { handle: '@sumiu' };
    mockByUsername.mockResolvedValue(null);
    await render(<HandleScreen />);
    expect(await screen.findByText('Esse perfil não existe')).toBeTruthy();
  });

  it('endereço sem @ não é perfil', async () => {
    mockParams = { handle: 'qualquercoisa' };
    await render(<HandleScreen />);
    expect(await screen.findByText('Essa página não existe')).toBeTruthy();
    expect(mockByUsername).not.toHaveBeenCalled();
  });

  it('falhou carregar: deixa tentar de novo', async () => {
    mockParams = { handle: '@bia' };
    mockByUsername.mockRejectedValueOnce(new Error('rede'));
    await render(<HandleScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('perfil:u2')).toBeTruthy();
  });
});

describe('/user/<id> (links antigos)', () => {
  it('de outra pessoa: vai para o @ dela', async () => {
    await render(<UserProfileScreen />);
    expect(await screen.findByText('redirect:/@bia')).toBeTruthy();
    expect(mockGetProfile).toHaveBeenCalledWith('u2');
  });

  it('o meu vai pra aba Perfil', async () => {
    mockParams = { id: 'me' };
    await render(<UserProfileScreen />);
    expect(screen.getByText('redirect:/profile')).toBeTruthy();
  });
});
