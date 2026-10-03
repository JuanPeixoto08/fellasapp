import type { ReactionSummary } from './api/reactions';

type Reactable = { reactions: ReactionSummary[]; myReaction: string | null };

type Likeable = { likedByMe: boolean; likeCount: number };

/** Curtida otimista: aplica o estado `liked` ajustando a contagem (idempotente). */
export function withLike<T extends Likeable>(item: T, liked: boolean): T {
  if (item.likedByMe === liked) return item;
  return { ...item, likedByMe: liked, likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)) };
}

/** Emoji a enviar à API: tocar na reação atual remove (null). */
export function nextReaction(current: string | null, picked: string): string | null {
  return picked === current ? null : picked;
}

/** Recalcula localmente counts/myReaction ao setar, trocar ou remover (`null`). */
export function withReaction<T extends Reactable>(item: T, emoji: string | null): T {
  const counts = new Map(item.reactions.map((r) => [r.emoji, r.count]));
  if (item.myReaction) {
    const left = (counts.get(item.myReaction) ?? 1) - 1;
    if (left > 0) counts.set(item.myReaction, left);
    else counts.delete(item.myReaction);
  }
  if (emoji) counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  const reactions = [...counts.entries()]
    .map(([e, count]) => ({ emoji: e, count }))
    .sort((a, b) => b.count - a.count);
  return { ...item, reactions, myReaction: emoji };
}
