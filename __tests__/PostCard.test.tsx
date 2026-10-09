import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PostCard } from '../components/PostCard';
import type { FeedPost } from '../lib/api/posts';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../components/share/StoryShareDialog', () => {
  const { Text } = require('react-native');
  return { StoryShareDialog: ({ visible }: { visible: boolean }) => (visible ? <Text>montador aberto</Text> : null) };
});
const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

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

  it('tocar na foto abre a foto (não o post); o resto do post continua abrindo o post', async () => {
    const onPress = jest.fn();
    const withPhotos = { ...post, images: ['https://x/a.jpg', 'https://x/b.gif'], imageUrl: 'https://x/a.jpg' };
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PostCard post={withPhotos} onPress={onPress} />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Foto postada por Ana (2 de 2)'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByText('2/2')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fechar fotos'));
    expect(screen.queryByText('2/2')).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('post-row'));
    expect(onPress).toHaveBeenCalledWith(withPhotos);
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

describe('PostCard fixado', () => {
  it('mostra "Fixado" e o alfinete vira desafixar', async () => {
    const onTogglePin = jest.fn();
    await render(<PostCard post={post} pinned onTogglePin={onTogglePin} />);
    expect(screen.getByText('Fixado')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Desafixar do perfil'));
    expect(onTogglePin).toHaveBeenCalledWith(post);
  });

  it('sem fixar: alfinete só com onTogglePin, sem etiqueta', async () => {
    await render(<PostCard post={post} onTogglePin={() => {}} />);
    expect(screen.queryByText('Fixado')).toBeNull();
    expect(screen.getByLabelText('Fixar no perfil')).toBeTruthy();
  });

  it('sem onTogglePin não tem alfinete (perfil dos outros, feed)', async () => {
    await render(<PostCard post={post} pinned />);
    expect(screen.getByText('Fixado')).toBeTruthy();
    expect(screen.queryByLabelText('Fixar no perfil')).toBeNull();
    expect(screen.queryByLabelText('Desafixar do perfil')).toBeNull();
  });
});

describe('PostCard selos', () => {
  it('mostra o selo do autor', async () => {
    await render(<PostCard post={{ ...post, author: { ...post.author, badges: ['verified'] } }} />);
    expect(screen.getByLabelText('Verificado')).toBeTruthy();
  });

  it('escolha antiga de um selo que não existe mais: mostra o que ele tem', async () => {
    await render(<PostCard post={{ ...post, author: { ...post.author, badges: ['verified'], featured_badge: 'xyz' } }} />);
    expect(screen.getByLabelText('Verificado')).toBeTruthy();
  });
});

const mockNowPlaying = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  hasLastfmKey: () => true,
  getNowPlaying: (user: string) => mockNowPlaying(user),
}));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    ...jest.requireActual('expo-router'),
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

describe('PostCard ouvindo agora', () => {
  const playing = { name: 'Espresso', artist: 'Sabrina Carpenter', album: null, image: null, url: 'u', playedAt: null, nowPlaying: true };
  beforeEach(() => {
    require('../lib/lastfm/nowPlayingStore').resetNowPlayingStore();
    mockNowPlaying.mockReset().mockResolvedValue(playing);
  });

  it('autor ouvindo algo: "ouvindo" + música ao lado do nome', async () => {
    await render(<PostCard post={{ ...post, author: { ...post.author, lastfm_user: 'anafm' } }} />);
    expect(await screen.findByLabelText('Ouvindo Espresso, de Sabrina Carpenter')).toBeTruthy();
    expect(screen.getByText('Espresso')).toBeTruthy();
    expect(mockNowPlaying).toHaveBeenCalledWith('anafm');
  });

  it('chave desligada: nada e nem pergunta ao Last.fm', async () => {
    await render(<PostCard post={{ ...post, author: { ...post.author, lastfm_user: 'anafm', show_now_playing: false } }} />);
    expect(screen.queryByText('Espresso')).toBeNull();
    expect(mockNowPlaying).not.toHaveBeenCalled();
  });

  it('sem Last.fm: nada', async () => {
    await render(<PostCard post={post} />);
    expect(screen.queryByText(/ouvindo/)).toBeNull();
    expect(mockNowPlaying).not.toHaveBeenCalled();
  });

  it('nada tocando: nada', async () => {
    mockNowPlaying.mockResolvedValue(null);
    await render(<PostCard post={{ ...post, author: { ...post.author, lastfm_user: 'anafm' } }} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/ouvindo/)).toBeNull();
  });
});

describe('PostCard compartilhar no story', () => {
  afterEach(() => jest.restoreAllMocks());

  it('na web, o botão abre o montador sem abrir o post', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const onPress = jest.fn();
    await render(<PostCard post={post} onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Compartilhar no story'));
    expect(screen.getByText('montador aberto')).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fora da web não aparece', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(<PostCard post={post} />);
    expect(screen.queryByLabelText('Compartilhar no story')).toBeNull();
  });
});
