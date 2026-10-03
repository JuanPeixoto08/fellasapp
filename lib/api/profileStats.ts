import { supabase } from '../supabase';

export type ProfileStats = {
  posts: number;
  likesReceived: number;
  commentsReceived: number;
  /** profiles.created_at (ISO). */
  memberSince: string | null;
};

/** Estatísticas do perfil via contagens (head: true) e inner join nos posts do autor. */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [posts, likes, comments, profile] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    supabase
      .from('likes')
      .select('post_id, posts!inner(author_id)', { count: 'exact', head: true })
      .eq('posts.author_id', userId),
    supabase
      .from('comments')
      .select('id, posts!inner(author_id)', { count: 'exact', head: true })
      .eq('posts.author_id', userId),
    supabase.from('profiles').select('created_at').eq('id', userId).single(),
  ]);
  if (posts.error) throw posts.error;
  if (likes.error) throw likes.error;
  if (comments.error) throw comments.error;
  if (profile.error) throw profile.error;
  return {
    posts: posts.count ?? 0,
    likesReceived: likes.count ?? 0,
    commentsReceived: comments.count ?? 0,
    memberSince: profile.data?.created_at ?? null,
  };
}
