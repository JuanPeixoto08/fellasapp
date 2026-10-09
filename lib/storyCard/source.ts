import type { FeedPoll, FeedPost } from '../api/posts';
import { postTime } from '../format';
import { splitMentions } from '../mentions';
import { pollPercents, pollTimeLeft, pollWinners, votesLabel } from '../polls';
import type { PostMedia } from '../postMedia';

/** Pedaço do texto do post; `highlight` = menção de fella, #tag ou link (em `brand`, como no app). */
export type Segment = { text: string; highlight: boolean };
export type PollSource = { options: string[]; percents: number[]; winners: number[]; footer: string };
/** Ingresso em versão mini: capa/pôster, título e linhas de detalhe. */
export type TicketSource = { kind: 'track' | 'review'; image: string | null; title: string; lines: string[] };

/** O que entra no recorte, já em texto pronto (sem nada de desenho). */
export type CardSource = {
  name: string;
  username: string;
  avatarUrl: string | null;
  time: string;
  location: string | null;
  segments: Segment[];
  bodyLength: number;
  photoUrl: string | null;
  extraPhotos: number;
  poll: PollSource | null;
  ticket: TicketSource | null;
};

/** O post como vai para a imagem do story. */
export function cardSource<M>(post: FeedPost, byUsername: Map<string, M>, now: Date = new Date()): CardSource {
  const body = post.body.trim();
  return {
    name: post.author.display_name || post.author.username,
    username: post.author.username,
    avatarUrl: post.author.avatar_url ?? null,
    time: postTime(post.createdAt, now),
    location: post.location ?? null,
    segments: body
      ? splitMentions(body, byUsername, { tags: true }).map((p) => ({ text: p.text, highlight: !!(p.member || p.tag || p.url) }))
      : [],
    bodyLength: Array.from(body).length,
    photoUrl: post.images[0] ?? null,
    extraPhotos: Math.max(0, post.images.length - 1),
    poll: post.poll ? pollSource(post.poll, now) : null,
    ticket: post.media ? ticketSource(post.media) : null,
  };
}

function pollSource(poll: FeedPoll, now: Date): PollSource {
  const total = poll.counts.reduce((a, b) => a + b, 0);
  const closed = pollTimeLeft(poll.endsAt, now.getTime()) === null;
  return {
    options: poll.options,
    percents: pollPercents(poll.counts),
    winners: pollWinners(poll.counts),
    footer: closed ? `${votesLabel(total)} · Resultado final` : votesLabel(total),
  };
}

/** 4,5 → "★★★★½". */
function stars(rating: number): string {
  const full = Math.floor(rating);
  return '★'.repeat(full) + (rating - full >= 0.5 ? '½' : '');
}

function ticketSource(m: PostMedia): TicketSource {
  if (m.kind === 'track') return { kind: 'track', image: m.image, title: m.title, lines: m.album ? [m.artist, m.album] : [m.artist] };
  const line = [m.year !== null ? String(m.year) : null, m.rating !== null ? stars(m.rating) : null, m.liked ? '♥' : null]
    .filter((x): x is string => x !== null)
    .join(' · ');
  return { kind: 'review', image: m.poster, title: m.title, lines: line ? [line] : [] };
}
