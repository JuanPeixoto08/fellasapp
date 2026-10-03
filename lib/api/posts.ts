import { supabase } from '../supabase';
import type { Tables } from '../../types/database';
import {
  NO_REACTIONS,
  commentReactionsMap,
  postReactionsMap,
  type ReactionGroup,
  type ReactionSummary,
} from './reactions';

export const PAGE_SIZE = 10;
const BUCKET = 'post-images';
const SIGNED_URL_TTL = 60 * 60;

export type Author = Pick<
  Tables<'profiles'>,
  'id' | 'username' | 'display_name' | 'avatar_url'
>;

export type FeedPost = {
  id: string;
  body: string;
  /** URL assinada (bucket privado) pronta para exibir, ou null. */
  imageUrl: string | null;
  createdAt: string;
  author: Author;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  reactions: ReactionSummary[];
  myReaction: string | null;
};

export type FeedPage = { posts: FeedPost[]; nextCursor: string | null };

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
  reactions: ReactionSummary[];
  myReaction: string | null;
};

type PostRow = Tables<'posts'> & {
  author: Author | null;
  likes: { count: number }[] | null;
  comments: { count: number }[] | null;
};

const AUTHOR_COLUMNS = 'id, username, display_name, avatar_url';
const POST_SELECT = `*, author:profiles!posts_author_id_fkey(${AUTHOR_COLUMNS}), likes(count), comments(count)`;

const unknownAuthor = (id: string): Author => ({
  id,
  username: 'desconhecido',
  display_name: null,
  avatar_url: null,
});

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Não autenticado');
  return data.user.id;
}

async function signImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

async function mapPost(
  row: PostRow,
  liked: Set<string>,
  reactions: Map<string, ReactionGroup>,
): Promise<FeedPost> {
  const r = reactions.get(row.id) ?? NO_REACTIONS;
  return {
    id: row.id,
    body: row.body,
    imageUrl: await signImage(row.image_url),
    createdAt: row.created_at,
    author: row.author ?? unknownAuthor(row.author_id),
    likeCount: row.likes?.[0]?.count ?? 0,
    commentCount: row.comments?.[0]?.count ?? 0,
    likedByMe: liked.has(row.id),
    reactions: r.reactions,
    myReaction: r.myReaction,
  };
}

async function likedSet(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  if (error) throw error;
  return new Set((data ?? []).map((l) => l.post_id));
}

/** Feed paginado por created_at (mais novos primeiro). `cursor` = created_at do último item. */
export async function listFeed(
  { cursor }: { cursor?: string | null } = {},
): Promise<FeedPage> {
  const userId = await currentUserId();
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as PostRow[];
  const ids = rows.map((r) => r.id);
  const [liked, reactions] = await Promise.all([
    likedSet(userId, ids),
    postReactionsMap(userId, ids),
  ]);
  const posts = await Promise.all(rows.map((r) => mapPost(r, liked, reactions)));
  return {
    posts,
    nextCursor:
      rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
  };
}

export async function getPost(postId: string): Promise<FeedPost> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .single();
  if (error) throw error;
  const [liked, reactions] = await Promise.all([
    likedSet(userId, [postId]),
    postReactionsMap(userId, [postId]),
  ]);
  return mapPost(data as unknown as PostRow, liked, reactions);
}

async function uploadImage(userId: string, uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function createPost({
  body,
  imageUri,
}: {
  body: string;
  imageUri?: string | null;
}): Promise<Tables<'posts'>> {
  const text = body.trim();
  if (!text && !imageUri) throw new Error('Escreva algo ou escolha uma imagem');
  const userId = await currentUserId();
  const image_url = imageUri ? await uploadImage(userId, imageUri) : null;
  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: userId, body: text, image_url })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Curte/descurte. Retorna o novo estado (true = curtido). */
export async function toggleLike(postId: string): Promise<boolean> {
  const userId = await currentUserId();
  const { data: existing, error: selectError } = await supabase
    .from('likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase
    .from('likes')
    .insert({ post_id: postId, user_id: userId });
  if (error) throw error;
  return true;
}

export async function listComments(postId: string): Promise<Comment[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('comments')
    .select(
      `id, body, created_at, author_id, author:profiles!comments_author_id_fkey(${AUTHOR_COLUMNS})`,
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  type Row = {
    id: string;
    body: string;
    created_at: string;
    author_id: string;
    author: Author | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const reactions = await commentReactionsMap(userId, rows.map((c) => c.id));
  return rows.map((c) => {
    const r = reactions.get(c.id) ?? NO_REACTIONS;
    return {
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      author: c.author ?? unknownAuthor(c.author_id),
      reactions: r.reactions,
      myReaction: r.myReaction,
    };
  });
}

export async function addComment(
  postId: string,
  body: string,
): Promise<Tables<'comments'>> {
  const text = body.trim();
  if (!text) throw new Error('Comentário vazio');
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, author_id: userId, body: text })
    .select()
    .single();
  if (error) throw error;
  return data;
}
