import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));

import { PostCard } from '../components/PostCard';
import { CommentItem } from '../components/feed/CommentItem';
import { MemberRow } from '../components/profile/MemberRow';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { VerifiedBadge } from '../components/ui';
import { badgeLabel, ownBadges, shownBadge } from '../lib/badges';
import type { Comment, FeedPost } from '../lib/api/posts';
import type { Profile } from '../lib/api/profiles';

const author = (badges?: string[]) => ({ id: 'u1', username: 'oliveira', display_name: 'Juan', avatar_url: null, badges });
const post = (badges?: string[]): FeedPost => ({
  id: 'p1',
  body: 'oi',
  images: [],
  imageUrl: null,
  createdAt: '2026-10-06T12:00:00Z',
  author: author(badges),
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
});
const comment = (badges?: string[]): Comment => ({
  id: 'c1',
  body: 'boa',
  createdAt: '2026-10-06T12:00:00Z',
  author: author(badges),
  reactions: [],
  myReaction: null,
});
const profile = (badges: string[]) =>
  ({
    id: 'u1',
    username: 'oliveira',
    display_name: 'Juan',
    avatar_url: null,
    banner_url: null,
    bio: null,
    status: null,
    location: null,
    birthday: null,
    is_member: true,
    is_admin: true,
    pinned_post_id: null,
    created_at: '2026-10-01T00:00:00Z',
    notifications_seen_at: '2026-10-01T00:00:00Z',
    badges,
  }) as Profile;

describe('shownBadge', () => {
  it('mostra o selo escolhido', () => expect(shownBadge(['verified'], 'verified')).toBe('verified'));
  it('sem escolha: o primeiro selo que a pessoa tem', () => expect(shownBadge(['verified'], null)).toBe('verified'));
  it('escolheu um selo que não tem mais: cai no primeiro que tem', () =>
    expect(shownBadge(['verified'], 'xyz')).toBe('verified'));
  it('sem selo: nenhum (mesmo com escolha antiga)', () => {
    expect(shownBadge([], 'verified')).toBeNull();
    expect(shownBadge(undefined, undefined)).toBeNull();
  });
  it('selo que o app não conhece não aparece', () => expect(shownBadge(['xyz'], 'xyz')).toBeNull());
});

describe('ownBadges', () => {
  it('só os selos que o app conhece, na ordem', () => expect(ownBadges(['xyz', 'verified'])).toEqual(['verified']));
  it('campo faltando', () => expect(ownBadges(null)).toEqual([]));
});

describe('badgeLabel', () => {
  it('nome do selo', () => expect(badgeLabel('verified')).toBe('Verificado'));
});

describe('VerifiedBadge', () => {
  it('diz "Verificado" pro leitor de tela', async () => {
    await render(<VerifiedBadge />);
    expect(screen.getByLabelText('Verificado')).toBeTruthy();
  });
});

describe('selo ao lado do nome', () => {
  it('post: com selo e sem selo', async () => {
    const view = await render(<PostCard post={post(['verified'])} />);
    expect(screen.getByLabelText('Verificado')).toBeTruthy();
    await view.rerender(<PostCard post={post()} />);
    expect(screen.queryByLabelText('Verificado')).toBeNull();
  });

  it('comentário', async () => {
    const view = await render(<CommentItem comment={comment(['verified'])} />);
    expect(screen.getByLabelText('Verificado')).toBeTruthy();
    await view.rerender(<CommentItem comment={comment([])} />);
    expect(screen.queryByLabelText('Verificado')).toBeNull();
  });

  it('linha de membro', async () => {
    const view = await render(<MemberRow member={profile(['verified'])} onPress={() => {}} />);
    expect(screen.getByLabelText('Verificado')).toBeTruthy();
    await view.rerender(<MemberRow member={profile([])} onPress={() => {}} />);
    expect(screen.queryByLabelText('Verificado')).toBeNull();
  });

  it('cabeçalho do perfil', async () => {
    const view = await render(<ProfileHeader profile={profile(['verified'])} avatarUri={null} />);
    expect(screen.getByLabelText('Verificado')).toBeTruthy();
    await view.rerender(<ProfileHeader profile={profile([])} avatarUri={null} />);
    expect(screen.queryByLabelText('Verificado')).toBeNull();
  });
});
