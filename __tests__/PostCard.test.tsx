import { fireEvent, render, screen } from '@testing-library/react-native';

import { PostCard } from '../components/PostCard';
import type { FeedPost } from '../lib/api/posts';

jest.mock('../lib/supabase', () => ({ supabase: {} }));

const post: FeedPost = {
  id: 'p1',
  body: 'Olá galera',
  imageUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  author: { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: null },
  likeCount: 4,
  commentCount: 7,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};

describe('PostCard', () => {
  it('renders author, text and counts', async () => {
    await render(<PostCard post={post} />);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Olá galera')).toBeTruthy();
    expect(screen.getByText(/4/)).toBeTruthy();
    expect(screen.getByText(/7/)).toBeTruthy();
  });

  it('calls onToggleLike', async () => {
    const onToggleLike = jest.fn();
    await render(<PostCard post={post} onToggleLike={onToggleLike} />);
    await fireEvent.press(screen.getByLabelText('Curtir'));
    expect(onToggleLike).toHaveBeenCalledWith(post);
  });
});

describe('PostCard like state', () => {
  it('shows liked label and Descurtir when liked', async () => {
    await render(<PostCard post={{ ...post, likedByMe: true }} />);
    expect(screen.getByLabelText('Descurtir')).toBeTruthy();
    expect(screen.getByText(/Curtiu/)).toBeTruthy();
  });
});
