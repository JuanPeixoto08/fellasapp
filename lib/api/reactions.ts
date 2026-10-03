import { supabase } from '../supabase';

export { QUICK_REACTIONS as REACTION_EMOJIS } from '../emoji';

/** Mesmo limite do banco (0004): 1 a 16 code points e sem espaço, para não virar texto livre. */
export function isValidReactionEmoji(emoji: string): boolean {
  const points = [...emoji].length;
  return points >= 1 && points <= 16 && !/\s/.test(emoji);
}

function assertEmoji(emoji: string): void {
  if (!isValidReactionEmoji(emoji)) throw new Error('Reação inválida');
}

export type ReactionSummary = { emoji: string; count: number };

export type ReactionRow = { user_id: string; emoji: string };

export type ReactionGroup = {
  reactions: ReactionSummary[];
  myReaction: string | null;
};

export const NO_REACTIONS: ReactionGroup = { reactions: [], myReaction: null };

/** Agrupa reações por emoji (maior contagem primeiro) e acha a do usuário. */
export function summarizeReactions(
  rows: ReactionRow[],
  myUserId: string,
): ReactionGroup {
  const counts = new Map<string, number>();
  let myReaction: string | null = null;
  for (const r of rows) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    if (r.user_id === myUserId) myReaction = r.emoji;
  }
  const reactions = [...counts.entries()]
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);
  return { reactions, myReaction };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Não autenticado');
  return data.user.id;
}

/** Define (ou troca) a reação do usuário no post; `null` remove. */
export async function setPostReaction(
  postId: string,
  emoji: string | null,
): Promise<void> {
  if (emoji !== null) assertEmoji(emoji);
  const userId = await currentUserId();
  if (emoji === null) {
    const { error } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('post_reactions')
    .upsert(
      { post_id: postId, user_id: userId, emoji },
      { onConflict: 'post_id,user_id' },
    );
  if (error) throw error;
}

/** Define (ou troca) a reação do usuário no comentário; `null` remove. */
export async function setCommentReaction(
  commentId: string,
  emoji: string | null,
): Promise<void> {
  if (emoji !== null) assertEmoji(emoji);
  const userId = await currentUserId();
  if (emoji === null) {
    const { error } = await supabase
      .from('comment_reactions')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('comment_reactions')
    .upsert(
      { comment_id: commentId, user_id: userId, emoji },
      { onConflict: 'comment_id,user_id' },
    );
  if (error) throw error;
}

function groupBy(
  rows: { id: string; user_id: string; emoji: string }[],
  userId: string,
): Map<string, ReactionGroup> {
  const byId = new Map<string, ReactionRow[]>();
  for (const r of rows) {
    const list = byId.get(r.id) ?? [];
    list.push(r);
    byId.set(r.id, list);
  }
  const out = new Map<string, ReactionGroup>();
  for (const [id, list] of byId) out.set(id, summarizeReactions(list, userId));
  return out;
}

/** Reações de vários posts em um select só (id do post -> resumo). */
export async function postReactionsMap(
  userId: string,
  postIds: string[],
): Promise<Map<string, ReactionGroup>> {
  if (postIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('post_reactions')
    .select('post_id, user_id, emoji')
    .in('post_id', postIds);
  if (error) throw error;
  return groupBy(
    (data ?? []).map((r) => ({ id: r.post_id, user_id: r.user_id, emoji: r.emoji })),
    userId,
  );
}

/** Reações de vários comentários em um select só (id do comentário -> resumo). */
export async function commentReactionsMap(
  userId: string,
  commentIds: string[],
): Promise<Map<string, ReactionGroup>> {
  if (commentIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('comment_reactions')
    .select('comment_id, user_id, emoji')
    .in('comment_id', commentIds);
  if (error) throw error;
  return groupBy(
    (data ?? []).map((r) => ({ id: r.comment_id, user_id: r.user_id, emoji: r.emoji })),
    userId,
  );
}
