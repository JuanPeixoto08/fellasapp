import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
const mockNowPlaying = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  getNowPlaying: (user: string) => mockNowPlaying(user),
}));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { ...jest.requireActual('expo-router'), useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) };
});

import { PostTicket } from '../components/feed/PostTicket';
import { PostCard } from '../components/PostCard';
import type { FeedPost } from '../lib/api/posts';
import type { ReviewMedia, TrackMedia } from '../lib/postMedia';

const review: ReviewMedia = {
  kind: 'review',
  title: 'A Story of Yonosuke',
  year: 2013,
  rating: 3.5,
  liked: true,
  rewatch: true,
  watched: '2025-12-30',
  poster: 'https://a.ltrbxd.com/p.jpg',
  url: 'https://letterboxd.com/oliveira/film/a-story-of-yonosuke/',
  text: 'Parece abrir um álbum de fotos antigo.\n\nNada nele é alto ou urgente.',
  spoiler: false,
};
const track: TrackMedia = {
  kind: 'track',
  title: 'Espresso',
  artist: 'Sabrina Carpenter',
  album: 'Short n’ Sweet',
  image: 'https://lastfm-img.freetls.fastly.net/i/u/300x300/a.jpg',
  url: 'https://www.last.fm/music/Sabrina+Carpenter/_/Espresso',
  live: true,
};

let openSpy: jest.SpyInstance;
beforeEach(() => {
  openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  require('../lib/lastfm/nowPlayingStore').resetNowPlayingStore();
  mockNowPlaying.mockReset().mockResolvedValue({ name: 'Outra', artist: 'X', album: null, image: null, url: 'u', playedAt: null, nowPlaying: true });
});

describe('PostTicket: review', () => {
  it('sessão, título, ano · revi, estrelas com meia, coração e o texto', async () => {
    await render(<PostTicket media={review} />);
    expect(screen.getByText('Sessão · 30 dez 2025')).toBeTruthy();
    expect(screen.getByText('A Story of Yonosuke')).toBeTruthy();
    expect(screen.getByText('2013 · revi')).toBeTruthy();
    expect(screen.getByLabelText('3.5 de 5 estrelas')).toBeTruthy();
    expect(screen.getByLabelText('Curtiu o filme')).toBeTruthy();
    expect(screen.getByText(/Parece abrir um álbum/)).toBeTruthy();
  });

  it('"mais" abre a review inteira', async () => {
    await render(<PostTicket media={review} />);
    expect(screen.getByText(/Parece abrir/).props.numberOfLines).toBe(4);
    await fireEvent.press(screen.getByLabelText('Ler a review inteira'));
    expect(screen.getByText(/Parece abrir/).props.numberOfLines).toBeUndefined();
  });

  it('spoiler marcado: texto escondido até tocar', async () => {
    await render(<PostTicket media={{ ...review, spoiler: true }} />);
    expect(screen.queryByLabelText('Ler a review inteira')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Pode ter spoiler. Toque pra ler' }));
    expect(screen.getByLabelText('Ler a review inteira')).toBeTruthy();
  });

  it('sem marca de spoiler: nada escondido', async () => {
    await render(<PostTicket media={review} />);
    expect(screen.queryByRole('button', { name: 'Pode ter spoiler. Toque pra ler' })).toBeNull();
  });

  it('tocar no ingresso ou no link abre o Letterboxd', async () => {
    await render(<PostTicket media={review} />);
    await fireEvent.press(screen.getByRole('link', { name: 'Abrir no Letterboxd' }));
    expect(openSpy).toHaveBeenCalledWith(review.url);
  });

  it('sem nota, ano, pôster nem data: só o que tem', async () => {
    await render(<PostTicket media={{ ...review, rating: null, year: null, poster: null, watched: null, rewatch: false, liked: false }} />);
    expect(screen.getByText('A Story of Yonosuke')).toBeTruthy();
    expect(screen.queryByText(/Sessão/)).toBeNull();
    expect(screen.queryByLabelText(/estrelas/)).toBeNull();
    expect(screen.queryByLabelText('Pôster de A Story of Yonosuke')).toBeNull();
  });

  it('no compositor: ✕ tira e o link não aparece', async () => {
    const onRemove = jest.fn();
    await render(<PostTicket media={review} onRemove={onRemove} />);
    expect(screen.queryByRole('link', { name: 'Abrir no Letterboxd' })).toBeNull();
    await fireEvent.press(screen.getByLabelText('Tirar a review'));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('PostTicket: música', () => {
  it('tocando agora, música, artista; abre o Last.fm', async () => {
    await render(<PostTicket media={track} />);
    expect(screen.getByText('Tocando agora')).toBeTruthy();
    expect(screen.getByText('Espresso')).toBeTruthy();
    expect(screen.getByText('Sabrina Carpenter')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Abrir no Last.fm' }));
    expect(openSpy).toHaveBeenCalledWith(track.url);
  });

  it('anexada depois de tocar: "Ouvi"', async () => {
    await render(<PostTicket media={{ ...track, live: false }} />);
    expect(screen.getByText('Ouvi')).toBeTruthy();
  });

  it('vinil: a capa no envelope e no selo do disco, e o álbum embaixo do artista', async () => {
    await render(<PostTicket media={track} />);
    expect(screen.getByTestId('vinyl-sleeve', { includeHiddenElements: true }).props.source).toEqual({ uri: track.image });
    expect(screen.getByTestId('vinyl-label', { includeHiddenElements: true }).props.source).toEqual({ uri: track.image });
    expect(screen.getByText('Short n’ Sweet')).toBeTruthy();
  });

  it('o disco gira tocando agora e também já ouvida', async () => {
    const { Animated } = require('react-native');
    const loop = jest.spyOn(Animated, 'loop');
    await render(<PostTicket media={{ ...track, live: false }} />);
    expect(loop).toHaveBeenCalledTimes(1);
    loop.mockClear();
    await render(<PostTicket media={track} />);
    // 3 barrinhas do equalizador + o disco
    expect(loop).toHaveBeenCalledTimes(4);
    loop.mockRestore();
  });

  it('sem capa nem álbum: disco sem foto, só música e artista', async () => {
    await render(<PostTicket media={{ ...track, image: null, album: null }} />);
    expect(screen.queryByTestId('vinyl-sleeve', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('Espresso')).toBeTruthy();
    expect(screen.queryByText('Short n’ Sweet')).toBeNull();
  });
});

describe('PostCard com ingresso', () => {
  const post: FeedPost = {
    id: 'p1',
    body: '',
    images: [],
    imageUrl: null,
    createdAt: '2026-10-08T10:00:00Z',
    author: { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: null, lastfm_user: 'anafm' },
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    reactions: [],
    myReaction: null,
  };

  it('mostra o ingresso; post sem texto continua de pé', async () => {
    await render(<PostCard post={{ ...post, media: review }} />);
    expect(screen.getByTestId('post-ticket')).toBeTruthy();
  });

  it('com música anexada, a linha ao vivo do cabeçalho some (nada de duas músicas)', async () => {
    await render(<PostCard post={{ ...post, media: track }} />);
    expect(mockNowPlaying).not.toHaveBeenCalled();
  });

  it('com review anexada, a linha ao vivo continua', async () => {
    await render(<PostCard post={{ ...post, media: review }} />);
    expect(mockNowPlaying).toHaveBeenCalledWith('anafm');
  });
});
