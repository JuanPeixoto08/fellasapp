import { fireEvent, render, screen } from '@testing-library/react-native';

import { PostCard } from '../components/PostCard';
import type { FeedPost } from '../lib/api/posts';

jest.mock('../lib/supabase', () => ({ supabase: {} }));

const post: FeedPost = {
  id: 'p1',
  body: 'Olá galera',
  images: [],
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
  it('shows Descurtir (selected) when liked', async () => {
    await render(<PostCard post={{ ...post, likedByMe: true }} />);
    expect(screen.getByLabelText('Descurtir').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('hides zero counts, like on Twitter', async () => {
    await render(<PostCard post={{ ...post, likeCount: 0, commentCount: 0 }} />);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getByLabelText('Curtir')).toBeTruthy();
  });
});

describe('PostCard hover', () => {
  it('no celular não registra eventos de ponteiro (toque não pode acender a linha do post)', async () => {
    await render(<PostCard post={post} />);
    const row = screen.getByTestId('post-row');
    expect(row.props.onPointerEnter).toBeUndefined();
    expect(row.props.onPointerLeave).toBeUndefined();
  });
});

describe('PostCard layout', () => {
  it('shows the date and time next to the name', async () => {
    await render(<PostCard post={{ ...post, createdAt: '2025-02-07T12:00:00Z' }} />);
    // a hora depende do fuso de quem roda o teste
    expect(screen.getByText(/^7 fev 2025 \d{2}:\d{2}$/)).toBeTruthy();
  });

  it('shows my reaction in place of the react face', async () => {
    await render(<PostCard post={{ ...post, reactions: [{ emoji: '😂', count: 2 }], myReaction: '😂' }} />);
    const button = screen.getByLabelText('Reagir');
    expect(button.props.accessibilityHint).toMatch(/Sua reação: 😂/);
  });

  it('a photo opens the post when there is no image handler', async () => {
    const onPress = jest.fn();
    const withPhoto = { ...post, images: ['https://x/a.jpg'], imageUrl: 'https://x/a.jpg' };
    await render(<PostCard post={withPhoto} onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Foto postada por Ana'));
    expect(onPress).toHaveBeenCalledWith(withPhoto);
  });
});

describe('PostCard reactions', () => {
  it('renders the reaction bar', async () => {
    await render(<PostCard post={{ ...post, reactions: [{ emoji: '❤️', count: 3 }], myReaction: null }} />);
    expect(screen.getByLabelText('❤️ 3 reações')).toBeTruthy();
  });

  it('picks an emoji via the React button', async () => {
    const onReact = jest.fn();
    await render(<PostCard post={post} onReact={onReact} />);
    await fireEvent.press(screen.getByLabelText('Reagir'));
    await fireEvent.press(screen.getByLabelText('Reagir com 😂'));
    expect(onReact).toHaveBeenCalledWith(post, '😂');
  });

  it('opens the picker on long press', async () => {
    const onReact = jest.fn();
    await render(<PostCard post={post} onReact={onReact} />);
    await fireEvent(screen.getByLabelText('Abrir post de Ana'), 'longPress');
    await fireEvent.press(screen.getByLabelText('Reagir com 👍'));
    expect(onReact).toHaveBeenCalledWith(post, '👍');
  });

  it('removes my reaction when tapping my chip or the same emoji', async () => {
    const onReact = jest.fn();
    const mine = { ...post, reactions: [{ emoji: '❤️', count: 1 }], myReaction: '❤️' };
    await render(<PostCard post={mine} onReact={onReact} />);
    await fireEvent.press(screen.getByLabelText('❤️ 1 reação'));
    expect(onReact).toHaveBeenLastCalledWith(mine, null);
    await fireEvent.press(screen.getByLabelText('Reagir'));
    await fireEvent.press(screen.getByLabelText('Reagir com ❤️'));
    expect(onReact).toHaveBeenLastCalledWith(mine, null);
  });
});
