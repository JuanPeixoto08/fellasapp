import type { FeedPost } from '../lib/api/posts';
import { cardSource } from '../lib/storyCard/source';

jest.mock('../lib/supabase', () => ({ supabase: {} }));

const post: FeedPost = {
  id: 'p1',
  body: '  bora @juan no #rolê com o @ze  ',
  images: [],
  imageUrl: null,
  createdAt: '2026-10-09T10:00:00Z',
  author: { id: 'u1', username: 'caio', display_name: 'Caio Ramos', avatar_url: 'https://x/av.jpg' },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};
const members = new Map([['juan', { id: 'u2', username: 'juan', name: 'Juan', avatarUrl: null }]]);
const now = new Date('2026-10-09T12:00:00Z');

describe('cardSource', () => {
  it('autor, horário do app e local', () => {
    const s = cardSource({ ...post, location: 'Padaria do Zé' }, members, now);
    expect([s.name, s.username, s.avatarUrl, s.time, s.location]).toEqual(['Caio Ramos', 'caio', 'https://x/av.jpg', 'há 2 h', 'Padaria do Zé']);
  });

  it('sem nome de exibição, usa o @usuario', () => {
    expect(cardSource({ ...post, author: { ...post.author, display_name: null } }, members, now).name).toBe('caio');
  });

  it('texto sem espaços nas pontas; menção de fella e #tag destacadas, @ de quem não existe não', () => {
    const s = cardSource(post, members, now);
    expect(s.segments.map((p) => p.text).join('')).toBe('bora @juan no #rolê com o @ze');
    expect(s.segments.filter((p) => p.highlight).map((p) => p.text)).toEqual(['@juan', '#rolê']);
    expect(s.bodyLength).toBe(Array.from('bora @juan no #rolê com o @ze').length);
  });

  it('post sem texto: sem trechos', () => {
    expect(cardSource({ ...post, body: '   ' }, members, now).segments).toEqual([]);
  });

  it('primeira foto e quantas sobram', () => {
    const s = cardSource({ ...post, images: ['https://x/a.jpg', 'https://x/b.jpg', 'https://x/c.jpg'] }, members, now);
    expect([s.photoUrl, s.extraPhotos]).toEqual(['https://x/a.jpg', 2]);
    expect(cardSource(post, members, now).photoUrl).toBeNull();
  });

  it('enquete aberta: porcentagens, mais votada e total', () => {
    const s = cardSource({ ...post, poll: { options: ['sim', 'não'], counts: [3, 1], endsAt: '2026-10-10T12:00:00Z', myVote: null } }, members, now);
    expect(s.poll).toEqual({ options: ['sim', 'não'], percents: [75, 25], winners: [0], footer: '4 votos' });
  });

  it('enquete encerrada e sem votos', () => {
    const closed = cardSource({ ...post, poll: { options: ['a', 'b'], counts: [0, 0], endsAt: '2026-10-09T11:00:00Z', myVote: null } }, members, now);
    expect(closed.poll).toEqual({ options: ['a', 'b'], percents: [0, 0], winners: [], footer: '0 votos · Resultado final' });
  });

  it('música: capa, nome, artista e álbum', () => {
    const s = cardSource({ ...post, media: { kind: 'track', title: 'Tempo Perdido', artist: 'Legião Urbana', album: 'Dois', image: null, url: 'https://www.last.fm/music/x', live: false } }, members, now);
    expect(s.ticket).toEqual({ kind: 'track', image: null, title: 'Tempo Perdido', lines: ['Legião Urbana', 'Dois'] });
  });

  it('filme: pôster, título e "ano · estrelas · ♥"', () => {
    const s = cardSource({
      ...post,
      media: { kind: 'review', title: 'Ainda Estou Aqui', year: 2024, rating: 4.5, liked: true, rewatch: false, watched: null, poster: 'https://a.ltrbxd.com/p.jpg', url: 'https://letterboxd.com/x/film/y/', text: '', spoiler: false },
    }, members, now);
    expect(s.ticket).toEqual({ kind: 'review', image: 'https://a.ltrbxd.com/p.jpg', title: 'Ainda Estou Aqui', lines: ['2024 · ★★★★½ · ♥'] });
  });
});
