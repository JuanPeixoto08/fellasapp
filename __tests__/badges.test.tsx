import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));

import { PostCard } from '../components/PostCard';
import { CommentItem } from '../components/feed/CommentItem';
import { MemberRow } from '../components/profile/MemberRow';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { VerifiedBadge } from '../components/ui';
import { hasBadge } from '../lib/badges';
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

describe('hasBadge', () => {
  it('acha o selo na lista; sem lista é false', () => {
    expect(hasBadge(['verified'], 'verified')).toBe(true);
    expect(hasBadge([], 'verified')).toBe(false);
    expect(hasBadge(undefined, 'verified')).toBe(false);
    expect(hasBadge(null, 'verified')).toBe(false);
  });
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
