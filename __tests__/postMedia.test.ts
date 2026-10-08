import {
  MAX_REVIEW_TEXT,
  matchReviewLink,
  ratingStars,
  toPostMedia,
  trackMedia,
  type ReviewMedia,
} from '../lib/postMedia';

const review: ReviewMedia = {
  kind: 'review',
  title: 'A Story of Yonosuke',
  year: 2013,
  rating: 4,
  liked: true,
  rewatch: false,
  watched: '2025-12-30',
  poster: 'https://a.ltrbxd.com/resized/film-poster/1/2/3-0-600-0-900-crop.jpg?v=1',
  url: 'https://letterboxd.com/oliveira/film/a-story-of-yonosuke/',
  text: 'Parece abrir um álbum de fotos antigo.\n\nNada nele é alto ou urgente.',
  spoiler: false,
};

describe('trackMedia (música do Last.fm → anexo)', () => {
  const track = {
    name: 'Espresso',
    artist: 'Sabrina Carpenter',
    album: 'Short n’ Sweet',
    image: 'https://lastfm-img.freetls.fastly.net/i/u/300x300/abc.jpg',
    url: 'https://www.last.fm/music/Sabrina+Carpenter/_/Espresso',
    playedAt: null,
    nowPlaying: true,
  };

  it('monta o anexo congelado', () => {
    expect(trackMedia(track)).toEqual({
      kind: 'track',
      title: 'Espresso',
      artist: 'Sabrina Carpenter',
      album: 'Short n’ Sweet',
      image: 'https://lastfm-img.freetls.fastly.net/i/u/300x300/abc.jpg',
      url: 'https://www.last.fm/music/Sabrina+Carpenter/_/Espresso',
      live: true,
    });
  });

  it('capa de outro host vira null (o post não falha por causa dela)', () => {
    expect(trackMedia({ ...track, image: 'https://evil.example/p.gif' })?.image).toBeNull();
  });

  it('link que não é do Last.fm: sem anexo', () => {
    expect(trackMedia({ ...track, url: 'javascript:alert(1)' })).toBeNull();
  });
});

describe('toPostMedia (o que vem do banco, conferido de novo antes de desenhar)', () => {
  it('review válida passa igual', () => expect(toPostMedia(review)).toEqual(review));

  it('pôster ou link de outro host: recusa', () => {
    expect(toPostMedia({ ...review, poster: 'https://evil.example/p.gif' })).toBeNull();
    expect(toPostMedia({ ...review, url: 'https://evil.example/film/x/' })).toBeNull();
  });

  it('campos opcionais faltando: continua valendo', () => {
    expect(toPostMedia({ ...review, year: null, rating: null, poster: null, watched: null })).toMatchObject({
      year: null,
      rating: null,
      poster: null,
    });
  });

  it('nota fora de 0.5–5 ou fora dos meios: recusa', () => {
    expect(toPostMedia({ ...review, rating: 6 })).toBeNull();
    expect(toPostMedia({ ...review, rating: 3.3 })).toBeNull();
  });

  it('texto grande demais: recusa', () => {
    expect(toPostMedia({ ...review, text: 'a'.repeat(MAX_REVIEW_TEXT + 1) })).toBeNull();
  });

  it('lixo: null', () => {
    expect(toPostMedia(null)).toBeNull();
    expect(toPostMedia({ kind: 'outro' })).toBeNull();
    expect(toPostMedia('oi')).toBeNull();
  });
});

describe('ratingStars', () => {
  it('cheias e meia', () => {
    expect(ratingStars(4)).toEqual({ full: 4, half: false });
    expect(ratingStars(3.5)).toEqual({ full: 3, half: true });
    expect(ratingStars(0.5)).toEqual({ full: 0, half: true });
    expect(ratingStars(null)).toEqual({ full: 0, half: false });
  });
});

describe('matchReviewLink (link colado → qual review sua)', () => {
  it('review sua: devolve o endereço normalizado', () => {
    expect(matchReviewLink('https://letterboxd.com/Oliveira/film/a-story-of-yonosuke/', 'oliveira')).toEqual({
      url: 'https://letterboxd.com/oliveira/film/a-story-of-yonosuke/',
    });
    expect(matchReviewLink('letterboxd.com/oliveira/film/a-story-of-yonosuke', 'oliveira')).toEqual({
      url: 'https://letterboxd.com/oliveira/film/a-story-of-yonosuke/',
    });
    expect(matchReviewLink('https://www.letterboxd.com/oliveira/film/a-story-of-yonosuke/2/', 'oliveira')).toEqual({
      url: 'https://letterboxd.com/oliveira/film/a-story-of-yonosuke/2/',
    });
  });

  it('review de outra pessoa: erro próprio', () => {
    expect(matchReviewLink('https://letterboxd.com/ana/film/x/', 'oliveira')).toEqual({ error: 'not_yours' });
  });

  it('link curto boxd.it ou outra coisa: erro próprio', () => {
    expect(matchReviewLink('https://boxd.it/abc', 'oliveira')).toEqual({ error: 'short_link' });
    expect(matchReviewLink('https://letterboxd.com/film/x/', 'oliveira')).toEqual({ error: 'not_review' });
    expect(matchReviewLink('oi', 'oliveira')).toEqual({ error: 'not_review' });
  });
});
