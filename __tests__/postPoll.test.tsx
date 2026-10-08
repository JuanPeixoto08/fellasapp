import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockVote = jest.fn();
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/api/posts', () => {
  const actual = jest.requireActual('../lib/api/posts');
  return { ...actual, votePoll: (postId: string, option: number) => mockVote(postId, option) };
});

import { PostPoll } from '../components/feed/PostPoll';
import { PostCard } from '../components/PostCard';
import { PollVoteError, type FeedPoll, type FeedPost } from '../lib/api/posts';

const NOW = Date.parse('2026-10-07T12:00:00Z');
const open: FeedPoll = { options: ['Sim', 'Não'], counts: [3, 1], endsAt: '2026-10-09T13:00:00Z', myVote: null };

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  mockVote.mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());

describe('PostPoll', () => {
  it('mostra as porcentagens antes de votar, o total e o tempo', async () => {
    await render(<PostPoll postId="p1" poll={open} />);
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByText('4 votos · faltam 2 dias')).toBeTruthy();
  });

  it('tocar numa opção vota na hora e marca a minha; depois não vota de novo', async () => {
    await render(<PostPoll postId="p1" poll={open} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Votar em Não' }));
    expect(mockVote).toHaveBeenCalledWith('p1', 1);
    expect(screen.getByText('5 votos · faltam 2 dias')).toBeTruthy();
    expect(screen.getAllByText('40%')).toHaveLength(1);
    expect(screen.getByLabelText('Não, 40%, seu voto')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Votar em/ })).toBeNull();
  });

  it('erro desfaz o voto e avisa', async () => {
    mockVote.mockRejectedValue(new PollVoteError('closed'));
    await render(<PostPoll postId="p1" poll={open} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Votar em Sim' }));
    await act(async () => {});
    expect(await screen.findByText('A enquete já acabou.')).toBeTruthy();
    expect(screen.getByText('4 votos · faltam 2 dias')).toBeTruthy();
  });

  it('já votei (vindo do banco): só mostra, com a minha marcada', async () => {
    await render(<PostPoll postId="p1" poll={{ ...open, myVote: 0 }} />);
    expect(screen.getByLabelText('Sim, 75%, seu voto')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Votar em/ })).toBeNull();
  });

  it('encerrada: "Resultado final" e não vota', async () => {
    await render(<PostPoll postId="p1" poll={{ ...open, endsAt: '2026-10-07T11:00:00Z' }} />);
    expect(screen.getByText('4 votos · Resultado final')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Votar em/ })).toBeNull();
  });

  it('o prazo vence com a enquete na tela: passa a "Resultado final"', async () => {
    await render(<PostPoll postId="p1" poll={{ ...open, endsAt: '2026-10-07T12:01:30Z' }} />);
    expect(screen.getByText('4 votos · falta 1 min')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(2 * 60_000);
    });
    expect(screen.getByText('4 votos · Resultado final')).toBeTruthy();
  });

  it('sem votos: 0% sem quebrar', async () => {
    await render(<PostPoll postId="p1" poll={{ ...open, counts: [0, 0] }} />);
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.getByText('0 votos · faltam 2 dias')).toBeTruthy();
  });
});

describe('PostCard com enquete', () => {
  const post: FeedPost = {
    id: 'p1',
    body: 'Bora?',
    images: [],
    imageUrl: null,
    createdAt: '2026-10-07T10:00:00Z',
    author: { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: null },
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    reactions: [],
    myReaction: null,
  };

  it('a enquete aparece depois do texto; votar não abre o post', async () => {
    const onPress = jest.fn();
    await render(<PostCard post={{ ...post, poll: open }} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Votar em Sim' }));
    expect(mockVote).toHaveBeenCalledWith('p1', 0);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('post sem enquete: nada de enquete', async () => {
    await render(<PostCard post={post} />);
    expect(screen.queryByText(/votos/)).toBeNull();
  });
});
